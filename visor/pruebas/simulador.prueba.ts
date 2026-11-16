// Pruebas del enlace al simulador 3D y de la intención "simula" del chat.
import assert from 'node:assert/strict';
import type { Celda } from '../src/datos/contrato';
import { construirEnlace, variablesDeCelda, variablesDeFilas } from '../src/simulador/enlaceSimulador';
import { interpretarSimulacion } from '../src/simulador/intencionSimular';

const BASE = 'http://localhost:5180/';

const celda = {
  rango: 1,
  ipix: 123456,
  variables: {
    slope_mean_deg: { valor: 18.2, diferencia: 0, nota: 1, etiqueta: 'coincide' },
    rug_rms_mean_m: { valor: 0.21, diferencia: 0, nota: 1, etiqueta: 'difiere' },
    relieve_mean_m: { valor: 9, diferencia: null, nota: null, etiqueta: 'sin_dato' },
  },
  diagnostico: { rango_diurno_k: { valor: 31, objetivo: 80, diferencia: 49 } },
} as unknown as Celda;

// variablesDeCelda: sin_dato se omite, diagnostico aporta n5
const v = variablesDeCelda(celda);
assert.deepEqual(v, { n1: 18.2, n2: 0.21, n5: 31 });

const url = new URL(construirEnlace({ cuerpo: 'mars', modo: 'rover', variables: v, ipix: 123456, sitio: 'JEZ', etiqueta: 'Jezero #1' }, BASE));
assert.equal(url.origin + url.pathname, 'http://localhost:5180/');
assert.equal(url.searchParams.get('v'), '1');
assert.equal(url.searchParams.get('body'), 'mars');
assert.equal(url.searchParams.get('mode'), 'rover');
assert.equal(url.searchParams.get('n1'), '18.2');
assert.equal(url.searchParams.get('n2'), '0.21');
assert.equal(url.searchParams.has('n3'), false);
assert.equal(url.searchParams.get('n5'), '31');
assert.equal(url.searchParams.get('seed'), '123456');
assert.equal(url.searchParams.get('site'), 'JEZ');
assert.equal(url.searchParams.get('label'), 'Jezero #1');

// valores no finitos no entran
const u2 = new URL(construirEnlace({ cuerpo: 'moon', modo: 'suit', variables: { n1: Number.NaN, n2: null } }, BASE));
assert.equal(u2.searchParams.has('n1'), false);
assert.equal(u2.searchParams.has('n2'), false);
assert.equal(u2.searchParams.has('seed'), false);

// zonas: medias de las filas ETL
assert.deepEqual(
  variablesDeFilas([
    { columna: 'slope_mean_deg', unidad: '°', min: 1, media: 5, max: 9, nValidos: 3 },
    { columna: 'aridez_ai', unidad: '', min: 0, media: 0.1, max: 1, nValidos: 3 },
    { columna: 'relieve_mean_m', unidad: 'm', min: 0, media: Number.NaN, max: 0, nValidos: 0 },
  ]),
  { n1: 5 },
);

// intención
const ctx = {
  seleccion: { cuerpo: 'mars' as const, variables: v, ipix: 123456, sitio: 'JEZ', etiqueta: 'Jezero #1' },
  sitios: [{ id: 'JEZ', nombre: 'Jezero', cuerpo: 'marte' }, { id: 'SHK', nombre: 'Shackleton', cuerpo: 'luna' }],
};

assert.equal(interpretarSimulacion('¿por qué se parece?', ctx), null);

const r1 = interpretarSimulacion('simúlame un rover en Marte con este lugar', ctx);
assert.ok(r1 && r1.tipo === 'enlace');
assert.equal(r1.datos.modo, 'rover');
assert.equal(r1.datos.cuerpo, 'mars');
assert.deepEqual(r1.datos.variables, { n1: 18.2, n2: 0.21, n5: 31 });
assert.equal(r1.datos.ipix, 123456);
assert.match(r1.resumen, /Rover en Marte/);

const r2 = interpretarSimulacion('simula el traje en la Luna con pendiente 25', { sitios: ctx.sitios });
assert.ok(r2 && r2.tipo === 'enlace');
assert.equal(r2.datos.modo, 'suit');
assert.equal(r2.datos.cuerpo, 'moon');
assert.equal(r2.datos.variables.n1, 25);

const r3 = interpretarSimulacion('simula algo', { sitios: ctx.sitios });
assert.ok(r3 && r3.tipo === 'preguntar_lugar');

const r4 = interpretarSimulacion('simulate a drill near Shackleton', { sitios: ctx.sitios });
assert.ok(r4 && r4.tipo === 'enlace');
assert.equal(r4.datos.modo, 'drill');
assert.equal(r4.datos.cuerpo, 'moon');
assert.equal(r4.datos.sitio, 'SHK');

const r5 = interpretarSimulacion('abre el simulador con rugosidad 0,3 m y relieve 5 m', {});
assert.ok(r5 && r5.tipo === 'enlace');
assert.equal(r5.datos.modo, 'rover');
assert.equal(r5.datos.variables.n2, 0.3);
assert.equal(r5.datos.variables.n3, 5);

console.log('simulador: ok');
