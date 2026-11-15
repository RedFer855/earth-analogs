#!/usr/bin/env node
// Servidor MCP por stdio (JSON-RPC 2.0, un mensaje por línea). stdout lleva solo JSON-RPC; los avisos van a
// stderr y redactados. Sin dependencias: `node scripts/mcp/servidor-mcp.mjs`.

import { createInterface } from 'node:readline';
import { pathToFileURL } from 'node:url';
import { explicacionAMarkdown, explicarCandidato } from './explicacion.mjs';
import {
  candidatoCompleto,
  consultarPines,
  ejecutarEscenarios,
  ejecutarMotor,
  estadoCorrida,
  listarObjetivos,
  listarResultados,
  obtenerCandidatos,
  resumirCapas7,
} from './nucleo.mjs';
import { ErrorValidacion, redactarSecretos, validarEntero } from './validacion.mjs';

export const VERSIONES = ['2025-06-18', '2025-03-26', '2024-11-05'];
const SERVIDOR = { name: 'earth-analogs', version: '0.1.0' };

const bbox = {
  type: 'array',
  items: { type: 'number' },
  minItems: 4,
  maxItems: 4,
  description: '[lat1, lon1, lat2, lon2] en grados WGS84; si lon1 > lon2 la caja cruza ±180°',
};
const objetivo = { type: 'string', description: 'Código del sitio objetivo (p. ej. JZ, CB). Ver listar_objetivos.' };
const perfil = { type: 'string', description: 'Perfil de búsqueda (por omisión terreno).' };
const corrida = { type: 'string', description: 'Id de una corrida de ejecutar_motor; sin él se usan los datos publicados.' };
const soloLectura = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

const HERRAMIENTAS = [
  {
    name: 'listar_objetivos',
    title: 'Sitios objetivo de la Luna y Marte',
    description: 'Lista los sitios objetivo (Artemis III en la Luna, sitios de Marte), los perfiles y la mejor nota publicada de cada uno.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: soloLectura,
    correr: () => listarObjetivos(),
  },
  {
    name: 'listar_resultados',
    title: 'Resultados disponibles',
    description: 'Resultados publicados (sitio × perfil, mejor candidato), fecha de la tabla y corridas MCP de esta sesión.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: soloLectura,
    correr: () => listarResultados(),
  },
  {
    name: 'obtener_candidatos',
    title: 'Candidatos análogos en la Tierra',
    description:
      'Candidatos de la Tierra para un sitio objetivo, ordenados por nota (0-1), con qué variables coinciden, cuáles difieren y la distancia a tubos de lava, cráteres y salares.',
    inputSchema: {
      type: 'object',
      properties: {
        objetivo,
        perfil,
        limite: { type: 'integer', minimum: 1, maximum: 500, default: 20 },
        nota_min: { type: 'number', minimum: 0, maximum: 1 },
        bbox,
        solo_completos: { type: 'boolean', description: 'Solo candidatos con dato en todas las variables.' },
        corrida,
      },
      required: ['objetivo'],
      additionalProperties: false,
    },
    annotations: soloLectura,
    correr: (a) => obtenerCandidatos(a),
  },
  {
    name: 'explicar_candidato',
    title: 'Ficha física de un candidato',
    description:
      'Explica un candidato con los números del motor: en qué coincide y en qué difiere, diagnósticos que no puntúan, entorno cercano, advertencias y lo que ningún dato captura (gravedad, presión, atmósfera, radiación).',
    inputSchema: {
      type: 'object',
      properties: {
        objetivo,
        perfil,
        rango: { type: 'integer', minimum: 1, description: 'Posición del candidato (1 = mejor).' },
        ipix: { type: 'integer', minimum: 0, description: 'Celda HEALPix nested (alternativa a rango).' },
        corrida,
        formato: { type: 'string', enum: ['markdown', 'json'], default: 'markdown' },
      },
      required: ['objetivo'],
      additionalProperties: false,
    },
    annotations: soloLectura,
    correr: (a) => {
      const e = explicarCandidato(candidatoCompleto(a));
      return a.formato === 'json' ? e : { markdown: explicacionAMarkdown(e), datos: e };
    },
  },
  {
    name: 'consultar_pines',
    title: 'Tubos de lava, cráteres y salares',
    description: 'Pines de la Tierra por tipo, caja o cercanía a un punto (radio en km), con fuente y licencia.',
    inputSchema: {
      type: 'object',
      properties: {
        tipo: { type: 'string', enum: ['tubo_lava', 'crater_impacto', 'playa_salar'] },
        bbox,
        lat: { type: 'number', minimum: -90, maximum: 90 },
        lon: { type: 'number', minimum: -180, maximum: 180 },
        radio_km: { type: 'number', minimum: 0, default: 500 },
        limite: { type: 'integer', minimum: 1, maximum: 1000, default: 50 },
      },
      additionalProperties: false,
    },
    annotations: soloLectura,
    correr: (a) => consultarPines(a),
  },
  {
    name: 'resumir_capas7',
    title: 'Variables de la Tierra a ~50 km',
    description:
      'Valores de las capas de nivel 7 (~50 km) en un punto (lat, lon) o resumen en una caja (bbox): pendiente, rugosidad, temperatura, aridez, etc., con fuente y licencia.',
    inputSchema: {
      type: 'object',
      properties: {
        lat: { type: 'number', minimum: -90, maximum: 90 },
        lon: { type: 'number', minimum: -180, maximum: 180 },
        bbox,
        columnas: { type: 'array', items: { type: 'string' }, description: 'Subconjunto de columnas; por omisión todas.' },
      },
      additionalProperties: false,
    },
    annotations: soloLectura,
    correr: (a) => resumirCapas7(a),
  },
  {
    name: 'ejecutar_motor',
    title: 'Ejecutar el motor de búsqueda (Rust)',
    description:
      'Corre `pipeline` sobre la tabla del ETL ($RUN) con todos sus parámetros. Escribe en una carpeta propia de la corrida (salidas/mcp/<id>); no toca lo publicado salvo con publicar_visor=true, que reemplaza el resultado de ese objetivo en visor/public/datos. Una corrida a la vez. Espera hasta esperar_s y devuelve el estado; si sigue corriendo, usa estado_corrida.',
    inputSchema: {
      type: 'object',
      properties: {
        objetivo,
        perfil,
        candidatos: { type: 'integer', minimum: 1, maximum: 500, default: 200 },
        hilos: { type: 'integer', minimum: 1, maximum: 64 },
        bbox,
        region_geojson: { type: 'object', description: 'Polygon, MultiPolygon, Feature o FeatureCollection (lon, lat).' },
        perfil_personalizado: {
          type: 'object',
          description: 'Cambia pesos y tolerancias del perfil: { "slope_mean_deg": { "peso": 2, "tolerancia": 1.5 } }.',
          additionalProperties: {
            type: 'object',
            properties: { peso: { type: 'number', minimum: 0 }, tolerancia: { type: 'number', exclusiveMinimum: 0 } },
            additionalProperties: false,
          },
        },
        separacion_km: { type: 'number', minimum: 0 },
        excluir_km: { type: 'number', minimum: 0 },
        k_area: { type: 'number', exclusiveMinimum: 0, maximum: 1 },
        min_area_km2: { type: 'number', minimum: 0 },
        solo_barrido: { type: 'boolean' },
        usar_puntos: { type: 'boolean', description: 'Pasa $RUN_PUNTOS como --puntos (cerca_de).' },
        publicar_visor: { type: 'boolean', description: 'Reemplaza el resultado publicado de este objetivo en el visor.' },
        timeout_s: { type: 'integer', minimum: 10, maximum: 3600, default: 900 },
        esperar_s: { type: 'integer', minimum: 0, maximum: 120, default: 50 },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    correr: async (a) => {
      const { esperar_s: espera, ...resto } = a;
      return ejecutarMotor(resto, { esperar_s: validarEntero(espera ?? 50, 'esperar_s', 0, 120) });
    },
  },
  {
    name: 'ejecutar_escenarios',
    title: 'Estabilidad entre escenarios',
    description:
      'Barre de una pasada varios escenarios (sitio × variables × factor de tolerancia × pesos × NDVI) y devuelve en qué fracción aparece cada candidato (estabilidad.json).',
    inputSchema: {
      type: 'object',
      properties: {
        escenarios: {
          type: 'array',
          minItems: 1,
          maxItems: 200,
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              objetivo: { type: 'string' },
              perfil: { type: 'string' },
              variables: { type: 'array', items: { type: 'string' } },
              factor_tolerancia: { type: 'number', minimum: 0 },
              pesos: { type: 'object', additionalProperties: { type: 'number', minimum: 0 } },
              ndvi_max: { type: 'number' },
              radio_exclusion_km: { type: 'number', minimum: 0 },
              separacion_km: { type: 'number', minimum: 0 },
            },
            required: ['id', 'objetivo'],
            additionalProperties: false,
          },
        },
        hilos: { type: 'integer', minimum: 1, maximum: 64 },
        timeout_s: { type: 'integer', minimum: 10, maximum: 3600 },
        esperar_s: { type: 'integer', minimum: 0, maximum: 120, default: 50 },
      },
      required: ['escenarios'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    correr: async (a) => {
      const { esperar_s: espera, ...resto } = a;
      return ejecutarEscenarios(resto, { esperar_s: validarEntero(espera ?? 50, 'esperar_s', 0, 120) });
    },
  },
  {
    name: 'estado_corrida',
    title: 'Estado de una corrida',
    description: 'Estado (corriendo, ok, error), duración, informe del motor y los 5 mejores candidatos de una corrida.',
    inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'], additionalProperties: false },
    annotations: soloLectura,
    correr: (a) => estadoCorrida(a.id),
  },
];

const REGLAS =
  'Usa solo los números que devuelven las herramientas de earth-analogs; si un dato falta, dilo ("sin dato"). ' +
  'La analogía es por procesos físicos, no por parecido visual. Di siempre en qué coincide y en qué difiere, ' +
  'incluidas gravedad, presión, atmósfera, radiación y escala. Cita la fuente y licencia de cada variable.';

const PROMPTS = [
  {
    name: 'evaluar_analogo',
    title: 'Evaluar un análogo',
    description: 'Evalúa con rigor un candidato de la Tierra para un sitio de la Luna o Marte.',
    arguments: [
      { name: 'objetivo', description: 'Código del sitio (p. ej. JZ)', required: true },
      { name: 'rango', description: 'Posición del candidato (1 = mejor)', required: false },
    ],
    texto: (a) =>
      `${REGLAS}\n\nLlama explicar_candidato con objetivo=${a.objetivo} y rango=${a.rango ?? 1}. ` +
      'Luego consultar_pines cerca de su centro (radio 100 km) y resumir_capas7 en ese punto. ' +
      'Escribe: 1) por qué es análogo (variables que coinciden, con valores), 2) en qué difiere físicamente, ' +
      '3) qué procesos podrían probarse allí y cuáles no, 4) advertencias de datos.',
  },
  {
    name: 'comparar_objetivos',
    title: 'Comparar dos sitios objetivo',
    description: 'Compara los mejores análogos de dos sitios objetivo.',
    arguments: [
      { name: 'objetivo_a', required: true },
      { name: 'objetivo_b', required: true },
    ],
    texto: (a) =>
      `${REGLAS}\n\nLlama obtener_candidatos para ${a.objetivo_a} y ${a.objetivo_b} (limite 5). ` +
      'Compara las notas, las variables que coinciden y las regiones de la Tierra donde caen. No inventes cifras.',
  },
  {
    name: 'buscar_en_region',
    title: 'Buscar análogos en una región',
    description: 'Corre el motor dentro de una caja geográfica y explica el mejor resultado.',
    arguments: [
      { name: 'objetivo', required: true },
      { name: 'bbox', description: 'lat1,lon1,lat2,lon2', required: true },
    ],
    texto: (a) =>
      `${REGLAS}\n\nLlama ejecutar_motor con objetivo=${a.objetivo} y bbox=[${a.bbox}]. Cuando esté en estado ok, ` +
      'llama explicar_candidato con la corrida devuelta y rango=1, y resume coincidencias y diferencias.',
  },
];

// --- JSON-RPC -------------------------------------------------------------------------------------------------

function enviar(msg) {
  process.stdout.write(`${JSON.stringify(msg)}\n`);
}

function aviso(texto) {
  process.stderr.write(`[earth-analogs] ${redactarSecretos(texto)}\n`);
}

function resultadoHerramienta(valor) {
  const texto = typeof valor?.markdown === 'string' ? `${valor.markdown}\n\n---\n${JSON.stringify(valor.datos)}` : JSON.stringify(valor, null, 1);
  return { content: [{ type: 'text', text: texto }], structuredContent: valor?.markdown ? valor.datos : valor };
}

export async function atender(msg, estado = {}) {
  const { id, method, params = {} } = msg;
  switch (method) {
    case 'initialize': {
      const pedida = params.protocolVersion;
      estado.version = VERSIONES.includes(pedida) ? pedida : VERSIONES[0];
      return {
        protocolVersion: estado.version,
        capabilities: { tools: { listChanged: false }, prompts: { listChanged: false } },
        serverInfo: SERVIDOR,
        instructions: REGLAS,
      };
    }
    case 'ping':
      return {};
    case 'tools/list':
      return {
        tools: HERRAMIENTAS.map(({ name, title, description, inputSchema, annotations }) => ({
          name,
          title,
          description,
          inputSchema,
          annotations,
        })),
      };
    case 'tools/call': {
      const h = HERRAMIENTAS.find((x) => x.name === params.name);
      if (!h) throw Object.assign(new Error(`herramienta desconocida: ${params.name}`), { code: -32602 });
      try {
        const r = resultadoHerramienta(await h.correr(params.arguments ?? {}));
        if (estado.version === '2024-11-05') delete r.structuredContent;
        return r;
      } catch (e) {
        const texto = e instanceof ErrorValidacion || e instanceof SyntaxError ? e.message : `error interno: ${e.message}`;
        if (!(e instanceof ErrorValidacion)) aviso(e.stack ?? String(e));
        return { content: [{ type: 'text', text: redactarSecretos(texto) }], isError: true };
      }
    }
    case 'prompts/list':
      return { prompts: PROMPTS.map(({ name, title, description, arguments: a }) => ({ name, title, description, arguments: a })) };
    case 'prompts/get': {
      const p = PROMPTS.find((x) => x.name === params.name);
      if (!p) throw Object.assign(new Error(`prompt desconocido: ${params.name}`), { code: -32602 });
      const args = params.arguments ?? {};
      for (const a of p.arguments) {
        if (a.required && !args[a.name]) throw Object.assign(new Error(`falta ${a.name}`), { code: -32602 });
      }
      return { description: p.description, messages: [{ role: 'user', content: { type: 'text', text: p.texto(args) } }] };
    }
    case 'resources/list':
      return { resources: [] };
    case 'resources/templates/list':
      return { resourceTemplates: [] };
    default:
      throw Object.assign(new Error(`método no soportado: ${method}`), { code: -32601 });
  }
}

function iniciar() {
  const estado = {};
  const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
  rl.on('line', async (linea) => {
    if (!linea.trim()) return;
    let msg;
    try {
      msg = JSON.parse(linea);
    } catch {
      enviar({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'JSON inválido' } });
      return;
    }
    if (msg.id === undefined || msg.id === null) return; // notificación (initialized, cancelled…)
    try {
      enviar({ jsonrpc: '2.0', id: msg.id, result: await atender(msg, estado) });
    } catch (e) {
      enviar({ jsonrpc: '2.0', id: msg.id, error: { code: e.code ?? -32603, message: redactarSecretos(e.message) } });
    }
  });
  rl.on('close', () => process.exit(0));
  aviso('servidor MCP listo por stdio');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) iniciar();
