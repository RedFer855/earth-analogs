import type { ColumnaCapas7 } from './capas7';
import type { Celda, PuntoFeature, PuntosGeoJson } from './contrato';
import type { Coordenada } from './coordenadas';
import {
  areaEsfericaM2,
  desenrollarLongitudes,
  distanciaGeodesicaM,
  normalizarLon,
  perimetroEsfericoM,
  puntoEnPoligono,
} from './geometria';
import { ipixACentro } from './healpix';

export interface ResumenVariableZona {
  columna: string;
  unidad: string;
  min: number;
  media: number;
  max: number;
  nValidos: number;
}

export interface ZonaGuardada {
  id: string;
  nombre: string;
  forma: 'cuadro' | 'circulo' | 'poligono';
  coords: Coordenada[];
  areaKm2: number;
  perimetroKm: number;
  color: string;
  creadaEn: string;
  /** Cuerpo al que la zona quiere parecerse; opcional para no romper lo guardado antes. */
  cuerpo?: 'marte' | 'luna';
  /** Sitio objetivo elegido (id del índice) y su nombre al momento de elegirlo. */
  objetivo?: string;
  objetivoNombre?: string;
  notas?: string;
}

export interface SeleccionCeldasZona {
  indices: number[];
  aproximacionPorCercania: boolean;
}

/** Promedio de vértices con longitudes desenrolladas: una zona que cruza 180° no cae en el meridiano 0. */
export function centroPoligono(coords: Coordenada[]): Coordenada {
  if (coords.length === 0) return { lat: 0, lon: 0 };
  const anillo = desenrollarLongitudes(coords);
  let sumLat = 0;
  let sumLon = 0;
  for (const c of anillo) {
    sumLat += c.lat;
    sumLon += c.lon;
  }
  return { lat: sumLat / anillo.length, lon: normalizarLon(sumLon / anillo.length) };
}

export function seleccionarCeldasEnZona(
  poligono: Coordenada[],
  ipix: Uint32Array,
  nside: number,
): SeleccionCeldasZona {
  const indices: number[] = [];
  if (poligono.length < 3 || ipix.length === 0) {
    return { indices, aproximacionPorCercania: false };
  }

  let minLat = 90;
  let maxLat = -90;
  for (const c of poligono) {
    if (c.lat < minLat) minLat = c.lat;
    if (c.lat > maxLat) maxLat = c.lat;
  }
  const margenLat = 1.5;

  let idxMasCercano = -1;
  let distMinM = Number.POSITIVE_INFINITY;
  const centro = centroPoligono(poligono);

  for (let i = 0; i < ipix.length; i += 1) {
    const [lat, lon] = ipixACentro(ipix[i], nside);
    if (lat < minLat - margenLat || lat > maxLat + margenLat) continue;
    if (puntoEnPoligono(lat, lon, poligono)) {
      indices.push(i);
    } else if (indices.length === 0) {
      const d = distanciaGeodesicaM(centro, { lat, lon });
      if (d < distMinM) {
        distMinM = d;
        idxMasCercano = i;
      }
    }
  }

  if (indices.length === 0 && idxMasCercano >= 0) {
    return { indices: [idxMasCercano], aproximacionPorCercania: true };
  }
  return { indices, aproximacionPorCercania: false };
}

export function resumirColumnasEnZona(
  indices: number[],
  metaColumnas: Record<string, ColumnaCapas7>,
  cacheColumnas: Map<string, Float32Array>,
): ResumenVariableZona[] {
  const resumen: ResumenVariableZona[] = [];
  if (indices.length === 0) return resumen;

  for (const [columna, meta] of Object.entries(metaColumnas)) {
    const arr = cacheColumnas.get(columna);
    if (!arr) continue;

    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    let suma = 0;
    let nValidos = 0;

    for (const idx of indices) {
      const val = arr[idx];
      if (!Number.isFinite(val)) continue;
      if (val < min) min = val;
      if (val > max) max = val;
      suma += val;
      nValidos += 1;
    }

    if (nValidos > 0) {
      resumen.push({
        columna,
        unidad: meta.unidad,
        min,
        media: suma / nValidos,
        max,
        nValidos,
      });
    }
  }

  return resumen;
}

export function filtrarCandidatosEnZona(poligono: Coordenada[], candidatos: Celda[]): Celda[] {
  if (poligono.length < 3) return [];
  return candidatos.filter((c) => puntoEnPoligono(c.centro.lat, c.centro.lon, poligono));
}

export function filtrarPuntosEnZona(
  poligono: Coordenada[],
  geojson: PuntosGeoJson | null,
): PuntoFeature[] {
  if (!geojson || poligono.length < 3) return [];
  return geojson.features.filter((f) => {
    const [lon, lat] = f.geometry.coordinates;
    return puntoEnPoligono(lat, lon, poligono);
  });
}

export function crearZonaGuardada(
  coords: Coordenada[],
  forma: 'cuadro' | 'circulo' | 'poligono',
  nombre: string,
  color = '#f97316',
): ZonaGuardada {
  const areaKm2 = areaEsfericaM2(coords) / 1_000_000;
  const perimetroKm = perimetroEsfericoM(coords) / 1000;
  return {
    id: `zona-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    nombre: nombre.trim() || `Zona ${forma}`,
    forma,
    coords: coords.map((c) => ({ ...c })),
    areaKm2,
    perimetroKm,
    color,
    creadaEn: new Date().toISOString(),
  };
}

export function zonaAFeature(z: ZonaGuardada): Record<string, unknown> {
  const anillo = z.coords.map((c) => [c.lon, c.lat]);
  if (anillo.length > 0) anillo.push([...anillo[0]]);
  return {
    type: 'Feature',
    properties: {
      id: z.id,
      nombre: z.nombre,
      forma: z.forma,
      area_km2: Number(z.areaKm2.toFixed(4)),
      perimetro_km: Number(z.perimetroKm.toFixed(4)),
      color: z.color,
      creada_en: z.creadaEn,
      ...(z.cuerpo ? { cuerpo: z.cuerpo } : {}),
      ...(z.objetivo ? { objetivo: z.objetivo, objetivo_nombre: z.objetivoNombre ?? null } : {}),
      ...(z.notas ? { notas: z.notas } : {}),
    },
    geometry: {
      type: 'Polygon',
      coordinates: [anillo],
    },
  };
}

export function exportarZonasAGeoJson(zonas: ZonaGuardada[]): string {
  return JSON.stringify({ type: 'FeatureCollection', features: zonas.map(zonaAFeature) }, null, 2);
}
