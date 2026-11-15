import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { request } from 'node:http';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { RAIZ_REPO } from './nucleo.mjs';
import { crearPuente } from './puente-http.mjs';
import { crearDatosPrueba } from './pruebas/datos-prueba.mjs';

const CLAVE = `AIza${'k'.repeat(35)}`;
let puerto;
let puente;
const llamadasProveedor = [];

function pedir(metodo, ruta, { headers = {}, cuerpo } = {}) {
  return new Promise((resolve, reject) => {
    const req = request(
      { host: '127.0.0.1', port: puerto, method: metodo, path: ruta, headers: { Host: `127.0.0.1:${puerto}`, ...headers } },
      (res) => {
        let t = '';
        res.on('data', (c) => (t += c));
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, texto: t, json: () => JSON.parse(t) }));
      },
    );
    req.on('error', reject);
    if (cuerpo !== undefined) req.write(typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo));
    req.end();
  });
}

const POST = { 'X-Earth-Analogs': '1', 'Content-Type': 'application/json', Origin: 'http://localhost:5173' };

before(async () => {
  const d = crearDatosPrueba();
  const run = join(d.raiz, 'run');
  mkdirSync(run);
  writeFileSync(join(run, 'perfiles.json'), '{"objetivos":{}}');
  const env = {
    RUN: run,
    EA_DATOS: d.datos,
    EA_SALIDAS: join(d.raiz, 'salidas'),
    EA_PIPELINE: join(RAIZ_REPO, 'scripts', 'mcp', 'pruebas', 'motor-simulado.mjs'),
  };
  const hacerFetch = async (url, init) => {
    llamadasProveedor.push({ url, init });
    if (init.headers['x-goog-api-key'] === 'mala-clave-123') {
      return new Response(JSON.stringify({ error: { message: 'API key not valid: mala-clave-123' } }), { status: 400 });
    }
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'respuesta' }] } }] }), { status: 200 });
  };
  puente = crearPuente({ env, hacerFetch, puerto: 0 });
  puerto = await puente.escuchar();
});

after(() => puente.servidor.close());

test('salud y CORS para localhost', async () => {
  const r = await pedir('GET', '/api/salud', { headers: { Origin: 'http://localhost:5173' } });
  assert.equal(r.status, 200);
  assert.equal(r.json().ok, true);
  assert.equal(r.json().motor, true);
  assert.equal(r.headers['access-control-allow-origin'], 'http://localhost:5173');
});

test('rechaza otro Host (DNS rebinding) y otro Origin', async () => {
  assert.equal((await pedir('GET', '/api/salud', { headers: { Host: 'atacante.example:5174' } })).status, 421);
  const r = await pedir('GET', '/api/salud', { headers: { Origin: 'https://atacante.example' } });
  assert.equal(r.status, 403);
  assert.equal(r.headers['access-control-allow-origin'], undefined);
});

test('POST sin X-Earth-Analogs se rechaza', async () => {
  const r = await pedir('POST', '/api/motor/ejecutar', { headers: { 'Content-Type': 'application/json' }, cuerpo: {} });
  assert.equal(r.status, 403);
});

test('preflight con red privada', async () => {
  const r = await pedir('OPTIONS', '/api/ia/chat', {
    headers: { Origin: 'http://127.0.0.1:4173', 'Access-Control-Request-Private-Network': 'true' },
  });
  assert.equal(r.status, 204);
  assert.equal(r.headers['access-control-allow-private-network'], 'true');
  assert.match(r.headers['access-control-allow-headers'], /X-IA-Clave/);
});

test('chat reenvía la clave solo en header y no la devuelve', async () => {
  const cuerpo = { modelo: 'gemini-2.5-flash', sistema: 'sis', mensajes: [{ rol: 'usuario', texto: 'hola' }] };
  const r = await pedir('POST', '/api/ia/chat', { headers: { ...POST, 'X-IA-Proveedor': 'gemini', 'X-IA-Clave': CLAVE }, cuerpo });
  assert.equal(r.status, 200);
  assert.equal(r.json().texto, 'respuesta');
  const ultima = llamadasProveedor.at(-1);
  assert.ok(!ultima.url.includes('key='));
  assert.equal(ultima.init.headers['x-goog-api-key'], CLAVE);
  assert.ok(!r.texto.includes(CLAVE));
  const malo = await pedir('POST', '/api/ia/chat', {
    headers: { ...POST, 'X-IA-Proveedor': 'gemini', 'X-IA-Clave': 'mala-clave-123' },
    cuerpo,
  });
  assert.equal(malo.status, 502);
  assert.ok(!malo.texto.includes('mala-clave-123'), malo.texto);
  const sinProv = await pedir('POST', '/api/ia/chat', { headers: { ...POST, 'X-IA-Proveedor': 'otro', 'X-IA-Clave': CLAVE }, cuerpo });
  assert.equal(sinProv.status, 400);
});

test('no hay endpoints de bóveda de claves', async () => {
  assert.equal((await pedir('GET', '/api/ia/estado')).status, 404);
  assert.equal((await pedir('POST', '/api/ia/borrar-clave', { headers: POST, cuerpo: {} })).status, 404);
});

test('motor: ejecutar, estado y archivo; nunca publica; rutas seguras', async () => {
  const r = await pedir('POST', '/api/motor/ejecutar', { headers: POST, cuerpo: { objetivo: 'JZ', publicar_visor: true } });
  assert.equal(r.status, 202, r.texto);
  const id = r.json().id;
  let e;
  for (let i = 0; i < 50; i += 1) {
    e = (await pedir('GET', `/api/motor/estado/${id}`)).json();
    if (e.estado !== 'corriendo') break;
    await new Promise((s) => setTimeout(s, 100));
  }
  assert.equal(e.estado, 'ok', JSON.stringify(e));
  assert.equal(e.publicado_en, undefined);
  assert.equal(e.parametros.publicar_visor, undefined);
  const a = await pedir('GET', `/api/motor/archivo/${id}/resultados/terreno/JZ.json`);
  assert.equal(a.status, 200);
  assert.equal(a.json().sitio, 'JZ');
  assert.equal((await pedir('GET', `/api/motor/archivo/${id}/..%2F..%2Fpackage.json`)).status, 400);
  const malo = await pedir('POST', '/api/motor/ejecutar', { headers: POST, cuerpo: { objetivo: 'JZ', maestro: 'C:/' } });
  assert.equal(malo.status, 400);
  const json = await pedir('POST', '/api/motor/ejecutar', { headers: POST, cuerpo: '{malo' });
  assert.equal(json.status, 400);
});
