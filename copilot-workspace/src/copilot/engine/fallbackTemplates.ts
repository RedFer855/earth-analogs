import type { AnalogCellContext, ModeReadiness, SimModeId } from '../types/copilot.types.ts';
import { lidarProfileFor, roverProfileFor } from '../bridge/etlToCopilotMapper.ts';

export interface FallbackVerdict {
  readonly headline: string;
  readonly verdict: string;
  readonly recommendation: string;
  readonly missingNote: string;
}

const MODE_LABEL: Record<SimModeId, string> = {
  ROVER: 'rover traverse',
  SUIT_EDS: 'suit dust (EDS)',
  LIDAR_LANDER: 'lander LiDAR',
  ISRU_DRILL: 'ISRU drill',
};

const STATUS_HEADLINE = { green: 'Within envelope', yellow: 'Caution: near the limit', red: 'Beyond the limit' } as const;

function profileFor(ctx: AnalogCellContext, mode: SimModeId): string {
  if (mode === 'ROVER') return roverProfileFor(ctx.targetBody);
  if (mode === 'LIDAR_LANDER') return lidarProfileFor(ctx.targetBody);
  if (mode === 'ISRU_DRILL') return 'TRIDENT';
  return 'EDS';
}

const RECOMMENDATION: Record<SimModeId, Record<ModeReadiness['status'], string>> = {
  ROVER: {
    green: 'Use as a baseline traverse; raise the slope with What-If to find the margin.',
    yellow: 'Good stress test: run the traverse in 3D and watch slip and the slope alert.',
    red: 'Expect a stall or tip-over; use it only to show the limit, not to qualify the rover.',
  },
  LIDAR_LANDER: {
    green: 'Use as a nominal landing site; add hazards with What-If to exercise detection.',
    yellow: 'Good hazard-detection test: check how many points the LiDAR marks as caution.',
    red: 'The site fails the landing envelope; use it to test divert logic.',
  },
  SUIT_EDS: {
    green: 'Walkable for EVA; set dust drivers with What-If (N6 on the Moon, N7 on Mars).',
    yellow: 'Steep for EVA; keep EDS tests short and watch suit power.',
    red: 'Too steep for a suit test; pick a gentler cell.',
  },
  ISRU_DRILL: {
    green: 'Stable pad for drilling; watch torque and raise WOB if the rate of penetration drops.',
    yellow: 'Tilted pad; expect torque spikes and plan bite retractions.',
    red: 'Too steep for a drill pad; move to a flatter cell.',
  },
};

/** Offline technical verdict and recommendation. Pure string assembly, well under 1 ms. */
export function buildFallbackVerdict(ctx: AnalogCellContext, readiness: ModeReadiness): FallbackVerdict {
  const profile = profileFor(ctx, readiness.mode);
  const headline = `${STATUS_HEADLINE[readiness.status]} · ${MODE_LABEL[readiness.mode]}`;
  const verdict = `${profile} on ${ctx.targetBody === 'MOON' ? 'the Moon' : 'Mars'}: ${readiness.reasons.join(' ')} Test suitability ${readiness.testSuitabilityScore.toFixed(0)}/100.`;
  const missingNote =
    readiness.missingVars.length > 0
      ? `Not in the data: ${readiness.missingVars.join(', ')}. Shown as missing, never as 0.`
      : 'All inputs present.';
  return { headline, verdict, recommendation: RECOMMENDATION[readiness.mode][readiness.status], missingNote };
}
