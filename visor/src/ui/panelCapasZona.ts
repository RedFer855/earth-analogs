import '../panel/capasZona.css';
import type { ZonaCapas } from '../capas/utilCapas';
import {
  ZONE_SUBLAYER_OPTIONS,
  type ZoneLayerFamily,
  type ZoneLayerResult,
  type ZoneSubLayerId,
} from '../types/capasZona';
import type { ZoneLayerManager } from '../capas/gestorCapasZona';
import { escaparHtml as escapeHtml } from '../datos/contrato';

export interface ZoneLayerPanelCallbacks {
  onLayerActivated?: (zone: ZonaCapas, subLayerId: ZoneSubLayerId, result: ZoneLayerResult) => void;
  onLayerCleared?: (zone: ZonaCapas | null) => void;
}

const DEFAULT_SUBLAYER_BY_FAMILY: Record<Exclude<ZoneLayerFamily, 'none'>, ZoneSubLayerId> = {
  geology: 'geology-lithology',
  soil: 'soil-texture',
  radiation: 'radiation-solar',
  hydrology: 'hydrology-surface',
  ndvi: 'ndvi-modis',
};

const FAMILY_PILLS: Array<{ family: ZoneLayerFamily; label: string }> = [
  { family: 'none', label: 'Apagar' },
  { family: 'geology', label: 'Geología' },
  { family: 'soil', label: 'Suelos / Polvo' },
  { family: 'radiation', label: 'Radiación' },
  { family: 'hydrology', label: 'Hidrología / Salares' },
  { family: 'ndvi', label: 'NDVI' },
];

export class ZoneLayerPanel {
  private readonly host: HTMLElement;
  private readonly layerManager: ZoneLayerManager;
  private readonly callbacks: ZoneLayerPanelCallbacks;
  private panelEl: HTMLElement;

  private isOpen = false;
  private currentZone: ZonaCapas | null = null;
  private activeFamily: ZoneLayerFamily = 'none';
  private activeSubLayer: ZoneSubLayerId = 'geology-lithology';
  private lastSubLayerByFamily: Record<Exclude<ZoneLayerFamily, 'none'>, ZoneSubLayerId> = {
    ...DEFAULT_SUBLAYER_BY_FAMILY,
  };
  private isLoading = false;
  private errorMessage: string | null = null;
  private currentResult: ZoneLayerResult | null = null;
  private requestToken = 0;

  constructor(
    host: HTMLElement,
    layerManager: ZoneLayerManager,
    callbacks: ZoneLayerPanelCallbacks = {}
  ) {
    this.host = host;
    this.layerManager = layerManager;
    this.callbacks = callbacks;

    this.panelEl = document.createElement('aside');
    this.panelEl.id = 'zoneLayerPanel';
    this.panelEl.className = 'zone-layer-panel hidden';
    this.host.appendChild(this.panelEl);

    this.bindEvents();
    this.render();
  }

  public openForZone(zone: ZonaCapas, defaultFamily: ZoneLayerFamily = 'geology'): void {
    const zoneChanged = this.currentZone?.id !== zone.id;
    this.currentZone = zone;
    this.isOpen = true;
    this.panelEl.classList.remove('hidden');

    if (zoneChanged) {
      this.errorMessage = null;
      this.currentResult = null;
      if (this.activeFamily === 'none') {
        this.activeFamily = defaultFamily;
        if (defaultFamily !== 'none') {
          this.activeSubLayer = this.lastSubLayerByFamily[defaultFamily];
        }
      }
      if (this.activeFamily !== 'none') {
        void this.loadActiveSubLayer();
        return;
      }
    }

    this.render();
  }

  public close(clearOverlay = false): void {
    this.isOpen = false;
    this.panelEl.classList.add('hidden');
    if (clearOverlay) {
      this.turnOffLayer();
    }
  }

  public turnOffLayer(): void {
    this.requestToken++;
    this.isLoading = false;
    this.errorMessage = null;
    this.currentResult = null;
    this.activeFamily = 'none';
    this.layerManager.clearOverlay();
    this.callbacks.onLayerCleared?.(this.currentZone);
    this.render();
  }

  public handleZoneDeleted(zoneId: string): void {
    if (this.currentZone?.id !== zoneId) return;
    this.currentZone = null;
    this.close(true);
  }

  public getActiveState(): {
    isOpen: boolean;
    zoneId: string | null;
    family: ZoneLayerFamily;
    subLayer: ZoneSubLayerId;
    available: boolean | null;
  } {
    return {
      isOpen: this.isOpen,
      zoneId: this.currentZone?.id ?? null,
      family: this.activeFamily,
      subLayer: this.activeSubLayer,
      available: this.currentResult ? this.currentResult.available : null,
    };
  }

  private bindEvents(): void {
    for (const evt of ['pointerdown', 'mousedown', 'wheel', 'dblclick'] as const) {
      this.panelEl.addEventListener(evt, (e) => {
        e.stopPropagation();
      });
    }

    this.panelEl.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;

      const closeBtn = target.closest<HTMLElement>('[data-layer-action="close"]');
      if (closeBtn) {
        this.close(false);
        return;
      }

      const pill = target.closest<HTMLButtonElement>('[data-layer-family]');
      if (pill) {
        const family = pill.dataset.layerFamily as ZoneLayerFamily;
        if (family === 'none') {
          this.turnOffLayer();
          return;
        }
        this.activeFamily = family;
        this.activeSubLayer = this.lastSubLayerByFamily[family];
        void this.loadActiveSubLayer();
      }
    });

    this.panelEl.addEventListener('change', (e) => {
      const target = e.target as HTMLElement;
      if (target.id === 'zoneSubLayerSelect') {
        const select = target as HTMLSelectElement;
        const subId = select.value as ZoneSubLayerId;
        const opt = ZONE_SUBLAYER_OPTIONS.find((o) => o.id === subId);
        if (opt) {
          this.activeFamily = opt.family;
          this.activeSubLayer = subId;
          this.lastSubLayerByFamily[opt.family] = subId;
          void this.loadActiveSubLayer();
        }
      }
    });

    this.panelEl.addEventListener('input', (e) => {
      const target = e.target as HTMLElement;
      if (target.id === 'zoneLayerAlphaRange') {
        const input = target as HTMLInputElement;
        const pct = Number(input.value);
        this.layerManager.setAlpha(pct / 100);
        const valEl = this.panelEl.querySelector('#zoneLayerAlphaValue');
        if (valEl) valEl.textContent = `${Math.round(pct)}%`;
      }
    });
  }

  private async loadActiveSubLayer(): Promise<void> {
    if (!this.currentZone || this.activeFamily === 'none') return;

    const token = ++this.requestToken;
    const zone = this.currentZone;
    const subLayerId = this.activeSubLayer;

    this.isLoading = true;
    this.errorMessage = null;
    this.render();

    try {
      const result = await this.layerManager.activateLayer(zone, subLayerId);
      if (token !== this.requestToken || !result) return;

      this.isLoading = false;
      this.currentResult = result;
      if (result.available) {
        this.callbacks.onLayerActivated?.(zone, subLayerId, result);
      } else {
        this.callbacks.onLayerCleared?.(zone);
      }
      this.render();
    } catch (err) {
      if (token !== this.requestToken) return;
      this.isLoading = false;
      this.currentResult = null;
      this.callbacks.onLayerCleared?.(zone);
      this.errorMessage =
        err instanceof Error
          ? err.message
          : 'No se pudo obtener la capa temática desde el proveedor.';
      this.render();
    }
  }

  private render(): void {
    const zoneName = this.currentZone ? escapeHtml(this.currentZone.name) : 'Sin zona';
    const alphaPct = Math.round(this.layerManager.getAlpha() * 100);

    const pillsHtml = FAMILY_PILLS.map((p) => {
      const activeClass = this.activeFamily === p.family ? ' active' : '';
      return `<button type="button" class="layer-pill${activeClass}" data-layer-family="${p.family}">${escapeHtml(p.label)}</button>`;
    }).join('');

    const familyOptions =
      this.activeFamily === 'none'
        ? []
        : ZONE_SUBLAYER_OPTIONS.filter((opt) => opt.family === this.activeFamily);

    const selectHtml =
      this.activeFamily === 'none'
        ? ''
        : `
        <div class="layer-control-row">
          <label class="layer-control-label" for="zoneSubLayerSelect">Subcapa</label>
          <select id="zoneSubLayerSelect" class="zone-sublayer-select" ${this.isLoading ? 'disabled' : ''}>
            ${familyOptions
              .map(
                (opt) =>
                  `<option value="${opt.id}" ${opt.id === this.activeSubLayer ? 'selected' : ''}>${escapeHtml(opt.label)}</option>`
              )
              .join('')}
          </select>
        </div>
        <div class="layer-control-row layer-alpha-row">
          <label class="layer-control-label" for="zoneLayerAlphaRange">Opacidad</label>
          <input id="zoneLayerAlphaRange" class="layer-alpha-slider" type="range" min="0" max="100" step="1" value="${alphaPct}" />
          <span id="zoneLayerAlphaValue" class="layer-alpha-value">${alphaPct}%</span>
        </div>
      `;

    const bodyHtml = this.renderBody();

    this.panelEl.innerHTML = `
      <div class="layer-panel-header">
        <div class="layer-panel-title-wrap">
          <span class="layer-panel-eyebrow">Capas de la zona</span>
          <strong class="layer-panel-zone-name" title="${zoneName}">${zoneName}</strong>
        </div>
        <button type="button" class="modal-close" data-layer-action="close" title="Cerrar panel">&times;</button>
      </div>
      <div class="layer-pills" role="tablist" aria-label="Familias de capas temáticas">
        ${pillsHtml}
      </div>
      ${selectHtml}
      <div class="layer-panel-body">
        ${bodyHtml}
      </div>
    `;
  }

  private renderBody(): string {
    if (!this.currentZone || this.activeFamily === 'none') {
      return `
        <div class="layer-empty-state">
          Selecciona una familia (<strong>Geología</strong>, <strong>Suelos</strong>, <strong>Radiación</strong>, <strong>Hidrología</strong> o <strong>NDVI</strong>) para proyectar datos reales recortados dentro de esta zona.
        </div>
      `;
    }

    if (this.isLoading) {
      const opt = ZONE_SUBLAYER_OPTIONS.find((o) => o.id === this.activeSubLayer);
      return `
        <div class="layer-loading-box">
          <span class="layer-spinner"></span>
          <div>
            <strong>Cargando ${escapeHtml(opt?.label ?? 'capa')}</strong>
            <p>Consultando fuente abierta y recortando al polígono...</p>
          </div>
        </div>
      `;
    }

    if (this.errorMessage) {
      return `
        <div class="layer-status-box is-error">
          <strong>sin dato — Error de consulta</strong>
          <p>${escapeHtml(this.errorMessage)}</p>
        </div>
      `;
    }

    const r = this.currentResult;
    if (!r) return '';

    const roleClass =
      r.role === 'comparable' ? 'role-comparable' : r.role === 'filtro' ? 'role-filtro' : 'role-contexto';

    if (!r.available) {
      return `
        <div class="layer-meta-top">
          <span class="layer-role-badge ${roleClass}">${escapeHtml(r.roleLabel)}</span>
          <span class="layer-res-tag">${escapeHtml(r.resolutionLabel)}</span>
        </div>
        <div class="layer-status-box is-unavailable">
          <strong>sin dato disponible en vivo</strong>
          <p>${escapeHtml(r.unavailableReason ?? 'Cobertura no disponible para esta zona.')}</p>
        </div>
        <div class="layer-source-line">Fuente: ${escapeHtml(r.sourceLabel)}</div>
      `;
    }

    const legendHtml = r.gradientCss
      ? `
        <div class="layer-legend-wrap">
          <div class="layer-legend-bar" style="background:${escapeHtml(r.gradientCss)};"></div>
          <div class="layer-legend-range">
            <span>${escapeHtml(r.legendStops[0]?.label ?? r.minLabel)}</span>
            <span>${escapeHtml(r.legendStops[r.legendStops.length - 1]?.label ?? r.maxLabel)}</span>
          </div>
        </div>
      `
      : r.legendStops.length > 0
        ? `
        <div class="layer-swatches">
          ${r.legendStops
            .map(
              (s) => `
            <span class="layer-swatch-item">
              <i class="layer-swatch-dot" style="background:${escapeHtml(s.color)};"></i>
              <span>${escapeHtml(s.label)}</span>
            </span>
          `
            )
            .join('')}
        </div>
      `
        : '';

    const summaryStatsHtml = `
      <div class="layer-stats-strip">
        <div class="layer-stat-cell"><span>Mín</span><strong>${escapeHtml(r.minLabel)}</strong></div>
        <div class="layer-stat-cell"><span>Prom</span><strong>${escapeHtml(r.meanLabel)}</strong></div>
        <div class="layer-stat-cell"><span>Máx</span><strong>${escapeHtml(r.maxLabel)}</strong></div>
      </div>
    `;

    const metricsHtml = r.metricsRows.length
      ? `
        <div class="layer-metrics-grid">
          ${r.metricsRows
            .map(
              (row) => `
            <div class="layer-metric-row">
              <span class="layer-metric-k">${escapeHtml(row.label)}</span>
              <span class="layer-metric-v">${escapeHtml(row.value)}</span>
            </div>
          `
            )
            .join('')}
        </div>
      `
      : '';

    return `
      <div class="layer-meta-top">
        <span class="layer-role-badge ${roleClass}">${escapeHtml(r.roleLabel)}</span>
        <span class="layer-res-tag">${escapeHtml(r.resolutionLabel)}</span>
      </div>
      ${legendHtml}
      ${summaryStatsHtml}
      ${metricsHtml}
      <div class="layer-note">${escapeHtml(r.note)}</div>
      <div class="layer-source-line">Fuente: ${escapeHtml(r.sourceLabel)} · Unidad: ${escapeHtml(r.unit)}</div>
    `;
  }
}
