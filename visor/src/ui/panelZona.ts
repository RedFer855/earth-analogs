import { type DatosCapas7, obtenerColumnaCapas7 } from '../datos/capas7';
import {
  type Celda,
  escaparHtml,
  type PuntoFeature,
  type PuntosGeoJson,
} from '../datos/contrato';
import type { Coordenada } from '../datos/coordenadas';
import {
  filtrarCandidatosEnZona,
  filtrarPuntosEnZona,
  resumirColumnasEnZona,
  seleccionarCeldasEnZona,
  type ResumenVariableZona,
} from '../datos/cruceZona';
import { areaEsfericaM2, perimetroEsfericoM } from '../datos/geometria';
import {
  CapaOverlaysZona,
  type ResultadoOverlayZona,
  type TipoOverlayZona,
} from '../capas/overlaysZona';
import { CapaZonas } from '../capas/zonas';
import type { FormaDibujo } from '../herramientas/dibujo';

const COLUMNAS_RESUMEN_PREFERIDAS = [
  'slope_mean_deg',
  't_mean_c',
  'aridez_ai',
  'ndvi_mean',
  'silice_pct',
  'roca_volcanica_pct',
];

export class PanelZona {
  private readonly el: HTMLElement;
  private zonaActiva: { coords: Coordenada[]; forma: FormaDibujo } | null = null;
  private datos7: DatosCapas7 | null = null;
  private candidatosActuales: Celda[] = [];
  private puntosGeoJson: PuntosGeoJson | null = null;
  private resumenEtl: ResumenVariableZona[] = [];
  private celdasConteo = 0;
  private aproxCercania = false;
  private cargandoEtl = false;
  private overlayTipo: TipoOverlayZona = 'ninguno';
  private overlayRes: ResultadoOverlayZona | null = null;

  constructor(
    contenedor: HTMLElement,
    private readonly baseDatos: string,
    private readonly capaZonas: CapaZonas,
    private readonly overlays: CapaOverlaysZona,
    private readonly alElegirCandidato?: (rango: number) => void,
  ) {
    this.el = document.createElement('aside');
    this.el.className = 'panel-zona oculto';
    contenedor.appendChild(this.el);
  }

  configurarDatos7(datos7: DatosCapas7): void {
    this.datos7 = datos7;
    if (this.zonaActiva) {
      void this.calcularResumenEtl(this.zonaActiva.coords);
    }
  }

  configurarCandidatos(candidatos: Celda[]): void {
    this.candidatosActuales = candidatos;
    if (this.zonaActiva) this.renderizar();
  }

  configurarPuntos(geojson: PuntosGeoJson): void {
    this.puntosGeoJson = geojson;
    if (this.zonaActiva) this.renderizar();
  }

  mostrarAnalisis(coords: Coordenada[], forma: FormaDibujo): void {
    this.zonaActiva = { coords, forma };
    this.overlayTipo = 'ninguno';
    this.overlayRes = null;
    this.overlays.limpiar();
    this.el.classList.remove('oculto');
    this.renderizar();
    void this.calcularResumenEtl(coords);
  }

  mostrarGuardadas(): void {
    this.el.classList.remove('oculto');
    this.renderizar();
  }

  ocultar(): void {
    this.el.classList.add('oculto');
  }

  private async calcularResumenEtl(coords: Coordenada[]): Promise<void> {
    if (!this.datos7) return;
    const { ipix, meta, cacheColumnas } = this.datos7;
    const sel = seleccionarCeldasEnZona(coords, ipix, meta.nside);
    this.celdasConteo = sel.indices.length;
    this.aproxCercania = sel.aproximacionPorCercania;

    if (sel.indices.length === 0) {
      this.resumenEtl = [];
      this.renderizar();
      return;
    }

    const columnasDisponibles = COLUMNAS_RESUMEN_PREFERIDAS.filter((c) => c in meta.columnas);
    const faltantes = columnasDisponibles.filter((c) => !cacheColumnas.has(c));
    if (faltantes.length > 0) {
      this.cargandoEtl = true;
      this.renderizar();
      await Promise.all(
        faltantes.map((c) => obtenerColumnaCapas7(this.datos7!, c, `${this.baseDatos}capas7/`)),
      );
      this.cargandoEtl = false;
    }

    this.resumenEtl = resumirColumnasEnZona(sel.indices, meta.columnas, cacheColumnas);
    this.renderizar();
  }

  private renderizar(): void {
    const zonas = this.capaZonas.listar();
    let htmlActiva = '<p class="zona-vacia">Dibuja o mide un área en el globo para ver su cruce ETL.</p>';

    if (this.zonaActiva) {
      const { coords, forma } = this.zonaActiva;
      const areaM2 = areaEsfericaM2(coords);
      const areaKm2 = areaM2 / 1_000_000;
      const areaHa = areaM2 / 10_000;
      const perimKm = perimetroEsfericoM(coords) / 1000;
      const cands: Celda[] = filtrarCandidatosEnZona(coords, this.candidatosActuales);
      const pines: PuntoFeature[] = filtrarPuntosEnZona(coords, this.puntosGeoJson);

      const notaCeldas = this.datos7
        ? this.aproxCercania
          ? 'Celda nivel 7 más cercana (área < ~50 km)'
          : `${this.celdasConteo} celdas nivel 7 dentro`
        : 'Cargando malla nivel 7...';

      const tablaEtl = this.cargandoEtl
        ? '<p class="zona-nota">Cargando variables ETL...</p>'
        : this.resumenEtl.length > 0
          ? `<table class="corr-tabla">
              <thead><tr><th>Variable</th><th>Media</th><th>Min / Max</th></tr></thead>
              <tbody>
                ${this.resumenEtl
                  .map(
                    (r) => `<tr>
                      <td>${escaparHtml(r.columna)}</td>
                      <td>${r.media.toFixed(2)} ${escaparHtml(r.unidad)}</td>
                      <td>${r.min.toFixed(1)} / ${r.max.toFixed(1)}</td>
                    </tr>`,
                  )
                  .join('')}
              </tbody>
            </table>`
          : '';

      const htmlCands =
        cands.length > 0
          ? `<div class="zona-chips">${cands
              .slice(0, 8)
              .map(
                (c) =>
                  `<button type="button" class="btn-mini" data-ir-cand="${c.rango}">#${c.rango} (${(c.nota * 100).toFixed(0)}%)</button>`,
              )
              .join('')}</div>`
          : '<span class="zona-nota">0 candidatos dentro</span>';

      htmlActiva = `
        <div class="zona-metricas">
          <div><strong>Forma:</strong> ${escaparHtml(forma)}</div>
          <div><strong>Área:</strong> ${areaKm2 >= 1 ? `${areaKm2.toFixed(2)} km²` : `${areaHa.toFixed(1)} ha`}</div>
          <div><strong>Perímetro:</strong> ${perimKm.toFixed(2)} km</div>
          <div><strong>Cobertura ETL:</strong> ${escaparHtml(notaCeldas)}</div>
          <div><strong>Pines de ref.:</strong> ${pines.length} dentro</div>
        </div>
        ${tablaEtl}
        <div class="zona-sub">
          <strong>Capa temática opcional:</strong>
          <select class="select-coro" data-overlay-zona aria-label="Overlay de zona">
            <option value="ninguno"${this.overlayTipo === 'ninguno' ? ' selected' : ''}>Ninguna (solo ETL)</option>
            <option value="gibs-aod"${this.overlayTipo === 'gibs-aod' ? ' selected' : ''}>Polvo / Aerosoles AOD (NASA GIBS)</option>
            <option value="gibs-lst"${this.overlayTipo === 'gibs-lst' ? ' selected' : ''}>Temp. superficial diurna (NASA GIBS)</option>
            <option value="macrostrat"${this.overlayTipo === 'macrostrat' ? ' selected' : ''}>Litología y formaciones (Macrostrat)</option>
          </select>
          ${this.renderizarEstadoOverlay()}
        </div>
        <div class="zona-sub"><strong>Candidatos dentro (${cands.length}):</strong> ${htmlCands}</div>
        <div class="zona-guardar-fila">
          <input type="text" class="input-coord" data-zona-nombre placeholder="Nombre de zona..." />
          <button type="button" class="btn-mini btn-ir" data-accion="guardar-zona">Guardar</button>
        </div>
      `;
    }

    const htmlGuardadas =
      zonas.length > 0
        ? `<ul class="zona-lista">${zonas
            .map(
              (z) => `<li class="zona-item">
                <span class="zona-color" style="background:${escaparHtml(z.color)}"></span>
                <span class="zona-nom">${escaparHtml(z.nombre)} (${z.areaKm2.toFixed(1)} km²)</span>
                <button type="button" class="btn-mini" data-ir-zona="${escaparHtml(z.id)}">Ir</button>
                <button type="button" class="btn-mini" data-del-zona="${escaparHtml(z.id)}">×</button>
              </li>`,
            )
            .join('')}</ul>`
        : '<p class="zona-nota">No hay zonas guardadas.</p>';

    this.el.innerHTML = `
      <div class="panel-objetivo-cab">
        <span>Análisis de Zona</span>
        <div class="pines-botones">
          <button type="button" class="btn-mini" data-accion="toggle-relleno">${this.capaZonas.tieneRelleno() ? 'Relleno ON' : 'Relleno OFF'}</button>
          <button type="button" class="btn-mini" data-accion="exportar-geojson" ${zonas.length === 0 ? 'disabled' : ''}>GeoJSON</button>
          <button type="button" class="btn-cerrar" data-accion="cerrar-zona" aria-label="Cerrar panel de zona">×</button>
        </div>
      </div>
      <div class="panel-zona-cuerpo">
        ${htmlActiva}
        <div class="zona-guardadas">
          <div class="zona-sub"><strong>Zonas guardadas (${zonas.length})</strong></div>
          ${htmlGuardadas}
        </div>
      </div>
    `;

    this.enlazarEventosDom();
  }

  private enlazarEventosDom(): void {
    this.el.querySelector('[data-accion="cerrar-zona"]')?.addEventListener('click', () => {
      this.overlays.limpiar();
      this.ocultar();
    });
    this.el.querySelector<HTMLSelectElement>('[data-overlay-zona]')?.addEventListener('change', (ev) => {
      if (!this.zonaActiva) return;
      const tipo = (ev.target as HTMLSelectElement).value as TipoOverlayZona;
      this.overlayTipo = tipo;
      void this.overlays.aplicar(tipo, this.zonaActiva.coords).then((res) => {
        this.overlayRes = res;
        this.renderizar();
      });
    });
    this.el.querySelector('[data-accion="toggle-relleno"]')?.addEventListener('click', () => {
      this.capaZonas.alternarRelleno();
      this.renderizar();
    });
    this.el.querySelector('[data-accion="exportar-geojson"]')?.addEventListener('click', () => {
      this.descargarGeoJson();
    });
    this.el.querySelector('[data-accion="guardar-zona"]')?.addEventListener('click', () => {
      if (!this.zonaActiva) return;
      const input = this.el.querySelector<HTMLInputElement>('[data-zona-nombre]');
      this.capaZonas.agregar(
        this.zonaActiva.coords,
        this.zonaActiva.forma,
        input?.value.trim() || undefined,
      );
      this.renderizar();
    });

    for (const btn of this.el.querySelectorAll<HTMLButtonElement>('[data-ir-cand]')) {
      btn.addEventListener('click', () => {
        const r = Number(btn.dataset.irCand);
        if (Number.isInteger(r)) this.alElegirCandidato?.(r);
      });
    }
    for (const btn of this.el.querySelectorAll<HTMLButtonElement>('[data-ir-zona]')) {
      btn.addEventListener('click', () => {
        const id = btn.dataset.irZona;
        if (id) this.capaZonas.volarAZona(id);
      });
    }
    for (const btn of this.el.querySelectorAll<HTMLButtonElement>('[data-del-zona]')) {
      btn.addEventListener('click', () => {
        const id = btn.dataset.delZona;
        if (id) {
          this.capaZonas.eliminar(id);
          this.renderizar();
        }
      });
    }
  }

  private descargarGeoJson(): void {
    const contenido = this.capaZonas.exportarGeoJson();
    const blob = new Blob([contenido], { type: 'application/geo+json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `earth-analogs-zonas-${new Date().toISOString().slice(0, 10)}.geojson`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  private renderizarEstadoOverlay(): string {
    if (!this.overlayRes || this.overlayTipo === 'ninguno') return '';
    const lista = this.overlayRes.unidades?.length
      ? `<ul class="zona-lista">${this.overlayRes.unidades
          .map(
            (u) => `<li class="zona-item">
              <span class="zona-color" style="background:${escaparHtml(u.color)}"></span>
              <span class="zona-nom" title="${escaparHtml(u.litologia)}">${escaparHtml(u.nombre)} · ${escaparHtml(u.edad)}</span>
            </li>`,
          )
          .join('')}</ul>`
      : '';
    return `<p class="zona-nota">${escaparHtml(this.overlayRes.nota)} (${escaparHtml(this.overlayRes.fuente)})</p>${lista}`;
  }
}
