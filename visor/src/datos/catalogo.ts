import type { Coordenada } from './coordenadas';
import { crearZonaGuardada, zonaAFeature, type ZonaGuardada } from './cruceZona';

/*
 * Catálogo lateral: pines guardados por el usuario y paso de zonas y pines a GeoJSON y de vuelta.
 * Todo lo importado es entrada no confiable: se valida forma, rango y tamaño antes de tocar el mapa.
 */

export type CategoriaPin = 'tierra' | 'marte' | 'luna';
export type CuerpoZona = 'marte' | 'luna';

export interface PinGuardado {
  id: string;
  nombre: string;
  categoria: CategoriaPin;
  lat: number;
  lon: number;
  notas: string;
  creadoEn: string;
}

export const MAX_BYTES_IMPORTACION = 2_000_000;
export const MAX_ELEMENTOS_IMPORTACION = 300;
export const MAX_VERTICES_ZONA = 2_000;
const MAX_NOMBRE = 80;
const MAX_NOTAS = 400;
const COLOR_HEX = /^#[0-9a-fA-F]{6}$/;
const ID_OBJETIVO = /^[A-Za-z0-9_.-]{1,40}$/;

export const COLORES_POR_CUERPO: Record<CuerpoZona, string> = { marte: '#f97316', luna: '#38bdf8' };

export function esCategoriaPin(v: unknown): v is CategoriaPin {
  return v === 'tierra' || v === 'marte' || v === 'luna';
}

export function esCuerpoZona(v: unknown): v is CuerpoZona {
  return v === 'marte' || v === 'luna';
}

export function limpiarTexto(valor: unknown, max: number): string {
  if (typeof valor !== 'string') return '';
  // Sin caracteres de control; el HTML se escapa al pintar, no aquí.
  // eslint-disable-next-line no-control-regex
  return valor.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
}

export function coordenadaValida(lat: unknown, lon: unknown): boolean {
  return (
    typeof lat === 'number' &&
    typeof lon === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lon) <= 180
  );
}

export function crearPin(
  coord: Coordenada,
  nombre: string,
  categoria: CategoriaPin = 'tierra',
  notas = '',
): PinGuardado {
  return {
    id: `pin-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    nombre: limpiarTexto(nombre, MAX_NOMBRE) || 'Pin',
    categoria,
    lat: coord.lat,
    lon: coord.lon,
    notas: limpiarTexto(notas, MAX_NOTAS),
    creadoEn: new Date().toISOString(),
  };
}

export function pinAFeature(p: PinGuardado): Record<string, unknown> {
  return {
    type: 'Feature',
    properties: {
      id: p.id,
      nombre: p.nombre,
      categoria: p.categoria,
      ...(p.notas ? { notas: p.notas } : {}),
      creado_en: p.creadoEn,
    },
    geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
  };
}

export function exportarCatalogoAGeoJson(zonas: ZonaGuardada[], pines: PinGuardado[]): string {
  return JSON.stringify(
    { type: 'FeatureCollection', features: [...zonas.map(zonaAFeature), ...pines.map(pinAFeature)] },
    null,
    2,
  );
}

export interface ImportacionCatalogo {
  zonas: ZonaGuardada[];
  pines: PinGuardado[];
  omitidos: number;
}

function anilloExterior(geometry: unknown): Coordenada[] | null {
  const g = geometry as { type?: unknown; coordinates?: unknown } | null;
  if (!g || g.type !== 'Polygon' || !Array.isArray(g.coordinates)) return null;
  const anillo = g.coordinates[0];
  if (!Array.isArray(anillo) || anillo.length < 3 || anillo.length > MAX_VERTICES_ZONA + 1) return null;
  const coords: Coordenada[] = [];
  for (const par of anillo) {
    if (!Array.isArray(par) || !coordenadaValida(par[1], par[0])) return null;
    coords.push({ lat: par[1] as number, lon: par[0] as number });
  }
  const a = coords[0];
  const b = coords[coords.length - 1];
  if (coords.length > 3 && a.lat === b.lat && a.lon === b.lon) coords.pop();
  return coords.length >= 3 ? coords : null;
}

/** Lee un FeatureCollection (o un Feature) con polígonos y puntos. Lanza Error con un mensaje para el usuario. */
export function importarCatalogoGeoJson(texto: string): ImportacionCatalogo {
  if (texto.length > MAX_BYTES_IMPORTACION) {
    throw new Error(`El archivo pesa más de ${MAX_BYTES_IMPORTACION / 1_000_000} MB.`);
  }
  let json: unknown;
  try {
    json = JSON.parse(texto);
  } catch {
    throw new Error('El archivo no es un JSON válido.');
  }
  const raiz = json as { type?: unknown; features?: unknown };
  const features: unknown[] =
    raiz?.type === 'FeatureCollection' && Array.isArray(raiz.features)
      ? raiz.features
      : raiz?.type === 'Feature'
        ? [raiz]
        : [];
  if (features.length === 0) throw new Error('No hay zonas ni puntos en el archivo (se espera GeoJSON).');
  if (features.length > MAX_ELEMENTOS_IMPORTACION) {
    throw new Error(`Hay más de ${MAX_ELEMENTOS_IMPORTACION} elementos; divide el archivo.`);
  }

  const zonas: ZonaGuardada[] = [];
  const pines: PinGuardado[] = [];
  let omitidos = 0;
  for (const f of features) {
    const feat = f as { geometry?: { type?: unknown; coordinates?: unknown }; properties?: Record<string, unknown> };
    const props = feat?.properties && typeof feat.properties === 'object' ? feat.properties : {};
    const tipo = feat?.geometry?.type;
    if (tipo === 'Polygon') {
      const coords = anilloExterior(feat.geometry);
      if (!coords) {
        omitidos += 1;
        continue;
      }
      const forma = props.forma === 'cuadro' || props.forma === 'circulo' ? props.forma : 'poligono';
      const cuerpo = esCuerpoZona(props.cuerpo) ? props.cuerpo : undefined;
      const color =
        typeof props.color === 'string' && COLOR_HEX.test(props.color)
          ? props.color
          : cuerpo
            ? COLORES_POR_CUERPO[cuerpo]
            : undefined;
      const zona = crearZonaGuardada(coords, forma, limpiarTexto(props.nombre, MAX_NOMBRE), color);
      if (cuerpo) zona.cuerpo = cuerpo;
      if (typeof props.objetivo === 'string' && ID_OBJETIVO.test(props.objetivo)) {
        zona.objetivo = props.objetivo;
        zona.objetivoNombre = limpiarTexto(props.objetivo_nombre, MAX_NOMBRE) || props.objetivo;
      }
      const notas = limpiarTexto(props.notas, MAX_NOTAS);
      if (notas) zona.notas = notas;
      zonas.push(zona);
    } else if (tipo === 'Point') {
      const c = feat.geometry?.coordinates;
      if (!Array.isArray(c) || !coordenadaValida(c[1], c[0])) {
        omitidos += 1;
        continue;
      }
      const categoria = esCategoriaPin(props.categoria) ? props.categoria : 'tierra';
      pines.push(
        crearPin({ lat: c[1] as number, lon: c[0] as number }, limpiarTexto(props.nombre, MAX_NOMBRE), categoria, limpiarTexto(props.notas, MAX_NOTAS)),
      );
    } else {
      omitidos += 1;
    }
  }
  if (zonas.length === 0 && pines.length === 0) {
    throw new Error('Ninguna zona ni punto del archivo es válido (se leen Polygon y Point).');
  }
  return { zonas, pines, omitidos };
}
