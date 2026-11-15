import { ipixACentro } from './healpix';

/*
 * Una búsqueda multicondición puede cumplirse en miles de celdas pegadas (nivel 7, ~50 km). Dibujarlas todas
 * tapa el mapa y no dice dónde están los lugares distintos. Se agrupan en regiones HEALPix más grandes (por
 * omisión nside 16, ~400 km): cada región es un punto con cuántas celdas cumplen.
 */

export const NSIDE_REGION = 16;

export interface RegionBusqueda {
  lat: number;
  lon: number;
  /** Celdas de la región que cumplen (todas las condiciones, o alguna si no se pidió «solo todas»). */
  celdas: number;
  /** De esas, las que cumplen todas las condiciones. */
  todas: number;
}

/** Agrupa las celdas que cumplen por región. Orden HEALPix anidado: el padre es ipix >> 2·log2(nside/nsideRegion). */
export function agruparBusqueda(
  ipix: Uint32Array,
  nside: number,
  conteos: Uint8Array,
  totalCondiciones: number,
  soloTodas: boolean,
  nsideRegion = NSIDE_REGION,
): RegionBusqueda[] {
  if (totalCondiciones === 0) return [];
  const bits = nside > nsideRegion ? 2 * Math.round(Math.log2(nside / nsideRegion)) : 0;
  const grupos = new Map<number, { x: number; y: number; z: number; n: number; todas: number }>();
  for (let i = 0; i < conteos.length; i += 1) {
    const c = conteos[i];
    const cumpleTodas = c === totalCondiciones;
    if (!cumpleTodas && (soloTodas || c === 0)) continue;
    const [lat, lon] = ipixACentro(ipix[i], nside);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const clave = Math.floor(ipix[i] / 2 ** bits);
    const phi = (lat * Math.PI) / 180;
    const lam = (lon * Math.PI) / 180;
    const g = grupos.get(clave) ?? { x: 0, y: 0, z: 0, n: 0, todas: 0 };
    // vectores unitarios: el promedio no se rompe en el antimeridiano ni en los polos
    g.x += Math.cos(phi) * Math.cos(lam);
    g.y += Math.cos(phi) * Math.sin(lam);
    g.z += Math.sin(phi);
    g.n += 1;
    if (cumpleTodas) g.todas += 1;
    grupos.set(clave, g);
  }
  const regiones: RegionBusqueda[] = [];
  for (const g of grupos.values()) {
    const norma = Math.hypot(g.x, g.y, g.z);
    if (norma === 0) continue;
    regiones.push({
      lat: (Math.asin(g.z / norma) * 180) / Math.PI,
      lon: (Math.atan2(g.y, g.x) * 180) / Math.PI,
      celdas: g.n,
      todas: g.todas,
    });
  }
  regiones.sort((a, b) => b.todas - a.todas || b.celdas - a.celdas);
  return regiones;
}
