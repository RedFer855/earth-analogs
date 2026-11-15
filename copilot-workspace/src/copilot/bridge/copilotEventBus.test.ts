import { describe, expect, it } from 'vitest';
import { CopilotEventBus, VISOR_FOCUS_SITES, VISOR_SELECT_CELL, VISOR_TOUR_STEP } from './copilotEventBus.ts';
import type { VisorFocusSitesDetail } from '../types/copilot.types.ts';

describe('CopilotEventBus', () => {
  it('uses the plan event names', () => {
    expect([VISOR_FOCUS_SITES, VISOR_SELECT_CELL, VISOR_TOUR_STEP]).toEqual([
      'nasa:visor-focus-sites',
      'nasa:visor-select-cell',
      'nasa:visor-tour-step',
    ]);
  });

  it('delivers a typed CustomEvent detail and stops after unsubscribe', () => {
    const target = new EventTarget();
    const bus = new CopilotEventBus(target);
    const seen: VisorFocusSitesDetail[] = [];
    const off = bus.on(VISOR_FOCUS_SITES, (d) => seen.push(d));
    const detail: VisorFocusSitesDetail = { matches: [], highlightColorByStatus: true, flyToBest: true };
    bus.emit(VISOR_FOCUS_SITES, detail);
    off();
    bus.emit(VISOR_FOCUS_SITES, detail);
    expect(seen).toEqual([detail]);
  });

  it('removes every listener on dispose', () => {
    const target = new EventTarget();
    const bus = new CopilotEventBus(target);
    let n = 0;
    bus.on(VISOR_TOUR_STEP, () => (n += 1));
    bus.on(VISOR_SELECT_CELL, () => (n += 1));
    expect(bus.listenerCount()).toBe(2);
    bus.dispose();
    expect(bus.listenerCount()).toBe(0);
    target.dispatchEvent(new CustomEvent(VISOR_TOUR_STEP, { detail: {} }));
    expect(n).toBe(0);
  });
});
