// Enlace al simulador 3D (nasa-3d-sandbox), contrato de URL v1:
// <base>/?v=1&body=mars&mode=rover&n1=..&n2=..&n3=..&n5=..&seed=<ipix>&site=..&label=..
// Una variable sin dato no se envía: el simulador la muestra como faltante (nunca 0).
import type { Celda } from '../datos/contrato';
import type { ResumenVariableZona } from '../datos/cruceZona';

export type CuerpoSim = 'moon' | 'mars' | 'earth';
export type ModoSim = 'rover' | 'suit' | 'lidar' | 'drill';
export type ClaveN = 'n1' | 'n2' | 'n3' | 'n5';
export type VariablesSim = Partial<Record<ClaveN, number | null>>;

export interface DatosEnlace {
  cuerpo: CuerpoSim;
  modo: ModoSim;
  variables: VariablesSim;
  ipix?: number | null;
  sitio?: string | null;
  etiqueta?: string | null;
}

/** Columna del ETL → variable N del simulador. */
export const COLUMNA_A_N: Record<string, ClaveN> = {
  slope_mean_deg: 'n1',
  rug_rms_mean_m: 'n2',
  relieve_mean_m: 'n3',
  rango_diurno_k: 'n5',
};

const ORDEN_N: ClaveN[] = ['n1', 'n2', 'n3', 'n5'];

export const URL_SIMULADOR_DEFECTO = 'http://localhost:5180/';

/** Base del simulador desde VITE_SIMULADOR_URL (en node no hay import.meta.env). */
export function urlSimulador(): string {
  const env = (import.meta as { env?: Record<string, string | undefined> }).env;
  const v = env?.VITE_SIMULADOR_URL?.trim();
  return v ? v : URL_SIMULADOR_DEFECTO;
}

const finito = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

function ordenar(v: VariablesSim): VariablesSim {
  const out: VariablesSim = {};
  for (const n of ORDEN_N) if (finito(v[n])) out[n] = v[n];
  return out;
}

/** Variables de una celda candidata; las marcadas sin_dato se omiten. El diagnóstico (temperatura) aporta n5. */
export function variablesDeCelda(c: Celda): VariablesSim {
  const out: VariablesSim = {};
  for (const [col, n] of Object.entries(COLUMNA_A_N)) {
    const vc = c.variables?.[col];
    if (vc && vc.etiqueta !== 'sin_dato' && finito(vc.valor)) {
      out[n] = vc.valor;
      continue;
    }
    const d = c.diagnostico?.[col];
    if (d && finito(d.valor)) out[n] = d.valor;
  }
  return ordenar(out);
}

/** Variables a partir de las medias ETL de una zona. */
export function variablesDeFilas(filas: ResumenVariableZona[]): VariablesSim {
  const out: VariablesSim = {};
  for (const f of filas) {
    const n = COLUMNA_A_N[f.columna];
    if (n && f.nValidos > 0 && finito(f.media)) out[n] = f.media;
  }
  return ordenar(out);
}

/** 'luna'/'marte'/'tierra' (o en inglés) → cuerpo del simulador. */
export function cuerpoSim(c: string | null | undefined, defecto: CuerpoSim = 'mars'): CuerpoSim {
  const t = (c ?? '').toLowerCase();
  if (t === 'luna' || t === 'moon') return 'moon';
  if (t === 'marte' || t === 'mars') return 'mars';
  if (t === 'tierra' || t === 'earth') return 'earth';
  return defecto;
}

const redondear = (x: number): string => String(Math.round(x * 1000) / 1000);

export function construirEnlace(d: DatosEnlace, base: string = urlSimulador()): string {
  const u = new URL(base);
  const p = u.searchParams;
  p.set('v', '1');
  p.set('body', d.cuerpo);
  p.set('mode', d.modo);
  for (const n of ORDEN_N) {
    const x = d.variables[n];
    if (finito(x)) p.set(n, redondear(x));
  }
  if (finito(d.ipix)) p.set('seed', String(Math.trunc(d.ipix)));
  if (d.sitio) p.set('site', d.sitio);
  if (d.etiqueta) p.set('label', d.etiqueta.slice(0, 80));
  return u.toString();
}

const TXT_MODO: Record<ModoSim, string> = { rover: 'Rover', suit: 'Traje (EVA)', lidar: 'Lidar de aterrizaje', drill: 'Taladro ISRU' };
const TXT_CUERPO: Record<CuerpoSim, string> = { moon: 'la Luna', mars: 'Marte', earth: 'la Tierra' };
const TXT_N: Record<ClaveN, (x: number) => string> = {
  n1: (x) => `N1 ${redondear(x)}°`,
  n2: (x) => `N2 ${redondear(x)} m`,
  n3: (x) => `N3 ${redondear(x)} m`,
  n5: (x) => `N5 ${redondear(x)} K`,
};

/** Resumen corto: "Rover en Marte · Jezero #1 · N1 18.2°, N2 0.21 m · N3/N4/N6/N7 sin dato". */
export function resumenEnlace(d: DatosEnlace): string {
  const con = ORDEN_N.filter((n) => finito(d.variables[n])).map((n) => TXT_N[n](d.variables[n] as number));
  const faltan = ['n1', 'n2', 'n3', 'n4', 'n5', 'n6', 'n7'].filter((n) => !finito(d.variables[n as ClaveN]));
  const partes = [`${TXT_MODO[d.modo]} en ${TXT_CUERPO[d.cuerpo]}`];
  if (d.etiqueta) partes.push(d.etiqueta);
  if (con.length) partes.push(con.join(', '));
  if (faltan.length) partes.push(`${faltan.map((n) => n.toUpperCase()).join('/')} sin dato`);
  return partes.join(' · ');
}
