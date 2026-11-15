// Validación de todo lo que llega de un cliente (MCP, puente HTTP) antes de tocar archivos o procesos.
// Nunca se acepta una ruta del cliente: las rutas salen del entorno ($RUN, $RUN_PUNTOS) o del repo.

export class ErrorValidacion extends Error {
  constructor(mensaje) {
    super(mensaje);
    this.name = 'ErrorValidacion';
  }
}

const RE_ID = /^[A-Za-z0-9_-]{1,32}$/;
const RE_VARIABLE = /^[a-z0-9_]{1,48}$/;

export function validarId(valor, campo) {
  if (typeof valor !== 'string' || !RE_ID.test(valor)) {
    throw new ErrorValidacion(`${campo} debe ser un identificador [A-Za-z0-9_-] de 1 a 32 caracteres`);
  }
  return valor;
}

export function validarVariable(valor, campo = 'variable') {
  if (typeof valor !== 'string' || !RE_VARIABLE.test(valor)) {
    throw new ErrorValidacion(`${campo} debe ser un nombre de columna [a-z0-9_]`);
  }
  return valor;
}

function numero(valor, campo) {
  const n = typeof valor === 'string' && valor.trim() !== '' ? Number(valor) : valor;
  if (typeof n !== 'number' || !Number.isFinite(n)) {
    throw new ErrorValidacion(`${campo} debe ser un número finito`);
  }
  return n;
}

export function validarEntero(valor, campo, min, max) {
  const n = numero(valor, campo);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new ErrorValidacion(`${campo} debe ser un entero entre ${min} y ${max}`);
  }
  return n;
}

export function validarRango(valor, campo, { min = -Infinity, max = Infinity, minAbierto = false } = {}) {
  const n = numero(valor, campo);
  if ((minAbierto ? n <= min : n < min) || n > max) {
    const izq = minAbierto ? '(' : '[';
    throw new ErrorValidacion(`${campo} debe estar en ${izq}${min}, ${max}]`);
  }
  return n;
}

export function validarLatLon(lat, lon) {
  return [
    validarRango(lat, 'lat', { min: -90, max: 90 }),
    validarRango(lon, 'lon', { min: -180, max: 180 }),
  ];
}

export function validarBbox(valor) {
  const partes = typeof valor === 'string' ? valor.split(',') : valor;
  if (!Array.isArray(partes) || partes.length !== 4) {
    throw new ErrorValidacion('bbox debe tener 4 números [lat1, lon1, lat2, lon2]');
  }
  const [lat1, lon1] = validarLatLon(partes[0], partes[1]);
  const [lat2, lon2] = validarLatLon(partes[2], partes[3]);
  if (lat1 === lat2) throw new ErrorValidacion('bbox: lat1 y lat2 no pueden ser iguales');
  return [lat1, lon1, lat2, lon2];
}

const TIPOS_GEOJSON = new Set(['Polygon', 'MultiPolygon', 'Feature', 'FeatureCollection']);
const MAX_VERTICES = 20_000;

function validarAnillo(anillo, contador) {
  if (!Array.isArray(anillo) || anillo.length < 4) {
    throw new ErrorValidacion('region_geojson: cada anillo necesita al menos 4 posiciones');
  }
  for (const p of anillo) {
    if (!Array.isArray(p) || p.length < 2) throw new ErrorValidacion('region_geojson: posición inválida');
    validarRango(p[0], 'region_geojson lon', { min: -180, max: 180 });
    validarRango(p[1], 'region_geojson lat', { min: -90, max: 90 });
    contador.n += 1;
    if (contador.n > MAX_VERTICES) {
      throw new ErrorValidacion(`region_geojson: más de ${MAX_VERTICES} vértices`);
    }
  }
}

function validarGeometria(g, contador) {
  if (!g || typeof g !== 'object') throw new ErrorValidacion('region_geojson: geometría vacía');
  if (g.type === 'Polygon') {
    if (!Array.isArray(g.coordinates) || g.coordinates.length === 0) {
      throw new ErrorValidacion('region_geojson: Polygon sin anillos');
    }
    g.coordinates.forEach((a) => validarAnillo(a, contador));
  } else if (g.type === 'MultiPolygon') {
    if (!Array.isArray(g.coordinates) || g.coordinates.length === 0) {
      throw new ErrorValidacion('region_geojson: MultiPolygon vacío');
    }
    g.coordinates.forEach((pol) => {
      if (!Array.isArray(pol)) throw new ErrorValidacion('region_geojson: polígono inválido');
      pol.forEach((a) => validarAnillo(a, contador));
    });
  } else {
    throw new ErrorValidacion('region_geojson: solo Polygon o MultiPolygon');
  }
}

export function validarGeoJson(valor) {
  const g = typeof valor === 'string' ? JSON.parse(valor) : valor;
  if (!g || typeof g !== 'object' || !TIPOS_GEOJSON.has(g.type)) {
    throw new ErrorValidacion('region_geojson debe ser Polygon, MultiPolygon, Feature o FeatureCollection');
  }
  const contador = { n: 0 };
  if (g.type === 'Feature') validarGeometria(g.geometry, contador);
  else if (g.type === 'FeatureCollection') {
    if (!Array.isArray(g.features) || g.features.length === 0) {
      throw new ErrorValidacion('region_geojson: FeatureCollection vacía');
    }
    g.features.forEach((f) => validarGeometria(f?.geometry, contador));
  } else validarGeometria(g, contador);
  return g;
}

/**
 * Ajustes de pesos y tolerancias sobre un perfil base: { variable: { peso?, tolerancia? } }.
 * Solo valida la forma; que la variable exista en el perfil lo revisa `aplicarPerfilPersonalizado`.
 */
export function validarPerfilPersonalizado(valor) {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) {
    throw new ErrorValidacion('perfil_personalizado debe ser un objeto { variable: { peso?, tolerancia? } }');
  }
  const salida = {};
  const entradas = Object.entries(valor);
  if (entradas.length === 0 || entradas.length > 32) {
    throw new ErrorValidacion('perfil_personalizado debe tener entre 1 y 32 variables');
  }
  for (const [variable, ajuste] of entradas) {
    validarVariable(variable);
    if (!ajuste || typeof ajuste !== 'object') {
      throw new ErrorValidacion(`perfil_personalizado.${variable} debe ser un objeto`);
    }
    const extra = Object.keys(ajuste).filter((k) => k !== 'peso' && k !== 'tolerancia');
    if (extra.length > 0) {
      throw new ErrorValidacion(`perfil_personalizado.${variable}: campo desconocido ${extra[0]}`);
    }
    const a = {};
    if (ajuste.peso !== undefined) {
      a.peso = validarRango(ajuste.peso, `${variable}.peso`, { min: 0, max: 100 });
    }
    if (ajuste.tolerancia !== undefined) {
      a.tolerancia = validarRango(ajuste.tolerancia, `${variable}.tolerancia`, {
        min: 0,
        max: 1e7,
        minAbierto: true,
      });
    }
    salida[variable] = a;
  }
  return salida;
}

/** Copia el perfil base de perfiles.json con los pesos y tolerancias cambiados; falla si la variable no está. */
export function aplicarPerfilPersonalizado(base, ajustes) {
  const perfil = structuredClone(base);
  perfil.pesos = { ...(perfil.pesos ?? {}) };
  for (const [variable, ajuste] of Object.entries(ajustes)) {
    if (!perfil.variables.includes(variable)) {
      throw new ErrorValidacion(
        `perfil_personalizado: ${variable} no está en el perfil (variables: ${perfil.variables.join(', ')})`,
      );
    }
    if (ajuste.peso !== undefined) perfil.pesos[variable] = ajuste.peso;
    if (ajuste.tolerancia !== undefined) perfil.tolerancia[variable] = ajuste.tolerancia;
  }
  const pesos = perfil.variables.map((v) => perfil.pesos[v] ?? 1);
  if (pesos.every((p) => p === 0)) throw new ErrorValidacion('perfil_personalizado: todos los pesos son 0');
  return perfil;
}

const CAMPOS_ESCENARIO = new Set([
  'id',
  'objetivo',
  'perfil',
  'variables',
  'factor_tolerancia',
  'pesos',
  'ndvi_max',
  'radio_exclusion_km',
  'separacion_km',
]);

/** Escenarios para `--escenarios`: mismo formato que motor/pipeline/src/escenarios.rs (deny_unknown_fields). */
export function validarEscenarios(valor) {
  const lista = Array.isArray(valor) ? valor : valor?.escenarios;
  if (!Array.isArray(lista) || lista.length === 0 || lista.length > 200) {
    throw new ErrorValidacion('escenarios debe ser una lista de 1 a 200 escenarios');
  }
  const ids = new Set();
  const escenarios = lista.map((e, i) => {
    if (!e || typeof e !== 'object') throw new ErrorValidacion(`escenario ${i} inválido`);
    const extra = Object.keys(e).find((k) => !CAMPOS_ESCENARIO.has(k));
    if (extra) throw new ErrorValidacion(`escenario ${i}: campo desconocido ${extra}`);
    const s = {
      id: validarId(e.id, `escenarios[${i}].id`),
      objetivo: validarId(e.objetivo, `escenarios[${i}].objetivo`),
      perfil: validarId(e.perfil ?? 'terreno', `escenarios[${i}].perfil`),
    };
    if (ids.has(s.id)) throw new ErrorValidacion(`escenario repetido: ${s.id}`);
    ids.add(s.id);
    if (e.variables !== undefined) {
      if (!Array.isArray(e.variables)) throw new ErrorValidacion(`escenarios[${i}].variables debe ser lista`);
      s.variables = e.variables.map((v) => validarVariable(v));
    }
    if (e.factor_tolerancia !== undefined) {
      s.factor_tolerancia = validarRango(e.factor_tolerancia, 'factor_tolerancia', { min: 0, max: 100 });
    }
    if (e.pesos !== undefined) {
      if (!e.pesos || typeof e.pesos !== 'object') throw new ErrorValidacion('pesos debe ser objeto');
      s.pesos = Object.fromEntries(
        Object.entries(e.pesos).map(([k, v]) => [validarVariable(k), validarRango(v, `peso ${k}`, { min: 0, max: 100 })]),
      );
    }
    if (e.ndvi_max !== undefined) s.ndvi_max = validarRango(e.ndvi_max, 'ndvi_max', { min: -1, max: 1 });
    if (e.radio_exclusion_km !== undefined) {
      s.radio_exclusion_km = validarRango(e.radio_exclusion_km, 'radio_exclusion_km', { min: 0, max: 20_000 });
    }
    if (e.separacion_km !== undefined) {
      s.separacion_km = validarRango(e.separacion_km, 'separacion_km', { min: 0, max: 20_000 });
    }
    return s;
  });
  return { escenarios };
}

/**
 * Parámetros de una corrida del motor. Devuelve un objeto limpio; cualquier campo desconocido es un error,
 * para que un cliente no cuele `--maestro`, `--salida` u otra ruta.
 */
const CAMPOS_MOTOR = new Set([
  'objetivo',
  'perfil',
  'candidatos',
  'hilos',
  'bbox',
  'region_geojson',
  'perfil_personalizado',
  'separacion_km',
  'excluir_km',
  'k_area',
  'min_area_km2',
  'solo_barrido',
  'usar_puntos',
  'publicar_visor',
  'timeout_s',
]);

export function validarParametrosMotor(p = {}) {
  if (!p || typeof p !== 'object' || Array.isArray(p)) throw new ErrorValidacion('parámetros inválidos');
  const extra = Object.keys(p).find((k) => !CAMPOS_MOTOR.has(k));
  if (extra) throw new ErrorValidacion(`parámetro desconocido: ${extra}`);
  const v = {
    objetivo: validarId(p.objetivo ?? 'JZ', 'objetivo'),
    perfil: validarId(p.perfil ?? 'terreno', 'perfil'),
    candidatos: validarEntero(p.candidatos ?? 200, 'candidatos', 1, 500),
  };
  if (p.hilos !== undefined) v.hilos = validarEntero(p.hilos, 'hilos', 1, 64);
  if (p.bbox !== undefined && p.region_geojson !== undefined) {
    throw new ErrorValidacion('usa bbox o region_geojson, no ambos');
  }
  if (p.bbox !== undefined) v.bbox = validarBbox(p.bbox);
  if (p.region_geojson !== undefined) v.region_geojson = validarGeoJson(p.region_geojson);
  if (p.perfil_personalizado !== undefined) {
    v.perfil_personalizado = validarPerfilPersonalizado(p.perfil_personalizado);
  }
  if (p.separacion_km !== undefined) {
    v.separacion_km = validarRango(p.separacion_km, 'separacion_km', { min: 0, max: 20_000 });
  }
  if (p.excluir_km !== undefined) v.excluir_km = validarRango(p.excluir_km, 'excluir_km', { min: 0, max: 20_000 });
  if (p.k_area !== undefined) v.k_area = validarRango(p.k_area, 'k_area', { min: 0, max: 1, minAbierto: true });
  if (p.min_area_km2 !== undefined) {
    v.min_area_km2 = validarRango(p.min_area_km2, 'min_area_km2', { min: 0, max: 600_000_000 });
  }
  for (const b of ['solo_barrido', 'usar_puntos', 'publicar_visor']) {
    if (p[b] !== undefined) {
      if (typeof p[b] !== 'boolean') throw new ErrorValidacion(`${b} debe ser true o false`);
      v[b] = p[b];
    }
  }
  v.timeout_s = validarEntero(p.timeout_s ?? 900, 'timeout_s', 10, 3600);
  return v;
}

// --- Secretos -------------------------------------------------------------------------------------------------

const PATRONES_SECRETO = [
  [/AIza[0-9A-Za-z_-]{20,}/g, 'AIza***'],
  [/sk-ant-[0-9A-Za-z_-]{8,}/g, 'sk-ant-***'],
  [/sk-[0-9A-Za-z_-]{8,}/g, 'sk-***'],
  [/(Bearer|Token)\s+[0-9A-Za-z._~+/=-]{6,}/gi, '$1 ***'],
  [/(x-goog-api-key|x-api-key|authorization|api[_-]?key)(["']?\s*[:=]\s*["']?)[^\s"',;&]{4,}/gi, '$1$2***'],
  [/([?&](?:key|api_key|token)=)[^&\s"']+/gi, '$1***'],
];

/** Enmascara claves y tokens antes de devolver o registrar un texto. */
export function redactarSecretos(texto, extras = []) {
  let s = String(texto ?? '');
  for (const secreto of extras) {
    if (typeof secreto === 'string' && secreto.length >= 6) s = s.split(secreto).join('***');
  }
  for (const [re, reemplazo] of PATRONES_SECRETO) s = s.replace(re, reemplazo);
  return s;
}
