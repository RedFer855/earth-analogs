import type { VisorFocusSitesDetail, VisorSelectCellDetail, VisorTourStepDetail } from '../types/copilot.types.ts';

/** Visor <-> Copilot `CustomEvent` contract (plan section 4.4). */
export const VISOR_FOCUS_SITES = 'nasa:visor-focus-sites';
export const VISOR_SELECT_CELL = 'nasa:visor-select-cell';
export const VISOR_TOUR_STEP = 'nasa:visor-tour-step';

export interface CopilotEventMap {
  readonly [VISOR_FOCUS_SITES]: VisorFocusSitesDetail;
  readonly [VISOR_SELECT_CELL]: VisorSelectCellDetail;
  readonly [VISOR_TOUR_STEP]: VisorTourStepDetail;
}

export type CopilotEventName = keyof CopilotEventMap;

/** Typed wrapper over an `EventTarget` (the page `window` by default) that tracks its own listeners. */
export class CopilotEventBus {
  private readonly target: EventTarget;
  private readonly listeners = new Set<{ readonly type: string; readonly fn: EventListener }>();

  constructor(target: EventTarget = window) {
    this.target = target;
  }

  emit<K extends CopilotEventName>(type: K, detail: CopilotEventMap[K]): void {
    this.target.dispatchEvent(new CustomEvent(type, { detail }));
  }

  on<K extends CopilotEventName>(type: K, handler: (detail: CopilotEventMap[K]) => void): () => void {
    const fn: EventListener = (ev) => handler((ev as CustomEvent<CopilotEventMap[K]>).detail);
    const entry = { type, fn };
    this.target.addEventListener(type, fn);
    this.listeners.add(entry);
    return () => {
      if (!this.listeners.delete(entry)) return;
      this.target.removeEventListener(type, fn);
    };
  }

  listenerCount(): number {
    return this.listeners.size;
  }

  dispose(): void {
    for (const { type, fn } of this.listeners) this.target.removeEventListener(type, fn);
    this.listeners.clear();
  }
}
