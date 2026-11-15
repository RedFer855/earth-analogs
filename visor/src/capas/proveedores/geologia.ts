import type { ZonaCapas } from '../utilCapas';
import type { ZoneBounds, ZoneLayerLegendStop, ZoneLayerResult } from '../../types/capasZona';
import {
  applyPolygonAlphaMask,
  buildInteriorSamplePoints,
  chooseTileZoomForBounds,
  computePolygonBounds,
  renderMercatorTilesToGeographicCanvas,
} from '../recorteGeo';

interface MacrostratUnit {
  map_id?: number;
  name?: string;
  lith?: string;
  best_int_name?: string;
  color?: string;
  t_age?: number;
  b_age?: number;
  scale?: string;
  source_id?: number;
}

interface MacrostratResponse {
  success?: {
    license?: string;
    data?: MacrostratUnit[];
    refs?: Record<string, string>;
  };
}

interface PointGeologyColor {
  lat: number;
  lon: number;
  rgb: [number, number, number];
}

const SCALE_RANK: Record<string, number> = { large: 0, medium: 1, small: 2, tiny: 3 };
const MAX_ZOOM_BY_SCALE: Record<string, number> = { large: 10, medium: 8, small: 7, tiny: 5 };

function parseHexRgb(hex?: string): [number, number, number] | null {
  if (!hex) return null;
  const clean = hex.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(clean)) {
    return [
      parseInt(clean[0] + clean[0], 16),
      parseInt(clean[1] + clean[1], 16),
      parseInt(clean[2] + clean[2], 16),
    ];
  }
  if (/^[0-9a-fA-F]{6}$/.test(clean)) {
    return [
      parseInt(clean.slice(0, 2), 16),
      parseInt(clean.slice(2, 4), 16),
      parseInt(clean.slice(4, 6), 16),
    ];
  }
  return null;
}

function paintGeologyFallbackAndComposeTiles(
  tileCanvas: HTMLCanvasElement,
  tileVisiblePixels: number,
  bounds: ZoneBounds,
  unwrappedPolygon: ZonaCapas['coordinates'],
  pointColors: PointGeologyColor[]
): HTMLCanvasElement | null {
  if (pointColors.length === 0) {
    return tileVisiblePixels > 0 ? tileCanvas : null;
  }

  const w = Math.max(192, tileCanvas.width || 256);
  const h = Math.max(192, tileCanvas.height || 256);
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d')!;
  const imgData = ctx.createImageData(w, h);

  // Interpolación IDW / vecino cercano suave con los colores geológicos reales muestreados dentro del polígono
  for (let row = 0; row < h; row++) {
    const lat = bounds.north - ((bounds.north - bounds.south) * (row + 0.5)) / h;
    for (let col = 0; col < w; col++) {
      const lon = bounds.west + ((bounds.east - bounds.west) * (col + 0.5)) / w;
      let rSum = 0;
      let gSum = 0;
      let bSum = 0;
      let wSum = 0;
      for (const pt of pointColors) {
        const d2 = (lat - pt.lat) ** 2 + (lon - pt.lon) ** 2;
        if (d2 < 1e-10) {
          rSum = pt.rgb[0];
          gSum = pt.rgb[1];
          bSum = pt.rgb[2];
          wSum = 1;
          break;
        }
        const weight = 1 / (d2 * d2);
        rSum += weight * pt.rgb[0];
        gSum += weight * pt.rgb[1];
        bSum += weight * pt.rgb[2];
        wSum += weight;
      }
      const pIdx = (row * w + col) * 4;
      imgData.data[pIdx] = Math.round(rSum / wSum);
      imgData.data[pIdx + 1] = Math.round(gSum / wSum);
      imgData.data[pIdx + 2] = Math.round(bSum / wSum);
      imgData.data[pIdx + 3] = 215;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  if (tileVisiblePixels > 0) {
    ctx.drawImage(tileCanvas, 0, 0, w, h);
  }
  applyPolygonAlphaMask(ctx, w, h, bounds, unwrappedPolygon);
  return out;
}

function macrostratApiBase(): string {
  if (
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ) {
    return '/proxy/macrostrat';
  }
  return 'https://macrostrat.org';
}

export async function loadGeologyLithologyLayer(
  zone: ZonaCapas,
  signal?: AbortSignal
): Promise<ZoneLayerResult> {
  const geom = computePolygonBounds(zone.coordinates);
  const samplePoints = buildInteriorSamplePoints(geom, 3).slice(0, 9);

  const unitResults = await Promise.all(
    samplePoints.map(async (pt) => {
      const url = `${macrostratApiBase()}/api/v2/geologic_units/map?lat=${pt.lat.toFixed(5)}&lng=${pt.lon.toFixed(5)}`;
      try {
        const res = await fetch(url, { signal });
        if (!res.ok) return { pt, resp: null as MacrostratResponse | null };
        return { pt, resp: (await res.json()) as MacrostratResponse };
      } catch {
        return { pt, resp: null as MacrostratResponse | null };
      }
    })
  );

  const seenUnits = new Map<string, MacrostratUnit>();
  const refs = new Set<string>();
  const pointColors: PointGeologyColor[] = [];

  for (const { pt, resp } of unitResults) {
    const data = resp?.success?.data ?? [];
    const sortedAtPoint = [...data].sort(
      (a, b) => (SCALE_RANK[a.scale ?? 'tiny'] ?? 4) - (SCALE_RANK[b.scale ?? 'tiny'] ?? 4)
    );
    const rgb = sortedAtPoint.map((u) => parseHexRgb(u.color)).find((c): c is [number, number, number] => c !== null);
    if (rgb) {
      pointColors.push({ lat: pt.lat, lon: pt.lon, rgb });
    }
    for (const u of data) {
      const key = `${u.map_id ?? ''}|${u.name ?? ''}|${u.best_int_name ?? ''}`;
      if (!seenUnits.has(key) && (u.name || u.lith)) {
        seenUnits.set(key, u);
      }
    }
    const r = resp?.success?.refs ?? {};
    for (const val of Object.values(r)) {
      if (typeof val === 'string' && val.trim()) refs.add(val.trim());
    }
  }

  const units = Array.from(seenUnits.values());
  units.sort((a, b) => (SCALE_RANK[a.scale ?? 'tiny'] ?? 4) - (SCALE_RANK[b.scale ?? 'tiny'] ?? 4));
  const bestScale = units[0]?.scale ?? 'small';
  const maxZoomByScale = MAX_ZOOM_BY_SCALE[bestScale] ?? 7;

  let zoom = chooseTileZoomForBounds(geom.bounds, 4, maxZoomByScale, 3);
  let tileResult = await renderMercatorTilesToGeographicCanvas(
    geom.bounds,
    geom.unwrapped,
    zoom,
    (z, x, y) => `https://tiles.macrostrat.org/carto/${z}/${x}/${y}.png`,
    512,
    signal
  );

  // En coberturas regionales, Macrostrat suele dejar z>=8 transparentes; reintentamos con menor zoom.
  if (tileResult.visiblePixels < 100 && zoom > 5) {
    zoom = Math.max(4, zoom - 2);
    tileResult = await renderMercatorTilesToGeographicCanvas(
      geom.bounds,
      geom.unwrapped,
      zoom,
      (z, x, y) => `https://tiles.macrostrat.org/carto/${z}/${x}/${y}.png`,
      512,
      signal
    );
  }

  const composedCanvas = paintGeologyFallbackAndComposeTiles(
    tileResult.canvas,
    tileResult.visiblePixels,
    geom.bounds,
    geom.unwrapped,
    pointColors
  );

  const available = composedCanvas !== null || units.length > 0;

  if (!available) {
    return {
      subLayerId: 'geology-lithology',
      title: 'Litología y Formaciones Geológicas',
      role: 'filtro',
      roleLabel: 'Geología · Contexto/Filtro',
      unit: 'Unidades estratigráficas',
      resolutionLabel: `Teselas Macrostrat z=${zoom}`,
      sourceLabel: 'Macrostrat v2 (CC BY 4.0)',
      note: 'No se pudo consultar el servicio geológico de Macrostrat en este momento.',
      minLabel: 'sin dato',
      maxLabel: 'sin dato',
      meanLabel: 'sin dato',
      legendStops: [],
      metricsRows: [],
      canvas: null,
      bounds: geom.bounds,
      available: false,
      unavailableReason: 'Sin respuesta de Macrostrat API / Tiles.',
    };
  }

  const legendStops: ZoneLayerLegendStop[] = units.slice(0, 5).map((u) => ({
    color: /^#[0-9a-fA-F]{3,8}$/.test(u.color ?? '') ? u.color! : '#94a3b8',
    label: `${u.name || 'Unidad'}${u.best_int_name ? ` (${u.best_int_name})` : ''}`,
  }));

  const liths = Array.from(
    new Set(units.map((u) => (u.lith ?? '').trim()).filter(Boolean))
  ).slice(0, 4);

  const primary = units[0];
  const ageText =
    primary && primary.t_age !== undefined && primary.b_age !== undefined
      ? `${primary.t_age.toFixed(1)}–${primary.b_age.toFixed(1)} Ma`
      : 'sin dato';

  const metricsRows = [
    { label: 'Unidad principal', value: primary?.name?.trim() || 'sin dato' },
    { label: 'Litología detectada', value: liths.join(', ') || 'sin dato' },
    { label: 'Edad / Periodo', value: `${primary?.best_int_name || '—'} (${ageText})` },
    { label: 'Unidades en zona', value: String(units.length) },
  ];

  return {
    subLayerId: 'geology-lithology',
    title: 'Litología y Formaciones Geológicas',
    role: 'filtro',
    roleLabel: 'Geología · Contexto/Filtro',
    unit: 'Formaciones y litología',
    resolutionLabel: `Escala ${primary?.scale ?? 'regional'} · z=${zoom}`,
    sourceLabel: 'Macrostrat v2 (CC BY 4.0)',
    note:
      refs.size > 0
        ? `Fuente cartográfica: ${Array.from(refs)[0].slice(0, 140)}…`
        : 'Cartografía geológica abierta recortada al polígono.',
    minLabel: primary?.best_int_name ?? '—',
    maxLabel: `${units.length} unid.`,
    meanLabel: liths[0] ?? '—',
    legendStops,
    metricsRows,
    canvas: composedCanvas,
    bounds: geom.bounds,
    available: true,
    creditText: 'Geology: Macrostrat (CC BY 4.0)',
  };
}
