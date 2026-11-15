#!/usr/bin/env node
// Puente HTTP local para el visor: `node scripts/mcp/puente-http.mjs`. Escucha solo en 127.0.0.1.
// - Host debe ser 127.0.0.1 o localhost (contra DNS rebinding); Origin, si viene, debe estar en la lista.
// - Todo POST exige el header X-Earth-Analogs: 1 (un formulario de otro sitio no puede ponerlo sin preflight).
// - La clave de IA llega en X-IA-Clave en cada solicitud, se reenvía al proveedor y no se guarda ni se registra.
// - El motor corre en carpetas propias (salidas/mcp/<id>); el puente nunca publica en el visor.

import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { archivoDeCorrida, ejecutarMotor, estadoCorrida, localizarBinarioPipeline, rutas } from './nucleo.mjs';
import { PROVEEDORES_IA, solicitudProveedor, textoProveedor } from './proveedores-ia.mjs';
import { ErrorValidacion, redactarSecretos } from './validacion.mjs';

const MAX_CUERPO = 1_000_000;

function origenesPermitidos(env) {
  const extra = (env.EA_PUENTE_ORIGENES ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return (origen) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/.test(origen) || extra.includes(origen);
}

function leerCuerpo(req) {
  return new Promise((resolve, reject) => {
    let n = 0;
    const partes = [];
    req.on('data', (c) => {
      n += c.length;
      if (n > MAX_CUERPO) {
        reject(Object.assign(new Error('cuerpo demasiado grande'), { status: 413 }));
        req.destroy();
      } else partes.push(c);
    });
    req.on('end', () => {
      try {
        resolve(n ? JSON.parse(Buffer.concat(partes).toString('utf8')) : {});
      } catch {
        reject(Object.assign(new Error('JSON inválido'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

function validarChat(cuerpo) {
  const { modelo, sistema, mensajes } = cuerpo ?? {};
  if (typeof modelo !== 'string' || typeof sistema !== 'string' || sistema.length > 20_000) {
    throw new ErrorValidacion('modelo y sistema son obligatorios (sistema ≤ 20000 caracteres)');
  }
  if (!Array.isArray(mensajes) || mensajes.length > 24) throw new ErrorValidacion('mensajes: lista de hasta 24');
  for (const m of mensajes) {
    if (!m || (m.rol !== 'usuario' && m.rol !== 'asistente') || typeof m.texto !== 'string' || m.texto.length > 4000) {
      throw new ErrorValidacion('mensaje inválido');
    }
  }
  return { modelo, sistema, mensajes };
}

export function crearPuente({ env = process.env, hacerFetch = fetch, puerto = 5174 } = {}) {
  const permitido = origenesPermitidos(env);
  const hostsValidos = new Set();

  const servidor = createServer(async (req, res) => {
    const origen = req.headers.origin;
    const responder = (status, cuerpo, tipo = 'application/json; charset=utf-8') => {
      const h = {
        'Content-Type': tipo,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
      };
      if (origen && permitido(origen)) {
        h['Access-Control-Allow-Origin'] = origen;
        h.Vary = 'Origin';
      }
      res.writeHead(status, h);
      res.end(typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo));
      process.stderr.write(`[puente] ${req.method} ${req.url?.split('?')[0]} ${status}\n`);
    };

    if (!hostsValidos.has(req.headers.host ?? '')) return responder(421, { error: 'host no permitido' });
    if (origen && !permitido(origen)) return responder(403, { error: 'origen no permitido' });

    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    if (req.method === 'OPTIONS') {
      const h = {
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Earth-Analogs, X-IA-Proveedor, X-IA-Clave',
        'Access-Control-Max-Age': '600',
      };
      if (origen) {
        h['Access-Control-Allow-Origin'] = origen;
        h.Vary = 'Origin';
      }
      if (req.headers['access-control-request-private-network'] === 'true') h['Access-Control-Allow-Private-Network'] = 'true';
      res.writeHead(204, h);
      return res.end();
    }
    if (req.method === 'POST' && req.headers['x-earth-analogs'] !== '1') {
      return responder(403, { error: 'falta el header X-Earth-Analogs: 1' });
    }

    let clave = '';
    try {
      if (req.method === 'GET' && url.pathname === '/api/salud') {
        let motor = false;
        try {
          localizarBinarioPipeline(env);
          motor = Boolean(rutas(env).run);
        } catch {
          motor = false;
        }
        return responder(200, { ok: true, motor, version: '0.1.0' });
      }

      if (req.method === 'POST' && url.pathname === '/api/ia/chat') {
        const proveedor = String(req.headers['x-ia-proveedor'] ?? '');
        clave = String(req.headers['x-ia-clave'] ?? '');
        if (!PROVEEDORES_IA.has(proveedor)) throw new ErrorValidacion('X-IA-Proveedor inválido');
        if (clave.length < 8 || clave.length > 512) throw new ErrorValidacion('X-IA-Clave inválida');
        const { modelo, sistema, mensajes } = validarChat(await leerCuerpo(req));
        const s = solicitudProveedor(proveedor, modelo, clave, sistema, mensajes);
        const r = await hacerFetch(s.url, {
          method: 'POST',
          headers: s.headers,
          body: JSON.stringify(s.body),
          signal: AbortSignal.timeout(60_000),
        });
        const t = await r.text();
        if (!r.ok) {
          let detalle = t.slice(0, 300);
          try {
            const j = JSON.parse(t);
            detalle = typeof j.error === 'string' ? j.error : (j.error?.message ?? detalle);
          } catch {
            // texto plano
          }
          return responder(502, { error: redactarSecretos(`HTTP ${r.status}: ${detalle}`, [clave]) });
        }
        return responder(200, { texto: textoProveedor(proveedor, JSON.parse(t)) });
      }

      if (req.method === 'POST' && url.pathname === '/api/motor/ejecutar') {
        const cuerpo = await leerCuerpo(req);
        delete cuerpo.publicar_visor; // el puente nunca publica
        return responder(202, await ejecutarMotor(cuerpo, { env }));
      }

      const est = url.pathname.match(/^\/api\/motor\/estado\/([A-Za-z0-9_-]{1,32})$/);
      if (req.method === 'GET' && est) return responder(200, estadoCorrida(est[1]));

      const arch = url.pathname.match(/^\/api\/motor\/archivo\/([A-Za-z0-9_-]{1,32})\/(.+)$/);
      if (req.method === 'GET' && arch) {
        const ruta = archivoDeCorrida(arch[1], decodeURIComponent(arch[2]), env);
        return responder(200, readFileSync(ruta, 'utf8'));
      }

      return responder(404, { error: 'ruta desconocida' });
    } catch (e) {
      const status = e.status ?? (e instanceof ErrorValidacion ? 400 : 500);
      const msg = e.name === 'TimeoutError' ? 'tiempo agotado (60 s)' : e.message;
      return responder(status, { error: redactarSecretos(msg, [clave]) });
    } finally {
      clave = '';
    }
  });

  return {
    servidor,
    escuchar: () =>
      new Promise((resolve) => {
        servidor.listen(puerto, '127.0.0.1', () => {
          const p = servidor.address().port;
          hostsValidos.add(`127.0.0.1:${p}`);
          hostsValidos.add(`localhost:${p}`);
          resolve(p);
        });
      }),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const puerto = Number(process.env.EA_PUENTE_PUERTO ?? 5174);
  const { escuchar } = crearPuente({ puerto });
  const p = await escuchar();
  process.stderr.write(`[puente] escuchando en http://127.0.0.1:${p} (solo esta máquina)\n`);
}
