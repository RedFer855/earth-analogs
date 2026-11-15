// Núcleo compartido por el servidor MCP y el puente HTTP: lee los datos reales (metrics.json, resultados/,
// puntos.geojson, capas7/) y ejecuta el motor Rust `pipeline`. Sin dependencias de npm.
//
// Rutas: solo del entorno o del repo, nunca del cliente.
//   RUN          corrida del ETL (manifest.json, columns/, perfiles.json). Necesaria para ejecutar el motor.
//   RUN_PUNTOS   otra corrida con columnas de distancia (--puntos), opcional.
//   EA_DATOS     carpeta publicada (metrics.json, resultados/…). Por omisión $RUN/salida o visor/public/datos.
//   EA_SALIDAS   dónde escribe cada corrida del motor. Por omisión salidas/mcp (ignorada por git).
//   EA_PIPELINE  binario del motor. Por omisión motor/target/{release,debug}/pipeline(.exe).

import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync, copyFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ang2pixNested, centroNested, distanciaKm, enBbox } from './healpix.mjs';
import {
  ErrorValidacion,
  aplicarPerfilPersonalizado,
  redactarSecretos,
  validarBbox,
  validarEntero,
  validarEscenarios,
  validarId,
  validarLatLon,
  validarParametrosMotor,
  validarRango,
  validarVariable,
} from './validacion.mjs';

export const RAIZ_REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

// --- Rutas ----------------------------------------------------------------------------------------------------

export function rutas(env = process.env) {
  const run = env.RUN ? resolve(env.RUN) : null;
  let datos;
  if (env.EA_DATOS) datos = resolve(env.EA_DATOS);
  else if (run && existsSync(join(run, 'salida', 'metrics.json'))) datos = join(run, 'salida');
  else datos = join(RAIZ_REPO, 'visor', 'public', 'datos');
  return {
    run,
    runPuntos: env.RUN_PUNTOS ? resolve(env.RUN_PUNTOS) : null,
    datos,
    salidas: env.EA_SALIDAS ? resolve(env.EA_SALIDAS) : join(RAIZ_REPO, 'salidas', 'mcp'),
    sitios: join(RAIZ_REPO, 'etl', 'sitios'),
    visorDatos: join(RAIZ_REPO, 'visor', 'public', 'datos'),
    pipeline: env.EA_PIPELINE ? resolve(env.EA_PIPELINE) : null,
  };
}

// --- Lectura con caché por fecha de modificación --------------------------------------------------------------

const cache = new Map();

function leerJson(ruta) {
  const st = statSync(ruta);
  const previo = cache.get(ruta);
  if (previo && previo.mtime === st.mtimeMs) return previo.valor;
  const valor = JSON.parse(readFileSync(ruta, 'utf8'));
  cache.set(ruta, { mtime: st.mtimeMs, valor });
  return valor;
}

function leerBinario(ruta, Tipo) {
  const st = statSync(ruta);
  const previo = cache.get(ruta);
  if (previo && previo.mtime === st.mtimeMs) return previo.valor;
  const b = readFileSync(ruta);
  const valor = new Tipo(b.buffer, b.byteOffset, b.byteLength / Tipo.BYTES_PER_ELEMENT);
  cache.set(ruta, { mtime: st.mtimeMs, valor });
  return valor;
}

function exigirArchivo(ruta, que) {
  if (!existsSync(ruta)) {
    throw new ErrorValidacion(
      `No existe ${que}. Publica datos con scripts/visor/publicar-datos.mjs o define EA_DATOS / RUN.`,
    );
  }
  return ruta;
}

function directorioDe(corrida, env) {
  const r = rutas(env);
  if (corrida === undefined || corrida === null) return r.datos;
  const id = validarId(corrida, 'corrida');
  const dir = join(r.salidas, id);
  return exigirArchivo(dir, `la corrida ${id}`);
}

export function indice(env, corrida) {
  return leerJson(exigirArchivo(join(directorioDe(corrida, env), 'metrics.json'), 'metrics.json'));
}

const r4 = (x) => (typeof x === 'number' && Number.isFinite(x) ? Math.round(x * 1e4) / 1e4 : x ?? null);

// --- Objetivos y resultados -----------------------------------------------------------------------------------

export function listarObjetivos(env = process.env) {
  const r = rutas(env);
  const salida = [];
  const luna = leerJson(join(r.sitios, 'objetivos-luna.json'));
  for (const s of luna.regiones ?? []) {
    salida.push({ codigo: s.codigo, nombre: s.nombre, cuerpo: 'luna', lat: s.lat, lon_e: s.lon_e, area_km2: s.area_km2 ?? null });
  }
  const marte = leerJson(join(r.sitios, 'objetivos-marte.json'));
  for (const s of marte.sitios ?? []) {
    salida.push({ codigo: s.codigo, nombre: s.nombre, cuerpo: 'marte', lat: s.lat, lon_e: s.lon_e, tipo: s.tipo ?? null });
  }
  let perfiles = [];
  let resultados = new Map();
  try {
    const ind = indice(env);
    perfiles = ind.perfiles.map((p) => ({ id: p.id, nombre: p.nombre, variables: p.variables }));
    resultados = new Map(ind.resultados.map((x) => [x.sitio, x]));
  } catch {
    // sin datos publicados: se listan solo los objetivos
  }
  return {
    fuente_sitios: {
      luna: luna.fuente?.doi ? `doi:${luna.fuente.doi}` : (luna.fuente?.producto ?? null),
      marte: marte.nota_de_investigacion ?? null,
    },
    perfiles,
    objetivos: salida.map((o) => {
      const res = resultados.get(o.codigo);
      return { ...o, mejor_nota: res?.mejor?.nota ?? null, n_candidatos: res?.n_candidatos ?? 0 };
    }),
  };
}

export function listarResultados(env = process.env) {
  const r = rutas(env);
  const ind = indice(env);
  return {
    datos: r.datos,
    tabla: ind.contrato?.tabla ?? null,
    generado: ind.generado,
    resultados: ind.resultados.map((x) => ({
      sitio: x.sitio,
      perfil: x.perfil,
      n_candidatos: x.n_candidatos,
      mejor: x.mejor,
    })),
    corridas_mcp: [...corridas.values()].map(resumenCorrida),
  };
}

function cargarResultado(env, objetivo, perfil = 'terreno', corrida) {
  validarId(objetivo, 'objetivo');
  validarId(perfil, 'perfil');
  const dir = directorioDe(corrida, env);
  const ind = indice(env, corrida);
  const entrada = ind.resultados.find((x) => x.sitio === objetivo && x.perfil === perfil);
  if (!entrada) {
    throw new ErrorValidacion(`No hay resultados de ${objetivo}/${perfil}. Usa listar_resultados o ejecutar_motor.`);
  }
  // archivo viene de metrics.json, pero la ruta se arma aquí para no abrir rutas arbitrarias
  const ruta = join(dir, 'resultados', perfil, `${objetivo}.json`);
  return { ind, res: leerJson(exigirArchivo(ruta, `resultados/${perfil}/${objetivo}.json`)) };
}

function compactarCandidato(c) {
  const coinciden = [];
  const difieren = [];
  const sinDato = [];
  for (const [v, d] of Object.entries(c.variables ?? {})) {
    if (d.etiqueta === 'coincide') coinciden.push(v);
    else if (d.etiqueta === 'difiere') difieren.push(v);
    else sinDato.push(v);
  }
  return {
    rango: c.rango,
    ipix: c.ipix,
    lat: c.centro.lat,
    lon: c.centro.lon,
    nota: r4(c.nota),
    cobertura: `${c.cobertura.usadas}/${c.cobertura.total}`,
    coinciden,
    difieren,
    sin_dato: sinDato,
    cerca_de: c.cerca_de ?? null,
    analogo_conocido: c.analogo_conocido,
    region: c.region,
  };
}

export function obtenerCandidatos(filtros = {}, env = process.env) {
  const objetivo = validarId(filtros.objetivo ?? 'JZ', 'objetivo');
  const perfil = validarId(filtros.perfil ?? 'terreno', 'perfil');
  const limite = validarEntero(filtros.limite ?? 20, 'limite', 1, 500);
  const notaMin = filtros.nota_min === undefined ? 0 : validarRango(filtros.nota_min, 'nota_min', { min: 0, max: 1 });
  const bbox = filtros.bbox === undefined ? null : validarBbox(filtros.bbox);
  const { res } = cargarResultado(env, objetivo, perfil, filtros.corrida);
  let lista = res.candidatos.filter((c) => c.nota >= notaMin);
  if (bbox) lista = lista.filter((c) => enBbox(bbox, c.centro.lat, c.centro.lon));
  if (filtros.solo_completos === true) lista = lista.filter((c) => c.cobertura.usadas === c.cobertura.total);
  return {
    objetivo,
    perfil,
    total_en_archivo: res.candidatos.length,
    total_filtrados: lista.length,
    objetivo_valores: Object.fromEntries(Object.entries(res.objetivo.variables).map(([k, v]) => [k, v.valor])),
    candidatos: lista.slice(0, limite).map(compactarCandidato),
  };
}

/** Candidato completo (por rango o por ipix) más el contexto que lo explica. */
export function candidatoCompleto({ objetivo, perfil = 'terreno', rango, ipix, corrida } = {}, env = process.env) {
  const { ind, res } = cargarResultado(env, objetivo ?? 'JZ', perfil, corrida);
  let c;
  if (ipix !== undefined) {
    const p = validarEntero(ipix, 'ipix', 0, 2 ** 32 - 1);
    c = res.candidatos.find((x) => x.ipix === p);
  } else {
    const k = validarEntero(rango ?? 1, 'rango', 1, 100_000);
    c = res.candidatos.find((x) => x.rango === k);
  }
  if (!c) throw new ErrorValidacion('Ese candidato no está en el resultado (revisa rango o ipix).');
  return { indice: ind, resultado: res, candidato: c };
}

// --- Pines ----------------------------------------------------------------------------------------------------

const TIPOS_PIN = new Set(['tubo_lava', 'crater_impacto', 'playa_salar']);

export function consultarPines(filtros = {}, env = process.env) {
  const ruta = exigirArchivo(join(rutas(env).datos, 'puntos.geojson'), 'puntos.geojson');
  const gj = leerJson(ruta);
  const limite = validarEntero(filtros.limite ?? 50, 'limite', 1, 1000);
  let tipo = null;
  if (filtros.tipo !== undefined) {
    if (!TIPOS_PIN.has(filtros.tipo)) throw new ErrorValidacion('tipo debe ser tubo_lava, crater_impacto o playa_salar');
    tipo = filtros.tipo;
  }
  const bbox = filtros.bbox === undefined ? null : validarBbox(filtros.bbox);
  let centro = null;
  let radio = null;
  if (filtros.lat !== undefined || filtros.lon !== undefined) {
    centro = validarLatLon(filtros.lat, filtros.lon);
    radio = validarRango(filtros.radio_km ?? 500, 'radio_km', { min: 0, max: 20_000 });
  }
  const conteo = {};
  let lista = [];
  for (const f of gj.features) {
    const p = f.properties;
    const [lon, lat] = f.geometry.coordinates;
    conteo[p.tipo] = (conteo[p.tipo] ?? 0) + 1;
    if (tipo && p.tipo !== tipo) continue;
    if (bbox && !enBbox(bbox, lat, lon)) continue;
    const item = {
      id: p.id,
      tipo: p.tipo,
      nombre: p.nombre,
      lat,
      lon,
      diametro_km: p.diametro_km ?? null,
      confirmado: p.confirmado ?? null,
      fuente: p.fuente,
      licencia: p.licencia,
    };
    if (centro) {
      item.distancia_km = Math.round(distanciaKm(centro[0], centro[1], lat, lon) * 10) / 10;
      if (item.distancia_km > radio) continue;
    }
    lista.push(item);
  }
  if (centro) lista.sort((a, b) => a.distancia_km - b.distancia_km);
  return { total_por_tipo: conteo, total_filtrados: lista.length, pines: lista.slice(0, limite) };
}

// --- capas7 ---------------------------------------------------------------------------------------------------

function capas7(env) {
  const dir = join(rutas(env).datos, 'capas7');
  const meta = leerJson(exigirArchivo(join(dir, 'capas7.json'), 'capas7/capas7.json'));
  const ipix = leerBinario(join(dir, meta.archivos.ipix), Uint32Array);
  return { dir, meta, ipix };
}

function columnaCapas7(c, nombre) {
  validarVariable(nombre, 'columna');
  const info = c.meta.columnas[nombre];
  if (!info) throw new ErrorValidacion(`capas7 no tiene la columna ${nombre}`);
  return leerBinario(join(c.dir, info.archivo), Float32Array);
}

function buscarIndice(arr, valor) {
  let lo = 0;
  let hi = arr.length - 1;
  while (lo <= hi) {
    const m = (lo + hi) >>> 1;
    if (arr[m] === valor) return m;
    if (arr[m] < valor) lo = m + 1;
    else hi = m - 1;
  }
  return -1;
}

function mediana(v) {
  if (v.length === 0) return null;
  const s = [...v].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Resumen de las capas de nivel 7 (~50 km): en un punto (valor de cada columna y dónde cae entre p1 y p99
 * de la Tierra) o en una caja (celdas, mediana, mínimo y máximo por columna).
 */
export function resumirCapas7(p = {}, env = process.env) {
  const c = capas7(env);
  const todas = Object.keys(c.meta.columnas);
  const columnas = p.columnas === undefined ? todas : p.columnas.map((x) => validarVariable(x, 'columna'));
  const nside = c.meta.nside;
  const fuentes = Object.fromEntries(
    columnas.map((k) => {
      const m = c.meta.columnas[k];
      if (!m) throw new ErrorValidacion(`capas7 no tiene la columna ${k}`);
      return [k, { unidad: m.unidad, fuente: m.fuente, licencia: m.licencia, metodo: m.metodo }];
    }),
  );
  if (p.lat !== undefined || p.lon !== undefined) {
    const [lat, lon] = validarLatLon(p.lat, p.lon);
    const pix = ang2pixNested(nside, lat, lon);
    const i = buscarIndice(c.ipix, pix);
    if (i < 0) return { nivel: c.meta.nivel, ipix: pix, en_tierra: false, nota: 'La celda no tiene tierra en la tabla.' };
    const valores = {};
    for (const k of columnas) {
      const v = columnaCapas7(c, k)[i];
      const m = c.meta.columnas[k];
      let posicion = null;
      if (Number.isFinite(v)) {
        posicion = v <= m.p1 ? '≤ p1 global' : v >= m.p99 ? '≥ p99 global' : v < m.p50 ? 'entre p1 y p50' : 'entre p50 y p99';
      }
      valores[k] = { valor: Number.isFinite(v) ? r4(v) : null, unidad: m.unidad, p1: m.p1, p50: m.p50, p99: m.p99, posicion };
    }
    return { nivel: c.meta.nivel, ipix: pix, en_tierra: true, centro: centroNested(nside, pix).map(r4), valores, fuentes };
  }
  const bbox = validarBbox(p.bbox);
  const idx = [];
  for (let i = 0; i < c.ipix.length; i += 1) {
    const [lat, lon] = centroNested(nside, c.ipix[i]);
    if (enBbox(bbox, lat, lon)) idx.push(i);
  }
  const resumen = {};
  for (const k of columnas) {
    const col = columnaCapas7(c, k);
    const v = idx.map((i) => col[i]).filter(Number.isFinite);
    resumen[k] = {
      con_dato: v.length,
      mediana: r4(mediana(v)),
      min: v.length ? r4(Math.min(...v)) : null,
      max: v.length ? r4(Math.max(...v)) : null,
      unidad: c.meta.columnas[k].unidad,
      p50_global: c.meta.columnas[k].p50,
    };
  }
  return { nivel: c.meta.nivel, celdas_en_caja: idx.length, resumen, fuentes };
}

// --- Motor ----------------------------------------------------------------------------------------------------

export function localizarBinarioPipeline(env = process.env) {
  const r = rutas(env);
  const exe = `pipeline${process.platform === 'win32' ? '.exe' : ''}`;
  const candidatos = r.pipeline
    ? [r.pipeline]
    : [join(RAIZ_REPO, 'motor', 'target', 'release', exe), join(RAIZ_REPO, 'motor', 'target', 'debug', exe)];
  const hallado = candidatos.find((c) => existsSync(c));
  if (!hallado) {
    throw new ErrorValidacion('No está compilado el motor. Corre: cd motor && cargo build --release (o define EA_PIPELINE).');
  }
  return hallado;
}

/** Argumentos de `pipeline` para unos parámetros ya validados. Puro: no toca disco. */
export function armarArgumentos(v, { run, runPuntos, sitios, salida, perfilJson, regionJson, escenariosJson }) {
  const a = ['--maestro', run, '--perfiles', join(run, 'perfiles.json'), '--sitios', sitios, '--salida', salida];
  if (escenariosJson) {
    a.push('--escenarios', escenariosJson);
    if (v.hilos !== undefined) a.push('--hilos', String(v.hilos));
    return a;
  }
  a.push('--objetivo', v.objetivo, '--perfil', v.perfil, '--candidatos', String(v.candidatos));
  if (v.hilos !== undefined) a.push('--hilos', String(v.hilos));
  if (perfilJson) a.push('--perfil-json', perfilJson);
  if (v.bbox) a.push('--bbox', v.bbox.join(','));
  if (regionJson) a.push('--region', regionJson);
  if (v.separacion_km !== undefined) a.push('--separacion-km', String(v.separacion_km));
  if (v.excluir_km !== undefined) a.push('--excluir-km', String(v.excluir_km));
  if (v.k_area !== undefined) a.push('--k-area', String(v.k_area));
  if (v.min_area_km2 !== undefined) a.push('--min-area-km2', String(v.min_area_km2));
  if (v.usar_puntos && runPuntos) a.push('--puntos', runPuntos);
  if (v.solo_barrido) a.push('--solo-barrido');
  return a;
}

const corridas = new Map();
let corridaActiva = null;
const MAX_LOG = 16_000;

function resumenCorrida(c) {
  return {
    id: c.id,
    tipo: c.tipo,
    estado: c.estado,
    objetivo: c.parametros.objetivo ?? null,
    perfil: c.parametros.perfil ?? null,
    inicio: c.inicio,
    duracion_s: c.fin ? Math.round((c.fin - c.t0) / 100) / 10 : Math.round((Date.now() - c.t0) / 100) / 10,
  };
}

function prepararCorrida(tipo, v, env) {
  if (corridaActiva) {
    throw new ErrorValidacion(`Ya hay una corrida en curso (${corridaActiva}). Espera o consulta estado_corrida.`);
  }
  const r = rutas(env);
  if (!r.run || !existsSync(join(r.run, 'perfiles.json'))) {
    throw new ErrorValidacion('Para ejecutar el motor define RUN con la corrida del ETL (manifest.json, columns/, perfiles.json).');
  }
  const binario = localizarBinarioPipeline(env);
  const id = `${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '')}-${randomUUID().slice(0, 8)}`;
  const salida = join(r.salidas, id);
  const tmp = join(salida, '_entrada');
  mkdirSync(tmp, { recursive: true });
  return { r, binario, id, salida, tmp };
}

function lanzar({ id, tipo, v, binario, args, salida, tmp, alTerminar }) {
  const c = {
    id,
    tipo,
    parametros: v,
    salida,
    estado: 'corriendo',
    inicio: new Date().toISOString(),
    t0: Date.now(),
    fin: null,
    stdout: '',
    stderr: '',
    informe: null,
    error: null,
  };
  corridas.set(id, c);
  corridaActiva = id;
  // un .mjs en EA_PIPELINE corre con node (motor simulado de las pruebas)
  const [cmd, argv] = binario.endsWith('.mjs') ? [process.execPath, [binario, ...args]] : [binario, args];
  const hijo = spawn(cmd, argv, { shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  const reloj = setTimeout(() => {
    c.error = `tiempo agotado (${v.timeout_s} s)`;
    hijo.kill();
  }, v.timeout_s * 1000);
  hijo.stdout.on('data', (d) => {
    if (c.stdout.length < 4 * MAX_LOG) c.stdout += d;
  });
  hijo.stderr.on('data', (d) => {
    c.stderr = (c.stderr + d).slice(-MAX_LOG);
  });
  c.promesa = new Promise((resolver) => {
    const cerrar = (codigo, err) => {
      clearTimeout(reloj);
      c.fin = Date.now();
      corridaActiva = null;
      rmSync(tmp, { recursive: true, force: true });
      if (err) c.error = err.message;
      if (codigo === 0 && !c.error) {
        try {
          c.informe = JSON.parse(c.stdout);
          c.estado = 'ok';
          if (alTerminar) alTerminar(c);
        } catch (e) {
          c.estado = 'error';
          c.error = `salida no es JSON: ${e.message}`;
        }
      } else {
        c.estado = 'error';
        // la última línea "error: …" del motor explica la causa mejor que el código de salida
        const causa = c.stderr.split('\n').filter((l) => l.startsWith('error:')).pop();
        c.error = c.error ?? (causa ? causa.replace(/^error:\s*/, '') : `pipeline terminó con código ${codigo}`);
      }
      c.stderr = redactarSecretos(c.stderr);
      resolver(c);
    };
    hijo.on('error', (e) => cerrar(-1, e));
    hijo.on('close', (codigo) => cerrar(codigo));
  });
  return c;
}

/** Copia metrics.json publicado a la salida para que el motor lo amplíe en vez de empezar de cero. */
function sembrarMetrics(r, salida) {
  const previo = join(r.datos, 'metrics.json');
  if (existsSync(previo)) copyFileSync(previo, join(salida, 'metrics.json'));
}

function publicarEnVisor(c, r) {
  const destino = r.visorDatos;
  mkdirSync(join(destino, 'resultados', c.parametros.perfil), { recursive: true });
  const rel = join('resultados', c.parametros.perfil, `${c.parametros.objetivo}.json`);
  for (const archivo of [rel, 'metrics.json']) {
    const texto = readFileSync(join(c.salida, archivo), 'utf8');
    const datos = JSON.parse(texto);
    if (texto.includes('local_only') || datos.es_ejemplo === true) {
      throw new Error(`${archivo} no se puede publicar (local_only o es_ejemplo)`);
    }
    const tmp = join(destino, `${archivo}.tmp`);
    writeFileSync(tmp, JSON.stringify(datos), 'utf8');
    renameSync(tmp, join(destino, archivo));
  }
  c.publicado = destino;
}

/** Lanza una corrida del motor. Si `esperar_s` > 0 espera hasta ese tiempo y devuelve el estado. */
export async function ejecutarMotor(params = {}, { esperar_s = 0, env = process.env } = {}) {
  const v = validarParametrosMotor(params);
  const { r, binario, id, salida, tmp } = prepararCorrida('motor', v, env);
  try {
    let perfilJson = null;
    let regionJson = null;
    if (v.perfil_personalizado) {
      const todos = leerJson(join(r.run, 'perfiles.json'));
      const base = todos.objetivos?.[v.objetivo]?.perfiles?.[v.perfil];
      if (!base) throw new ErrorValidacion(`perfiles.json no tiene ${v.objetivo}/${v.perfil}`);
      perfilJson = join(tmp, 'perfil.json');
      writeFileSync(perfilJson, JSON.stringify(aplicarPerfilPersonalizado(base, v.perfil_personalizado)));
    }
    if (v.region_geojson) {
      regionJson = join(tmp, 'region.geojson');
      writeFileSync(regionJson, JSON.stringify(v.region_geojson));
    }
    if (!v.solo_barrido) sembrarMetrics(r, salida);
    const args = armarArgumentos(v, { run: r.run, runPuntos: r.runPuntos, sitios: r.sitios, salida, perfilJson, regionJson });
    const c = lanzar({
      id,
      tipo: 'motor',
      v,
      binario,
      args,
      salida,
      tmp,
      alTerminar: v.publicar_visor && !v.solo_barrido ? (x) => publicarEnVisor(x, r) : null,
    });
    return esperarCorrida(c, esperar_s);
  } catch (e) {
    rmSync(salida, { recursive: true, force: true });
    corridaActiva = null;
    throw e;
  }
}

export async function ejecutarEscenarios(params = {}, { esperar_s = 0, env = process.env } = {}) {
  const e = validarEscenarios(params.escenarios);
  const v = { timeout_s: validarEntero(params.timeout_s ?? 1800, 'timeout_s', 10, 3600) };
  if (params.hilos !== undefined) v.hilos = validarEntero(params.hilos, 'hilos', 1, 64);
  const { r, binario, id, salida, tmp } = prepararCorrida('escenarios', v, env);
  try {
    const escenariosJson = join(tmp, 'escenarios.json');
    writeFileSync(escenariosJson, JSON.stringify(e));
    const args = armarArgumentos(v, { run: r.run, sitios: r.sitios, salida, escenariosJson });
    return esperarCorrida(lanzar({ id, tipo: 'escenarios', v, binario, args, salida, tmp }), esperar_s);
  } catch (err) {
    rmSync(salida, { recursive: true, force: true });
    corridaActiva = null;
    throw err;
  }
}

async function esperarCorrida(c, esperar_s) {
  if (esperar_s > 0) {
    await Promise.race([c.promesa, new Promise((r) => setTimeout(r, esperar_s * 1000).unref())]);
  }
  return estadoCorrida(c.id);
}

export function estadoCorrida(id) {
  validarId(id, 'id');
  const c = corridas.get(id);
  if (!c) throw new ErrorValidacion(`No conozco la corrida ${id} (las corridas viven mientras el proceso siga abierto).`);
  const base = { ...resumenCorrida(c), parametros: c.parametros };
  if (c.estado === 'corriendo') return { ...base, siguiente: 'Llama estado_corrida con este id en unos segundos.' };
  if (c.estado === 'error') {
    return { ...base, error: redactarSecretos(c.error), stderr: redactarSecretos(c.stderr.slice(-2000)) };
  }
  const salida = { ...base, informe: c.informe };
  if (c.publicado) salida.publicado_en = 'visor/public/datos';
  if (c.tipo === 'motor' && !c.parametros.solo_barrido) {
    try {
      const ruta = join(c.salida, 'resultados', c.parametros.perfil, `${c.parametros.objetivo}.json`);
      const res = JSON.parse(readFileSync(ruta, 'utf8'));
      salida.archivo_resultado = `resultados/${c.parametros.perfil}/${c.parametros.objetivo}.json`;
      salida.mejores = res.candidatos.slice(0, 5).map(compactarCandidato);
      salida.como_seguir = `obtener_candidatos y explicar_candidato con corrida="${c.id}"`;
    } catch {
      // el informe ya dice qué pasó
    }
  }
  return salida;
}

/** Ruta de un archivo de salida de una corrida terminada (para el puente). Solo metrics.json y resultados/. */
export function archivoDeCorrida(id, rel, env = process.env) {
  validarId(id, 'id');
  if (!/^(metrics\.json|estabilidad\.json|resultados\/[A-Za-z0-9_-]{1,32}\/[A-Za-z0-9_-]{1,32}\.json)$/.test(rel)) {
    throw new ErrorValidacion('archivo no permitido');
  }
  const ruta = join(rutas(env).salidas, id, ...rel.split('/'));
  return exigirArchivo(ruta, rel);
}

export function _reiniciarParaPruebas() {
  corridas.clear();
  corridaActiva = null;
  cache.clear();
}
