#!/usr/bin/env node
// Arranca todo de una vez y abre la página: el puente local (motor Rust y asistente) y el visor.
//
//   node scripts/iniciar.mjs [--run RUTA] [--puntos RUTA] [--sin-puente] [--sin-abrir] [--build]
//
// RUN (corrida del ETL) y RUN_PUNTOS salen del entorno o de --run / --puntos. Sin RUN el visor funciona igual,
// pero el botón «Recalcular con motor Rust» queda apagado. Sin dependencias de npm.

import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PUERTO_PUENTE = 5174; // el visor busca el puente aquí
const esWin = process.platform === 'win32';

/** ¿Se puede escuchar en ese host y puerto? Un error de dirección no disponible (sin IPv6) cuenta como libre. */
function libreEn(puerto, host) {
  return new Promise((ok) => {
    const s = createServer();
    s.once('error', (e) => ok(e.code === 'EADDRNOTAVAIL' || e.code === 'EAFNOSUPPORT'));
    s.listen(puerto, host, () => s.close(() => ok(true)));
  });
}

/** Primer puerto libre desde `desde` en IPv4 e IPv6 (vite escucha en ::1), saltando los de `evitar`. */
export async function puertoLibre(desde, evitar = []) {
  for (let p = desde; p < desde + 100; p += 1) {
    if (evitar.includes(p)) continue;
    if ((await libreEn(p, '127.0.0.1')) && (await libreEn(p, '::1'))) return p;
  }
  throw new Error(`No hay puertos libres desde ${desde}`);
}

export function leerArgumentos(argv) {
  const a = { run: process.env.RUN ?? null, puntos: process.env.RUN_PUNTOS ?? null, puente: true, abrir: true, build: false };
  for (let i = 0; i < argv.length; i += 1) {
    const x = argv[i];
    if (x === '--run') a.run = argv[++i];
    else if (x === '--puntos') a.puntos = argv[++i];
    else if (x === '--sin-puente') a.puente = false;
    else if (x === '--sin-abrir') a.abrir = false;
    else if (x === '--build') a.build = true;
    else throw new Error(`opción desconocida: ${x}`);
  }
  return a;
}

async function responde(url) {
  try {
    return (await fetch(url, { signal: AbortSignal.timeout(1500) })).ok;
  } catch {
    return false;
  }
}

async function esperar(url, ms = 60_000, proceso = null) {
  const fin = Date.now() + ms;
  while (Date.now() < fin) {
    if (proceso && proceso.exitCode !== null) return false; // murió: lo que responda no es nuestro
    if (await responde(url)) return true;
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

function abrir(url) {
  const [cmd, args] = esWin ? ['cmd', ['/c', 'start', '', url]] : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  spawn(cmd, args, { stdio: 'ignore', detached: true }).unref();
}

const hijos = [];
function lanzar(nombre, cmd, args, opciones) {
  const h = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], shell: esWin && cmd === 'npx', windowsHide: true, ...opciones });
  const prefijo = `[${nombre}] `;
  for (const s of [h.stdout, h.stderr]) s.on('data', (d) => process.stdout.write(String(d).split('\n').filter(Boolean).map((l) => prefijo + l).join('\n') + '\n'));
  h.on('exit', (c) => c !== 0 && c !== null && console.error(`${prefijo}terminó con código ${c}`));
  hijos.push(h);
  return h;
}

function detenerTodo() {
  for (const h of hijos) {
    if (h.exitCode !== null) continue;
    if (esWin) spawnSync('taskkill', ['/PID', String(h.pid), '/T', '/F'], { stdio: 'ignore' });
    else h.kill();
  }
}

async function principal() {
  const a = leerArgumentos(process.argv.slice(2));
  const visor = join(RAIZ, 'visor');
  if (!existsSync(join(visor, 'node_modules'))) {
    console.log('Instalando dependencias del visor (una sola vez)…');
    const r = spawnSync('npm', ['ci', '--no-audit', '--no-fund'], { cwd: visor, stdio: 'inherit', shell: esWin });
    if (r.status !== 0) throw new Error('npm ci falló');
  }
  if (!existsSync(join(visor, 'public', 'datos', 'metrics.json'))) {
    console.warn('Aviso: no hay datos publicados en visor/public/datos. Publícalos con scripts/visor/publicar-datos.mjs <salida>.');
  }

  const env = { ...process.env };
  if (a.run) env.RUN = resolve(a.run);
  if (a.puntos) env.RUN_PUNTOS = resolve(a.puntos);

  // Puente local: si ya hay uno vivo se reutiliza.
  if (a.puente) {
    if (await responde(`http://127.0.0.1:${PUERTO_PUENTE}/api/salud`)) {
      console.log(`Puente local ya activo en 127.0.0.1:${PUERTO_PUENTE}: se reutiliza.`);
    } else {
      lanzar('puente', process.execPath, [join(RAIZ, 'scripts', 'mcp', 'puente-http.mjs')], { cwd: RAIZ, env });
      if (!(await esperar(`http://127.0.0.1:${PUERTO_PUENTE}/api/salud`, 10_000))) console.warn('El puente no respondió en 10 s; el visor sigue sin él.');
    }
    if (!env.RUN) console.log('Sin RUN: el motor Rust no se puede ejecutar desde el visor (define RUN o usa --run).');
  }

  // Visor: servidor de desarrollo (rápido) o, con --build, la versión de producción.
  const puerto = await puertoLibre(5173, [PUERTO_PUENTE]);
  if (a.build) {
    console.log('Compilando el visor…');
    const r = spawnSync('npm', ['run', 'build'], { cwd: visor, stdio: 'inherit', shell: esWin });
    if (r.status !== 0) throw new Error('npm run build falló');
    var proceso = lanzar('visor', 'npx', ['vite', 'preview', '--port', String(puerto), '--strictPort'], { cwd: visor, env });
  } else {
    var proceso = lanzar('visor', 'npx', ['vite', '--port', String(puerto), '--strictPort'], { cwd: visor, env });
  }
  const url = `http://localhost:${puerto}/`;
  if (!(await esperar(url, 60_000, proceso))) throw new Error('El visor no arrancó (revisa los mensajes de [visor])');
  console.log(`\nListo: ${url}\nCtrl+C para detener todo.\n`);
  if (a.abrir) abrir(url);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => { detenerTodo(); process.exit(0); });
  process.on('exit', detenerTodo);
  principal().catch((e) => {
    console.error(`Error: ${e.message}`);
    detenerTodo();
    process.exit(1);
  });
}
