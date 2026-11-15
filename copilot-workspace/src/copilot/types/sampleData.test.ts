import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { EtlResultFile, MetricsFile, PinCollection } from './copilot.types.ts';

const dataDir = join(__dirname, '..', '..', '..', 'public', 'data');
const readJson = <T>(rel: string): T => JSON.parse(readFileSync(join(dataDir, rel), 'utf8')) as T;

describe('synthetic sample data', () => {
  const metrics = readJson<MetricsFile>('metrics.json');
  const results = metrics.objetivos.map((t) => readJson<EtlResultFile>(t.archivo));

  it('labels every file as synthetic with a notice', () => {
    const pins = readJson<PinCollection>('puntos.geojson');
    for (const file of [metrics, pins, ...results]) {
      expect(file.synthetic).toBe(true);
      expect(file.notice.length).toBeGreaterThan(10);
    }
  });

  it('covers Moon and Mars with at most 40 cells per target', () => {
    expect(new Set(metrics.objetivos.map((t) => t.cuerpo))).toEqual(new Set(['MOON', 'MARS']));
    for (const r of results) expect(r.celdas.length).toBeLessThanOrEqual(40);
  });

  it('includes cells above 60 N so the polar filter is testable', () => {
    const polar = results.flatMap((r) => r.celdas).filter((c) => c.lat > 60);
    expect(polar.length).toBeGreaterThan(0);
  });

  it('never publishes N4, N6, N7 or surface temperature', () => {
    const text = JSON.stringify(results);
    for (const key of ['silice', 'n4', 'n6', 'n7', 'surfaceTempK', 'lst_media_k', 'iluminacion']) {
      expect(text.includes(`"${key}"`)).toBe(false);
    }
  });

  it('has all three pin types', () => {
    const pins = readJson<PinCollection>('puntos.geojson');
    expect(new Set(pins.features.map((f) => f.properties.tipo))).toEqual(
      new Set(['tubo_lava', 'crater_impacto', 'playa_salar']),
    );
  });
});
