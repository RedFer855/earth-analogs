// Datos de la ficha que no vienen en el resultado del motor: valores de capas7 (~50 km) en un punto, minerales y
// suelo frente al resto de la Tierra, y el nombre del lugar (geocodificación inversa con Photon).
import { obtenerColumnaCapas7, type DatosCapas7 } from './capas7';
import { ang2pixNested, buscarIpix } from './healpix';
import { percentil } from './solidez';

export const ASTER: [string, string, string][] = [
  ['aster_qi', 'Índice de cuarzo (QI)', 'Mayor que 1 en arena de cuarzo.'],
  ['aster_ci', 'Índice de carbonato (CI)', 'Más alto cuanto más carbonato (indicio, no medida directa).'],
  ['aster_mi', 'Índice máfico (MI)', 'Bajo en rocas ricas en sílice, alto en basaltos.'],
];
export const EMIT: Record<string, string> = {
  emit_calcite: 'Calcita',
  emit_dolomite: 'Dolomita',
  emit_gypsum: 'Yeso',
  emit_hematite: 'Hematita',
  emit_goethite: 'Goethita',
  emit_kaolinite: 'Caolinita',
  emit_montmorillonite: 'Montmorillonita',
  emit_illite_muscovite: 'Illita / moscovita',
  emit_chlorite: 'Clorita',
  emit_vermiculite: 'Vermiculita',
  emit_quartz_feldspar: 'Cuarzo y feldespato',
};
export const SUELO: Record<string, string> = { arcilla_gkg: 'Arcilla', limo_gkg: 'Limo', arena_frac: 'Arena' };
export const ROCA: Record<string, string> = {
  roca_volcanica_frac: 'Roca volcánica',
  roca_evaporita_frac: 'Evaporitas (yeso, sal)',
};

export type Lectura = 'alto' | 'bajo' | 'típico';
export const lectura = (p: number): Lectura => (p >= 85 ? 'alto' : p <= 15 ? 'bajo' : 'típico');

export interface ValorCapa {
  columna: string;
  nombre: string;
  valor: number | null;
  unidad: string;
  percentil: number | null;
  pista?: string;
}

export interface Minerales {
  ipix: number;
  roca: ValorCapa[];
  aster: ValorCapa[];
  emit: ValorCapa[];
  suelo: ValorCapa[];
  fuentes: string[];
}

/** Índice de la celda de nivel 7 que contiene el punto, o -1 si no tiene tierra en la tabla. */
export function indiceCapas7(d: DatosCapas7, lat: number, lon: number): number {
  return buscarIpix(d.ipix, ang2pixNested(d.meta.nside, lat, lon));
}

/** Valores de varias columnas en una celda (carga las que falten). */
export async function valoresEn(d: DatosCapas7, i: number, columnas: string[], base: string): Promise<Record<string, number | null>> {
  const salida: Record<string, number | null> = {};
  await Promise.all(
    columnas
      .filter((c) => d.meta.columnas[c])
      .map(async (c) => {
        const col = await obtenerColumnaCapas7(d, c, base);
        const v = i >= 0 ? col[i] : Number.NaN;
        salida[c] = Number.isFinite(v) ? v : null;
      }),
  );
  return salida;
}

export async function mineralesEn(d: DatosCapas7, lat: number, lon: number, base: string): Promise<Minerales | null> {
  const i = indiceCapas7(d, lat, lon);
  if (i < 0) return null;
  const todas = [...Object.keys(ROCA), ...ASTER.map((a) => a[0]), ...Object.keys(EMIT), ...Object.keys(SUELO)];
  const v = await valoresEn(d, i, todas, base);
  const fuentes = new Set<string>();
  const armar = (columna: string, nombre: string, pista?: string): ValorCapa | null => {
    const m = d.meta.columnas[columna];
    if (!m) return null;
    fuentes.add(m.fuente);
    const x = v[columna] ?? null;
    const col = d.cacheColumnas.get(columna);
    return { columna, nombre, valor: x, unidad: m.unidad, percentil: x === null || !col ? null : percentil(col, x), pista };
  };
  const lista = <T,>(xs: (T | null)[]): T[] => xs.filter((x): x is T => x !== null);
  return {
    ipix: d.ipix[i],
    roca: lista(Object.entries(ROCA).map(([c, n]) => armar(c, n))),
    aster: lista(ASTER.map(([c, n, p]) => armar(c, n, p))),
    emit: lista(Object.entries(EMIT).map(([c, n]) => armar(c, n))),
    suelo: lista(Object.entries(SUELO).map(([c, n]) => armar(c, n))),
    fuentes: [...fuentes],
  };
}

// --- Lugar ----------------------------------------------------------------------------------------------------

const lugares = new Map<string, string>();

/** «Ciudad, región, país» del punto más cercano según Photon (OpenStreetMap). Si falla, null. */
export async function nombreLugar(lat: number, lon: number): Promise<string | null> {
  const clave = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  const previo = lugares.get(clave);
  if (previo !== undefined) return previo || null;
  try {
    const res = await fetch(`https://photon.komoot.io/reverse?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}&limit=1`, {
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      signal: AbortSignal.timeout(8000), // Photon público puede tardar decenas de segundos
    });
    if (!res.ok) throw new Error(String(res.status));
    const j = (await res.json()) as { features?: { properties?: Record<string, string> }[] };
    const p = j.features?.[0]?.properties;
    const partes = p ? [p.name ?? p.city ?? p.county, p.state, p.country].filter(Boolean) : [];
    const nombre = [...new Set(partes)].join(', ');
    lugares.set(clave, nombre);
    return nombre || null;
  } catch {
    lugares.set(clave, '');
    return null;
  }
}
