import type { TestSiteMatch } from '../types/copilot.types.ts';
import { button, el, fmt } from './dom.ts';

export interface CardHandlers {
  readonly onSelect: (match: TestSiteMatch) => void;
  readonly onOpen3D: (match: TestSiteMatch) => void;
}

const PIN_WORD = { tubo_lava: 'lava tube', crater_impacto: 'impact crater', playa_salar: 'salt playa' } as const;

/** Ranked cards #1..#N. Every value is written with textContent. */
export function renderRecommendationCards(
  container: HTMLElement,
  matches: readonly TestSiteMatch[],
  selectedIpix: number | null,
  handlers: CardHandlers,
): void {
  container.replaceChildren();
  if (matches.length === 0) {
    container.append(el('p', 'muted', 'No cell matches. Loosen the slope, drop the site code, or ask for ice to include polar cells.'));
    return;
  }
  const list = el('ol', 'cards');
  for (const m of matches) {
    const v = m.context.analogVector;
    const card = el('li', `card is-${m.readiness.status}${m.ipix === selectedIpix ? ' is-selected' : ''}`);
    const head = el('div', 'card-head');
    head.append(
      el('span', 'card-rank data', `#${m.rank}`),
      el('span', 'card-title', `${m.targetSiteName}`),
      el('span', 'card-score data', m.combinedScore.toFixed(1)),
    );
    const where = el('p', 'card-where data', `${m.regionName} · ${m.lat.toFixed(2)}°, ${m.lon.toFixed(2)}° · ipix ${m.ipix}`);
    const facts = el('dl', 'card-facts');
    const fact = (k: string, val: string) => facts.append(el('dt', '', k), el('dd', 'data', val));
    fact('Similarity', `${(m.similarityScore * 100).toFixed(0)}%`);
    fact('Suitability', `${m.readiness.testSuitabilityScore.toFixed(0)}/100`);
    fact('Slope N1', fmt(v[0], 1, '°'));
    fact('Rough N2', fmt(v[1], 2, 'm'));
    if (m.nearestPin !== undefined) fact('Pin', `${PIN_WORD[m.nearestPin.type]} ${m.nearestPin.distanceKm.toFixed(1)} km`);
    const reason = el('p', 'card-reason', m.readiness.reasons[0] ?? '');
    const actions = el('div', 'card-actions');
    actions.append(
      button('btn-quiet', 'Show on globe', () => handlers.onSelect(m)),
      button('btn', 'Open in 3D', () => handlers.onOpen3D(m)),
    );
    card.append(head, where, facts, reason, actions);
    list.append(card);
  }
  container.append(list);
}
