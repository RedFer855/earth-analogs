import { describe, expect, it } from 'vitest';
import type { SimTelemetryAlertDetail } from '../types/copilot.types.ts';
import { remedyFor, whatIfChips } from './ActionChips.ts';

const alert = (code: string, suggestedAction?: SimTelemetryAlertDetail['suggestedAction']): SimTelemetryAlertDetail => ({
  source: 'nasa-3d-sandbox',
  code,
  mode: 'LIDAR_LANDER',
  body: 'moon',
  severity: 'red',
  message: 'm',
  metric: 'x',
  value: 1,
  threshold: 1,
  timestampMs: 0,
  ...(suggestedAction !== undefined ? { suggestedAction } : {}),
});

describe('whatIfChips', () => {
  it('offers the PSR chip on the Moon as a bare whatIf N6 = 0 in LiDAR mode', () => {
    const psr = whatIfChips('MOON').find((c) => c.id === 'moon-psr');
    // The sandbox applies whatIf only when the message carries no analog payload.
    expect(psr?.control).toEqual({ mode: 'LIDAR_LANDER', whatIf: { variable: 'N6', newValue: 0 } });
  });

  it('offers Mars chips for saltation and drill thrust, and no Moon-only chips', () => {
    const mars = whatIfChips('MARS');
    expect(mars.map((c) => c.id)).toEqual(['mars-saltation', 'mars-wob']);
    expect(mars[0].control.whatIf).toEqual({ variable: 'N7', newValue: 0.65 });
    expect(mars[1].control.action).toBe('BOOST_DRILL_WOB');
    for (const c of [...mars, ...whatIfChips('MOON')]) expect(c.control.analog).toBeUndefined();
  });
});

describe('remedyFor', () => {
  it('uses the sandbox suggestedAction when present', () => {
    expect(remedyFor(alert('SUIT_SOLAR_DEFICIT_PSR', 'PULSE_EDS'))?.control).toEqual({ action: 'PULSE_EDS' });
  });

  it('offers a return to sunlight for LiDAR PSR blindness', () => {
    expect(remedyFor(alert('LIDAR_PSR_OPTICAL_BLIND'))?.control).toEqual({
      mode: 'LIDAR_LANDER',
      whatIf: { variable: 'N6', newValue: 1 },
    });
  });

  it('returns null for an alert without a known remedy', () => {
    expect(remedyFor(alert('SOMETHING_NEW'))).toBeNull();
  });
});
