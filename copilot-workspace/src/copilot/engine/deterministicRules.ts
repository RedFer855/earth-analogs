import type {
  AnalogCellContext,
  LidarProfile,
  ModeReadiness,
  OperationalStatus,
  RoverProfile,
  SimModeId,
} from '../types/copilot.types.ts';
import { SIM_MODES } from '../types/copilot.types.ts';
import { lidarProfileFor, roverProfileFor } from '../bridge/etlToCopilotMapper.ts';

// Threshold values restated from the 3D sandbox so the copilot and the 3D agree on the same envelope.
// Source: nasa-3d-sandbox/src/sandbox3d/solvers/RoverSolver.ts (VIPER_LIMITS, PERSEVERANCE_LIMITS).
export const ROVER_LIMITS: Readonly<Record<RoverProfile, {
  readonly slopeGreenMaxDeg: number;
  readonly slopeYellowMaxDeg: number;
  readonly hazardRedM: number;
}>> = {
  VIPER: { slopeGreenMaxDeg: 10, slopeYellowMaxDeg: 15, hazardRedM: 0.2 },
  PERSEVERANCE: { slopeGreenMaxDeg: 20, slopeYellowMaxDeg: 30, hazardRedM: 0.525 },
  CURIOSITY: { slopeGreenMaxDeg: 20, slopeYellowMaxDeg: 30, hazardRedM: 0.525 },
};

// Source: nasa-3d-sandbox/src/sandbox3d/solvers/LidarBvhSolver.ts (ALHAT/SPLICE/CLPS/M2020_LIMITS).
export const LIDAR_LIMITS: Readonly<Record<LidarProfile, {
  readonly greenMaxDeg: number;
  readonly redMinDeg: number;
  readonly hazardSizeM: number;
}>> = {
  ALHAT: { greenMaxDeg: 5, redMinDeg: 5, hazardSizeM: 0.3 },
  SPLICE: { greenMaxDeg: 5, redMinDeg: 20, hazardSizeM: 0.3 },
  CLPS: { greenMaxDeg: 5, redMinDeg: 10, hazardSizeM: 0.2 },
  M2020: { greenMaxDeg: 5, redMinDeg: 20, hazardSizeM: 0.5 },
};

// Source: nasa-3d-sandbox/src/sandbox3d/solvers/IsruDrillSolver.ts (ICE_TEMPERATURE_K, TRIDENT_* constants).
export const DRILL_ICE_TEMPERATURE_K = 265;
export const TRIDENT_WOB_N = 100;

// Copilot-local siting envelopes (not sandbox solver values): a drill and an EVA site want gentle ground.
export const DRILL_SITE_LIMITS = { greenMaxDeg: 10, yellowMaxDeg: 15 } as const;
export const EVA_SITE_LIMITS = { greenMaxDeg: 15, yellowMaxDeg: 25 } as const;

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
const round1 = (v: number): number => Math.round(v * 10) / 10;

interface Band {
  readonly status: OperationalStatus;
  /** 0..1 terrain demand within the envelope (higher = exercises the subsystem harder). */
  readonly demand: number;
  readonly reasons: string[];
}

function slopeBand(slope: number, greenMax: number, yellowMax: number, label: string): Band {
  const status: OperationalStatus = slope <= greenMax ? 'green' : slope <= yellowMax ? 'yellow' : 'red';
  const reasons = [`Slope ${slope.toFixed(1)}° vs ${label} limits ${greenMax}° / ${yellowMax}°.`];
  return { status, demand: clamp01(slope / Math.max(yellowMax, 1e-3)), reasons };
}

function worse(a: OperationalStatus, b: OperationalStatus): OperationalStatus {
  const order: Record<OperationalStatus, number> = { green: 0, yellow: 1, red: 2 };
  return order[a] >= order[b] ? a : b;
}

/**
 * Converts terrain demand into a 0..100 test-suitability score. A test site is useful when it loads the subsystem
 * near (not beyond) its envelope: demand raises the score, a red status caps it, and each missing input costs a bit.
 */
function score(band: Band, status: OperationalStatus, missingPenalty: number, preferLow: boolean): number {
  const d = preferLow ? 1 - band.demand : band.demand;
  let s = 25 + 75 * d;
  if (status === 'red') s *= 0.4;
  s -= missingPenalty;
  return round1(Math.min(100, Math.max(0, s)));
}

export function evaluateMode(ctx: AnalogCellContext, mode: SimModeId): ModeReadiness {
  const slope = ctx.analogVector[0];
  const rough = ctx.analogVector[1];
  const missing = ctx.missingVars;

  if (!Number.isFinite(slope)) {
    return {
      mode,
      status: 'yellow',
      testSuitabilityScore: 0,
      reasons: ['Slope (N1) missing: the cell cannot be rated, so it is not read as flat.'],
      missingVars: missing,
    };
  }

  let band: Band;
  let status: OperationalStatus;
  let missingPenalty = 0;
  let preferLow = false;

  switch (mode) {
    case 'ROVER': {
      const profile = roverProfileFor(ctx.targetBody);
      const lim = ROVER_LIMITS[profile];
      band = slopeBand(slope, lim.slopeGreenMaxDeg, lim.slopeYellowMaxDeg, profile);
      status = band.status;
      if (Number.isFinite(rough) && rough > lim.hazardRedM) {
        status = 'red';
        band.reasons.push(`Roughness ${rough.toFixed(2)} m exceeds the ${profile} obstacle limit ${lim.hazardRedM} m.`);
      }
      break;
    }
    case 'LIDAR_LANDER': {
      const profile = lidarProfileFor(ctx.targetBody);
      const lim = LIDAR_LIMITS[profile];
      const yellowMax = Math.max(lim.redMinDeg, lim.greenMaxDeg);
      band = slopeBand(slope, lim.greenMaxDeg, yellowMax, profile);
      status = band.status;
      if (Number.isFinite(rough) && rough > lim.hazardSizeM) {
        status = worse(status, 'yellow');
        band.reasons.push(`Roughness ${rough.toFixed(2)} m above the ${profile} hazard size ${lim.hazardSizeM} m.`);
      }
      if (ctx.targetBody === 'MOON' && missing.includes('N6')) {
        band.reasons.push('Illumination (N6) missing: PSR optical blindness not assessed.');
        missingPenalty += 5;
      }
      break;
    }
    case 'SUIT_EDS': {
      band = slopeBand(slope, EVA_SITE_LIMITS.greenMaxDeg, EVA_SITE_LIMITS.yellowMaxDeg, 'EVA');
      status = band.status;
      preferLow = true;
      const dustVar = ctx.targetBody === 'MOON' ? 'N6' : 'N7';
      if (missing.includes('N4') || missing.includes(dustVar)) {
        band.reasons.push(`Dust drivers missing (N4, ${dustVar}): EDS load is set by What-If, not by the cell.`);
        missingPenalty += 10;
      }
      break;
    }
    case 'ISRU_DRILL': {
      band = slopeBand(slope, DRILL_SITE_LIMITS.greenMaxDeg, DRILL_SITE_LIMITS.yellowMaxDeg, 'drill site');
      status = band.status;
      preferLow = true;
      if (ctx.surfaceTempK === null) {
        band.reasons.push(`Ice not assessed: surface temperature missing (no ice assumed below ${DRILL_ICE_TEMPERATURE_K} K).`);
        missingPenalty += 5;
      }
      if (missing.includes('N4')) {
        band.reasons.push(`Silica (N4) missing: lithology factor at the TRIDENT ${TRIDENT_WOB_N} N default.`);
        missingPenalty += 5;
      }
      break;
    }
  }

  return {
    mode,
    status,
    testSuitabilityScore: score(band, status, missingPenalty, preferLow),
    reasons: band.reasons,
    missingVars: missing,
  };
}

export function evaluateAllModes(ctx: AnalogCellContext): ModeReadiness[] {
  return SIM_MODES.map((m) => evaluateMode(ctx, m));
}
