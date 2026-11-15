import type { ModeReadiness, SimModeId } from '../types/copilot.types.ts';
import { el } from './dom.ts';

const MODE_SHORT: Record<SimModeId, string> = {
  ROVER: 'Rover',
  SUIT_EDS: 'Suit EDS',
  LIDAR_LANDER: 'Lander LiDAR',
  ISRU_DRILL: 'ISRU drill',
};

const STATUS_WORD = { green: 'Go', yellow: 'Caution', red: 'Limit' } as const;

/** Four-mode traffic light with the test-suitability score of each mode. */
export function renderReadinessMatrix(container: HTMLElement, rows: readonly ModeReadiness[], active?: SimModeId): void {
  container.replaceChildren();
  const list = el('ol', 'matrix');
  list.setAttribute('aria-label', 'Readiness by subsystem');
  for (const r of rows) {
    const item = el('li', `matrix-row is-${r.status}${r.mode === active ? ' is-active' : ''}`);
    const lamp = el('span', 'lamp');
    lamp.setAttribute('aria-hidden', 'true');
    const name = el('span', 'matrix-mode', MODE_SHORT[r.mode]);
    const status = el('span', 'matrix-status', STATUS_WORD[r.status]);
    const meter = el('span', 'matrix-meter');
    const fill = el('span', 'matrix-fill');
    fill.style.width = `${Math.max(0, Math.min(100, r.testSuitabilityScore))}%`;
    meter.append(fill);
    const score = el('span', 'matrix-score data', r.testSuitabilityScore.toFixed(0));
    item.title = r.reasons.join(' ');
    item.append(lamp, name, status, meter, score);
    list.append(item);
  }
  container.append(list);
}
