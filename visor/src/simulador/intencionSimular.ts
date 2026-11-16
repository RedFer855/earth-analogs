// Intención "simula…" del chat, sin modelo ni clave: detecta el disparador y extrae modo, cuerpo, lugar y valores.
// Si hay intención pero ni lugar ni valores, pide el lugar: nunca inventa números.
import { cuerpoSim, resumenEnlace, type CuerpoSim, type DatosEnlace, type ModoSim, type VariablesSim } from './enlaceSimulador';

export interface SeleccionSim {
  cuerpo: CuerpoSim;
  variables: VariablesSim;
  ipix?: number | null;
  sitio?: string | null;
  etiqueta?: string | null;
}

export interface ContextoSimulacion {
  /** Lugar seleccionado ahora en el visor ("este lugar", "aquí"). */
  seleccion?: SeleccionSim | null;
  /** Sitios objetivo de metrics.json. */
  sitios?: { id: string; nombre: string; cuerpo: string }[];
}

export type ResultadoSimulacion =
  | { tipo: 'enlace'; datos: DatosEnlace; resumen: string }
  | { tipo: 'preguntar_lugar'; mensaje: string };

const normalizar = (t: string): string =>
  t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

const DISPARADOR = /\b(simula\w*|simulate\w*|prueba(lo)? en el simulador|abre el simulador|open the simulator)\b/;

const MODOS: [ModoSim, RegExp][] = [
  ['drill', /\b(taladro|perforar|perfora\w*|broca|drill\w*|isru)\b/],
  ['lidar', /\b(lidar|aterrizaje|aterrizar|lander|landing)\b/],
  ['suit', /\b(traje|astronauta|eva|caminar|camina\w*|suit|walk\w*)\b/],
  ['rover', /\b(rover|robot|vehiculo|vehicle)\b/],
];

const CUERPOS: [CuerpoSim, RegExp][] = [
  ['moon', /\b(luna|lunar|moon)\b/],
  ['mars', /\b(marte|marciano|mars|martian)\b/],
  ['earth', /\b(tierra|earth)\b/],
];

const DEICTICO = /\b(este lugar|esta zona|este sitio|este punto|aqui|aca|this place|here)\b/;

const NUM = '(-?\\d+(?:[.,]\\d+)?)';
const VALORES: [keyof VariablesSim, RegExp][] = [
  ['n1', new RegExp(`\\b(?:pendiente|slope)\\s*(?:de\\s*)?${NUM}`)],
  ['n2', new RegExp(`\\b(?:rugosidad|roughness)\\s*(?:de\\s*)?${NUM}`)],
  ['n3', new RegExp(`\\b(?:relieve|relief)\\s*(?:de\\s*)?${NUM}`)],
];

const leerNum = (s: string): number => Number(s.replace(',', '.'));

export const MENSAJE_PEDIR_LUGAR =
  '¿Qué lugar quieres simular? Elige un candidato y escribe «simula un rover con este lugar», nombra un sitio objetivo o da valores (p. ej. «pendiente 20»).';

export function interpretarSimulacion(texto: string, contexto: ContextoSimulacion = {}): ResultadoSimulacion | null {
  const t = normalizar(texto);
  if (!DISPARADOR.test(t)) return null;

  const modo = MODOS.find(([, re]) => re.test(t))?.[0] ?? 'rover';
  const cuerpoPedido = CUERPOS.find(([, re]) => re.test(t))?.[0] ?? null;

  const valores: VariablesSim = {};
  for (const [n, re] of VALORES) {
    const m = re.exec(t);
    if (m) {
      const x = leerNum(m[1]);
      if (Number.isFinite(x)) valores[n] = x;
    }
  }

  const sel = contexto.seleccion ?? null;
  const sitio = (contexto.sitios ?? []).find((s) => {
    const id = normalizar(s.id).replace(/[^a-z0-9]/g, '');
    const nombre = normalizar(s.nombre);
    return (id.length >= 2 && new RegExp(`\\b${id}\\b`).test(t)) || (nombre.length >= 3 && t.includes(nombre));
  });

  let base: SeleccionSim | null = null;
  if (DEICTICO.test(t) && sel) base = sel;
  else if (sitio) {
    base =
      sel && sel.sitio === sitio.id
        ? sel
        : { cuerpo: cuerpoSim(sitio.cuerpo), variables: {}, sitio: sitio.id, etiqueta: sitio.nombre };
  }

  if (!base && Object.keys(valores).length === 0) return { tipo: 'preguntar_lugar', mensaje: MENSAJE_PEDIR_LUGAR };

  const datos: DatosEnlace = {
    cuerpo: cuerpoPedido ?? base?.cuerpo ?? 'mars',
    modo,
    variables: { ...(base?.variables ?? {}), ...valores },
    ipix: base?.ipix ?? null,
    sitio: base?.sitio ?? null,
    etiqueta: base?.etiqueta ?? null,
  };
  return { tipo: 'enlace', datos, resumen: resumenEnlace(datos) };
}

/** Valida un bloque {"accion":"simular",...} que devuelva el modelo, con las mismas reglas del enlace. */
export function accionDeModelo(respuesta: string): DatosEnlace | null {
  const m = /\{[^{}]*"accion"\s*:\s*"simular"[^{}]*\}/.exec(respuesta);
  if (!m) return null;
  let o: Record<string, unknown>;
  try {
    o = JSON.parse(m[0]) as Record<string, unknown>;
  } catch {
    return null;
  }
  const modos: ModoSim[] = ['rover', 'suit', 'lidar', 'drill'];
  const modo = modos.includes(o.modo as ModoSim) ? (o.modo as ModoSim) : 'rover';
  const variables: VariablesSim = {};
  for (const n of ['n1', 'n2', 'n3', 'n5'] as const) {
    const x = o[n];
    if (typeof x === 'number' && Number.isFinite(x)) variables[n] = x;
  }
  return {
    cuerpo: cuerpoSim(typeof o.cuerpo === 'string' ? o.cuerpo : null),
    modo,
    variables,
    sitio: typeof o.sitio === 'string' ? o.sitio : null,
    etiqueta: typeof o.etiqueta === 'string' ? o.etiqueta : null,
  };
}
