import type { ZonaCapas } from '../utilCapas';
import type { ZoneBounds, ZoneLayerResult } from '../../types/capasZona';
import {
  applyPolygonAlphaMask,
  chooseTileZoomForBounds,
  computePolygonBounds,
  isCoordInPolygon,
  renderMercatorTilesToGeographicCanvas,
} from '../recorteGeo';

interface OverpassGeomPt {
  lat: number;
  lon: number;
}

interface OverpassElement {
  type: 'way' | 'relation' | 'node';
  id: number;
  tags?: Record<string, string>;
  geometry?: OverpassGeomPt[];
  members?: Array<{ role: string; geometry?: OverpassGeomPt[] }>;
}

interface OsmHydroSummary {
  salares: string[];
  waterBodies: string[];
  waysToDraw: Array<{ kind: 'salar' | 'water' | 'waterway'; pts: OverpassGeomPt[] }>;
}

function overpassUrl(): string {
  if (
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ) {
    return '/proxy/overpass/api/interpreter';
  }
  return 'https://overpass-api.de/api/interpreter';
}

async function fetchOsmHydrologyAndSalares(
  bounds: ZoneBounds,
  parentSignal?: AbortSignal
): Promise<OsmHydroSummary> {
  const empty: OsmHydroSummary = { salares: [], waterBodies: [], waysToDraw: [] };
  // Limita el bbox para no sobrecargar Overpass en polígonos gigantes (>3°)
  if (bounds.east - bounds.west > 3 || bounds.north - bounds.south > 3) {
    return empty;
  }

  const bbox = `${bounds.south.toFixed(4)},${bounds.west.toFixed(4)},${bounds.north.toFixed(4)},${bounds.east.toFixed(4)}`;
  const query =
    `[out:json][timeout:6];(` +
    `way["natural"~"water|wetland|mud|salt_pond"](${bbox});` +
    `way["landuse"="salt_pond"](${bbox});` +
    `way["waterway"~"river|stream|canal|wadi"](${bbox});` +
    `relation["natural"~"water|wetland|salt_pond"](${bbox});` +
    `);out geom 40;`;

  const timeoutCtrl = new AbortController();
  const timer = setTimeout(() => timeoutCtrl.abort(), 5500);
  const onParentAbort = () => timeoutCtrl.abort();
  parentSignal?.addEventListener('abort', onParentAbort, { once: true });

  try {
    const res = await fetch(overpassUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: `data=${encodeURIComponent(query)}`,
      signal: timeoutCtrl.signal,
    });
    if (!res.ok) return empty;
    const json = (await res.json()) as { elements?: OverpassElement[] };
    const salarNames = new Set<string>();
    const waterNames = new Set<string>();
    const waysToDraw: OsmHydroSummary['waysToDraw'] = [];

    for (const el of json.elements ?? []) {
      const tags = el.tags ?? {};
      const isSalar =
        tags.wetland === 'salt_desert' ||
        tags.natural === 'salt_pond' ||
        tags.landuse === 'salt_pond' ||
        tags.salt === 'yes' ||
        tags.desert === 'salt' ||
        /salar|salina|salt flat|playa/i.test(tags.name ?? '');

      const kind: 'salar' | 'water' | 'waterway' = isSalar
        ? 'salar'
        : tags.waterway
          ? 'waterway'
          : 'water';

      if (tags.name) {
        if (isSalar) salarNames.add(tags.name);
        else waterNames.add(tags.name);
      }

      if (el.geometry && el.geometry.length >= 2) {
        waysToDraw.push({ kind, pts: el.geometry });
      } else if (el.members) {
        for (const m of el.members) {
          if (m.role !== 'inner' && m.geometry && m.geometry.length >= 2) {
            waysToDraw.push({ kind, pts: m.geometry });
          }
        }
      }
    }

    return {
      salares: Array.from(salarNames).slice(0, 5),
      waterBodies: Array.from(waterNames).slice(0, 5),
      waysToDraw,
    };
  } catch {
    return empty;
  } finally {
    clearTimeout(timer);
    parentSignal?.removeEventListener('abort', onParentAbort);
  }
}

export async function loadHydrologyLayer(
  zone: ZonaCapas,
  mode: 'hydrology-surface' | 'hydrology-seasonality',
  signal?: AbortSignal
): Promise<ZoneLayerResult> {
  const geom = computePolygonBounds(zone.coordinates);
  const { bounds, unwrapped } = geom;
  const zoom = chooseTileZoomForBounds(bounds, 4, 13, 3);
  const jrcProduct = mode === 'hydrology-surface' ? 'occurrence' : 'seasonality';

  const jrcPromise = renderMercatorTilesToGeographicCanvas(
    bounds,
    unwrapped,
    zoom,
    (z, x, y) =>
      `https://storage.googleapis.com/global-surface-water/tiles2021/${jrcProduct}/${z}/${x}/${y}.png`,
    384,
    signal
  );

  const osmPromise =
    mode === 'hydrology-surface'
      ? fetchOsmHydrologyAndSalares(bounds, signal)
      : Promise.resolve<OsmHydroSummary>({ salares: [], waterBodies: [], waysToDraw: [] });

  const [jrcRes, osm] = await Promise.all([jrcPromise, osmPromise]);

  if (jrcRes.loadedTiles === 0 && osm.waysToDraw.length === 0) {
    return {
      subLayerId: mode,
      title: 'Hidrología Superficial y Salares',
      role: 'filtro',
      roleLabel: 'Filtro hídrico / Salares · Análogos',
      unit: '% ocurrencia / clase',
      resolutionLabel: `JRC GSW z=${zoom}`,
      sourceLabel: 'EC JRC / Google GSW v1.5 + OSM Overpass',
      note: 'No se pudo consultar JRC Global Surface Water ni OSM Overpass en este momento.',
      minLabel: 'sin dato',
      maxLabel: 'sin dato',
      meanLabel: 'sin dato',
      legendStops: [],
      metricsRows: [],
      canvas: null,
      bounds,
      available: false,
      unavailableReason: 'Sin respuesta de JRC GSW ni de Overpass.',
    };
  }

  const canvas = jrcRes.canvas;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const w = canvas.width;
  const h = canvas.height;
  const imgData = ctx.getImageData(0, 0, w, h);

  let polyPixels = 0;
  let waterPixels = 0;

  // Recolorea píxeles JRC para evitar el tono exacto #38bdf8 de bordes Lunares y mide cobertura real dentro del polígono
  for (let row = 0; row < h; row++) {
    const lat = bounds.north - ((bounds.north - bounds.south) * (row + 0.5)) / h;
    for (let col = 0; col < w; col++) {
      const lon = bounds.west + ((bounds.east - bounds.west) * (col + 0.5)) / w;
      const pIdx = (row * w + col) * 4;
      if (!isCoordInPolygon(lat, lon, unwrapped)) continue;
      polyPixels++;

      const alpha = imgData.data[pIdx + 3];
      if (alpha > 25) {
        waterPixels++;
        const g = imgData.data[pIdx + 1];
        const b = imgData.data[pIdx + 2];
        // Mapea agua JRC a azul cobalto -> turquesa profundo (sin #38bdf8)
        if (b > 150) {
          imgData.data[pIdx] = 29;
          imgData.data[pIdx + 1] = 78;
          imgData.data[pIdx + 2] = 216;
        } else if (g > 120) {
          imgData.data[pIdx] = 14;
          imgData.data[pIdx + 1] = 116;
          imgData.data[pIdx + 2] = 144;
        }
        imgData.data[pIdx + 3] = 225;
      }
    }
  }
  ctx.putImageData(imgData, 0, 0);

  // Superponer salares y cauces vectoriales de OSM si se detectaron en la zona
  const lonSpan = Math.max(1e-6, bounds.east - bounds.west);
  const latSpan = Math.max(1e-6, bounds.north - bounds.south);
  let hasSalarDraw = false;

  for (const item of osm.waysToDraw) {
    if (item.pts.length < 2) continue;
    ctx.beginPath();
    item.pts.forEach((pt, idx) => {
      const x = ((pt.lon - bounds.west) / lonSpan) * w;
      const y = ((bounds.north - pt.lat) / latSpan) * h;
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    if (item.kind === 'salar') {
      hasSalarDraw = true;
      ctx.closePath();
      ctx.fillStyle = 'rgba(226, 232, 240, 0.72)';
      ctx.fill();
      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else if (item.kind === 'water') {
      ctx.closePath();
      ctx.fillStyle = 'rgba(29, 78, 216, 0.72)';
      ctx.fill();
    } else {
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  applyPolygonAlphaMask(ctx, w, h, bounds, unwrapped);

  const waterPct = polyPixels > 0 ? (waterPixels / polyPixels) * 100 : 0;
  const salarCount = osm.waysToDraw.filter((x) => x.kind === 'salar').length;

  return {
    subLayerId: mode,
    title:
      mode === 'hydrology-surface'
        ? 'Agua Superficial (1984–2024) y Salares'
        : 'Estacionalidad Hídrica (JRC GSW)',
    role: 'filtro',
    roleLabel: 'Filtro hídrico / Salares · Análogos',
    unit: mode === 'hydrology-surface' ? '% agua / salar' : 'meses/año',
    resolutionLabel: `30 m nativa (JRC z=${zoom}) + OSM`,
    sourceLabel: 'EC JRC / Google GSW v1.5 · OpenStreetMap Overpass',
    note:
      waterPct === 0 && !hasSalarDraw
        ? 'Superficie libre de cuerpos de agua abiertos (0.0 % detectado en JRC 30 m): condición típica de desiertos análogos hiperáridos.'
        : 'Combina ocurrencia de agua superficial histórica (30 m) y salares/playas evaporíticas cartografiadas.',
    minLabel: `${waterPct.toFixed(1)} % agua`,
    maxLabel: salarCount > 0 ? `${salarCount} salares` : `${waterPixels} px`,
    meanLabel: waterPct === 0 && !hasSalarDraw ? 'Seco (0 %)' : `${waterPct.toFixed(1)} %`,
    legendStops: [
      { color: '#1d4ed8', label: 'Agua permanente (JRC)' },
      { color: '#0e7490', label: 'Agua estacional / intermitente' },
      { color: '#e2e8f0', label: 'Salar / costra evaporítica (OSM)' },
      { color: '#a855f7', label: 'Borde salar' },
    ],
    metricsRows: [
      { label: 'Lámina de agua (JRC 30 m)', value: `${waterPct.toFixed(2)} % del área` },
      {
        label: 'Salares detectados (OSM)',
        value: osm.salares.length > 0 ? osm.salares.join(', ') : salarCount > 0 ? `${salarCount} polígonos` : 'Ninguno en polígono',
      },
      {
        label: 'Cauces / lagos OSM',
        value: osm.waterBodies.length > 0 ? osm.waterBodies.join(', ') : osm.waysToDraw.length > salarCount ? `${osm.waysToDraw.length - salarCount} trazos` : 'Ninguno',
      },
      { label: 'Uso científico', value: 'Filtro aridez / evaporitas' },
    ],
    canvas: waterPixels > 0 || osm.waysToDraw.length > 0 ? canvas : null,
    bounds,
    available: true,
    creditText: 'Water: EC JRC/Google (1984-2024), OSM',
  };
}

export async function loadNdviLayer(
  zone: ZonaCapas,
  signal?: AbortSignal
): Promise<ZoneLayerResult> {
  const geom = computePolygonBounds(zone.coordinates);
  const { bounds, unwrapped } = geom;
  const zoom = chooseTileZoomForBounds(bounds, 3, 9, 3);

  const ndviRes = await renderMercatorTilesToGeographicCanvas(
    bounds,
    unwrapped,
    zoom,
    (z, x, y) =>
      `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_NDVI_8Day/default/default/GoogleMapsCompatible_Level9/${z}/${y}/${x}.png`,
    384,
    signal
  );

  if (ndviRes.loadedTiles === 0 || ndviRes.visiblePixels === 0) {
    return {
      subLayerId: 'ndvi-modis',
      title: 'Índice de Vegetación — NDVI (8 días)',
      role: 'filtro',
      roleLabel: 'Filtro biótico / Esterilidad',
      unit: 'NDVI (−0.2 a +0.9)',
      resolutionLabel: `250 m orbital (MODIS z=${zoom})`,
      sourceLabel: 'NASA GIBS · MODIS Terra NDVI 8-Day',
      note: 'Sin recuperación válida de NDVI sobre esta zona (posible cobertura nubosa o hueco orbital reciente).',
      minLabel: 'sin dato',
      maxLabel: 'sin dato',
      meanLabel: 'sin dato',
      legendStops: [],
      metricsRows: [],
      canvas: null,
      bounds,
      available: false,
      unavailableReason: 'NASA GIBS MODIS_Terra_NDVI_8Day sin píxeles válidos para este polígono.',
    };
  }

  const canvas = ndviRes.canvas;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  // Clasifica píxeles interiores según la rampa cromática MODIS_Terra_NDVI_8Day
  let validPolyPx = 0;
  let denseVegPx = 0;
  let sparseVegPx = 0;
  let barrenPx = 0;

  for (let row = 0; row < canvas.height; row++) {
    const lat = bounds.north - ((bounds.north - bounds.south) * (row + 0.5)) / canvas.height;
    for (let col = 0; col < canvas.width; col++) {
      const lon = bounds.west + ((bounds.east - bounds.west) * (col + 0.5)) / canvas.width;
      if (!isCoordInPolygon(lat, lon, unwrapped)) continue;
      const pIdx = (row * canvas.width + col) * 4;
      const r = imgData.data[pIdx];
      const g = imgData.data[pIdx + 1];
      const b = imgData.data[pIdx + 2];
      const a = imgData.data[pIdx + 3];
      if (a < 25) continue;

      validPolyPx++;
      if (g > r + 15 && g > b + 15) {
        denseVegPx++;
      } else if (g >= r && r > 120 && b < 130) {
        sparseVegPx++;
      } else {
        barrenPx++;
      }
    }
  }

  const vegPct = validPolyPx > 0 ? ((denseVegPx + sparseVegPx) / validPolyPx) * 100 : 0;
  const barrenPct = validPolyPx > 0 ? (barrenPx / validPolyPx) * 100 : 0;
  const sterilityLabel =
    barrenPct >= 85
      ? 'Óptimo desierto árido (≥85 % sin vegetación)'
      : barrenPct >= 50
        ? 'Vegetación dispersa (matorral ralo)'
        : 'Cobertura vegetal alta (no estéril)';

  return {
    subLayerId: 'ndvi-modis',
    title: 'Índice de Vegetación — NDVI (8 días)',
    role: 'filtro',
    roleLabel: 'Filtro biótico / Esterilidad',
    unit: 'Índice NDVI',
    resolutionLabel: `250 m orbital (MODIS Terra z=${zoom})`,
    sourceLabel: 'NASA GIBS · MODIS_Terra_NDVI_8Day',
    note: 'Evalúa cobertura fotosintética: los análogos marcianos y lunares buscan mínimo NDVI (suelo mineral expuesto sin vegetación).',
    minLabel: `${barrenPct.toFixed(0)} % árido`,
    maxLabel: `${vegPct.toFixed(0)} % veg.`,
    meanLabel: barrenPct >= 85 ? 'Árido / Estéril' : vegPct >= 50 ? 'Vegetado' : 'Mixto',
    gradientCss: 'linear-gradient(90deg, #78350f, #d6d3d1, #bef264, #22c55e, #14532d)',
    legendStops: [
      { color: '#78350f', label: '≤0.1 Suelo desnudo' },
      { color: '#14532d', label: '≥0.7 Vegetación densa' },
    ],
    metricsRows: [
      { label: 'Aptitud astrobiológica', value: sterilityLabel },
      { label: 'Suelo desnudo / árido', value: `${barrenPct.toFixed(1)} %` },
      { label: 'Vegetación activa', value: `${vegPct.toFixed(1)} %` },
      { label: 'Uso científico', value: 'Filtro exclusión vegetación' },
    ],
    canvas,
    bounds,
    available: true,
    creditText: 'NDVI: NASA GIBS MODIS Terra 8-Day',
  };
}
