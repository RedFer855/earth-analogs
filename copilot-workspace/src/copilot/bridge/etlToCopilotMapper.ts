import type {
  AnalogCellContext,
  AnalogN1N7Payload,
  DiurnalRangePercentiles,
  EtlCandidateCell,
  LidarProfile,
  MissingVarName,
  RoverProfile,
  SimModeId,
  SimulationControlDetail,
  TargetBody,
} from '../types/copilot.types.ts';

/**
 * Neutral surface temperature the sandbox applies when `surfaceTempK` is missing
 * (`NEUTRAL_WARM_TEMP_K` in nasa-3d-sandbox/src/bridge/copilotContract.ts). The copilot never sends it: it leaves
 * the field out so the sandbox applies it itself and records `surfaceTempK` in its own `missingVars`. The constant is
 * kept here only to label the value in the UI.
 */
export const NEUTRAL_SURFACE_TEMP_K = 280;

/** Variables the published ETL output does not carry today (plan section 4.3). */
const ALWAYS_MISSING: readonly MissingVarName[] = ['N4', 'N6', 'N7', 'surfaceTempK'];

export interface TargetRef {
  readonly code: string;
  readonly name: string;
  readonly body: TargetBody;
}

const finiteOrNaN = (v: number | null | undefined): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : Number.NaN;

/** Translates one candidate cell (ETL field names) into the copilot's N1..N7 context. Missing stays NaN. */
export function cellToContext(
  cell: EtlCandidateCell,
  target: TargetRef,
  diurnalPercentiles?: DiurnalRangePercentiles,
): AnalogCellContext {
  const n1 = finiteOrNaN(cell.slope_mean_deg);
  const n2 = finiteOrNaN(cell.rug_rms_mean_m);
  const n3 = finiteOrNaN(cell.relieve_mean_m);
  const n5 = finiteOrNaN(cell.diagnostico?.rango_diurno_k);
  const analogVector = Float32Array.from([n1, n2, n3, Number.NaN, n5, Number.NaN, Number.NaN]);

  const missing: MissingVarName[] = [];
  if (Number.isNaN(n1)) missing.push('N1');
  if (Number.isNaN(n2)) missing.push('N2');
  if (Number.isNaN(n3)) missing.push('N3');
  if (Number.isNaN(n5)) missing.push('N5');
  missing.push(...ALWAYS_MISSING);

  return {
    targetBody: target.body,
    targetSiteCode: target.code,
    targetSiteName: target.name,
    ipix: cell.ipix,
    lat: cell.lat,
    lon: cell.lon,
    regionName: cell.region ?? `Cell ${cell.ipix}`,
    similarityScore: cell.similitud,
    analogVector,
    surfaceTempK: null,
    missingVars: missing,
    seed: cell.ipix,
    diurnalPercentiles,
  };
}

export function roverProfileFor(body: TargetBody): RoverProfile {
  return body === 'MOON' ? 'VIPER' : 'PERSEVERANCE';
}

export function lidarProfileFor(body: TargetBody): LidarProfile {
  return body === 'MOON' ? 'ALHAT' : 'M2020';
}

/** Value of the vector entry or `undefined` (never NaN, never 0) so JSON and postMessage stay honest. */
function present(v: number): number | undefined {
  return Number.isFinite(v) ? Number(v.toFixed(4)) : undefined;
}

/**
 * Builds the `SimulationControlDetail` for the sandbox. Missing variables are omitted, not zeroed: the sandbox then
 * records them in its `missingVars`, keeps 280 K for the missing surface temperature (no fake ice) and derives
 * `sunlit` itself.
 */
export function contextToSimControl(ctx: AnalogCellContext, mode: SimModeId): SimulationControlDetail {
  const v = ctx.analogVector;
  const roverProfile = roverProfileFor(ctx.targetBody);
  const lidarProfile = lidarProfileFor(ctx.targetBody);
  const analog: AnalogN1N7Payload = {
    n1SlopeDeg: present(v[0]),
    n2RoughnessRmsM: present(v[1]),
    n3ReliefM: present(v[2]),
    n4SilicaPct: present(v[3]),
    n5DiurnalTempK: present(v[4]),
    n6SolarIllumFrac: present(v[5]),
    n7SaltationTimeFrac: present(v[6]),
    diurnalPercentiles: ctx.diurnalPercentiles,
    targetBody: ctx.targetBody,
    roverProfile,
    lidarProfile,
    seed: ctx.seed,
  };
  return { mode, targetBody: ctx.targetBody, roverProfile, lidarProfile, seed: ctx.seed, analog };
}
