import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
if (args.length < 1) {
  console.error('Uso: node scripts/visor/publicar-datos.mjs <salida-dir> [--puntos <puntos.geojson>]');
  process.exit(1);
}

const dirSalida = resolve(args[0]);
let rutaPuntos = null;
for (let i = 1; i < args.length; i += 1) {
  if (args[i] === '--puntos' && args[i + 1]) {
    rutaPuntos = resolve(args[i + 1]);
    i += 1;
  } else {
    console.error(`Argumento desconocido: ${args[i]}`);
    process.exit(1);
  }
}
const raizRepo = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const dirDestino = join(raizRepo, 'visor', 'public', 'datos');

function buscarJson(dir, acumulado = []) {
  for (const entrada of readdirSync(dir)) {
    const ruta = join(dir, entrada);
    const st = statSync(ruta);
    if (st.isDirectory()) {
      buscarJson(ruta, acumulado);
    } else if (entrada.endsWith('.json')) {
      acumulado.push(ruta);
    }
  }
  return acumulado;
}

const rutaMetrics = join(dirSalida, 'metrics.json');
const dirResultados = join(dirSalida, 'resultados');

let archivosOrigen = [];
try {
  statSync(rutaMetrics);
  archivosOrigen.push(rutaMetrics);
} catch {
  console.error(`No existe ${rutaMetrics}`);
  process.exit(1);
}

try {
  statSync(dirResultados);
  archivosOrigen = archivosOrigen.concat(buscarJson(dirResultados).sort());
} catch {
  console.error(`No existe la carpeta ${dirResultados}`);
  process.exit(1);
}

const preparados = [];

for (const ruta of archivosOrigen) {
  const texto = readFileSync(ruta, 'utf8');
  if (texto.includes('local_only')) {
    console.error(`Abortado: ${ruta} contiene "local_only".`);
    process.exit(1);
  }
  let datos;
  try {
    datos = JSON.parse(texto);
  } catch (err) {
    console.error(`Abortado: ${ruta} no es JSON válido (${err.message}).`);
    process.exit(1);
  }
  const minificado = JSON.stringify(datos);
  if (minificado.includes('"es_ejemplo":true') || datos.es_ejemplo === true) {
    console.error(`Abortado: ${ruta} está marcado con "es_ejemplo":true.`);
    process.exit(1);
  }
  const rel = relative(dirSalida, ruta);
  preparados.push({ rel, contenido: minificado });
}

const extras = [];
if (rutaPuntos) {
  extras.push({ ruta: rutaPuntos, rel: 'puntos.geojson' });
}
const rutaCorrelacion = join(raizRepo, 'docs', 'analisis', 'point-correlation.json');
if (existsSync(rutaCorrelacion)) {
  extras.push({ ruta: rutaCorrelacion, rel: 'point-correlation.json' });
}

for (const extra of extras) {
  const texto = readFileSync(extra.ruta, 'utf8');
  if (texto.includes('local_only')) {
    console.error(`Abortado: ${extra.ruta} contiene "local_only".`);
    process.exit(1);
  }
  const minificado = JSON.stringify(JSON.parse(texto));
  preparados.push({ rel: extra.rel, contenido: minificado });
}

if (existsSync(dirDestino)) {
  for (const entrada of readdirSync(dirDestino)) {
    rmSync(join(dirDestino, entrada), { recursive: true, force: true });
  }
} else {
  mkdirSync(dirDestino, { recursive: true });
}

let bytesTotales = 0;
for (const item of preparados) {
  const destino = join(dirDestino, item.rel);
  mkdirSync(dirname(destino), { recursive: true });
  writeFileSync(destino, item.contenido, 'utf8');
  bytesTotales += Buffer.byteLength(item.contenido, 'utf8');
}

const kbTotales = (bytesTotales / 1024).toFixed(1);
console.log(`Publicados ${preparados.length} archivos (${kbTotales} KB) en ${dirDestino}`);
