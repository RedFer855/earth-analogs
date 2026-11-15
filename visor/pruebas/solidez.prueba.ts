// Pruebas unitarias de solidez, analógos documentados, lectura de ficha, HEALPix ang2pix y contexto de análogo.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { DatosCapas7 } from '../src/datos/capas7';
import { validarCatalogo } from '../src/datos/analogos';
import {
  normalizarEstabilidad,
  type Indice,
  type ResultadoJson,
  type VariableParametro,
} from '../src/datos/contrato';
import { indiceCapas7, lectura } from '../src/datos/ficha';
import { ang2pixNested, buscarIpix, geodesicaAAutalica, ipixACentro } from '../src/datos/healpix';
import { construirContextoAnalogo, respuestaLocal } from '../src/datos/iaCliente';
import {
  leerVariable,
  percentil,
  puntuar,
  solidezDeCandidato,
  topMultivariable,
} from '../src/datos/solidez';

const leerDato = (rel: string): string => {
  try {
    return readFileSync(resolve('datos', rel), 'utf8');
  } catch {
    return readFileSync(resolve('../public/datos', rel), 'utf8');
  }
};

const indice = JSON.parse(leerDato('metrics.json')) as Indice;
const resultadoJZ = JSON.parse(leerDato('resultados/terreno/JZ.json')) as ResultadoJson;

// --- Solidez ---------------------------------------------------------------------------------------------------

const alta = puntuar({ ok: 6, n: 6, cercania: 0.9, sin: 0, anchas: 0, k: 12, nEsc: 12 });
assert.equal(alta.nivel, 'alta');
assert.ok(alta.puntaje >= 65 && alta.puntaje <= 100);
assert.equal(alta.puntaje, alta.puntaje_bruto);
assert.ok(alta.bajo <= alta.puntaje && alta.puntaje <= alta.alto);
assert.equal(alta.limitantes.length, 0);

const sinEst = puntuar({ ok: 6, n: 6, cercania: 0.9, sin: 0, anchas: 0, k: null, nEsc: null });
assert.equal(sinEst.nivel, 'media', 'sin estabilidad se limita a media');
assert.ok(sinEst.puntaje <= 64 && sinEst.puntaje_bruto >= 65);
assert.equal(sinEst.robustez_rango, null);
assert.ok(sinEst.limitantes.some((l) => l.includes('estabilidad')));

const anchas = puntuar({ ok: 4, n: 4, cercania: 0.85, sin: 0, anchas: 3, k: 10, nEsc: 10 });
assert.equal(anchas.nivel, 'media', 'muchas tolerancias anchas limitan a media');
assert.ok(anchas.limitantes.some((l) => l.includes('discriminan')));

const flojo = puntuar({ ok: 0, n: 4, cercania: 0.2, sin: 0, anchas: 0, k: 10, nEsc: 10 });
assert.equal(flojo.nivel, 'baja');

const conSinDato = puntuar({ ok: 2, n: 4, cercania: 0.8, sin: 2, anchas: 0, k: 8, nEsc: 10 });
const sinSinDato = puntuar({ ok: 2, n: 4, cercania: 0.8, sin: 0, anchas: 0, k: 8, nEsc: 10 });
assert.ok(conSinDato.alto - conSinDato.bajo > sinSinDato.alto - sinSinDato.bajo, 'sin datos ensancha las cotas');

// --- leerVariable y solidezDeCandidato -------------------------------------------------------------------------

const vp: VariableParametro = {
  id: 'slope_mean_deg',
  peso: 1,
  tolerancia: 2,
  escala: 5,
  origen: { columna: 'slope_mean_deg', fuente: 'MERIT', url: 'https://example.com', licencia: 'CC-BY-4.0' },
};
assert.deepEqual(leerVariable(vp, 5, 6), {
  id: 'slope_mean_deg',
  aqui: 6,
  objetivo: 5,
  tolerancia: 2,
  escala: 5,
  coincide: true,
  veces_tolerancia: 0.5,
  direccion: null,
  objetivo_real: null,
});
const alto = leerVariable(vp, 5, 9, 12);
assert.equal(alto.coincide, false);
assert.equal(alto.direccion, 'más alto');
assert.equal(alto.veces_tolerancia, 2);
assert.equal(alto.objetivo_real, 12);
assert.equal(leerVariable(vp, 5, null, 5).objetivo_real, null);
assert.equal(leerVariable(vp, 5, Number.NaN).coincide, null);

const sol0 = solidezDeCandidato(resultadoJZ, resultadoJZ.candidatos[0], { aparece_en: 8, n_escenarios: 10 });
assert.ok(sol0.razones.length >= 3);
assert.ok(sol0.bajo <= sol0.alto);

const estNorm = normalizarEstabilidad({
  escenarios: [{ objetivo: 'JZ' }, { objetivo: 'JZ' }, { objetivo: 'SH' }],
  robustez: {
    JZ: [{ ipix: 1, aparece_en: 2, fraccion: 1, s_min: 0.7, s_mediana: 0.8, s_max: 0.9 }],
    SH: [{ ipix: 2, aparece_en: 1, fraccion: 1, s_min: 0.5, s_mediana: 0.5, s_max: 0.5 }],
  },
});
assert.equal(estNorm?.objetivos.JZ.n_escenarios, 2);
assert.equal(estNorm?.objetivos.SH.n_escenarios, 1);
assert.equal(normalizarEstabilidad(null), null);

// --- topMultivariable y percentil ------------------------------------------------------------------------------

const copiaR2: ResultadoJson = {
  ...resultadoJZ,
  sitio: 'OTRO',
  candidatos: [resultadoJZ.candidatos[0]],
};
const tops = topMultivariable([resultadoJZ, copiaR2], 3);
assert.ok(tops.length >= 1);
assert.equal(tops[0].objetivos.length, 2);
assert.equal(percentil(new Float32Array([Number.NaN, 10, 20, 30, 40]), 25), 50);
assert.equal(percentil(new Float32Array([Number.NaN]), 10), null);

// --- Análogos y contexto de IA ---------------------------------------------------------------------------------

const catRaw = JSON.parse(leerDato('analogos-tierra.json')) as unknown;
const cat = validarCatalogo(catRaw);
assert.ok(cat !== null && cat.sitios.length > 0, 'catálogo publicado válido');
assert.equal(validarCatalogo(null), null);
const filtrado = validarCatalogo({
  descripcion: 't',
  fuente: { investigacion: 'I-03', coordenadas_verificadas: false, nota: '' },
  sitios: [
    cat.sitios[0],
    { ...cat.sitios[0], codigo: 'BAD', lat: 120 },
  ],
});
assert.equal(filtrado?.sitios.length, 1);

const ctxA = construirContextoAnalogo(indice, resultadoJZ, cat.sitios[0]);
const respA = respuestaLocal(ctxA);
assert.ok(respA.includes(cat.sitios[0].nombre) && respA.includes('gravedad'));

// --- HEALPix ang2pix, buscarIpix, ficha ------------------------------------------------------------------------

assert.equal(geodesicaAAutalica(0), 0);
assert.ok(Math.abs(geodesicaAAutalica(90) - 90) < 1e-9);
assert.ok(geodesicaAAutalica(45) < 45 && geodesicaAAutalica(45) > 44.8);

const nside = 128;
const nMax = 12 * nside * nside;
for (const [lat, lon] of [[0, 0], [23.5, -68.2], [-24.5, 133.7], [89.5, -45], [-89.5, 179.9], [90, 0], [-90, 0]]) {
  const ip = ang2pixNested(nside, lat, lon);
  assert.ok(Number.isInteger(ip) && ip >= 0 && ip < nMax, `ipix fuera de rango en (${lat}, ${lon}): ${ip}`);
}

const ipPrueba = ang2pixNested(nside, -23.5, -68.2);
const [cLat, cLon] = ipixACentro(ipPrueba, nside);
assert.ok(Math.abs(cLat - -23.5) < 1 && Math.abs(cLon - -68.2) < 1);

const lista = new Uint32Array([5, 12, ipPrueba, nMax - 1]).sort((a, b) => a - b);
assert.equal(buscarIpix(lista, ipPrueba), lista.indexOf(ipPrueba));
assert.equal(buscarIpix(lista, ipPrueba + 1), -1);

const datosMock: DatosCapas7 = {
  meta: {
    nivel: 7,
    nside,
    esquema: 'nested',
    n_celdas: lista.length,
    archivos: { ipix: 'ipix.u32', n_hijas: 'n_hijas.u16' },
    columnas: {},
  },
  ipix: lista,
  cacheColumnas: new Map(),
};
assert.equal(indiceCapas7(datosMock, -23.5, -68.2), lista.indexOf(ipPrueba));
assert.equal(indiceCapas7(datosMock, 0, 120), -1);
assert.equal(lectura(90), 'alto');
assert.equal(lectura(50), 'típico');
assert.equal(lectura(10), 'bajo');
