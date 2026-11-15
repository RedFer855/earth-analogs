// Pruebas de los auxiliares de las capas temáticas por zona.
import assert from 'node:assert/strict';
import { getGibsRecentDateIso, unwrapLongitudes } from '../src/capas/utilCapas';

// una zona que cruza el antimeridiano queda en una sola secuencia continua
const cruza = unwrapLongitudes([
  { lat: 0, lon: 179 },
  { lat: 0, lon: -179 },
  { lat: 1, lon: -179 },
  { lat: 1, lon: 179 },
]);
assert.equal(cruza[1].lon, 181);
assert.equal(cruza[2].lon, 181);
assert.equal(cruza[3].lon, 179);
assert.deepEqual(unwrapLongitudes([]), []);

// la fecha de GIBS lleva retraso y formato AAAA-MM-DD
assert.equal(getGibsRecentDateIso(Date.UTC(2026, 10, 20), 2), '2026-11-18');
assert.equal(getGibsRecentDateIso(Date.UTC(2026, 10, 20), 0), '2026-11-20');
assert.match(getGibsRecentDateIso(), /^\d{4}-\d{2}-\d{2}$/);

console.log('capas.prueba.ts: ok');
