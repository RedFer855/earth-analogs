// Solidez del ajuste de un candidato: índice orientativo de 0 a 100 con su rango, y lectura variable por variable.
// Cinco componentes con puntos fijos: ajuste 40, discriminación 20, robustez 20, calidad del perfil 10, cobertura 10.
// No es una probabilidad calibrada ni una verificación: dice cuánto creer que el parecido con el objetivo es real.
//
// Con los datos publicados:
// - ajuste: 0,5 · fracción de variables dentro de la tolerancia + 0,5 · cercanía media (1 - |d|/tol, mínimo 0).
// - discriminación: fracción de variables cuya tolerancia no pasa de 5 veces la escala de la Tierra.
// - robustez: k/n de estabilidad.json (en cuántos escenarios aparece la celda). El rango usa Wilson al 95 %.
//   Sin estabilidad.json la robustez puntual es 0 y su rango va de 0 a 1.
// - calidad: no se publica por perfil; queda neutra (0,5) y su incertidumbre (0,1 a 1) entra al rango.
// - cobertura: variables con dato / variables del perfil.
// Topes por el eslabón más débil: ajuste < 0,6, discriminación < 0,5 o robustez (Wilson inferior) < 0,7 limitan el nivel.

import type { Celda, Diagnostico, ResultadoJson, VariableParametro } from './contrato';

export const PUNTOS = { ajuste: 40, discriminacion: 20, robustez: 20, calidad: 10, cobertura: 10 } as const;
export const UMBRALES = { alta: 65, media: 40 } as const;
export type Nivel = 'alta' | 'media' | 'baja';

export interface Solidez {
  nivel: Nivel;
  puntaje: number;
  puntaje_bruto: number;
  bajo: number;
  alto: number;
  componentes: Record<keyof typeof PUNTOS, number>;
  robustez_rango: [number, number] | null;
  limitantes: string[];
  razones: string[];
}

export function wilson(k: number, n: number, z = 1.96): { lo: number; centro: number; hi: number } {
  if (!n) return { lo: 0, centro: 0, hi: 1 };
  const p = Math.min(1, k / n);
  const d = 1 + (z * z) / n;
  const centro = (p + (z * z) / (2 * n)) / d;
  const m = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return { lo: Math.max(0, centro - m), centro, hi: Math.min(1, centro + m) };
}

export const nivelDe = (p: number): Nivel => (p >= UMBRALES.alta ? 'alta' : p >= UMBRALES.media ? 'media' : 'baja');
const ORDEN: Nivel[] = ['baja', 'media', 'alta'];
const tope = (n: Nivel, max: Nivel): Nivel => (ORDEN.indexOf(n) > ORDEN.indexOf(max) ? max : n);

export interface Senales {
  ok: number;
  n: number;
  cercania: number;
  sin: number;
  anchas: number;
  /** apariciones y escenarios (null si no hay estabilidad.json) */
  k: number | null;
  nEsc: number | null;
}

/** Puntaje, rango y nivel a partir de las señales ya medidas (puro, para pruebas). */
export function puntuar(s: Senales): Omit<Solidez, 'razones'> {
  const disc = s.n ? (s.n - s.anchas) / s.n : 0;
  const hayEsc = s.k !== null && s.nEsc !== null && s.nEsc > 0;
  const w = hayEsc ? wilson(s.k as number, s.nEsc as number) : { lo: 0, centro: 0, hi: 1 };
  const rob = hayEsc ? Math.min(1, (s.k as number) / (s.nEsc as number)) : 0;
  const q = 0.5;
  const cob = s.n ? 1 - s.sin / s.n : 0;
  const aj = s.n - s.sin > 0 ? 0.5 * (s.ok / (s.n - s.sin)) + 0.5 * s.cercania : 0;
  const comp = {
    ajuste: PUNTOS.ajuste * aj,
    discriminacion: PUNTOS.discriminacion * disc,
    robustez: PUNTOS.robustez * rob,
    calidad: PUNTOS.calidad * q,
    cobertura: PUNTOS.cobertura * cob,
  };
  const bruto = comp.ajuste + comp.discriminacion + comp.robustez + comp.calidad + comp.cobertura;
  // Las variables sin dato abren el rango del ajuste (cotas de Manski): peor caso = fallan, mejor caso = coinciden.
  const fracSin = s.n ? s.sin / s.n : 0;
  const ajLo = aj * (1 - fracSin);
  const ajHi = aj * (1 - fracSin) + fracSin;
  const base = PUNTOS.discriminacion * disc + PUNTOS.cobertura * cob;
  const bajo = Math.max(0, base + PUNTOS.ajuste * ajLo + PUNTOS.calidad * 0.1 + PUNTOS.robustez * w.lo);
  const alto = Math.min(100, base + PUNTOS.ajuste * ajHi + PUNTOS.calidad * 1 + PUNTOS.robustez * w.hi);
  let nivel = nivelDe(bruto);
  const limitantes: string[] = [];
  if (aj < 0.6) {
    nivel = tope(nivel, aj < 0.4 ? 'baja' : 'media');
    limitantes.push('el ajuste con el objetivo es flojo (menos de 60 % entre variables dentro de tolerancia y cercanía)');
  }
  if (disc < 0.5) {
    nivel = tope(nivel, 'media');
    limitantes.push('la mitad o más de las variables tienen tolerancias tan anchas que casi no discriminan');
  }
  if (w.lo < 0.7) {
    nivel = tope(nivel, 'media');
    limitantes.push(hayEsc ? 'aparece en pocos escenarios y el margen de la robustez es amplio' : 'no hay dato de estabilidad entre escenarios');
  }
  const techo = nivel === 'baja' ? UMBRALES.media - 1 : nivel === 'media' ? UMBRALES.alta - 1 : 100;
  const r = (x: number) => Math.round(x);
  return {
    nivel,
    puntaje: Math.min(techo, r(bruto)),
    puntaje_bruto: r(bruto),
    bajo: r(bajo),
    alto: r(alto),
    componentes: Object.fromEntries(Object.entries(comp).map(([k, v]) => [k, Number(v.toFixed(1))])) as Solidez['componentes'],
    robustez_rango: hayEsc ? [Math.round(w.lo * 100), Math.round(w.hi * 100)] : null,
    limitantes,
  };
}

// --- Variable por variable -------------------------------------------------------------------------------------

export interface LecturaVariable {
  id: string;
  aqui: number | null;
  objetivo: number;
  tolerancia: number;
  escala: number;
  coincide: boolean | null;
  /** |aquí − objetivo| / tolerancia; 1 = justo en el límite */
  veces_tolerancia: number | null;
  direccion: 'más alto' | 'más bajo' | null;
  /** el objetivo real queda fuera de lo que existe en la Tierra */
  objetivo_real: number | null;
}

export function leerVariable(p: VariableParametro, objetivo: number, aqui: number | null, objetivoReal: number | null = null): LecturaVariable {
  const ok = aqui !== null && Number.isFinite(aqui);
  const d = ok ? (aqui as number) - objetivo : null;
  const veces = d === null || p.tolerancia <= 0 ? null : Math.round((Math.abs(d) / p.tolerancia) * 10) / 10;
  return {
    id: p.id,
    aqui: ok ? (aqui as number) : null,
    objetivo,
    tolerancia: p.tolerancia,
    escala: p.escala,
    coincide: d === null ? null : Math.abs(d) <= p.tolerancia,
    veces_tolerancia: veces,
    direccion: d === null || Math.abs(d) <= p.tolerancia ? null : d > 0 ? 'más alto' : 'más bajo',
    objetivo_real: objetivoReal !== null && objetivoReal !== objetivo ? objetivoReal : null,
  };
}

/** Lectura de las variables del perfil con valores de cualquier origen (candidato o capas7 de un análogo). */
export function leerVariables(resultado: ResultadoJson, valores: (id: string) => number | null): LecturaVariable[] {
  return resultado.parametros.variables.map((p) => {
    const o = resultado.objetivo.variables[p.id];
    return leerVariable(p, o?.valor ?? Number.NaN, valores(p.id), o?.valor_real ?? null);
  });
}

export interface Estabilidad {
  aparece_en: number;
  n_escenarios: number;
}

export function solidezDe(lecturas: LecturaVariable[], est: Estabilidad | null): Solidez {
  const n = lecturas.length;
  const conDato = lecturas.filter((l) => l.coincide !== null);
  const ok = conDato.filter((l) => l.coincide).length;
  const sin = n - conDato.length;
  const cercania = conDato.length
    ? conDato.reduce((s, l) => s + Math.max(0, 1 - (l.veces_tolerancia ?? 0)), 0) / conDato.length
    : 0;
  const anchas = lecturas.filter((l) => l.escala > 0 && l.tolerancia / l.escala > 5).length;
  const r = puntuar({ ok, n, cercania, sin, anchas, k: est?.aparece_en ?? null, nEsc: est?.n_escenarios ?? null });
  const razones = [`${ok} de ${n} variables dentro de la tolerancia del objetivo.`];
  if (anchas) razones.push(`${anchas} de ${n} variables tienen una tolerancia de más de 5 veces la variación natural de la Tierra: casi no discriminan.`);
  if (est) {
    razones.push(
      `Aparece en ${est.aparece_en} de ${est.n_escenarios} escenarios (${Math.round((est.aparece_en / est.n_escenarios) * 100)} %): Wilson al 95 % da de ${r.robustez_rango?.[0]} % a ${r.robustez_rango?.[1]} %.`,
    );
  } else {
    razones.push('Sin estabilidad entre escenarios publicada: la robustez cuenta 0 y su rango va de 0 % a 100 %.');
  }
  razones.push('La calidad del perfil no se publica: queda neutra (50 %) y su incertidumbre (10 %–100 %) entra al rango.');
  if (sin) razones.push(`${sin} variable(s) sin dato: abren el rango del ajuste.`);
  for (const l of r.limitantes) razones.push(`Nivel limitado porque ${l}.`);
  razones.push('Sin verificar con una fuente independiente: es un índice orientativo, no una probabilidad calibrada.');
  return { ...r, razones };
}

export function solidezDeCandidato(resultado: ResultadoJson, c: Celda, est: Estabilidad | null): Solidez {
  return solidezDe(leerVariables(resultado, (id) => c.variables[id]?.valor ?? null), est);
}

export function diagnosticos(c: Celda): [string, Diagnostico][] {
  return Object.entries(c.diagnostico ?? {});
}

// --- Top multivariable -----------------------------------------------------------------------------------------

export interface TopItem {
  clave: string;
  lat: number;
  lon: number;
  objetivos: { sitio: string; rango: number; nota: number }[];
  nota_media: number;
}

/**
 * Lugares de la Tierra que salen entre los candidatos de varios objetivos a la vez. Se agrupan por celda de
 * 1° × 1°; gana el que se parece a más objetivos y, a igualdad, el de mejor nota media.
 */
export function topMultivariable(resultados: ResultadoJson[], n = 3): TopItem[] {
  const grupos = new Map<string, TopItem>();
  for (const r of resultados) {
    for (const c of r.candidatos) {
      const clave = `${Math.floor(c.centro.lat)},${Math.floor(c.centro.lon)}`;
      const g = grupos.get(clave) ?? { clave, lat: c.centro.lat, lon: c.centro.lon, objetivos: [], nota_media: 0 };
      const previo = g.objetivos.find((o) => o.sitio === r.sitio);
      if (!previo) g.objetivos.push({ sitio: r.sitio, rango: c.rango, nota: c.nota });
      else if (c.nota > previo.nota) Object.assign(previo, { rango: c.rango, nota: c.nota });
      grupos.set(clave, g);
    }
  }
  const lista = [...grupos.values()].filter((g) => g.objetivos.length > 1);
  for (const g of lista) g.nota_media = g.objetivos.reduce((s, o) => s + o.nota, 0) / g.objetivos.length;
  return lista
    .sort((a, b) => b.objetivos.length - a.objetivos.length || b.nota_media - a.nota_media)
    .slice(0, n);
}

/** Percentil (0-100) de un valor dentro de una columna de capas7 (sin NaN). */
export function percentil(columna: Float32Array, valor: number): number | null {
  if (!Number.isFinite(valor)) return null;
  let menores = 0;
  let total = 0;
  for (const x of columna) {
    if (!Number.isFinite(x)) continue;
    total += 1;
    if (x < valor) menores += 1;
  }
  return total ? Math.round((menores / total) * 100) : null;
}
