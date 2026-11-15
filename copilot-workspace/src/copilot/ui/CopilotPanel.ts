import type {
  AnalogCellContext,
  EtlResultFile,
  SimModeId,
  SimTelemetryAlertDetail,
  TestSiteMatch,
  TestSiteQuery,
} from '../types/copilot.types.ts';
import type { CopilotEventBus } from '../bridge/copilotEventBus.ts';
import { VISOR_FOCUS_SITES, VISOR_SELECT_CELL, VISOR_TOUR_STEP } from '../bridge/copilotEventBus.ts';
import type { SimulatorTransport } from '../bridge/simulatorTransport.ts';
import { NEUTRAL_SURFACE_TEMP_K, cellToContext, contextToSimControl } from '../bridge/etlToCopilotMapper.ts';
import { evaluateAllModes, evaluateMode } from '../engine/deterministicRules.ts';
import { buildFallbackVerdict } from '../engine/fallbackTemplates.ts';
import { parseQuery } from '../search/queryParser.ts';
import type { SiteIndexStore } from '../search/siteIndexStore.ts';
import { DEFAULT_MODE, rankCandidates } from '../search/siteRecommender.ts';
import { remedyFor, renderActionChips, whatIfChips } from './ActionChips.ts';
import { renderReadinessMatrix } from './ReadinessMatrix.ts';
import { renderRecommendationCards } from './RecommendationCards.ts';
import { button, el, fmt } from './dom.ts';

export interface GlobeLike {
  showCells(files: readonly EtlResultFile[]): void;
}

export interface CopilotPanelDeps {
  readonly store: SiteIndexStore;
  readonly bus: CopilotEventBus;
  readonly transport: SimulatorTransport;
  /** Element the transport appends its iframe to; the panel places it inside the 3D section. */
  readonly sandboxHost: HTMLElement;
  /** Column next to the globe that holds the collapsible 3D section. */
  readonly stage: HTMLElement;
}

const SUGGESTED_PROMPTS = [
  'quiero una zona para probar el rover en pendiente fuerte en Marte',
  'Lander LiDAR test on the Moon near an impact crater',
  'taladro para hielo en Marte',
];

const MODE_WORD: Record<SimModeId, string> = {
  ROVER: 'rover',
  SUIT_EDS: 'suit dust',
  LIDAR_LANDER: 'lander LiDAR',
  ISRU_DRILL: 'ISRU drill',
};

function describeQuery(q: TestSiteQuery): string {
  const parts = [MODE_WORD[q.mode ?? DEFAULT_MODE]];
  parts.push(q.targetBody === 'MOON' ? 'Moon' : q.targetBody === 'MARS' ? 'Mars' : 'Moon and Mars');
  if (q.targetSiteCode !== undefined) parts.push(`site ${q.targetSiteCode}`);
  if (q.minSlopeDeg !== undefined) parts.push(`slope ≥ ${q.minSlopeDeg}°`);
  if (q.maxSlopeDeg !== undefined) parts.push(`slope ≤ ${q.maxSlopeDeg}°`);
  if (q.featurePinType !== undefined) parts.push(`near ${q.featurePinType.replace('_', ' ')}`);
  if (q.preferMarginStress === true) parts.push('caution cells first');
  parts.push(q.excludePolarIceCaps ? 'polar cells above 60° N excluded' : 'polar cells included');
  return parts.join(' · ');
}

/** Chat + recommendations + copilot verdict + live 3D alert + lazy 3D viewport. */
export class CopilotPanel {
  private readonly deps: CopilotPanelDeps;
  private globe: GlobeLike | null = null;
  private matches: TestSiteMatch[] = [];
  private selected: { ctx: AnalogCellContext; mode: SimModeId } | null = null;
  private tourStep = -1;
  private sim3dOpen = false;
  private readonly offs: Array<() => void> = [];

  private readonly transcript = el('ol', 'transcript');
  private readonly input = el('input', 'chat-input');
  private readonly cards = el('div', 'cards-host');
  private readonly tourBtn: HTMLButtonElement;
  private readonly resultsMeta = el('p', 'results-meta data');
  private readonly verdict = el('section', 'verdict');
  private readonly alertCard = el('section', 'alert-card');
  private readonly sim3d = el('details', 'sim3d');

  constructor(root: HTMLElement, deps: CopilotPanelDeps) {
    this.deps = deps;
    this.tourBtn = button('btn-quiet', 'Tour #1 → #3', () => this.nextTourStep());
    this.tourBtn.disabled = true;
    root.append(this.buildChat(), this.alertCard, this.buildResults(), this.verdict);
    deps.stage.append(this.build3d());
    this.alertCard.hidden = true;
    this.renderVerdict();

    this.offs.push(
      deps.bus.on(VISOR_SELECT_CELL, (d) => {
        const target = { code: d.targetSiteCode ?? '', name: d.targetSiteName, body: d.targetBody };
        this.select(cellToContext(d.cell, target), d.mode ?? this.selected?.mode ?? DEFAULT_MODE);
      }),
      deps.transport.onAlert((a) => this.showAlert(a)),
    );
  }

  attachGlobe(globe: GlobeLike): void {
    this.globe = globe;
  }

  private buildChat(): HTMLElement {
    const section = el('section', 'chat');
    section.append(el('h2', 'section-title', 'Ask for a test site'));
    const form = el('form', 'chat-form');
    this.input.type = 'text';
    this.input.name = 'q';
    this.input.autocomplete = 'off';
    this.input.placeholder = 'e.g. rover test on steep ground on Mars';
    this.input.setAttribute('aria-label', 'Describe the test you want to run');
    const send = el('button', 'btn', 'Search');
    send.type = 'submit';
    form.append(this.input, send);
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      void this.ask(this.input.value);
    });
    const prompts = el('div', 'prompt-row');
    for (const p of SUGGESTED_PROMPTS) prompts.append(button('chip chip-prompt', p, () => void this.ask(p)));
    this.transcript.setAttribute('aria-live', 'polite');
    section.append(form, prompts, this.transcript);
    return section;
  }

  private buildResults(): HTMLElement {
    const section = el('section', 'results');
    const head = el('div', 'results-head');
    head.append(el('h2', 'section-title', 'Candidate cells'), this.tourBtn);
    section.append(head, this.resultsMeta, this.cards);
    return section;
  }

  private build3d(): HTMLElement {
    const summary = el('summary', 'sim3d-summary', '3D sandbox');
    summary.append(el('span', 'tag', 'Simulated · parametric'));
    this.sim3d.append(summary, this.deps.sandboxHost);
    this.sim3d.addEventListener('toggle', () => {
      this.sim3dOpen = this.sim3d.open;
      if (this.sim3dOpen) {
        this.deps.transport.open();
        if (this.selected !== null) this.deps.transport.send(contextToSimControl(this.selected.ctx, this.selected.mode));
      }
      this.deps.transport.setPanelVisible(this.sim3dOpen);
    });
    return this.sim3d;
  }

  private say(who: 'user' | 'copilot', text: string): void {
    const li = el('li', `turn is-${who}`);
    li.append(el('span', 'turn-who', who === 'user' ? 'You' : 'Copilot'), el('p', 'turn-text', text));
    this.transcript.append(li);
    while (this.transcript.children.length > 8) this.transcript.firstElementChild?.remove();
  }

  async ask(text: string): Promise<void> {
    const trimmed = text.trim();
    if (trimmed === '') return;
    this.input.value = '';
    this.say('user', trimmed);
    try {
      const codes = this.deps.store.targets().map((t) => t.codigo);
      const t0 = performance.now();
      const query = parseQuery(trimmed, codes);
      const files = await this.deps.store.loadResults(query);
      const matches = rankCandidates(files, this.deps.store.pins(), query);
      const ms = performance.now() - t0;
      this.matches = matches;
      this.tourStep = -1;
      this.tourBtn.disabled = matches.length === 0;
      this.resultsMeta.textContent = `Offline parser · ${ms.toFixed(1)} ms · ${describeQuery(query)}`;
      this.globe?.showCells(files);
      this.deps.bus.emit(VISOR_FOCUS_SITES, { matches, highlightColorByStatus: true, flyToBest: true });
      const best = matches[0];
      if (best === undefined) {
        this.say('copilot', 'No cell in the sample passes those filters. Loosen the slope or ask for ice to include polar cells.');
      } else {
        this.say('copilot', `${matches.length} cells ranked. #1 is ${best.targetSiteName}, combined score ${best.combinedScore.toFixed(1)}.`);
        this.select(best.context, best.readiness.mode, false);
      }
      this.renderCards();
    } catch (err) {
      this.say('copilot', `Search failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private renderCards(): void {
    renderRecommendationCards(this.cards, this.matches, this.selected?.ctx.ipix ?? null, {
      onSelect: (m) => {
        this.deps.bus.emit(VISOR_TOUR_STEP, { match: m, stepIndex: m.rank - 1, totalSteps: this.matches.length });
        this.select(m.context, m.readiness.mode);
      },
      onOpen3D: (m) => {
        this.select(m.context, m.readiness.mode);
        if (!this.sim3d.open) this.sim3d.open = true; // the toggle handler mounts and sends
        else this.deps.transport.send(m.simControl);
      },
    });
  }

  private nextTourStep(): void {
    const total = Math.min(3, this.matches.length);
    if (total === 0) return;
    this.tourStep = (this.tourStep + 1) % total;
    const m = this.matches[this.tourStep];
    this.tourBtn.textContent = `Tour #${this.tourStep + 1} of ${total} · next`;
    this.deps.bus.emit(VISOR_TOUR_STEP, { match: m, stepIndex: this.tourStep, totalSteps: total });
    this.select(m.context, m.readiness.mode);
  }

  /** Updates the verdict and, when the 3D panel is open, loads the cell in the sandbox. */
  private select(ctx: AnalogCellContext, mode: SimModeId, rerenderCards = true): void {
    this.selected = { ctx, mode };
    this.renderVerdict();
    if (rerenderCards) this.renderCards();
    if (this.sim3dOpen) this.deps.transport.send(contextToSimControl(ctx, mode));
  }

  private renderVerdict(): void {
    const host = this.verdict;
    host.replaceChildren();
    host.append(el('h2', 'section-title', 'Copilot verdict'));
    if (this.selected === null) {
      host.append(el('p', 'muted', 'Search, or click a cell on the globe, to rate it for each subsystem.'));
      return;
    }
    const { ctx, mode } = this.selected;
    const readiness = evaluateMode(ctx, mode);
    const v = buildFallbackVerdict(ctx, readiness);
    const matrix = el('div', 'matrix-host');
    renderReadinessMatrix(matrix, evaluateAllModes(ctx), mode);

    const vec = ctx.analogVector;
    const vars = el('dl', 'vars');
    const row = (k: string, val: string, missing: boolean) => {
      vars.append(el('dt', '', k), el('dd', `data${missing ? ' is-missing' : ''}`, val));
    };
    row('N1 slope', fmt(vec[0], 1, '°'), !Number.isFinite(vec[0]));
    row('N2 roughness', fmt(vec[1], 2, 'm'), !Number.isFinite(vec[1]));
    row('N3 relief', fmt(vec[2], 2, 'm'), !Number.isFinite(vec[2]));
    row('N4 silica', fmt(vec[3], 0, '%'), !Number.isFinite(vec[3]));
    row('N5 diurnal range', fmt(vec[4], 1, 'K'), !Number.isFinite(vec[4]));
    row('N6 illumination', fmt(vec[5], 2, ''), !Number.isFinite(vec[5]));
    row('N7 saltation', fmt(vec[6], 2, ''), !Number.isFinite(vec[6]));
    row('Surface temp.', ctx.surfaceTempK === null ? `missing (3D uses ${NEUTRAL_SURFACE_TEMP_K} K neutral, no ice)` : fmt(ctx.surfaceTempK, 0, 'K'), ctx.surfaceTempK === null);

    const chips = el('div', 'chip-row');
    renderActionChips(chips, whatIfChips(ctx.targetBody), (chip) => {
      if (chip.control.mode !== undefined && this.selected !== null) {
        this.selected = { ctx: this.selected.ctx, mode: chip.control.mode };
      }
      this.say('copilot', `What-If: ${chip.label}. ${chip.hint}`);
      if (!this.sim3d.open) this.sim3d.open = true;
      this.deps.transport.send(chip.control);
    });

    host.append(
      el('p', `verdict-head is-${readiness.status}`, v.headline),
      el('p', 'verdict-site data', `${ctx.targetSiteName} · ${ctx.regionName} · ipix ${ctx.ipix}`),
      el('p', 'verdict-text', v.verdict),
      el('p', 'verdict-rec', v.recommendation),
      matrix,
      vars,
      el('p', 'muted', v.missingNote),
      el('h3', 'subhead', 'What-If in the 3D'),
      chips,
    );
  }

  private showAlert(a: SimTelemetryAlertDetail): void {
    const card = this.alertCard;
    card.hidden = false;
    card.className = `alert-card is-${a.severity}`;
    card.replaceChildren(
      el('h2', 'section-title', 'Live 3D alert'),
      el('p', 'alert-code data', a.code),
      el('p', 'alert-msg', a.message),
      el('p', 'alert-metric data', `${a.metric} ${a.value.toFixed(2)} vs ${a.threshold.toFixed(2)} · ${a.mode} · ${a.body}`),
    );
    const remedy = remedyFor(a);
    if (remedy !== null) {
      const b = button('btn', remedy.label, () => {
        this.say('copilot', `Remedy sent: ${remedy.label}.`);
        this.deps.transport.send(remedy.control);
      });
      b.title = remedy.hint;
      card.append(b);
    }
    this.say('copilot', `3D alert ${a.code}: ${a.message}`);
  }

  destroy(): void {
    for (const off of this.offs) off();
    this.deps.transport.destroy();
  }
}
