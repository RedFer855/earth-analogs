import { describe, expect, it } from 'vitest';
import type { EtlCandidateCell } from '../types/copilot.types.ts';
import { NEUTRAL_SURFACE_TEMP_K, cellToContext, contextToSimControl } from './etlToCopilotMapper.ts';

const cell: EtlCandidateCell = {
  ipix: 123456,
  lat: 21.5,
  lon: -101.25,
  region: 'Synthetic region 42',
  similitud: 0.81,
  slope_mean_deg: 18.4,
  rug_rms_mean_m: 0.12,
  relieve_mean_m: 1.4,
  diagnostico: { rango_diurno_k: 31.5 },
};
const target = { code: 'JEZ', name: 'Jezero delta (sample)', body: 'MARS' as const };

describe('cellToContext', () => {
  it('maps N1, N2, N3 and N5 from the published fields and seeds from ipix', () => {
    const ctx = cellToContext(cell, target);
    expect(ctx.analogVector).toBeInstanceOf(Float32Array);
    expect(ctx.analogVector.length).toBe(7);
    expect(ctx.analogVector[0]).toBeCloseTo(18.4, 4);
    expect(ctx.analogVector[1]).toBeCloseTo(0.12, 4);
    expect(ctx.analogVector[2]).toBeCloseTo(1.4, 4);
    expect(ctx.analogVector[4]).toBeCloseTo(31.5, 4);
    expect(ctx.seed).toBe(123456);
    expect(ctx.similarityScore).toBe(0.81);
    expect(ctx.regionName).toBe('Synthetic region 42');
  });

  it('records N4, N6, N7 and surfaceTempK as missing and never as 0', () => {
    const ctx = cellToContext(cell, target);
    for (const v of ['N4', 'N6', 'N7', 'surfaceTempK']) expect(ctx.missingVars).toContain(v);
    expect(Number.isNaN(ctx.analogVector[3])).toBe(true);
    expect(Number.isNaN(ctx.analogVector[5])).toBe(true);
    expect(Number.isNaN(ctx.analogVector[6])).toBe(true);
    expect(ctx.surfaceTempK).toBeNull();
  });

  it('records a null published field as missing instead of 0', () => {
    const ctx = cellToContext({ ...cell, slope_mean_deg: null, diagnostico: { rango_diurno_k: null } }, target);
    expect(ctx.missingVars).toContain('N1');
    expect(ctx.missingVars).toContain('N5');
    expect(Number.isNaN(ctx.analogVector[0])).toBe(true);
  });
});

describe('contextToSimControl', () => {
  it('builds a sandbox command with the mode, body profiles and seed', () => {
    const ctrl = contextToSimControl(cellToContext(cell, target), 'ROVER');
    expect(ctrl.mode).toBe('ROVER');
    expect(ctrl.targetBody).toBe('MARS');
    expect(ctrl.roverProfile).toBe('PERSEVERANCE');
    expect(ctrl.lidarProfile).toBe('M2020');
    expect(ctrl.seed).toBe(123456);
    expect(ctrl.analog?.n1SlopeDeg).toBeCloseTo(18.4, 4);
  });

  it('leaves missing values out so the sandbox applies its own neutral 280 K and never fakes ice', () => {
    const ctrl = contextToSimControl(cellToContext(cell, { ...target, body: 'MOON' }), 'LIDAR_LANDER');
    expect(ctrl.roverProfile).toBe('VIPER');
    expect(ctrl.lidarProfile).toBe('ALHAT');
    const analog = ctrl.analog ?? {};
    for (const key of ['n4SilicaPct', 'n6SolarIllumFrac', 'n7SaltationTimeFrac', 'surfaceTempK'] as const) {
      expect(analog[key] ?? null).toBeNull();
    }
    expect(ctrl.surfaceTempK ?? null).toBeNull();
    // A sunlit flag would override the sandbox's own N6 handling; it must stay unset when N6 is missing.
    expect(ctrl.sunlit).toBeUndefined();
    expect(NEUTRAL_SURFACE_TEMP_K).toBe(280);
  });

  it('serializes without NaN so postMessage carries no fabricated numbers', () => {
    const ctrl = contextToSimControl(cellToContext(cell, target), 'ISRU_DRILL');
    expect(JSON.stringify(ctrl)).not.toMatch(/NaN|:0[,}]/);
  });
});
