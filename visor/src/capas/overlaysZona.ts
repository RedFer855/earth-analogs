import * as Cesium from 'cesium';
import type { Coordenada } from '../datos/coordenadas';
import { centroPoligono } from '../datos/cruceZona';
import { desenrollarLongitudes, normalizarLon } from '../datos/geometria';

export type TipoOverlayZona = 'ninguno' | 'gibs-aod' | 'gibs-lst' | 'macrostrat';

export interface BboxZona {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface UnidadGeologica {
  nombre: string;
  litologia: string;
  edad: string;
  color: string;
}

export interface ResultadoOverlayZona {
  tipo: TipoOverlayZona;
  disponible: boolean;
  fuente: string;
  nota: string;
  unidades?: UnidadGeologica[];
}

const TIMEOUT_MS = 4000;

/**
 * Caja de la zona en grados. Si la zona cruza el antimeridiano, `west > east`
 * (convención de `Cesium.Rectangle`). Si encierra un polo, cubre todas las
 * longitudes y llega hasta ese polo.
 */
export function calcularBboxZona(coords: Coordenada[]): BboxZona | null {
  if (coords.length < 3) return null;
  const anillo = desenrollarLongitudes(coords);
  let minLon = Number.POSITIVE_INFINITY;
  let maxLon = Number.NEGATIVE_INFINITY;
  let south = 90;
  let north = -90;
  for (const c of anillo) {
    if (c.lon < minLon) minLon = c.lon;
    if (c.lon > maxLon) maxLon = c.lon;
    if (c.lat < south) south = c.lat;
    if (c.lat > north) north = c.lat;
  }

  // Al cerrar el anillo, un polígono que rodea un polo suma ±360° de longitud.
  const primero = anillo[0].lon;
  const ultimo = anillo[anillo.length - 1].lon;
  let cierre = primero - ultimo;
  while (cierre > 180) cierre -= 360;
  while (cierre < -180) cierre += 360;
  const giro = ultimo - primero + cierre;
  if (Math.abs(giro) > 180) {
    const poloNorte = south + north >= 0;
    return {
      west: -180,
      south: poloNorte ? south : -90,
      east: 180,
      north: poloNorte ? 90 : north,
    };
  }

  if (maxLon - minLon >= 360) return { west: -180, south, east: 180, north };
  return { west: normalizarLon(minLon), south, east: normalizarLon(maxLon), north };
}

export function parsearUnidadesMacrostrat(payload: unknown): UnidadGeologica[] {
  const data = (payload as { success?: { data?: unknown[] } })?.success?.data;
  if (!Array.isArray(data)) return [];
  const vistas = new Set<string>();
  const out: UnidadGeologica[] = [];
  for (const item of data) {
    if (!item || typeof item !== 'object') continue;
    const u = item as Record<string, unknown>;
    const nombre = String(u.name ?? u.strat_name ?? 'Unidad sin nombre').trim();
    const litologia = String(u.lith ?? u.descrip ?? 'Sin descripción litológica').trim();
    const edad = String(u.t_int_name ?? u.b_int_name ?? 'Edad no especificada').trim();
    const color = typeof u.color === 'string' && /^#[0-9a-f]{6}$/i.test(u.color) ? u.color : '#64748b';
    const clave = `${nombre}|${edad}`;
    if (vistas.has(clave)) continue;
    vistas.add(clave);
    out.push({ nombre, litologia, edad, color });
    if (out.length >= 6) break;
  }
  return out;
}

function fechaAyerUtc(): string {
  const d = new Date(Date.now() - 2 * 86_400_000);
  return d.toISOString().slice(0, 10);
}

export class CapaOverlaysZona {
  private capaActiva: Cesium.ImageryLayer | null = null;
  private opacidad = 0.72;

  constructor(private readonly viewer: Cesium.Viewer) {}

  limpiar(): void {
    if (this.capaActiva && !this.viewer.isDestroyed()) {
      this.viewer.imageryLayers.remove(this.capaActiva, true);
      this.viewer.scene.requestRender();
    }
    this.capaActiva = null;
  }

  establecerOpacidad(valor: number): void {
    this.opacidad = Math.max(0.1, Math.min(1, valor));
    if (this.capaActiva && !this.viewer.isDestroyed()) {
      this.capaActiva.alpha = this.opacidad;
      this.viewer.scene.requestRender();
    }
  }

  async aplicar(tipo: TipoOverlayZona, coords: Coordenada[]): Promise<ResultadoOverlayZona> {
    this.limpiar();
    if (tipo === 'ninguno') {
      return { tipo, disponible: true, fuente: '—', nota: 'Sin overlay activo.' };
    }

    const bbox = calcularBboxZona(coords);
    if (!bbox) {
      return { tipo, disponible: false, fuente: '—', nota: 'Zona inválida.' };
    }

    if (tipo === 'gibs-aod' || tipo === 'gibs-lst') {
      const esAod = tipo === 'gibs-aod';
      const layerName = esAod
        ? 'MODIS_Combined_Value_Added_AOD'
        : 'MODIS_Terra_Land_Surface_Temp_Day';
      const maxLevel = esAod ? 6 : 7;
      const fecha = fechaAyerUtc();
      const url = `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${layerName}/default/${fecha}/GoogleMapsCompatible_Level${maxLevel}/{z}/{y}/{x}.png`;

      const proveedor = new Cesium.UrlTemplateImageryProvider({
        url,
        tilingScheme: new Cesium.WebMercatorTilingScheme(),
        maximumLevel: maxLevel,
        rectangle: Cesium.Rectangle.fromDegrees(bbox.west, bbox.south, bbox.east, bbox.north),
        credit: new Cesium.Credit('NASA GIBS / EOSDIS', false),
      });

      this.capaActiva = this.viewer.imageryLayers.addImageryProvider(proveedor);
      this.capaActiva.alpha = this.opacidad;
      this.viewer.scene.requestRender();

      return {
        tipo,
        disponible: true,
        fuente: `NASA GIBS (${fecha})`,
        nota: esAod
          ? 'Profundidad óptica de aerosoles/polvo (AOD) acotada a la zona.'
          : 'Temperatura superficial diurna (MODIS Terra) acotada a la zona.',
      };
    }

    const centro = centroPoligono(coords);
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(
        `https://macrostrat.org/api/v2/geologic_units/map?lat=${centro.lat.toFixed(4)}&lng=${centro.lon.toFixed(4)}`,
        { signal: controller.signal },
      );
      if (!res.ok) {
        return {
          tipo,
          disponible: false,
          fuente: 'Macrostrat v2',
          nota: `No disponible (HTTP ${res.status}). El resumen ETL local sigue activo.`,
        };
      }
      const json = (await res.json()) as unknown;
      const unidades = parsearUnidadesMacrostrat(json);
      return {
        tipo,
        disponible: unidades.length > 0,
        fuente: 'Macrostrat API v2',
        nota:
          unidades.length > 0
            ? `${unidades.length} unidad(es) geológica(s) en el centro de la zona.`
            : 'Sin unidades cartografiadas en Macrostrat para este punto.',
        unidades,
      };
    } catch {
      return {
        tipo,
        disponible: false,
        fuente: 'Macrostrat API v2',
        nota: 'Sin conexión o tiempo agotado. El resumen ETL local sigue activo.',
      };
    } finally {
      window.clearTimeout(timer);
    }
  }
}
