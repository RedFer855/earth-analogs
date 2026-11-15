// Pruebas de la agrupación de la búsqueda multicondición en regiones.
import assert from 'node:assert/strict';
import { agruparBusqueda } from '../src/datos/regiones';

// nside 128 → regiones de nside 16: 64 celdas hijas por región (orden anidado)
const ipix = Uint32Array.from({ length: 200 }, (_, i) => i);
const conteos = new Uint8Array(200);
for (let i = 0; i < 64; i += 1) conteos[i] = 2; // región 0: 64 celdas cumplen todo (2 condiciones)
for (let i = 64; i < 70; i += 1) conteos[i] = 2; // región 1: 6 celdas
for (let i = 128; i < 135; i += 1) conteos[i] = 1; // región 2: solo cumplen una

const todas = agruparBusqueda(ipix, 128, conteos, 2, true);
assert.equal(todas.length, 2, 'dos regiones con celdas que cumplen todo');
assert.equal(todas[0].celdas, 64);
assert.equal(todas[1].celdas, 6);
assert.ok(Math.abs(todas[0].lat) <= 90 && Math.abs(todas[0].lon) <= 180);

const algunas = agruparBusqueda(ipix, 128, conteos, 2, false);
assert.equal(algunas.length, 3, 'sin «solo todas» entra la región parcial');
assert.equal(algunas[2].todas, 0);
assert.equal(algunas[0].todas, 64, 'primero las regiones con más celdas que cumplen todo');

assert.equal(agruparBusqueda(ipix, 128, conteos, 0, true).length, 0, 'sin condiciones no hay regiones');
assert.equal(agruparBusqueda(ipix, 128, new Uint8Array(200), 2, false).length, 0, 'nada cumple, nada se marca');

console.log('regiones.prueba.ts: ok');
