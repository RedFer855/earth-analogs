import type {
  EtlResultFile,
  NearestPin,
  PinFeature,
  SimModeId,
  TestSiteMatch,
  TestSiteQuery,
} from '../types/copilot.types.ts';
import { cellToContext, contextToSimControl } from '../bridge/etlToCopilotMapper.ts';
import { evaluateMode } from '../engine/deterministicRules.ts';
import type { SiteIndexStore } from './siteIndexStore.ts';

/** P-015: Greenland-type ice sheets sit above this latitude; excluded unless the query asks for ice. */
export const POLAR_LAT_LIMIT_DEG = 60;
export const PIN_RADIUS_KM = 25;
export const PIN_BONUS_MAX = 15;
export const DEFAULT_MODE: SimModeId = 'ROVER';

const EARTH_RADIUS_KM = 6371.0088;
const toRad = (deg: number): number => (deg * Math.PI) / 180;

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

function nearestPin(lat: number, lon: number, pins: readonly PinFeature[], type?: PinFeature['properties']['tipo']): NearestPin | undefined {
  let best: NearestPin | undefined;
  for (const p of pins) {
    if (type !== undefined && p.properties.tipo !== type) continue;
    const [plon, plat] = p.geometry.coordinates;
    const d = haversineKm(lat, lon, plat, plon);
    if (best === undefined || d < best.distanceKm) {
      best = { type: p.properties.tipo, name: p.properties.nombre, distanceKm: Math.round(d * 10) / 10 };
    }
  }
  return best;
}

/** A filtered variable that is missing fails the filter; it is never read as 0. */
function passes(value: number, min?: number, max?: number): boolean {
  if (min === undefined && max === undefined) return true;
  if (!Number.isFinite(value)) return false;
  return (min === undefined || value >= min) && (max === undefined || value <= max);
}

interface Scored {
  readonly match: Omit<TestSiteMatch, 'rank'>;
  readonly nearPin: boolean;
}

/** Pure ranking over already-loaded result files. */
export function rankCandidates(
  files: readonly EtlResultFile[],
  pins: readonly PinFeature[],
  query: TestSiteQuery,
): TestSiteMatch[] {
  const mode = query.mode ?? DEFAULT_MODE;
  const scored: Scored[] = [];

  for (const file of files) {
    const { codigo, nombre, cuerpo } = file.objetivo;
    if (query.targetBody !== undefined && cuerpo !== query.targetBody) continue;
    if (query.targetSiteCode !== undefined && codigo !== query.targetSiteCode) continue;

    for (const cell of file.celdas) {
      if (query.excludePolarIceCaps && cell.lat > POLAR_LAT_LIMIT_DEG) continue;
      const ctx = cellToContext(cell, { code: codigo, name: nombre, body: cuerpo }, file.percentiles_rango_diurno_k);
      const v = ctx.analogVector;
      if (!passes(v[0], query.minSlopeDeg, query.maxSlopeDeg)) continue;
      if (!passes(v[1], query.minRoughnessM)) continue;
      if (!passes(v[2], query.minReliefM)) continue;

      const readiness = evaluateMode(ctx, mode);
      const pin = nearestPin(cell.lat, cell.lon, pins, query.featurePinType);
      const nearPin = query.featurePinType !== undefined && pin !== undefined && pin.distanceKm < PIN_RADIUS_KM;
      const bonus = nearPin && pin !== undefined ? PIN_BONUS_MAX * (1 - pin.distanceKm / PIN_RADIUS_KM) : 0;
      const combinedScore =
        Math.round((0.45 * (ctx.similarityScore * 100) + 0.55 * readiness.testSuitabilityScore + bonus) * 100) / 100;

      scored.push({
        nearPin,
        match: {
          targetBody: cuerpo,
          targetSiteCode: codigo,
          targetSiteName: nombre,
          ipix: cell.ipix,
          lat: cell.lat,
          lon: cell.lon,
          regionName: ctx.regionName,
          similarityScore: ctx.similarityScore,
          readiness,
          combinedScore,
          ...(pin !== undefined && pin.distanceKm < PIN_RADIUS_KM ? { nearestPin: pin } : {}),
          context: ctx,
          simControl: contextToSimControl(ctx, mode),
        },
      });
    }
  }

  scored.sort((a, b) => {
    if (query.featurePinType !== undefined && a.nearPin !== b.nearPin) return a.nearPin ? -1 : 1;
    if (query.preferMarginStress === true) {
      const ay = a.match.readiness.status === 'yellow';
      const by = b.match.readiness.status === 'yellow';
      if (ay !== by) return ay ? -1 : 1;
    }
    return b.match.combinedScore - a.match.combinedScore || a.match.ipix - b.match.ipix;
  });

  return scored.slice(0, Math.max(1, query.limit)).map((s, i) => ({ rank: i + 1, ...s.match }));
}

/** `findTestSites(...)`: the call both the offline parser and the Gemini function call produce. */
export async function findTestSites(store: SiteIndexStore, query: TestSiteQuery): Promise<TestSiteMatch[]> {
  const files = await store.loadResults(query);
  return rankCandidates(files, store.pins(), query);
}
