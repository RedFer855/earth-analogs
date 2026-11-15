import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  cargarIndice,
  cargarResultado,
  colorNota,
  escaparHtml,
  objetivoDe,
  pareceHielo,
  sitiosPorCuerpo,
  type Indice,
  type ResultadoJson,
} from '../src/datos/contrato';

const metricsRaw = readFileSync(resolve('datos/metrics.json'), 'utf8');
const jzRaw = readFileSync(resolve('datos/resultados/terreno/JZ.json'), 'utf8');
const indiceFixture = JSON.parse(metricsRaw) as Indice;
const resultadoFixture = JSON.parse(jzRaw) as ResultadoJson;

// 1. colorNota en los extremos y punto medio
const c0 = colorNota(0);
assert.ok(c0[0] > c0[1] && c0[0] > c0[2], 'nota 0 debe ser roja');
const c05 = colorNota(0.5);
assert.ok(c05[0] > 180 && c05[1] > 150 && c05[2] < 80, 'nota 0.5 debe ser amarilla');
const c1 = colorNota(1);
assert.ok(c1[1] > c1[0] && c1[1] > c1[2], 'nota 1 debe ser verde');
assert.deepEqual(colorNota(-0.5), c0);
assert.deepEqual(colorNota(1.5), c1);

// 2. sitiosPorCuerpo separa y ordena por id
const grupos = sitiosPorCuerpo(indiceFixture);
assert.equal(grupos.luna.length, 1);
assert.equal(grupos.marte.length, 1);
assert.equal(grupos.luna[0].id, 'CB');
assert.equal(grupos.marte[0].id, 'JZ');
assert.equal(grupos.luna[0].archivo, 'resultados/terreno/CB.json');

const desordenado: Indice = {
  ...indiceFixture,
  sitios_objetivo: [
    { id: 'SP', nombre: 'Slater Plain', cuerpo: 'luna', centro: { lat: -87, lon: 125 } },
    { id: 'CB', nombre: 'Peak Near Cabeus B', cuerpo: 'luna', centro: { lat: -83, lon: -68 } },
    { id: 'ZH', nombre: 'Zhurong', cuerpo: 'marte', centro: { lat: 25, lon: 109 } },
    { id: 'AF', nombre: 'Acheron Fossae', cuerpo: 'marte', centro: { lat: 36, lon: -137 } },
  ],
};
const gruposOrden = sitiosPorCuerpo(desordenado);
assert.deepEqual(
  gruposOrden.luna.map((s) => s.id),
  ['CB', 'SP'],
);
assert.deepEqual(
  gruposOrden.marte.map((s) => s.id),
  ['AF', 'ZH'],
);

// 3. objetivoDe con y sin valor_real
assert.equal(objetivoDe(resultadoFixture, 'slope_mean_deg'), 3.1343);
assert.equal(objetivoDe(resultadoFixture, 'inexistente'), null);

const conValorReal: ResultadoJson = {
  ...resultadoFixture,
  objetivo: {
    ...resultadoFixture.objetivo,
    variables: {
      ...resultadoFixture.objetivo.variables,
      rango_diurno_k: { valor: 55.0, valor_real: 92.4 },
    },
  },
};
assert.equal(objetivoDe(conValorReal, 'rango_diurno_k'), 92.4);

// 4. pareceHielo
assert.equal(pareceHielo(81.28125, -53.1658), true);
assert.equal(pareceHielo(31.12002, 2.46094), false);
assert.equal(pareceHielo(60, -40), false);
assert.equal(pareceHielo(65, -75), false);
assert.equal(pareceHielo(65, -10), false);

// 5. escaparHtml
assert.equal(
  escaparHtml('<script>alert("x" & \'y\')</script>'),
  '&lt;script&gt;alert(&quot;x&quot; &amp; &#39;y&#39;)&lt;/script&gt;',
);

// 6. Rechaza versión incorrecta y carga fixture válido con fetch simulado
const fetchOriginal = globalThis.fetch;
try {
  globalThis.fetch = (async (url: string | URL) => {
    const ruta = String(url);
    if (ruta.endsWith('bad/metrics.json')) {
      return new Response(JSON.stringify({ ...indiceFixture, version_contrato: '0.9.0' }), {
        status: 200,
      });
    }
    if (ruta.endsWith('ejemplo/metrics.json')) {
      return new Response(JSON.stringify({ ...indiceFixture, es_ejemplo: true }), { status: 200 });
    }
    if (ruta.endsWith('ok/metrics.json')) {
      return new Response(metricsRaw, { status: 200 });
    }
    if (ruta.endsWith('ok/resultados/terreno/JZ.json')) {
      return new Response(jzRaw, { status: 200 });
    }
    return new Response('Not found', { status: 404 });
  }) as typeof fetch;

  await assert.rejects(() => cargarIndice('bad/'), /Versión de contrato incompatible/);
  await assert.rejects(() => cargarIndice('ejemplo/'), /marcados como ejemplo/);
  const okIndice = await cargarIndice('ok/');
  assert.equal(okIndice.sitios_objetivo.length, 2);
  const okRes = await cargarResultado('ok/', 'resultados/terreno/JZ.json');
  assert.equal(okRes.candidatos.length, 3);
} finally {
  globalThis.fetch = fetchOriginal;
}
