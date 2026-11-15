import { describe, expect, it } from 'vitest';
import type { AnalogCellContext, MissingVarName, TargetBody } from '../types/copilot.types.ts';
import { ROVER_LIMITS, evaluateAllModes, evaluateMode } from './deterministicRules.ts';
import { buildFallbackVerdict } from './fallbackTemplates.ts';

function ctx(body: TargetBody, slope: number, rough = 0.1, missing: MissingVarName[] = ['N4', 'N6', 'N7', 'surfaceTempK']): AnalogCellContext {
  return {
    targetBody: body,
    targetSiteCode: 'X',
    targetSiteName: 'Sample',
    ipix: 1,
    lat: 10,
    lon: 10,
    regionName: 'Synthetic region',
    similarityScore: 0.8,
    analogVector: Float32Array.from([slope, rough, 1, Number.NaN, 25, Number.NaN, Number.NaN]),
    surfaceTempK: null,
    missingVars: missing,
    seed: 1,
  };
}

describe('ROVER rules (sandbox RoverSolver profiles)', () => {
  it('uses VIPER on the Moon: green <= 10, yellow <= 15, red above', () => {
    expect(ROVER_LIMITS.VIPER.slopeYellowMaxDeg).toBe(15);
    expect(evaluateMode(ctx('MOON', 8), 'ROVER').status).toBe('green');
    expect(evaluateMode(ctx('MOON', 13), 'ROVER').status).toBe('yellow');
    expect(evaluateMode(ctx('MOON', 16), 'ROVER').status).toBe('red');
  });

  it('uses PERSEVERANCE on Mars: green <= 20, yellow <= 30, red above', () => {
    expect(evaluateMode(ctx('MARS', 16), 'ROVER').status).toBe('green');
    expect(evaluateMode(ctx('MARS', 25), 'ROVER').status).toBe('yellow');
    expect(evaluateMode(ctx('MARS', 31), 'ROVER').status).toBe('red');
  });

  it('turns red when roughness exceeds the obstacle limit', () => {
    expect(evaluateMode(ctx('MOON', 5, 0.25), 'ROVER').status).toBe('red');
  });

  it('scores steeper in-envelope slopes higher and penalizes red', () => {
    const gentle = evaluateMode(ctx('MARS', 5), 'ROVER').testSuitabilityScore;
    const steep = evaluateMode(ctx('MARS', 24), 'ROVER').testSuitabilityScore;
    const beyond = evaluateMode(ctx('MARS', 34), 'ROVER').testSuitabilityScore;
    expect(steep).toBeGreaterThan(gentle);
    expect(beyond).toBeLessThan(steep);
    for (const s of [gentle, steep, beyond]) {
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(100);
    }
  });
});

describe('LIDAR_LANDER rules (sandbox LidarBvhSolver profiles)', () => {
  it('ALHAT on the Moon has no yellow band above 5 deg', () => {
    expect(evaluateMode(ctx('MOON', 4), 'LIDAR_LANDER').status).toBe('green');
    expect(evaluateMode(ctx('MOON', 6), 'LIDAR_LANDER').status).toBe('red');
  });
  it('M2020 on Mars is yellow between 5 and 20 deg', () => {
    expect(evaluateMode(ctx('MARS', 12), 'LIDAR_LANDER').status).toBe('yellow');
    expect(evaluateMode(ctx('MARS', 21), 'LIDAR_LANDER').status).toBe('red');
  });
});

describe('missing data', () => {
  it('never assumes ice for ISRU when surfaceTempK is missing', () => {
    const r = evaluateMode(ctx('MARS', 4), 'ISRU_DRILL');
    expect(r.missingVars).toContain('surfaceTempK');
    expect(r.reasons.join(' ')).toMatch(/ice not assessed/i);
  });

  it('marks a cell without N1 as yellow with score 0 instead of reading slope 0', () => {
    const r = evaluateMode(ctx('MARS', Number.NaN, 0.1, ['N1']), 'ROVER');
    expect(r.status).toBe('yellow');
    expect(r.testSuitabilityScore).toBe(0);
  });

  it('evaluates all four modes', () => {
    expect(evaluateAllModes(ctx('MOON', 8)).map((r) => r.mode)).toEqual([
      'ROVER',
      'SUIT_EDS',
      'LIDAR_LANDER',
      'ISRU_DRILL',
    ]);
  });
});

describe('fallback verdict', () => {
  it('writes an offline verdict that lists missing variables in under 1 ms', () => {
    const c = ctx('MOON', 13);
    const readiness = evaluateMode(c, 'ROVER');
    const t0 = performance.now();
    const v = buildFallbackVerdict(c, readiness);
    const dt = performance.now() - t0;
    expect(v.headline).toMatch(/caution/i);
    expect(v.verdict).toMatch(/VIPER/);
    expect(v.missingNote).toMatch(/N4/);
    expect(v.recommendation.length).toBeGreaterThan(10);
    expect(dt).toBeLessThan(1);
  });
});
