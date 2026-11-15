// Prueba de punta a punta: levanta el servidor MCP como subproceso y le habla por stdio.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { RAIZ_REPO } from './nucleo.mjs';
import { VERSIONES } from './servidor-mcp.mjs';
import { crearDatosPrueba } from './pruebas/datos-prueba.mjs';

let hijo;
let siguiente = 1;
const pendientes = new Map();
let stdoutCrudo = '';

function pedir(method, params) {
  const id = siguiente++;
  hijo.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
  return new Promise((resolve, reject) => {
    pendientes.set(id, resolve);
    setTimeout(() => reject(new Error(`sin respuesta a ${method}`)), 10_000).unref();
  });
}

before(() => {
  const d = crearDatosPrueba();
  hijo = spawn(process.execPath, [join(RAIZ_REPO, 'scripts', 'mcp', 'servidor-mcp.mjs')], {
    env: { ...process.env, EA_DATOS: d.datos, EA_SALIDAS: join(d.raiz, 'salidas'), RUN: '' },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let buf = '';
  hijo.stdout.on('data', (b) => {
    stdoutCrudo += b;
    buf += b;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const linea = buf.slice(0, i);
      buf = buf.slice(i + 1);
      const msg = JSON.parse(linea);
      pendientes.get(msg.id)?.(msg);
    }
  });
});

after(() => hijo.kill());

test('initialize negocia la versión', async () => {
  const r = await pedir('initialize', { protocolVersion: VERSIONES[1], capabilities: {}, clientInfo: { name: 't', version: '0' } });
  assert.equal(r.result.protocolVersion, VERSIONES[1]);
  assert.equal(r.result.serverInfo.name, 'earth-analogs');
  hijo.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`);
});

test('tools/list expone las 9 herramientas con esquema', async () => {
  const r = await pedir('tools/list', {});
  const nombres = r.result.tools.map((t) => t.name);
  assert.deepEqual(nombres, [
    'listar_objetivos',
    'listar_resultados',
    'obtener_candidatos',
    'explicar_candidato',
    'consultar_pines',
    'resumir_capas7',
    'ejecutar_motor',
    'ejecutar_escenarios',
    'estado_corrida',
  ]);
  for (const t of r.result.tools) assert.equal(t.inputSchema.type, 'object');
  assert.equal(r.result.tools.find((t) => t.name === 'ejecutar_motor').annotations.destructiveHint, true);
});

test('tools/call listar_objetivos y explicar_candidato', async () => {
  const o = await pedir('tools/call', { name: 'listar_objetivos', arguments: {} });
  assert.ok(!o.result.isError);
  assert.ok(JSON.parse(o.result.content[0].text).objetivos.some((x) => x.codigo === 'JZ'));
  const e = await pedir('tools/call', { name: 'explicar_candidato', arguments: { objetivo: 'JZ', rango: 1 } });
  assert.ok(!e.result.isError, e.result.content[0].text);
  assert.match(e.result.content[0].text, /## Candidato #1/);
  assert.equal(e.result.structuredContent.candidato.rango, 1);
});

test('errores de validación vuelven como isError, no rompen el servidor', async () => {
  const r = await pedir('tools/call', { name: 'obtener_candidatos', arguments: { objetivo: '../../x' } });
  assert.equal(r.result.isError, true);
  const m = await pedir('tools/call', { name: 'ejecutar_motor', arguments: { objetivo: 'JZ' } });
  assert.equal(m.result.isError, true);
  assert.match(m.result.content[0].text, /RUN/);
  const x = await pedir('metodo/raro', {});
  assert.equal(x.error.code, -32601);
});

test('prompts', async () => {
  const l = await pedir('prompts/list', {});
  assert.ok(l.result.prompts.some((p) => p.name === 'evaluar_analogo'));
  const g = await pedir('prompts/get', { name: 'evaluar_analogo', arguments: { objetivo: 'JZ' } });
  assert.match(g.result.messages[0].content.text, /explicar_candidato/);
});

test('stdout lleva solo JSON-RPC', () => {
  for (const linea of stdoutCrudo.split('\n').filter(Boolean)) {
    assert.equal(JSON.parse(linea).jsonrpc, '2.0');
  }
});
