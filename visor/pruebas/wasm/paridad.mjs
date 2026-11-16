// Prueba de paridad nativo ↔ WebAssembly del núcleo de puntaje (ADR-003, regla 9).
//
// Carga el `.wasm` compilado de `motor/wasm` con el mismo protocolo que usa el visor en el navegador
// (WebAssembly.instantiate sobre los bytes), puntúa las cuatro celdas de `motor/wasm/src/datos_prueba.rs` y compara
// contra la corrida nativa del mismo código. Si difiere en más de 1e-9, falla.
//
// Uso:
//   cd motor && cargo build -p wasm --target wasm32-unknown-unknown --release
//   node visor/pruebas/wasm/paridad.mjs
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, '../../..');
const WASM = join(RAIZ, 'motor/target/wasm32-unknown-unknown/release/motor_wasm.wasm');
const EPS = 1e-9;

// Mismos números que motor/wasm/src/datos_prueba.rs
const K = 3;
const OBJETIVO = [2.0, 15.0, 0.3];
const TOLERANCIA = [0.5, 3.0, 0.05];
const ESCALA = [1.0, 1.0, 1.0];
const CORRELACION = [1, 0.3, 0.3, 0.3, 1, 0.3, 0.3, 0.3, 1];
const PESOS = [1.0, 2.0, 1.0];
const GAMMA = 0.8;
const LAMBDA = 0.1;
const OBLIGATORIAS = 0b101;
const MAX_VARS = 12;
const CELDAS = [
  [2.1, 14.8, 0.31],
  [2.4, 18.0, 0.22],
  [NaN, 15.0, 0.3],
  [2.0, NaN, 0.3]
];

function filas() {
  const plano = new Float32Array(CELDAS.length * MAX_VARS).fill(NaN);
  CELDAS.forEach((c, i) => c.forEach((v, j) => { plano[i * MAX_VARS + j] = v; }));
  return plano;
}

async function nativo() {
  const salida = execFileSync('cargo', ['run', '-q', '-p', 'wasm', '--bin', 'volcar'], {
    cwd: join(RAIZ, 'motor'),
    encoding: 'utf8'
  });
  return JSON.parse(salida.trim());
}

async function enWasm() {
  const bytes = readFileSync(WASM);
  const { instance } = await WebAssembly.instantiate(bytes, {});
  const e = instance.exports;
  // Las vistas sobre memory.buffer se invalidan si Wasm crece: se piden después de cada reserva.
  const reservarF64 = (valores) => {
    const ptr = e.reservar(valores.length * 8);
    new Float64Array(e.memory.buffer, ptr, valores.length).set(valores);
    return { ptr, bytes: valores.length * 8 };
  };
  const reservarF32 = (valores) => {
    const ptr = e.reservar(valores.length * 4);
    new Float32Array(e.memory.buffer, ptr, valores.length).set(valores);
    return { ptr, bytes: valores.length * 4 };
  };

  const obj = reservarF64(OBJETIVO);
  const tol = reservarF64(TOLERANCIA);
  const esc = reservarF64(ESCALA);
  const cor = reservarF64(CORRELACION);
  const pes = reservarF64(PESOS);
  const perfil = e.perfil_crear(K, obj.ptr, tol.ptr, esc.ptr, cor.ptr, pes.ptr, GAMMA, LAMBDA, OBLIGATORIAS);
  if (perfil === 0) throw new Error('perfil_crear devolvió 0');

  const celdas = filas();
  const ent = reservarF32(celdas);
  const n = CELDAS.length;
  const sPtr = e.reservar(n * 8);
  const d2Ptr = e.reservar(n * 8);
  const hechas = e.perfil_puntuar_lote(perfil, ent.ptr, n, sPtr, d2Ptr);

  const s = Array.from(new Float64Array(e.memory.buffer, sPtr, n));
  const d2 = Array.from(new Float64Array(e.memory.buffer, d2Ptr, n));

  // Liberar igual que en el visor: punteros de ida y vuelta, sin confiar en el recolector.
  for (const b of [obj, tol, esc, cor, pes]) e.liberar(b.ptr, b.bytes);
  e.liberar(ent.ptr, ent.bytes);
  e.liberar(sPtr, n * 8);
  e.liberar(d2Ptr, n * 8);
  e.perfil_libre(perfil);

  return { k: K, hechas, s, d2 };
}

function comparar(a, b) {
  const fallos = [];
  if (a.hechas !== b.hechas) fallos.push(`hechas: nativo ${a.hechas} vs wasm ${b.hechas}`);
  for (let i = 0; i < a.s.length; i++) {
    const na = a.s[i];
    const nb = b.s[i];
    if (na === null || nb === null || Number.isNaN(nb)) {
      const iguales = (na === null && (nb === null || Number.isNaN(nb))) || na === nb;
      if (!iguales) fallos.push(`celda ${i}: S nativo ${na} vs wasm ${nb}`);
      continue;
    }
    if (Math.abs(na - nb) > EPS) fallos.push(`celda ${i}: S ${na} vs ${nb} (dif ${Math.abs(na - nb)})`);
    if (Math.abs(a.d2[i] - b.d2[i]) > EPS) fallos.push(`celda ${i}: D² ${a.d2[i]} vs ${b.d2[i]}`);
  }
  return fallos;
}

if (!existsSync(WASM)) {
  console.error(`Falta el artefacto wasm: ${WASM}\nCompilá primero: cd motor && cargo build -p wasm --target wasm32-unknown-unknown --release`);
  process.exit(2);
}

const a = await nativo();
const b = await enWasm();
const fallos = comparar(a, b);

console.log(`nativo: hechas=${a.hechas} S=${a.s.map((x) => (x === null ? 'null' : x.toFixed(9))).join(' ')}`);
console.log(`wasm:   hechas=${b.hechas} S=${b.s.map((x) => (Number.isNaN(x) ? 'NaN' : x.toFixed(9))).join(' ')}`);
if (fallos.length) {
  console.error(`\nPARIDAD ROTA (${fallos.length}):`);
  fallos.forEach((f) => console.error('  ' + f));
  process.exit(1);
}
console.log(`\nParidad OK: mismo resultado nativo y wasm dentro de ${EPS} en ${a.s.length} celdas (${a.hechas} puntuadas).`);
