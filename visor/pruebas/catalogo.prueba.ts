// Pruebas del catálogo lateral: pines, exportar e importar GeoJSON con entrada no confiable.
import assert from 'node:assert/strict';
import {
  coordenadaValida,
  crearPin,
  exportarCatalogoAGeoJson,
  importarCatalogoGeoJson,
  limpiarTexto,
  MAX_ELEMENTOS_IMPORTACION,
} from '../src/datos/catalogo';
import { crearZonaGuardada } from '../src/datos/cruceZona';

const cuadro = [
  { lat: 10, lon: -80 },
  { lat: 10, lon: -79 },
  { lat: 11, lon: -79 },
  { lat: 11, lon: -80 },
];

// ida y vuelta de zona con cuerpo y objetivo
{
  const z = crearZonaGuardada(cuadro, 'cuadro', 'Zona de prueba', '#10b981');
  z.cuerpo = 'marte';
  z.objetivo = 'JZ';
  z.objetivoNombre = 'Jezero';
  const p = crearPin({ lat: -24.09, lon: -69.93 }, 'Yungay', 'luna', 'nota corta');
  const res = importarCatalogoGeoJson(exportarCatalogoAGeoJson([z], [p]));
  assert.equal(res.zonas.length, 1);
  assert.equal(res.pines.length, 1);
  assert.equal(res.omitidos, 0);
  assert.equal(res.zonas[0].nombre, 'Zona de prueba');
  assert.equal(res.zonas[0].cuerpo, 'marte');
  assert.equal(res.zonas[0].objetivo, 'JZ');
  assert.equal(res.zonas[0].color, '#10b981');
  assert.equal(res.zonas[0].coords.length, 4, 'el anillo cerrado pierde el vértice repetido');
  assert.notEqual(res.zonas[0].id, z.id, 'lo importado recibe un id nuevo');
  assert.equal(res.pines[0].categoria, 'luna');
  assert.equal(res.pines[0].notas, 'nota corta');
}

// rangos de coordenadas
assert.equal(coordenadaValida(90, 180), true);
assert.equal(coordenadaValida(90.1, 0), false);
assert.equal(coordenadaValida(0, -180.5), false);
assert.equal(coordenadaValida(Number.NaN, 0), false);
assert.equal(coordenadaValida('10' as unknown as number, 0), false);

// elementos inválidos se omiten y el resto entra
{
  const fc = {
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', properties: { nombre: 'ok' }, geometry: { type: 'Point', coordinates: [-70, -20] } },
      { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [-70, 95] } },
      { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 1]]] } },
      { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] } },
    ],
  };
  const res = importarCatalogoGeoJson(JSON.stringify(fc));
  assert.equal(res.pines.length, 1);
  assert.equal(res.zonas.length, 0);
  assert.equal(res.omitidos, 3);
}

// propiedades hostiles: color y objetivo inválidos se descartan, el texto queda como texto
{
  const fc = {
    type: 'Feature',
    properties: {
      nombre: '<img src=x onerror=alert(1)>\u0000',
      color: 'red;background:url(javascript:1)',
      cuerpo: 'jupiter',
      objetivo: '"><script>',
      categoria: 'x',
    },
    geometry: { type: 'Polygon', coordinates: [[[0, 0], [0, 1], [1, 1], [0, 0]]] },
  };
  const res = importarCatalogoGeoJson(JSON.stringify(fc));
  const z = res.zonas[0];
  assert.match(z.color, /^#[0-9a-f]{6}$/i);
  assert.equal(z.cuerpo, undefined);
  assert.equal(z.objetivo, undefined);
  assert.ok(!z.nombre.includes('\u0000'));
  assert.equal(z.nombre, '<img src=x onerror=alert(1)>', 'el HTML se escapa al pintar, no se altera aquí');
}

// errores de archivo
assert.throws(() => importarCatalogoGeoJson('no es json'), /JSON válido/);
assert.throws(() => importarCatalogoGeoJson('{"type":"FeatureCollection","features":[]}'), /No hay zonas/);
assert.throws(() => importarCatalogoGeoJson('{"type":"Topology"}'), /No hay zonas/);
assert.throws(
  () =>
    importarCatalogoGeoJson(
      JSON.stringify({
        type: 'FeatureCollection',
        features: Array.from({ length: MAX_ELEMENTOS_IMPORTACION + 1 }, () => ({
          type: 'Feature',
          properties: {},
          geometry: { type: 'Point', coordinates: [0, 0] },
        })),
      }),
    ),
  /más de/,
);
assert.throws(() => importarCatalogoGeoJson(' '.repeat(2_000_001)), /pesa más/);
assert.throws(
  () =>
    importarCatalogoGeoJson(
      JSON.stringify({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } }),
    ),
  /Ninguna zona/,
);

// limpieza de texto
assert.equal(limpiarTexto('  hola\n\tmundo  ', 80), 'hola  mundo');
assert.equal(limpiarTexto('x'.repeat(200), 10).length, 10);
assert.equal(limpiarTexto(42, 10), '');

console.log('catalogo.prueba.ts: ok');
