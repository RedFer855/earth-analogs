// Pruebas del agente que controla el motor desde el chat: extraer y validar acciones, armar el cuerpo del
// puente, filtrar sin motor y el prompt de cada modo.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Indice, ResultadoJson } from '../src/datos/contrato';
import {
  PREAJUSTES,
  ajustesIniciales,
  aplicarCambios,
  cuerpoPuente,
  extraerAcciones,
  filtrarResultado,
  interpretarPeticion,
  resumenResultado,
  sistemaAgente,
  sistemaSinSitio,
  validarAccion,
  validarSitio,
} from '../src/datos/agenteMotor';

const indice = JSON.parse(readFileSync(resolve('datos/metrics.json'), 'utf8')) as Indice;
const r = JSON.parse(readFileSync(resolve('datos/resultados/terreno/JZ.json'), 'utf8')) as ResultadoJson;
const a0 = ajustesIniciales(r);

// 1. Ajustes iniciales: peso 1 y factor 1 por variable del perfil
assert.deepEqual(Object.keys(a0.pesos).sort(), r.parametros.variables.map((v) => v.id).sort());
assert.ok(Object.values(a0.pesos).every((p) => p === 1));

// 2. Extraer el bloque de acción y dejar el texto limpio
const texto = 'Subo la rugosidad.\n```accion\n{"accion":"ejecutar_motor","pesos":{"rug_rms_mean_m":3},"solo_vista":true}\n```\nListo.';
const ex = extraerAcciones(texto);
assert.equal(ex.crudas.length, 1);
assert.ok(!ex.texto.includes('```'));
assert.match(ex.texto, /Subo la rugosidad/);
assert.equal(extraerAcciones('```js\nconst x = 1\n```').crudas.length, 0, 'código que no es acción queda como texto');

// 3. Validación: variables del perfil, rangos acotados, campos extra ignorados
const acc = validarAccion(
  { accion: 'ejecutar_motor', pesos: { rug_rms_mean_m: 99, inventada: 2 }, tolerancias: { slope_mean_deg: 0.01 }, candidatos: 9999, maestro: 'C:/', solo_vista: true },
  r,
);
assert.ok(acc && acc.tipo === 'ejecutar_motor');
if (acc && acc.tipo === 'ejecutar_motor') {
  assert.deepEqual(acc.cambios.pesos, { rug_rms_mean_m: 5 });
  assert.deepEqual(acc.cambios.factorTol, { slope_mean_deg: 0.25 });
  assert.equal(acc.cambios.candidatos, 500);
  assert.equal(acc.cambios.soloVista, true);
  assert.ok(!('maestro' in acc.cambios));
}
assert.equal(validarAccion({ accion: 'borrar_todo' }, r), null);
assert.equal(validarAccion({ accion: 'seleccionar', rango: 999 }, r), null, 'rango que no existe');
assert.deepEqual(validarAccion({ accion: 'seleccionar', rango: 2 }, r), { tipo: 'seleccionar', rango: 2 });
const f = validarAccion({ accion: 'filtrar', nota_min: 90 }, r);
assert.ok(f && f.tipo === 'filtrar' && f.cambios.nota_min === 0.9, 'acepta porcentaje');

// 4. Cuerpo del puente: perfil personalizado solo si algo cambió, tolerancia absoluta = base × factor
const sinCambio = cuerpoPuente(a0, r, null);
assert.equal(sinCambio.objetivo, 'JZ');
assert.equal(sinCambio.perfil_personalizado, undefined);
assert.equal(sinCambio.bbox, undefined);
const a1 = aplicarCambios(a0, { pesos: { rug_rms_mean_m: 3 }, factorTol: { slope_mean_deg: 2 }, soloVista: true, min_area_km2: 0 });
const c1 = cuerpoPuente(a1, r, [10, 20, 30, 40]);
const perf = c1.perfil_personalizado as Record<string, { peso: number; tolerancia: number }>;
assert.equal(perf.rug_rms_mean_m.peso, 3);
const tolBase = r.parametros.variables.find((v) => v.id === 'slope_mean_deg')!.tolerancia;
assert.ok(Math.abs(perf.slope_mean_deg.tolerancia - tolBase * 2) < 1e-9);
assert.deepEqual(c1.bbox, [10, 20, 30, 40]);
assert.equal(c1.min_area_km2, 0);
assert.equal(a0.pesos.rug_rms_mean_m, 1, 'aplicarCambios no muta');
let fallo = false;
try {
  cuerpoPuente(aplicarCambios(a0, { pesos: Object.fromEntries(Object.keys(a0.pesos).map((k) => [k, 0])) }), r, null);
} catch {
  fallo = true;
}
assert.ok(fallo, 'todos los pesos en 0 no se envía');

// 5. Filtros sin motor
assert.equal(filtrarResultado(r, { ...a0, soloVista: true }, [20, -10, 35, 10]).candidatos.length, 2);
assert.equal(filtrarResultado(r, { ...a0, nota_min: 1.01 }, null).candidatos.length, 0);
assert.match(resumenResultado(r, 10), /3 candidatos \(antes 10\)/);

// 6. Preajustes del modo fácil
const pendiente = PREAJUSTES.find((p) => p.id === 'pendiente')!;
assert.equal(pendiente.pesos('slope_mean_deg'), 3);
assert.equal(pendiente.pesos('relieve_mean_m'), 1);

// 7. Prompt: reglas científicas, modo, protocolo de acciones y aviso de motor
const facil = sistemaAgente({ modo: 'facil', indice, resultado: r, candidato: null, ajustes: a0, motorDisponible: false });
assert.match(facil, /MODO FÁCIL/);
assert.match(facil, /No estimes ni inventes cifras/);
assert.match(facil, /gravedad/);
assert.match(facil, /motor NO está disponible/);
const cient = sistemaAgente({ modo: 'cientifico', indice, resultado: r, candidato: r.candidatos[1], ajustes: a1, motorDisponible: true });
assert.match(cient, /MODO CIENTÍFICO/);
assert.match(cient, /"accion":"ejecutar_motor"/);
assert.match(cient, /"posible_hielo":true/);
assert.ok(cient.length < 18_000, 'cabe en el límite del puente');

// 4. Peticiones sin clave: verbo de búsqueda + sitio del índice o cantidad
assert.deepEqual(interpretarPeticion('busca nuevas zonas de jezero unos 50 escenarios', indice), { sitio: 'JZ', candidatos: 50 });
assert.deepEqual(interpretarPeticion('Busca similar a Jezero', indice), { sitio: 'JZ', candidatos: null });
assert.deepEqual(interpretarPeticion('encuentra 20 lugares', indice), { sitio: null, candidatos: 20 });
assert.equal(interpretarPeticion('busca lugares menos inclinados', indice), null, 'sin sitio ni cantidad no se corre nada');
assert.equal(interpretarPeticion('¿por qué Jezero se parece?', indice), null, 'una pregunta no es una orden');
assert.equal(interpretarPeticion('busca 9999 candidatos de jezero', indice)?.candidatos, 500, 'se acota a 500');

// 5. Acción elegir_sitio: solo ids del índice
assert.equal(validarSitio({ accion: 'elegir_sitio', sitio: 'JZ' }, indice), 'JZ');
assert.equal(validarSitio({ accion: 'elegir_sitio', sitio: '../../etc' }, indice), null);
assert.equal(validarSitio({ accion: 'ejecutar_motor', sitio: 'JZ' }, indice), null);
const sin = sistemaSinSitio({ modo: 'facil', indice, motorDisponible: true });
assert.match(sin, /elegir_sitio/);
assert.match(sin, /No inventes sitios/);
assert.ok(sin.includes('"id":"JZ"'));

console.log('agente.prueba: ok');
