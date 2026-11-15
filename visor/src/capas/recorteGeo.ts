import { unwrapLongitudes, type GeoCoord } from './utilCapas';
import type { ZoneBounds } from '../types/capasZona';

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

export interface PolygonGeometryBounds {
  bounds: ZoneBounds;
  unwrapped: GeoCoord[];
  centerLat: number;
  centerLon: number;
}

/** Calcula el rectángulo envolvente mínimo desenrollando longitudes cerca del antimeridiano. */
export function computePolygonBounds(coords: GeoCoord[]): PolygonGeometryBounds {
  const unwrapped = unwrapLongitudes(coords);
  let west = Infinity;
  let east = -Infinity;
  let south = Infinity;
  let north = -Infinity;

  for (const pt of unwrapped) {
    if (pt.lon < west) west = pt.lon;
    if (pt.lon > east) east = pt.lon;
    if (pt.lat < south) south = pt.lat;
    if (pt.lat > north) north = pt.lat;
  }

  // Evita rectángulos degenerados de ancho/alto cero
  if (east - west < 1e-5) {
    west -= 5e-4;
    east += 5e-4;
  }
  if (north - south < 1e-5) {
    south -= 5e-4;
    north += 5e-4;
  }

  const centerLat = (south + north) / 2;
  const centerLon = normalizeLon((west + east) / 2);

  return {
    bounds: { west, south, east, north },
    unwrapped,
    centerLat,
    centerLon,
  };
}

export function normalizeLon(lon: number): number {
  let out = lon;
  while (out > 180) out -= 360;
  while (out < -180) out += 360;
  return out;
}

/** Ray-casting sobre polígono ya desenrollado. */
export function isCoordInPolygon(lat: number, lon: number, polygon: GeoCoord[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lon;
    const yi = polygon[i].lat;
    const xj = polygon[j].lon;
    const yj = polygon[j].lat;
    const intersect =
      yi > lat !== yj > lat &&
      lon < ((xj - xi) * (lat - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Devuelve puntos de muestreo interiores al polígono (centroide primero). */
export function buildInteriorSamplePoints(
  geom: PolygonGeometryBounds,
  gridSteps: number = 3
): GeoCoord[] {
  const { bounds, unwrapped, centerLat, centerLon } = geom;
  const points: GeoCoord[] = [];
  if (isCoordInPolygon(centerLat, (bounds.west + bounds.east) / 2, unwrapped)) {
    points.push({ lat: centerLat, lon: normalizeLon(centerLon) });
  }

  const steps = Math.max(1, gridSteps);
  for (let r = 0; r < steps; r++) {
    for (let c = 0; c < steps; c++) {
      const lat = bounds.south + ((bounds.north - bounds.south) * (r + 0.5)) / steps;
      const lonUnwrapped = bounds.west + ((bounds.east - bounds.west) * (c + 0.5)) / steps;
      if (isCoordInPolygon(lat, lonUnwrapped, unwrapped)) {
        const lon = normalizeLon(lonUnwrapped);
        if (!points.some((p) => Math.abs(p.lat - lat) < 1e-4 && Math.abs(p.lon - lon) < 1e-4)) {
          points.push({ lat, lon });
        }
      }
    }
  }

  if (points.length === 0) {
    points.push({ lat: centerLat, lon: normalizeLon(centerLon) });
  }
  return points;
}

/** Convierte longitud a coordenada fraccional de tesela Web Mercator (0..2^z). */
export function lonToTileX(lon: number, zoom: number): number {
  return ((lon + 180) / 360) * Math.pow(2, zoom);
}

/** Convierte latitud a coordenada fraccional de tesela Web Mercator (0..2^z). */
export function latToTileY(lat: number, zoom: number): number {
  const clamped = Math.max(-85.05112878, Math.min(85.05112878, lat));
  const rad = clamped * DEG2RAD;
  const n = Math.pow(2, zoom);
  return ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n;
}

export function tileYToLat(yTile: number, zoom: number): number {
  const n = Math.PI - (2 * Math.PI * yTile) / Math.pow(2, zoom);
  return RAD2DEG * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

/** Elige un zoom Web Mercator razonable para cubrir el rectángulo con pocas teselas (1..9). */
export function chooseTileZoomForBounds(
  bounds: ZoneBounds,
  minZoom: number,
  maxZoom: number,
  maxTilesSpan: number = 3
): number {
  const lonSpan = Math.max(1e-4, bounds.east - bounds.west);
  for (let z = maxZoom; z >= minZoom; z--) {
    const tilesX = (lonSpan / 360) * Math.pow(2, z);
    const yTop = latToTileY(bounds.north, z);
    const yBot = latToTileY(bounds.south, z);
    const tilesY = Math.abs(yBot - yTop);
    if (tilesX <= maxTilesSpan && tilesY <= maxTilesSpan) {
      return z;
    }
  }
  return minZoom;
}

/**
 * Recorta el canvas con el polígono usando destination-in para que el exterior tenga alpha = 0.
 */
export function applyPolygonAlphaMask(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  bounds: ZoneBounds,
  unwrappedPolygon: GeoCoord[]
): void {
  const lonSpan = bounds.east - bounds.west;
  const latSpan = bounds.north - bounds.south;
  if (lonSpan <= 0 || latSpan <= 0 || unwrappedPolygon.length < 3) return;

  ctx.save();
  ctx.globalCompositeOperation = 'destination-in';
  ctx.beginPath();
  unwrappedPolygon.forEach((pt, i) => {
    const x = ((pt.lon - bounds.west) / lonSpan) * width;
    const y = ((bounds.north - pt.lat) / latSpan) * height;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.restore();
}

/** Cuenta cuántos píxeles visibles (alpha > 20) contiene un lienzo. */
export function countVisiblePixels(canvas: HTMLCanvasElement): number {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx || canvas.width <= 0 || canvas.height <= 0) return 0;
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let count = 0;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] > 20) count++;
  }
  return count;
}

/**
 * Reproyecta una rejilla de teselas Web Mercator (EPSG:3857) al lienzo geográfico lineal
 * (EPSG:4326) requerido por Cesium.SingleTileImageryProvider, por franjas horizontales.
 */
export async function renderMercatorTilesToGeographicCanvas(
  bounds: ZoneBounds,
  unwrappedPolygon: GeoCoord[],
  zoom: number,
  tileUrlBuilder: (z: number, x: number, y: number) => string,
  canvasSize: number = 512,
  signal?: AbortSignal
): Promise<{ canvas: HTMLCanvasElement; loadedTiles: number; totalTiles: number; visiblePixels: number }> {
  const n = Math.pow(2, zoom);
  const xStart = Math.floor(lonToTileX(bounds.west, zoom));
  const xEnd = Math.floor(lonToTileX(bounds.east - 1e-9, zoom));
  const yStart = Math.max(0, Math.floor(latToTileY(bounds.north, zoom)));
  const yEnd = Math.min(n - 1, Math.floor(latToTileY(bounds.south + 1e-9, zoom)));

  const tilesX = xEnd - xStart + 1;
  const tilesY = yEnd - yStart + 1;
  const totalTiles = tilesX * tilesY;

  const mercCanvas = document.createElement('canvas');
  mercCanvas.width = tilesX * 256;
  mercCanvas.height = tilesY * 256;
  const mercCtx = mercCanvas.getContext('2d')!;

  let loadedTiles = 0;
  const jobs: Array<Promise<void>> = [];

  for (let ty = yStart; ty <= yEnd; ty++) {
    for (let tx = xStart; tx <= xEnd; tx++) {
      const wrappedX = ((tx % n) + n) % n;
      const url = tileUrlBuilder(zoom, wrappedX, ty);
      const dx = (tx - xStart) * 256;
      const dy = (ty - yStart) * 256;
      jobs.push(
        loadImageBitmap(url, signal).then((img) => {
          if (img) {
            mercCtx.drawImage(img, dx, dy, 256, 256);
            loadedTiles++;
            if ('close' in img && typeof img.close === 'function') {
              img.close();
            }
          }
        })
      );
    }
  }

  await Promise.all(jobs);

  const aspect = Math.max(
    0.35,
    Math.min(2.8, (bounds.east - bounds.west) / Math.max(1e-5, bounds.north - bounds.south))
  );
  const outW = aspect >= 1 ? canvasSize : Math.max(192, Math.round(canvasSize * aspect));
  const outH = aspect >= 1 ? Math.max(192, Math.round(canvasSize / aspect)) : canvasSize;

  const outCanvas = document.createElement('canvas');
  outCanvas.width = outW;
  outCanvas.height = outH;
  const outCtx = outCanvas.getContext('2d')!;

  const xPixelStart = (lonToTileX(bounds.west, zoom) - xStart) * 256;
  const xPixelWidth = (lonToTileX(bounds.east, zoom) - lonToTileX(bounds.west, zoom)) * 256;

  // Reproyección exacta por cada fila de latitud lineal (EPSG:4326 -> Mercator Y)
  for (let row = 0; row < outH; row++) {
    const latTop = bounds.north - ((bounds.north - bounds.south) * row) / outH;
    const latBot = bounds.north - ((bounds.north - bounds.south) * (row + 1)) / outH;
    const yMercTop = (latToTileY(latTop, zoom) - yStart) * 256;
    const yMercBot = (latToTileY(latBot, zoom) - yStart) * 256;
    const srcH = Math.max(0.5, yMercBot - yMercTop);
    outCtx.drawImage(
      mercCanvas,
      xPixelStart,
      yMercTop,
      xPixelWidth,
      srcH,
      0,
      row,
      outW,
      1
    );
  }

  applyPolygonAlphaMask(outCtx, outW, outH, bounds, unwrappedPolygon);
  const visiblePixels = countVisiblePixels(outCanvas);
  return { canvas: outCanvas, loadedTiles, totalTiles, visiblePixels };
}

async function loadImageBitmap(url: string, signal?: AbortSignal): Promise<ImageBitmap | null> {
  try {
    const res = await fetch(url, { signal, mode: 'cors' });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (blob.size === 0) return null;
    return await createImageBitmap(blob);
  } catch {
    return null;
  }
}
