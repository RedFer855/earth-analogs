import type { ZonaCapas } from '../utilCapas';
import type { ZoneLayerResult } from '../../types/capasZona';
import {
  applyPolygonAlphaMask,
  buildInteriorSamplePoints,
  computePolygonBounds,
} from '../recorteGeo';

interface PowerPointData {
  lat: number;
  lon: number;
  solarAnn: number | null;
  solarMinMonth: number | null;
  solarMaxMonth: number | null;
  uvAnn: number | null;
  uvMaxMonth: number | null;
}

interface PowerApiJson {
  properties?: {
    parameter?: {
      ALLSKY_SFC_SW_DWN?: Record<string, number>;
      ALLSKY_SFC_UV_INDEX?: Record<string, number>;
    };
  };
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const powerPointCache = new Map<string, PowerPointData>();

function powerBaseUrl(): string {
  if (
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ) {
    return '/proxy/power';
  }
  return 'https://power.larc.nasa.gov';
}

function validPowerVal(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v > -900 ? v : null;
}

async function fetchPowerPoint(lat: number, lon: number, signal?: AbortSignal): Promise<PowerPointData> {
  // NASA POWER SYN1DEG tiene malla de ~1° / 0.5°; agrupamos por celda de 0.5° para evitar llamadas duplicadas.
  const cellLat = Math.round(lat * 2) / 2;
  const cellLon = Math.round(lon * 2) / 2;
  const key = `${cellLat.toFixed(1)},${cellLon.toFixed(1)}`;
  const cached = powerPointCache.get(key);
  if (cached) return { ...cached, lat, lon };

  const url =
    `${powerBaseUrl()}/api/temporal/climatology/point` +
    `?parameters=ALLSKY_SFC_SW_DWN,ALLSKY_SFC_UV_INDEX&community=RE` +
    `&longitude=${lon.toFixed(4)}&latitude=${lat.toFixed(4)}&format=JSON`;

  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`NASA POWER HTTP ${res.status}`);
  const json = (await res.json()) as PowerApiJson;
  const sw = json.properties?.parameter?.ALLSKY_SFC_SW_DWN ?? {};
  const uv = json.properties?.parameter?.ALLSKY_SFC_UV_INDEX ?? {};

  const swMonths = MONTHS.map((m) => validPowerVal(sw[m])).filter((v): v is number => v !== null);
  const uvMonths = MONTHS.map((m) => validPowerVal(uv[m])).filter((v): v is number => v !== null);

  const parsed: PowerPointData = {
    lat,
    lon,
    solarAnn: validPowerVal(sw.ANN),
    solarMinMonth: swMonths.length > 0 ? Math.min(...swMonths) : null,
    solarMaxMonth: swMonths.length > 0 ? Math.max(...swMonths) : null,
    uvAnn: validPowerVal(uv.ANN),
    uvMaxMonth: uvMonths.length > 0 ? Math.max(...uvMonths) : null,
  };
  powerPointCache.set(key, parsed);
  return parsed;
}

function colorScale(t: number, stops: Array<[number, number, number]>): [number, number, number] {
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

export async function loadRadiationPowerLayer(
  zone: ZonaCapas,
  mode: 'radiation-solar' | 'radiation-uv',
  signal?: AbortSignal
): Promise<ZoneLayerResult> {
  const geom = computePolygonBounds(zone.coordinates);
  const { bounds, unwrapped } = geom;
  const samplePts = buildInteriorSamplePoints(geom, 3);

  // Limita a un máximo de 6 celdas distintas de 0.5° para responder en <1s
  const uniqueByCell = new Map<string, { lat: number; lon: number }>();
  for (const pt of samplePts) {
    const k = `${(Math.round(pt.lat * 2) / 2).toFixed(1)},${(Math.round(pt.lon * 2) / 2).toFixed(1)}`;
    if (!uniqueByCell.has(k)) uniqueByCell.set(k, pt);
    if (uniqueByCell.size >= 6) break;
  }

  let results: PowerPointData[];
  try {
    results = await Promise.all(
      Array.from(uniqueByCell.values()).map((p) => fetchPowerPoint(p.lat, p.lon, signal))
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error al consultar NASA POWER';
    return {
      subLayerId: mode,
      title: mode === 'radiation-solar' ? 'Irradiancia Solar Superficial' : 'Índice UV Superficial',
      role: 'contexto',
      roleLabel: 'Límite terrestre / Radiación',
      unit: mode === 'radiation-solar' ? 'kWh/m²/día' : 'Índice UV',
      resolutionLabel: '1° × 1° climatología 2001–2025 (NASA POWER)',
      sourceLabel: 'NASA POWER Climatology API',
      note: 'No se pudo conectar con NASA POWER.',
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

  const validSamples = results
    .map((r) => ({
      lat: r.lat,
      lon: r.lon,
      value: mode === 'radiation-solar' ? r.solarAnn : r.uvAnn,
      raw: r,
    }))
    .filter((s): s is { lat: number; lon: number; value: number; raw: PowerPointData } => s.value !== null);

  if (validSamples.length === 0) {
    return {
      subLayerId: mode,
      title: mode === 'radiation-solar' ? 'Irradiancia Solar Superficial' : 'Índice UV Superficial',
      role: 'contexto',
      roleLabel: 'Límite terrestre / Radiación',
      unit: mode === 'radiation-solar' ? 'kWh/m²/día' : 'Índice UV',
      resolutionLabel: '1° × 1° (NASA POWER)',
      sourceLabel: 'NASA POWER Climatology API',
      note: 'Sin datos válidos de radiación en esta zona.',
      minLabel: 'sin dato',
      maxLabel: 'sin dato',
      meanLabel: 'sin dato',
      legendStops: [],
      metricsRows: [],
      canvas: null,
      bounds,
      available: false,
      unavailableReason: 'NASA POWER devolvió valor vacío (-999).',
    };
  }

  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const imgData = ctx.createImageData(size, size);

  const stops: Array<[number, number, number]> =
    mode === 'radiation-solar'
      ? [
          [30, 64, 175],
          [13, 148, 136],
          [234, 179, 8],
          [225, 29, 72],
          [153, 27, 27],
        ]
      : [
          [16, 185, 129],
          [234, 179, 8],
          [225, 29, 72],
          [190, 24, 93],
          [126, 34, 206],
        ];

  const minRange = mode === 'radiation-solar' ? 2.0 : 0.0;
  const maxRange = mode === 'radiation-solar' ? 8.0 : 12.0;

  // Interpolación IDW sobre las muestras reales dentro de la zona
  for (let row = 0; row < size; row++) {
    const lat = bounds.north - ((bounds.north - bounds.south) * (row + 0.5)) / size;
    for (let col = 0; col < size; col++) {
      const lon = bounds.west + ((bounds.east - bounds.west) * (col + 0.5)) / size;
      let val: number;
      if (validSamples.length === 1) {
        val = validSamples[0].value;
      } else {
        let num = 0;
        let den = 0;
        for (const s of validSamples) {
          const d2 = (lat - s.lat) ** 2 + (lon - s.lon) ** 2;
          if (d2 < 1e-10) {
            num = s.value;
            den = 1;
            break;
          }
          const w = 1 / d2;
          num += w * s.value;
          den += w;
        }
        val = num / den;
      }

      const t = (val - minRange) / (maxRange - minRange);
      const [r, g, b] = colorScale(t, stops);
      const pIdx = (row * size + col) * 4;
      imgData.data[pIdx] = r;
      imgData.data[pIdx + 1] = g;
      imgData.data[pIdx + 2] = b;
      imgData.data[pIdx + 3] = 220;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  applyPolygonAlphaMask(ctx, size, size, bounds, unwrapped);

  const vals = validSamples.map((s) => s.value);
  const minVal = Math.min(...vals);
  const maxVal = Math.max(...vals);
  const meanVal = vals.reduce((a, b) => a + b, 0) / vals.length;

  if (mode === 'radiation-solar') {
    const peakM = Math.max(
      ...validSamples.map((s) => s.raw.solarMaxMonth ?? -Infinity).filter(Number.isFinite)
    );
    const lowM = Math.min(
      ...validSamples.map((s) => s.raw.solarMinMonth ?? Infinity).filter(Number.isFinite)
    );
    return {
      subLayerId: mode,
      title: 'Irradiancia Solar Superficial',
      role: 'contexto',
      roleLabel: 'Energía / Exposición solar',
      unit: 'kWh/m²/día',
      resolutionLabel: '1° × 1° SYN1DEG (2001–2025)',
      sourceLabel: 'NASA POWER Climatology v2.10',
      note: 'Promedios climatológicos de irradiancia solar incidente (útil para dimensionamiento fotovoltaico e insolación).',
      minLabel: `${minVal.toFixed(2)}`,
      maxLabel: `${maxVal.toFixed(2)}`,
      meanLabel: `${meanVal.toFixed(2)} kWh/m²/d`,
      gradientCss: 'linear-gradient(90deg, #1e40af, #0d9488, #eab308, #e11d48, #991b1b)',
      legendStops: [
        { color: '#1e40af', label: '2 kWh' },
        { color: '#0d9488', label: '4 kWh' },
        { color: '#eab308', label: '6 kWh' },
        { color: '#991b1b', label: '≥8 kWh' },
      ],
      metricsRows: [
        { label: 'Media anual', value: `${meanVal.toFixed(2)} kWh/m²/día` },
        { label: 'Mes más soleado', value: Number.isFinite(peakM) ? `${peakM.toFixed(2)} kWh/m²/día` : 'sin dato' },
        { label: 'Mes menos soleado', value: Number.isFinite(lowM) ? `${lowM.toFixed(2)} kWh/m²/día` : 'sin dato' },
        { label: 'Celdas muestreadas', value: String(validSamples.length) },
      ],
      canvas,
      bounds,
      available: true,
      creditText: 'Solar/UV: NASA POWER Climatology',
    };
  }

  const peakUv = Math.max(
    ...validSamples.map((s) => s.raw.uvMaxMonth ?? -Infinity).filter(Number.isFinite)
  );

  return {
    subLayerId: mode,
    title: 'Índice UV Superficial (Climatología)',
    role: 'contexto',
    roleLabel: 'Límite de la Tierra · Ficha (Principio 9)',
    unit: 'Índice UV',
    resolutionLabel: '1° × 1° SYN1DEG (2001–2025)',
    sourceLabel: 'NASA POWER Climatology v2.10',
    note: 'Contexto astrobiológico: la atmósfera y magnetósfera terrestres atenúan la radiación frente a la Luna o Marte (Principio 9).',
    minLabel: `${minVal.toFixed(2)}`,
    maxLabel: `${maxVal.toFixed(2)}`,
    meanLabel: `${meanVal.toFixed(2)} UV`,
    gradientCss: 'linear-gradient(90deg, #10b981, #eab308, #e11d48, #be185d, #7e22ce)',
    legendStops: [
      { color: '#10b981', label: '0–2' },
      { color: '#eab308', label: '4–6' },
      { color: '#e11d48', label: '7–9' },
      { color: '#7e22ce', label: '≥11 Extremo' },
    ],
    metricsRows: [
      { label: 'Índice UV medio anual', value: meanVal.toFixed(2) },
      { label: 'Pico mensual medio', value: Number.isFinite(peakUv) ? peakUv.toFixed(2) : 'sin dato' },
      { label: 'Celdas muestreadas', value: String(validSamples.length) },
      { label: 'Nota física', value: 'No comparable directo a UV cósmico' },
    ],
    canvas,
    bounds,
    available: true,
    creditText: 'Solar/UV: NASA POWER Climatology',
  };
}
