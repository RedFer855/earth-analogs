import { getGibsRecentDateIso } from '../utilCapas';
import type { ZonaCapas } from '../utilCapas';
import type { ZoneBounds, ZoneLayerResult } from '../../types/capasZona';
import {
  applyPolygonAlphaMask,
  chooseTileZoomForBounds,
  computePolygonBounds,
  isCoordInPolygon,
  renderMercatorTilesToGeographicCanvas,
} from '../recorteGeo';
import {
  classifyOperationalSoil,
  parseInt16GeoTiff,
  type ParsedInt16Tiff,
} from '../tiffSuelos';

interface SoilGridsTriple {
  bounds: ZoneBounds;
  clay: ParsedInt16Tiff;
  sand: ParsedInt16Tiff;
  silt: ParsedInt16Tiff;
}

const soilCache = new Map<string, SoilGridsTriple>();

function soilGridsBaseUrl(): string {
  if (
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ) {
    return '/proxy/soilgrids-wms';
  }
  return 'https://maps.isric.org';
}

function soilGridsWcsUrl(
  prop: 'clay' | 'sand' | 'silt',
  bounds: ZoneBounds,
  width: number,
  height: number
): string {
  const bbox = `${bounds.west.toFixed(6)},${bounds.south.toFixed(6)},${bounds.east.toFixed(6)},${bounds.north.toFixed(6)}`;
  return (
    `${soilGridsBaseUrl()}/mapserv?map=/map/${prop}.map` +
    `&SERVICE=WCS&VERSION=1.0.0&REQUEST=GetCoverage` +
    `&COVERAGE=${prop}_0-5cm_mean&CRS=EPSG:4326` +
    `&BBOX=${bbox}&WIDTH=${width}&HEIGHT=${height}&FORMAT=GEOTIFF_INT16`
  );
}

async function fetchSoilGridsTriple(
  zoneId: string,
  bounds: ZoneBounds,
  signal?: AbortSignal
): Promise<SoilGridsTriple> {
  const key = `${zoneId}|${bounds.west.toFixed(4)},${bounds.south.toFixed(4)},${bounds.east.toFixed(4)},${bounds.north.toFixed(4)}`;
  const cached = soilCache.get(key);
  if (cached) return cached;

  const w = 64;
  const h = 64;
  const fetchOne = async (prop: 'clay' | 'sand' | 'silt'): Promise<ParsedInt16Tiff> => {
    const res = await fetch(soilGridsWcsUrl(prop, bounds, w, h), { signal });
    if (!res.ok) throw new Error(`SoilGrids ${prop} HTTP ${res.status}`);
    const ct = res.headers.get('content-type') ?? '';
    if (ct.includes('xml') || ct.includes('html')) {
      throw new Error(`SoilGrids ${prop} devolvió excepción WMS/WCS`);
    }
    const buf = await res.arrayBuffer();
    return parseInt16GeoTiff(buf);
  };

  const [clay, sand, silt] = await Promise.all([
    fetchOne('clay'),
    fetchOne('sand'),
    fetchOne('silt'),
  ]);

  const triple = { bounds, clay, sand, silt };
  soilCache.set(key, triple);
  return triple;
}

function heatColor(t: number, stops: Array<[number, number, number]>): [number, number, number] {
  const c = Math.max(0, Math.min(1, t));
  const scaled = c * (stops.length - 1);
  const idx = Math.min(stops.length - 2, Math.floor(scaled));
  const f = scaled - idx;
  const a = stops[idx];
  const b = stops[idx + 1];
  return [
    Math.round(a[0] + (b[0] - a[0]) * f),
    Math.round(a[1] + (b[1] - a[1]) * f),
    Math.round(a[2] + (b[2] - a[2]) * f),
  ];
}

export async function loadSoilGridsLayer(
  zone: ZonaCapas,
  mode: 'soil-texture' | 'soil-sand' | 'soil-clay',
  signal?: AbortSignal
): Promise<ZoneLayerResult> {
  const geom = computePolygonBounds(zone.coordinates);
  const { bounds, unwrapped } = geom;

  let triple: SoilGridsTriple;
  try {
    triple = await fetchSoilGridsTriple(zone.id, bounds, signal);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error consultando SoilGrids 2.0';
    return {
      subLayerId: mode,
      title: 'Suelos 0–5 cm (SoilGrids 2.0)',
      role: 'contexto',
      roleLabel: 'Movilidad / Suelo',
      unit: '%',
      resolutionLabel: '250 m (SoilGrids 2.0)',
      sourceLabel: 'ISRIC SoilGrids 2.0 (CC BY 4.0)',
      note: 'No se pudo obtener la cobertura de SoilGrids.',
      minLabel: 'sin dato',
      maxLabel: 'sin dato',
      meanLabel: 'sin dato',
      legendStops: [],
      metricsRows: [],
      canvas: null,
      bounds,
      available: false,
      unavailableReason: msg,
    };
  }

  const w = triple.clay.width;
  const h = triple.clay.height;
  const srcCanvas = document.createElement('canvas');
  srcCanvas.width = w;
  srcCanvas.height = h;
  const srcCtx = srcCanvas.getContext('2d')!;
  const imgData = srcCtx.createImageData(w, h);

  let validCount = 0;
  let sumClay = 0;
  let sumSand = 0;
  let sumSilt = 0;
  let minClay = Infinity;
  let maxClay = -Infinity;
  let minSand = Infinity;
  let maxSand = -Infinity;
  const classCounts: Record<string, { label: string; count: number }> = {};

  for (let row = 0; row < h; row++) {
    const lat = bounds.north - ((bounds.north - bounds.south) * (row + 0.5)) / h;
    for (let col = 0; col < w; col++) {
      const lon = bounds.west + ((bounds.east - bounds.west) * (col + 0.5)) / w;
      const idx = row * w + col;
      const pIdx = idx * 4;

      if (!isCoordInPolygon(lat, lon, unwrapped)) {
        imgData.data[pIdx + 3] = 0;
        continue;
      }

      const rawClay = triple.clay.data[idx];
      const rawSand = triple.sand.data[idx];
      const rawSilt = triple.silt.data[idx];

      if (
        rawClay === triple.clay.noData ||
        rawSand === triple.sand.noData ||
        rawSilt === triple.silt.noData ||
        rawClay < 0 ||
        rawSand < 0 ||
        rawSilt < 0
      ) {
        imgData.data[pIdx + 3] = 0;
        continue;
      }

      const clayPct = rawClay / 10;
      const sandPct = rawSand / 10;
      const siltPct = rawSilt / 10;

      validCount++;
      sumClay += clayPct;
      sumSand += sandPct;
      sumSilt += siltPct;
      if (clayPct < minClay) minClay = clayPct;
      if (clayPct > maxClay) maxClay = clayPct;
      if (sandPct < minSand) minSand = sandPct;
      if (sandPct > maxSand) maxSand = sandPct;

      const cls = classifyOperationalSoil(clayPct, sandPct, siltPct);
      if (!classCounts[cls.kind]) classCounts[cls.kind] = { label: cls.label, count: 0 };
      classCounts[cls.kind].count++;

      let rgb: [number, number, number];
      if (mode === 'soil-texture') {
        rgb = cls.rgb;
      } else if (mode === 'soil-sand') {
        rgb = heatColor(sandPct / 100, [
          [30, 58, 138],
          [13, 148, 136],
          [234, 179, 8],
          [225, 29, 72],
        ]);
      } else {
        rgb = heatColor(clayPct / 65, [
          [15, 23, 42],
          [16, 185, 129],
          [250, 204, 21],
          [239, 68, 68],
        ]);
      }

      imgData.data[pIdx] = rgb[0];
      imgData.data[pIdx + 1] = rgb[1];
      imgData.data[pIdx + 2] = rgb[2];
      imgData.data[pIdx + 3] = 235;
    }
  }

  if (validCount === 0) {
    return {
      subLayerId: mode,
      title: 'Suelos 0–5 cm (SoilGrids 2.0)',
      role: 'contexto',
      roleLabel: 'Movilidad / Suelo',
      unit: '%',
      resolutionLabel: '250 m (SoilGrids 2.0)',
      sourceLabel: 'ISRIC SoilGrids 2.0 (CC BY 4.0)',
      note: 'SoilGrids marca esta zona sin cobertura de suelo (cuerpo de agua, glaciar o roca urbana sin perfil).',
      minLabel: 'sin dato',
      maxLabel: 'sin dato',
      meanLabel: 'sin dato',
      legendStops: [],
      metricsRows: [],
      canvas: null,
      bounds,
      available: false,
      unavailableReason: 'SoilGrids no tiene celdas con dato de suelo dentro del polígono.',
    };
  }

  srcCtx.putImageData(imgData, 0, 0);

  // Escala suave a 256 px manteniendo recorte exacto del polígono
  const outCanvas = document.createElement('canvas');
  outCanvas.width = 256;
  outCanvas.height = 256;
  const outCtx = outCanvas.getContext('2d')!;
  outCtx.imageSmoothingEnabled = mode !== 'soil-texture';
  outCtx.drawImage(srcCanvas, 0, 0, 256, 256);
  applyPolygonAlphaMask(outCtx, 256, 256, bounds, unwrapped);

  const meanClay = sumClay / validCount;
  const meanSand = sumSand / validCount;
  const meanSilt = sumSilt / validCount;
  const dominant = Object.values(classCounts).sort((a, b) => b.count - a.count)[0];

  const metricsRows = [
    { label: 'Clase dominante', value: dominant?.label ?? 'sin dato' },
    { label: 'Arena media (0–5 cm)', value: `${meanSand.toFixed(1)} %` },
    { label: 'Limo medio (0–5 cm)', value: `${meanSilt.toFixed(1)} %` },
    { label: 'Arcilla media (0–5 cm)', value: `${meanClay.toFixed(1)} %` },
  ];

  if (mode === 'soil-texture') {
    return {
      subLayerId: mode,
      title: 'Clases de Suelo Superficial (0–5 cm)',
      role: 'contexto',
      roleLabel: 'Movilidad / Suelo',
      unit: 'Clase textural',
      resolutionLabel: '250 m nativa (SoilGrids 2.0)',
      sourceLabel: 'ISRIC SoilGrids 2.0 (CC BY 4.0)',
      note: 'Estimado por modelo global (útil para movilidad de rovers: arena suelta vs suelo fino/cohesivo).',
      minLabel: `${minSand.toFixed(0)} % arena`,
      maxLabel: `${maxSand.toFixed(0)} % arena`,
      meanLabel: dominant?.label ?? '—',
      legendStops: [
        { color: '#f59e0b', label: 'Arena (≥65 %)' },
        { color: '#facc15', label: 'Limo / Polvo (≥45 %)' },
        { color: '#ef4444', label: 'Arcilla (≥35 %)' },
        { color: '#14b8a6', label: 'Franco / Mixto' },
      ],
      metricsRows,
      canvas: outCanvas,
      bounds,
      available: true,
      creditText: 'Soil: ISRIC SoilGrids 2.0 (CC BY 4.0)',
    };
  }

  if (mode === 'soil-sand') {
    return {
      subLayerId: mode,
      title: 'Porcentaje de Arena (0–5 cm)',
      role: 'contexto',
      roleLabel: 'Movilidad / Dunas',
      unit: '% arena',
      resolutionLabel: '250 m nativa (SoilGrids 2.0)',
      sourceLabel: 'ISRIC SoilGrids 2.0 (CC BY 4.0)',
      note: 'Valores altos (≥65 %) indican mayor riesgo de atascamiento de rovers o presencia potencial de dunas.',
      minLabel: `${minSand.toFixed(1)} %`,
      maxLabel: `${maxSand.toFixed(1)} %`,
      meanLabel: `${meanSand.toFixed(1)} %`,
      gradientCss: 'linear-gradient(90deg, #1e3a8a, #0d9488, #eab308, #e11d48)',
      legendStops: [
        { color: '#1e3a8a', label: '0 %' },
        { color: '#0d9488', label: '35 %' },
        { color: '#eab308', label: '70 %' },
        { color: '#e11d48', label: '100 %' },
      ],
      metricsRows,
      canvas: outCanvas,
      bounds,
      available: true,
      creditText: 'Soil: ISRIC SoilGrids 2.0 (CC BY 4.0)',
    };
  }

  return {
    subLayerId: mode,
    title: 'Porcentaje de Arcilla (0–5 cm)',
    role: 'contexto',
    roleLabel: 'Composición / Cohesión',
    unit: '% arcilla',
    resolutionLabel: '250 m nativa (SoilGrids 2.0)',
    sourceLabel: 'ISRIC SoilGrids 2.0 (CC BY 4.0)',
    note: 'Fracción arcillosa superficial; en astrobiología ayuda a localizar posibles sedimentos lacustres/evaporíticos.',
    minLabel: `${minClay.toFixed(1)} %`,
    maxLabel: `${maxClay.toFixed(1)} %`,
    meanLabel: `${meanClay.toFixed(1)} %`,
    gradientCss: 'linear-gradient(90deg, #0f172a, #10b981, #facc15, #ef4444)',
    legendStops: [
      { color: '#0f172a', label: '0 %' },
      { color: '#10b981', label: '20 %' },
      { color: '#facc15', label: '45 %' },
      { color: '#ef4444', label: '≥65 %' },
    ],
    metricsRows,
    canvas: outCanvas,
    bounds,
    available: true,
    creditText: 'Soil: ISRIC SoilGrids 2.0 (CC BY 4.0)',
  };
}

function hasVisiblePixels(canvas: HTMLCanvasElement): boolean {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return false;
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  for (let i = 3; i < data.length; i += 16) {
    if (data[i] > 15) return true;
  }
  return false;
}

export async function loadDustGibsLayer(
  zone: ZonaCapas,
  signal?: AbortSignal
): Promise<ZoneLayerResult> {
  const geom = computePolygonBounds(zone.coordinates);
  const zoom = chooseTileZoomForBounds(geom.bounds, 2, 6, 2);

  // MODIS Terra Aerosol diario puede tener huecos por órbita o nubes; probamos hasta 4 días recientes.
  for (const lag of [2, 3, 4, 5]) {
    const dateIso = getGibsRecentDateIso(Date.now(), lag);
    const res = await renderMercatorTilesToGeographicCanvas(
      geom.bounds,
      geom.unwrapped,
      zoom,
      (z, x, y) =>
        `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_Aerosol/default/${dateIso}/GoogleMapsCompatible_Level6/${z}/${y}/${x}.png`,
      256,
      signal
    );

    if (res.loadedTiles > 0 && hasVisiblePixels(res.canvas)) {
      return {
        subLayerId: 'soil-dust-gibs',
        title: 'Polvo y Aerosoles en Aire (AOD)',
        role: 'contexto',
        roleLabel: 'Proceso atmosférico · Contexto Marte',
        unit: 'Espesor óptico (AOD)',
        resolutionLabel: `~10 km orbital (MODIS, ${dateIso})`,
        sourceLabel: 'NASA GIBS · MODIS Terra Aerosol',
        note: 'Espesor óptico de aerosoles/polvo reciente. Zonas desérticas muy brillantes a veces quedan sin dato por límite del algoritmo Dark Target.',
        minLabel: '0.0 (limpio)',
        maxLabel: '≥1.0 (denso)',
        meanLabel: dateIso,
        gradientCss: 'linear-gradient(90deg, #16a34a, #facc15, #f97316, #dc2626)',
        legendStops: [
          { color: '#16a34a', label: 'Bajo' },
          { color: '#facc15', label: 'Moderado' },
          { color: '#f97316', label: 'Alto' },
          { color: '#dc2626', label: 'Tormenta/Denso' },
        ],
        metricsRows: [
          { label: 'Fecha orbital usada', value: dateIso },
          { label: 'Cobertura en zona', value: 'Recuperación válida' },
          { label: 'Dunas', value: 'sin dato en esta versión' },
        ],
        canvas: res.canvas,
        bounds: geom.bounds,
        available: true,
        creditText: 'NASA GIBS (MODIS Terra Aerosol)',
      };
    }
  }

  return {
    subLayerId: 'soil-dust-gibs',
    title: 'Polvo y Aerosoles en Aire (AOD)',
    role: 'contexto',
    roleLabel: 'Proceso atmosférico · Contexto Marte',
    unit: 'AOD',
    resolutionLabel: '~10 km (NASA GIBS MODIS)',
    sourceLabel: 'NASA GIBS · MODIS Terra Aerosol',
    note: 'Sin recuperación válida de AOD sobre esta zona en los últimos 5 días (nubosidad o superficie hiperbrillante sin retrieval).',
    minLabel: 'sin dato',
    maxLabel: 'sin dato',
    meanLabel: 'sin dato',
    legendStops: [],
    metricsRows: [
      { label: 'Aerosol AOD reciente', value: 'sin dato orbital' },
      { label: 'Polvo (reanálisis)', value: 'sin dato en esta versión' },
    ],
    canvas: null,
    bounds: geom.bounds,
    available: false,
    unavailableReason:
      'MODIS Terra Aerosol no tiene píxeles válidos sobre este polígono en los últimos 5 días (hueco orbital/nubes o desierto brillante).',
  };
}
