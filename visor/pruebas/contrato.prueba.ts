import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  cargarCorrelacion,
  cargarEstabilidad,
  cargarIndice,
  cargarPuntos,
  cargarResultado,
  colorNota,
  escaparHtml,
  objetivoDe,
  pareceHielo,
  sitiosPorCuerpo,
  type Indice,
  type ResultadoJson,
} from '../src/datos/contrato';
import { evaluarCondiciones } from '../src/datos/capas7';
import { calcularBboxZona, parsearUnidadesMacrostrat } from '../src/capas/overlaysZona';
import { formatearAlturaM, parsearCoordenadas } from '../src/datos/coordenadas';
import { creditoEox } from '../src/globo';
import {
  centroPoligono,
  crearZonaGuardada,
  exportarZonasAGeoJson,
  filtrarCandidatosEnZona,
  resumirColumnasEnZona,
} from '../src/datos/cruceZona';
import {
  areaEsfericaM2,
  construirCirculoPorPerimetro,
  construirCuadroPorPerimetro,
  destorcerPoligono,
  distanciaGeodesicaM,
  hayAutoInterseccion,
  perimetroEsfericoM,
  puntoEnPoligono,
} from '../src/datos/geometria';
import { ipixACentro, ipixAVertices } from '../src/datos/healpix';

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
    if (ruta.endsWith('ok/puntos.geojson')) {
      return new Response(
        JSON.stringify({
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [2.46, 31.12] },
              properties: {
                id: 't1',
                tipo: 'tubo_lava',
                nombre: 'Tubo demo',
                fuente: 'Pyroduct v3.0',
                licencia: 'CC BY 4.0',
                atribucion: 'Pyroduct',
              },
            },
          ],
        }),
        { status: 200 },
      );
    }
    if (ruta.endsWith('ok/point-correlation.json')) {
      return new Response(
        JSON.stringify({
          resultados: {
            tubo_lava: { sitios: 55, sitios_usados: 50, radio_km: 5, filas: [] },
          },
        }),
        { status: 200 },
      );
    }
    if (ruta.endsWith('ok/estabilidad.json')) {
      return new Response(
        JSON.stringify({
          objetivos: {
            JZ: {
              n_escenarios: 10,
              celdas: [
                { ipix: 123, aparece_en: 8, fraccion: 0.8, s_min: 0.7, s_mediana: 0.85, s_max: 0.9 },
              ],
            },
          },
        }),
        { status: 200 },
      );
    }
    return new Response('Not found', { status: 404 });
  }) as typeof fetch;

  await assert.rejects(() => cargarIndice('bad/'), /Versión de contrato incompatible/);
  await assert.rejects(() => cargarIndice('ejemplo/'), /marcados como ejemplo/);
  const okIndice = await cargarIndice('ok/');
  assert.equal(okIndice.sitios_objetivo.length, 2);
  const okRes = await cargarResultado('ok/', 'resultados/terreno/JZ.json');
  assert.equal(okRes.candidatos.length, 3);
  const okPuntos = await cargarPuntos('ok/');
  assert.equal(okPuntos?.features.length, 1);
  assert.equal(await cargarPuntos('faltante/'), null);
  const okCorr = await cargarCorrelacion('ok/');
  assert.equal(okCorr?.resultados.tubo_lava?.sitios_usados, 50);
  assert.equal(await cargarCorrelacion('faltante/'), null);
  const okEst = await cargarEstabilidad('ok/');
  assert.equal(okEst?.objetivos.JZ?.celdas[0]?.fraccion, 0.8);
  assert.equal(await cargarEstabilidad('faltante/'), null);
} finally {
  globalThis.fetch = fetchOriginal;
}

// 7. HEALPix nested nivel 7 y evaluarCondiciones
const [lat0, lon0] = ipixACentro(0, 128);
assert.ok(Number.isFinite(lat0) && lat0 > 0 && lat0 < 90);
assert.ok(Number.isFinite(lon0) && lon0 >= -180 && lon0 <= 180);
const verts0 = ipixAVertices(0, 128);
assert.equal(verts0.length, 4);

const cols = new Map<string, Float32Array>([
  ['slope_mean_deg', new Float32Array([2.0, 8.0, Number.NaN, 3.0])],
  ['aridez_ai', new Float32Array([0.02, 0.01, 0.01, 0.5])],
]);
const evalRes = evaluarCondiciones(4, cols, [
  { columna: 'slope_mean_deg', op: '<=', umbral: 5 },
  { columna: 'aridez_ai', op: '<=', umbral: 0.05 },
]);
assert.deepEqual(Array.from(evalRes.conteos), [2, 1, 1, 1]);
assert.equal(evalRes.celdasTodas, 1);
assert.equal(evalRes.celdasAlguna, 4);

// 8. parsearCoordenadas y formatearAlturaM
assert.deepEqual(parsearCoordenadas('14.0540, -87.2489'), { lat: 14.054, lon: -87.2489 });
assert.deepEqual(parsearCoordenadas('14.0540° N; 87.2489° W'), { lat: 14.054, lon: -87.2489 });
assert.deepEqual(parsearCoordenadas('-23.5 45.25'), { lat: -23.5, lon: 45.25 });
assert.equal(parsearCoordenadas('95, 10'), null);
assert.equal(parsearCoordenadas('10, 190'), null);
assert.equal(parsearCoordenadas('texto'), null);
assert.equal(formatearAlturaM(850), '850 m');
assert.equal(formatearAlturaM(12500), '12.5 km');
assert.equal(formatearAlturaM(-1), '—');

// 9. Geometría esférica, Medir Pin y puntoEnPoligono
const centroPrueba = { lat: 14.0, lon: -87.0 };
const cuadro16 = construirCuadroPorPerimetro(centroPrueba, 16);
assert.equal(cuadro16.length, 4);
const perimCuadroKm = perimetroEsfericoM(cuadro16) / 1000;
const areaCuadroKm2 = areaEsfericaM2(cuadro16) / 1_000_000;
assert.ok(Math.abs(perimCuadroKm - 16) < 0.2, `perímetro esperado ~16 km, obtuvo ${perimCuadroKm}`);
assert.ok(Math.abs(areaCuadroKm2 - 16) < 0.3, `área esperada ~16 km², obtuvo ${areaCuadroKm2}`);

const circulo16 = construirCirculoPorPerimetro(centroPrueba, 16, 64);
assert.equal(circulo16.length, 64);
const perimCircKm = perimetroEsfericoM(circulo16) / 1000;
assert.ok(Math.abs(perimCircKm - 16) < 0.2, `perímetro círculo ~16 km, obtuvo ${perimCircKm}`);

assert.equal(puntoEnPoligono(14.0, -87.0, cuadro16), true);
assert.equal(puntoEnPoligono(15.0, -87.0, cuadro16), false);
assert.ok(distanciaGeodesicaM({ lat: 0, lon: 0 }, { lat: 0, lon: 1 }) > 110_000);

const cruzado = [
  { lat: 0, lon: 0 },
  { lat: 1, lon: 1 },
  { lat: 1, lon: 0 },
  { lat: 0, lon: 1 },
];
assert.equal(hayAutoInterseccion(cruzado), true);
const destorcido = destorcerPoligono(cruzado);
assert.equal(hayAutoInterseccion(destorcido), false);

// 10. Cruce de zona con capas7, candidatos y exportación GeoJSON
const zonaDemo = crearZonaGuardada(
  [
    { lat: 10, lon: -10 },
    { lat: 10, lon: 10 },
    { lat: -10, lon: 10 },
    { lat: -10, lon: -10 },
  ],
  'cuadro',
  'Zona Prueba',
);
assert.ok(zonaDemo.areaKm2 > 1_000_000);
const colsZona = new Map<string, Float32Array>([
  ['slope_mean_deg', new Float32Array([2, 6, Number.NaN, 10])],
]);
const metaZona = {
  slope_mean_deg: {
    archivo: 'slope.f32',
    unidad: '°',
    fuente: 'test',
    url: 'https://example.com',
    licencia: 'CC0',
    metodo: 'mean',
    cobertura_pct: 100,
    p1: 0,
    p50: 5,
    p99: 15,
  },
};
const resCols = resumirColumnasEnZona([0, 1, 2], metaZona, colsZona);
assert.equal(resCols.length, 1);
assert.equal(resCols[0].min, 2);
assert.equal(resCols[0].media, 4);
assert.equal(resCols[0].max, 6);
assert.equal(resCols[0].nValidos, 2);

const candsDentro = filtrarCandidatosEnZona(zonaDemo.coords, [
  { ...resultadoFixture.candidatos[0], centro: { lat: 0, lon: 0 } },
  { ...resultadoFixture.candidatos[0], rango: 99, centro: { lat: 60, lon: 60 } },
]);
assert.equal(candsDentro.length, 1);

const gj = JSON.parse(exportarZonasAGeoJson([zonaDemo])) as {
  type: string;
  features: { geometry: { coordinates: number[][][] }; properties: { nombre: string } }[];
};
assert.equal(gj.type, 'FeatureCollection');
assert.equal(gj.features.length, 1);
assert.equal(gj.features[0].properties.nombre, 'Zona Prueba');
assert.equal(gj.features[0].geometry.coordinates[0].length, 5);

// 11. Bbox de zona y parser Macrostrat (con fallback limpio)
const bbox = calcularBboxZona(zonaDemo.coords);
assert.deepEqual(bbox, { west: -10, south: -10, east: 10, north: 10 });
assert.equal(calcularBboxZona([{ lat: 0, lon: 0 }]), null);

// 11b. Zona que cruza el antimeridiano (Fiyi): west > east, como pide Cesium.Rectangle
const fiyi = [
  { lat: -16, lon: 177 },
  { lat: -16, lon: -178 },
  { lat: -19, lon: -178 },
  { lat: -19, lon: 177 },
];
assert.deepEqual(calcularBboxZona(fiyi), { west: 177, south: -19, east: -178, north: -16 });
const centroFiyi = centroPoligono(fiyi);
assert.ok(Math.abs(Math.abs(centroFiyi.lon) - 179.5) < 1e-9, `centro en 179.5°, no en 0°: ${centroFiyi.lon}`);
assert.ok(Math.abs(centroFiyi.lat + 17.5) < 1e-9);

// 11c. Zona que rodea el polo sur: todas las longitudes y hasta -90
const antartida = [
  { lat: -80, lon: 0 },
  { lat: -80, lon: 90 },
  { lat: -80, lon: 180 },
  { lat: -80, lon: -90 },
];
assert.deepEqual(calcularBboxZona(antartida), { west: -180, south: -90, east: 180, north: -80 });

// 11d. Crédito de EOX con la licencia correcta por año
assert.match(creditoEox(2016), /CC BY 4\.0/);
assert.ok(!creditoEox(2016).includes('NC-SA'), '2016 no es NC-SA');
assert.match(creditoEox(2025), /CC BY-NC-SA 4\.0/);
assert.match(creditoEox(2025), /Copernicus Sentinel data 2025/);

const unidades = parsearUnidadesMacrostrat({
  success: {
    data: [
      { name: 'Basaltos', lith: 'Basalt', t_int_name: 'Miocene', color: '#334155' },
      { name: 'Basaltos', lith: 'Basalt', t_int_name: 'Miocene', color: '#334155' },
    ],
  },
});
assert.equal(unidades.length, 1);
assert.equal(unidades[0].nombre, 'Basaltos');
assert.deepEqual(parsearUnidadesMacrostrat({}), []);

// 12. Esquinas HEALPix de nivel 7: finitas, del ancho de una celda y como las de cdshealpix
//     (la fórmula anterior daba celdas de 20° a 325° de ancho, y en el polo dividía
//     entre cero; Cesium detenía el render con "normalized result is not a number").
{
  const nside = 128;
  let malas = 0;
  let anchoMax = 0;
  for (let i = 0; i < 12 * nside * nside; i += 1) {
    const v = ipixAVertices(i, nside);
    for (const [lat, lon] of v) {
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90) malas += 1;
    }
    const c = ipixACentro(i, nside);
    if (!Number.isFinite(c[0]) || !Number.isFinite(c[1]) || Math.abs(c[1]) > 180) malas += 1;
    if (v.every(([lat]) => Math.abs(lat) < 80)) {
      const lons = v.map(([, lon]) => lon);
      anchoMax = Math.max(anchoMax, Math.max(...lons) - Math.min(...lons));
    }
  }
  assert.equal(malas, 0, `${malas} esquinas o centros no finitos`);
  // Cerca de 80° de latitud una celda legítima mide ~3.1° de longitud.
  assert.ok(anchoMax < 5, `una celda abarca ${anchoMax}° de longitud`);

  // Referencia: cdshealpix.nested.vertices([10942], 7), en (lat, lon).
  const ref10942: [number, number][] = [
    [43.804488, 0.731707],
    [44.20153, 0.737705],
    [44.597991, 0.0],
    [44.20153, 0.0],
  ];
  const v10942 = ipixAVertices(10942, nside);
  for (const [la, lo] of ref10942) {
    assert.ok(
      v10942.some(([a, b]) => Math.abs(a - la) < 1e-5 && Math.abs(b - lo) < 1e-5),
      `falta el vértice (${la}, ${lo}) en ${JSON.stringify(v10942)}`,
    );
  }
  // La celda que toca el polo norte tiene un vértice en lat 90.
  const polo = ipixAVertices(nside * nside - 1, nside);
  assert.ok(polo.some(([lat]) => lat === 90), 'la última celda de la cara 0 toca el polo norte');
  const poloSur = ipixAVertices(8 * nside * nside, nside);
  assert.ok(poloSur.some(([lat]) => lat === -90), 'la primera celda de la cara 8 toca el polo sur');
}
