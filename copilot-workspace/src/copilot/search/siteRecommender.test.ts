import { describe, expect, it } from 'vitest';
import type { EtlCandidateCell, EtlResultFile, PinFeature, TestSiteQuery } from '../types/copilot.types.ts';
import { haversineKm, rankCandidates } from './siteRecommender.ts';

function cell(ipix: number, lat: number, lon: number, slope: number, sim = 0.8, rough = 0.1): EtlCandidateCell {
  return {
    ipix,
    lat,
    lon,
    similitud: sim,
    slope_mean_deg: slope,
    rug_rms_mean_m: rough,
    relieve_mean_m: 1,
    diagnostico: { rango_diurno_k: 25 },
  };
}

function file(code: string, body: 'MOON' | 'MARS', celdas: EtlCandidateCell[]): EtlResultFile {
  return { synthetic: true, notice: 'test', perfil: 'p', objetivo: { codigo: code, nombre: code, cuerpo: body }, celdas };
}

const pin = (lat: number, lon: number, tipo: PinFeature['properties']['tipo'] = 'tubo_lava'): PinFeature => ({
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [lon, lat] },
  properties: { tipo, nombre: `pin ${lat}`, synthetic: true },
});

const base: TestSiteQuery = { mode: 'ROVER', targetBody: 'MARS', excludePolarIceCaps: true, limit: 5 };

describe('haversineKm', () => {
  it('measures one degree of latitude as about 111 km', () => {
    expect(haversineKm(0, 0, 1, 0)).toBeCloseTo(111.2, 0);
  });
});

describe('rankCandidates', () => {
  it('excludes cells above 60 N unless ice is requested (P-015)', () => {
    const files = [file('JEZ', 'MARS', [cell(1, 72, 0, 22), cell(2, 20, 0, 22)])];
    expect(rankCandidates(files, [], base).map((m) => m.ipix)).toEqual([2]);
    expect(rankCandidates(files, [], { ...base, excludePolarIceCaps: false }).map((m) => m.ipix)).toEqual([1, 2]);
  });

  it('applies combinedScore = 0.45 * similarity * 100 + 0.55 * suitability + pin bonus', () => {
    const [m] = rankCandidates([file('JEZ', 'MARS', [cell(1, 10, 10, 24, 0.9)])], [], base);
    expect(m.combinedScore).toBeCloseTo(0.45 * 90 + 0.55 * m.readiness.testSuitabilityScore, 5);
  });

  it('gives a bonus of up to 15 to cells within 25 km of the requested pin type and attaches nearestPin', () => {
    const files = [file('JEZ', 'MARS', [cell(1, 10, 10, 24, 0.8), cell(2, 30, 30, 24, 0.8)])];
    const pins = [pin(10.05, 10)];
    const ranked = rankCandidates(files, pins, { ...base, featurePinType: 'tubo_lava' });
    expect(ranked[0].ipix).toBe(1);
    expect(ranked[0].nearestPin?.distanceKm).toBeLessThan(25);
    const bonus = ranked[0].combinedScore - ranked[1].combinedScore;
    expect(bonus).toBeGreaterThan(10);
    expect(bonus).toBeLessThanOrEqual(15);
  });

  it('puts yellow cells first when preferMarginStress is set', () => {
    const files = [file('JEZ', 'MARS', [cell(1, 10, 10, 15, 0.97), cell(2, 11, 11, 24, 0.5)])];
    const ranked = rankCandidates(files, [], { ...base, preferMarginStress: true });
    expect(ranked[0].readiness.status).toBe('yellow');
    expect(ranked[0].ipix).toBe(2);
  });

  it('filters by body, slope floor, and returns ranks 1..limit with a ready simControl', () => {
    const files = [
      file('SHK', 'MOON', [cell(9, 0, 0, 30)]),
      file('JEZ', 'MARS', Array.from({ length: 8 }, (_, i) => cell(10 + i, i, i, 8 + i * 3))),
    ];
    const ranked = rankCandidates(files, [], { ...base, minSlopeDeg: 12 });
    expect(ranked.length).toBe(5);
    expect(ranked.map((m) => m.rank)).toEqual([1, 2, 3, 4, 5]);
    for (const m of ranked) {
      expect(m.targetBody).toBe('MARS');
      expect(m.context.analogVector[0]).toBeGreaterThanOrEqual(12);
      expect(m.simControl.mode).toBe('ROVER');
      expect(m.simControl.seed).toBe(m.ipix);
    }
  });

  it('drops cells whose filtered variable is missing instead of reading it as 0', () => {
    const missing: EtlCandidateCell = { ...cell(1, 0, 0, 0), slope_mean_deg: null };
    expect(rankCandidates([file('JEZ', 'MARS', [missing])], [], { ...base, maxSlopeDeg: 10 })).toEqual([]);
  });
});
