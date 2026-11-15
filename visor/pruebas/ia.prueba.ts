// Pruebas del asistente BYOK: clave solo en memoria, headers por proveedor (Gemini nunca con ?key=),
// redacción de secretos y contexto científico acotado.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Indice, ResultadoJson } from '../src/datos/contrato';
import {
  borrarClaveIA,
  construirContextoIA,
  construirSolicitud,
  extraerTexto,
  guardarClaveIA,
  hayClaveIA,
  preguntarIA,
  proveedorConClave,
  redactarSecretos,
  respuestaLocal,
  restaurarClaveIA,
  URL_PUENTE,
} from '../src/datos/iaCliente';

const indice = JSON.parse(readFileSync(resolve('datos/metrics.json'), 'utf8')) as Indice;
const resultado = JSON.parse(readFileSync(resolve('datos/resultados/terreno/JZ.json'), 'utf8')) as ResultadoJson;
const CLAVE = `AIza${'q'.repeat(35)}`;
const CLAVE_OAI = `sk-proj-${'w'.repeat(40)}`;

// sessionStorage de mentira para Node
const almacen = new Map<string, string>();
(globalThis as Record<string, unknown>).sessionStorage = {
  getItem: (k: string) => almacen.get(k) ?? null,
  setItem: (k: string, v: string) => void almacen.set(k, v),
  removeItem: (k: string) => void almacen.delete(k),
};

// 1. Ciclo de vida de la clave: memoria por omisión, sessionStorage solo si se pide, borrado total
guardarClaveIA('gemini', `  ${CLAVE}  `);
assert.ok(hayClaveIA());
assert.equal(proveedorConClave(), 'gemini');
assert.equal(almacen.size, 0, 'sin marcar no toca sessionStorage');
guardarClaveIA('openai', CLAVE_OAI, true);
assert.equal(almacen.size, 1);
borrarClaveIA();
assert.ok(!hayClaveIA());
assert.equal(almacen.size, 0, 'borrar limpia la pestaña');
guardarClaveIA('openai', CLAVE_OAI, true);
borrarClaveIA();
assert.equal(restaurarClaveIA(), null);
guardarClaveIA('anthropic', 'sk-ant-xxxxxxxxxxxx', true);
assert.equal(restaurarClaveIA(), 'anthropic');
borrarClaveIA();
almacen.set('ea-ia-sesion', '{malo');
assert.equal(restaurarClaveIA(), null);
assert.equal(almacen.size, 0, 'descarta datos corruptos');
assert.equal(typeof (globalThis as Record<string, unknown>).localStorage, 'undefined');

// 2. Gemini usa x-goog-api-key y nunca ?key=
const g = construirSolicitud('gemini', 'gemini-2.5-flash', CLAVE, 'sis', [{ rol: 'usuario', texto: 'hola' }]);
assert.ok(!g.url.includes('key='), 'la clave no va en la URL');
assert.ok(!g.url.includes(CLAVE));
assert.equal(g.init.headers['x-goog-api-key'], CLAVE);
assert.match(g.url, /^https:\/\/generativelanguage\.googleapis\.com\/v1beta\/models\/gemini-2\.5-flash:generateContent$/);
assert.ok(!g.init.body.includes(CLAVE), 'la clave no va en el cuerpo');

// 3. OpenAI, DeepSeek y Anthropic
const o = construirSolicitud('openai', 'gpt-5-mini', CLAVE_OAI, 'sis', [{ rol: 'usuario', texto: 'x' }]);
assert.equal(o.init.headers.Authorization, `Bearer ${CLAVE_OAI}`);
assert.match(o.url, /^https:\/\/api\.openai\.com\//);
const ds = construirSolicitud('deepseek', 'deepseek-chat', CLAVE_OAI, 'sis', []);
assert.match(ds.url, /^https:\/\/api\.deepseek\.com\//);
const an = construirSolicitud('anthropic', 'claude-sonnet-5-5', 'sk-ant-zzzzzzzzzz', 'sis', [{ rol: 'usuario', texto: 'x' }]);
assert.equal(an.init.headers['x-api-key'], 'sk-ant-zzzzzzzzzz');
assert.equal(an.init.headers['anthropic-dangerous-direct-browser-access'], 'true');
assert.equal(JSON.parse(an.init.body).system, 'sis');
for (const s of [o, ds, an]) assert.ok(!s.url.includes('key'), s.url);

// 4. Puente: header anti-CSRF y la clave en header, no en la URL
const p = construirSolicitud('deepseek', 'deepseek-chat', CLAVE_OAI, 'sis', [], true);
assert.equal(p.url, `${URL_PUENTE}/api/ia/chat`);
assert.equal(p.init.headers['X-Earth-Analogs'], '1');
assert.equal(p.init.headers['X-IA-Clave'], CLAVE_OAI);
assert.ok(!p.init.body.includes(CLAVE_OAI));

// 5. Modelo con caracteres raros se rechaza (no se cuela en la ruta)
let fallo = false;
try {
  construirSolicitud('gemini', '../x?key=1', CLAVE, 's', []);
} catch {
  fallo = true;
}
assert.ok(fallo);

// 6. Extracción de texto por proveedor
assert.equal(extraerTexto('gemini', { candidates: [{ content: { parts: [{ text: 'a' }, { text: 'b' }] } }] }), 'ab');
assert.equal(extraerTexto('openai', { choices: [{ message: { content: 'c' } }] }), 'c');
assert.equal(extraerTexto('anthropic', { content: [{ type: 'text', text: 'd' }] }), 'd');
assert.equal(extraerTexto('gemini', { texto: 'e' }, true), 'e');

// 7. redactarSecretos
const sucio = `fallo ${CLAVE} Bearer ${CLAVE_OAI} https://x?key=${CLAVE}&b=2`;
const limpio = redactarSecretos(sucio);
assert.ok(!limpio.includes(CLAVE) && !limpio.includes(CLAVE_OAI));
assert.match(limpio, /b=2/);
assert.equal(redactarSecretos('mi-clave-rara-999 x', ['mi-clave-rara-999']), '*** x');

// 8. Un error del proveedor que repite la clave sale redactado
guardarClaveIA('gemini', CLAVE);
await assert.rejects(
  () =>
    preguntarIA('gemini-2.5-flash', 'sis', [{ rol: 'usuario', texto: 'x' }], false, (async () =>
      new Response(JSON.stringify({ error: { message: `API key not valid: ${CLAVE}` } }), { status: 400 })) as typeof fetch),
  (e: unknown) => e instanceof Error && !e.message.includes(CLAVE) && e.message.includes('HTTP 400'),
);
let urlVista = '';
const r = await preguntarIA('gemini-2.5-flash', 'sis', [{ rol: 'usuario', texto: 'x' }], false, (async (u: string) => {
  urlVista = u;
  return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }), { status: 200 });
}) as unknown as typeof fetch);
assert.equal(r, 'ok');
assert.ok(!urlVista.includes(CLAVE));
borrarClaveIA();
await assert.rejects(() => preguntarIA('m', 's', [], false), /No hay clave/);

// 9. Contexto científico: solo números reales, orden de no inventar, diferencias planetarias
const cand = resultado.candidatos[0];
const ctx = construirContextoIA(indice, resultado, cand);
assert.match(ctx.sistema, /no inventes cifras/i);
assert.match(ctx.sistema, /gravedad/);
const datos = ctx.datos as { variables: { tierra: number | null }[]; planetas: { gravedad_ms2: number[] } };
assert.equal(datos.variables.length, resultado.parametros.variables.length);
assert.equal(datos.variables.find((v) => v.tierra === null), undefined);
assert.ok(datos.planetas.gravedad_ms2[1] < 4);
assert.ok(ctx.sistema.length < 8000, 'contexto acotado');
const local = respuestaLocal(ctx);
assert.match(local, /Coincide en:/);
assert.match(local, /Ningún dato captura/);
assert.equal(respuestaLocal(construirContextoIA(indice, resultado, cand)), local, 'determinista');
const hielo = respuestaLocal(construirContextoIA(indice, resultado, resultado.candidatos[1]));
assert.match(hielo, /hielo/);

console.log('ia.prueba: ok');
