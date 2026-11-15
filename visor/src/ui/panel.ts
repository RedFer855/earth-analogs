import {
  escaparHtml,
  sitiosPorCuerpo,
  type Celda,
  type CorrelacionJson,
  type Indice,
  type Sitio,
  type TipoPunto,
} from '../datos/contrato';
import { etiquetaTipoPunto, svgIconoTipo } from '../capas/pines';

export type CuerpoTab = 'luna' | 'marte' | 'buscar';

export interface PanelCallbacks {
  alElegirSitio: (sitio: Sitio) => void;
  alElegirCandidato: (rango: number) => void;
  alCambiarPines?: (visibles: Set<TipoPunto>) => void;
}

export class PanelLateral {
  private raiz: HTMLElement;
  private grupos: { luna: Sitio[]; marte: Sitio[] };
  private callbacks: PanelCallbacks;
  private tabActiva: CuerpoTab = 'luna';
  private sitioActivoId: string | null = null;
  private candidatoActivoRango: number | null = null;
  private candidatosActuales: Celda[] = [];
  private mensajeEstado: string | null = null;
  private conteosPines: Record<TipoPunto, number> | null = null;
  private pinesVisibles = new Set<TipoPunto>(['tubo_lava', 'crater_impacto', 'playa_salar']);
  private correlacion: CorrelacionJson | null = null;
  private contenedorBusqueda: HTMLElement | null = null;

  constructor(contenedor: HTMLElement, indice: Indice, callbacks: PanelCallbacks) {
    this.grupos = sitiosPorCuerpo(indice);
    this.callbacks = callbacks;

    this.raiz = document.createElement('aside');
    this.raiz.className = 'panel panel-izq';
    contenedor.appendChild(this.raiz);

    this.raiz.addEventListener('click', (ev) => {
      const target = ev.target as HTMLElement | null;
      if (!target) return;

      const tabBtn = target.closest<HTMLButtonElement>('[data-tab]');
      if (tabBtn) {
        const tab = tabBtn.dataset.tab as CuerpoTab | undefined;
        if (tab === 'luna' || tab === 'marte' || tab === 'buscar') {
          this.tabActiva = tab;
          this.render();
        }
        return;
      }

      const sitioBtn = target.closest<HTMLButtonElement>('[data-sitio]');
      if (sitioBtn) {
        const id = sitioBtn.dataset.sitio;
        if (id) {
          const encontrado =
            this.grupos.luna.find((s) => s.id === id) ??
            this.grupos.marte.find((s) => s.id === id);
          if (encontrado) {
            this.callbacks.alElegirSitio(encontrado);
          }
        }
        return;
      }

      const candBtn = target.closest<HTMLButtonElement>('[data-candidato]');
      if (candBtn) {
        const rango = Number(candBtn.dataset.candidato);
        if (Number.isInteger(rango)) {
          this.callbacks.alElegirCandidato(rango);
        }
        return;
      }

      const pinesAccion = target.closest<HTMLButtonElement>('[data-pines-accion]');
      if (pinesAccion) {
        if (pinesAccion.dataset.pinesAccion === 'todos') {
          this.pinesVisibles = new Set<TipoPunto>(['tubo_lava', 'crater_impacto', 'playa_salar']);
        } else {
          this.pinesVisibles.clear();
        }
        this.callbacks.alCambiarPines?.(new Set(this.pinesVisibles));
        this.render();
      }
    });

    this.raiz.addEventListener('change', (ev) => {
      const input = ev.target as HTMLInputElement | null;
      if (!input || input.dataset.pinTipo === undefined) return;
      const tipo = input.dataset.pinTipo as TipoPunto;
      if (input.checked) {
        this.pinesVisibles.add(tipo);
      } else {
        this.pinesVisibles.delete(tipo);
      }
      this.callbacks.alCambiarPines?.(new Set(this.pinesVisibles));
    });

    this.render();
  }

  configurarPines(conteos: Record<TipoPunto, number>): void {
    this.conteosPines = conteos;
    this.render();
  }

  configurarCorrelacion(correlacion: CorrelacionJson | null): void {
    this.correlacion = correlacion;
    this.render();
  }

  configurarBusqueda(contenedor: HTMLElement): void {
    this.contenedorBusqueda = contenedor;
    this.render();
  }

  activarTab(tab: CuerpoTab): void {
    this.tabActiva = tab;
    this.render();
  }

  establecerSitio(sitioId: string, cuerpo?: string): void {
    this.sitioActivoId = sitioId;
    this.candidatoActivoRango = null;
    this.candidatosActuales = [];
    this.mensajeEstado = 'Cargando candidatos...';
    if (cuerpo === 'luna' || cuerpo === 'marte') {
      this.tabActiva = cuerpo;
    }
    this.render();
  }

  mostrarCandidatos(candidatos: Celda[]): void {
    this.candidatosActuales = candidatos.slice(0, 50);
    this.mensajeEstado = null;
    this.render();
  }

  marcarCandidato(rango: number | null): void {
    this.candidatoActivoRango = rango;
    const botones = this.raiz.querySelectorAll<HTMLButtonElement>('[data-candidato]');
    for (const btn of botones) {
      const activo = Number(btn.dataset.candidato) === rango;
      btn.classList.toggle('activo', activo);
      if (activo) {
        btn.scrollIntoView({ block: 'nearest' });
      }
    }
  }

  mostrarError(mensaje: string): void {
    this.mensajeEstado = mensaje;
    this.render();
  }

  private render(): void {
    const esBuscar = this.tabActiva === 'buscar';
    const sitios =
      this.tabActiva === 'luna'
        ? this.grupos.luna
        : this.tabActiva === 'marte'
          ? this.grupos.marte
          : [];
    const itemsSitios = sitios
      .map((s) => {
        const activo = s.id === this.sitioActivoId ? ' activo' : '';
        const notaTxt =
          s.mejor !== null ? `${(s.mejor.nota * 100).toFixed(1)}%` : '—';
        return `<button type="button" class="item-lista${activo}" data-sitio="${escaparHtml(s.id)}">
          <span class="item-principal">
            <span class="codigo">${escaparHtml(s.id)}</span>
            <span class="nombre">${escaparHtml(s.nombre)}</span>
          </span>
          <span class="nota-pill">${escaparHtml(notaTxt)}</span>
        </button>`;
      })
      .join('');

    let bloqueCandidatos = '';
    if (!esBuscar && this.mensajeEstado) {
      bloqueCandidatos = `<p class="estado-lista">${escaparHtml(this.mensajeEstado)}</p>`;
    } else if (!esBuscar && this.candidatosActuales.length > 0) {
      const itemsCand = this.candidatosActuales
        .map((c) => {
          const activo = c.rango === this.candidatoActivoRango ? ' activo' : '';
          return `<button type="button" class="item-lista${activo}" data-candidato="${c.rango}">
            <span class="item-principal">
              <span class="codigo">#${c.rango}</span>
              <span class="coords">${c.centro.lat.toFixed(3)}, ${c.centro.lon.toFixed(3)}</span>
            </span>
            <span class="nota-pill">${(c.nota * 100).toFixed(1)}%</span>
          </button>`;
        })
        .join('');
      bloqueCandidatos = `<div class="subtitulo">Primeros ${this.candidatosActuales.length} candidatos</div>
        <div class="lista-scroll lista-candidatos">${itemsCand}</div>`;
    } else if (!esBuscar && this.sitioActivoId) {
      bloqueCandidatos = `<p class="estado-lista">Sin candidatos disponibles.</p>`;
    }

    const tabBuscar = this.contenedorBusqueda
      ? `<button type="button" class="tab${esBuscar ? ' activa' : ''}" data-tab="buscar">Buscar</button>`
      : '';

    this.raiz.innerHTML = `
      <header class="panel-cabecera">
        <h1>Análogos terrestres</h1>
        <p class="bajada">Busca en la Tierra lugares parecidos a sitios de la Luna y Marte</p>
      </header>
      <div class="tabs" role="tablist">
        <button type="button" class="tab${this.tabActiva === 'luna' ? ' activa' : ''}" data-tab="luna">
          Luna (${this.grupos.luna.length})
        </button>
        <button type="button" class="tab${this.tabActiva === 'marte' ? ' activa' : ''}" data-tab="marte">
          Marte (${this.grupos.marte.length})
        </button>
        ${tabBuscar}
      </div>
      ${esBuscar ? '<div class="busqueda-slot"></div>' : `<div class="lista-scroll lista-sitios">${itemsSitios}</div>`}
      ${this.renderPines()}
      ${esBuscar ? '' : this.renderCorrelacion()}
      ${bloqueCandidatos}
    `;

    if (esBuscar && this.contenedorBusqueda) {
      const slot = this.raiz.querySelector('.busqueda-slot');
      if (slot) slot.appendChild(this.contenedorBusqueda);
    }
  }

  private renderPines(): string {
    if (!this.conteosPines) return '';
    const tipos: TipoPunto[] = ['tubo_lava', 'crater_impacto', 'playa_salar'];
    const checks = tipos
      .map((t) => {
        const checked = this.pinesVisibles.has(t) ? ' checked' : '';
        return `<label class="pin-check">
          <input type="checkbox" data-pin-tipo="${t}"${checked} />
          <span class="pin-icono">${svgIconoTipo(t)}</span>
          <span>${escaparHtml(etiquetaTipoPunto(t))} (${this.conteosPines?.[t] ?? 0})</span>
        </label>`;
      })
      .join('');
    return `<div class="bloque-pines">
      <div class="pines-cabecera">
        <span class="subtitulo" style="padding:0">Pines de referencia</span>
        <span class="pines-botones">
          <button type="button" class="btn-mini" data-pines-accion="todos">Todos</button>
          <button type="button" class="btn-mini" data-pines-accion="ninguno">Ninguno</button>
        </span>
      </div>
      <div class="pines-checks">${checks}</div>
    </div>`;
  }

  private renderCorrelacion(): string {
    if (!this.correlacion) return '';
    const grupos = Object.entries(this.correlacion.resultados)
      .map(([tipo, g]) => {
        const nombre = etiquetaTipoPunto(tipo as TipoPunto);
        const top = g.filas
          .slice()
          .sort((a, b) => a.p_holm - b.p_holm)
          .slice(0, 4)
          .map(
            (f) => `<tr>
              <td>${escaparHtml(f.etiqueta)}</td>
              <td class="num">${f.mediana_sitio.toFixed(2)} vs ${f.mediana_control.toFixed(2)}</td>
              <td class="num">${f.cliff_delta.toFixed(2)}</td>
            </tr>`,
          )
          .join('');
        return `<div class="corr-grupo">
          <div class="corr-titulo">${escaparHtml(nombre)} (${g.sitios_usados}/${g.sitios}, r=${g.radio_km} km)</div>
          <table class="corr-tabla">
            <thead><tr><th>Variable</th><th class="num">Sitio vs ctrl</th><th class="num">δ</th></tr></thead>
            <tbody>${top}</tbody>
          </table>
        </div>`;
      })
      .join('');
    return `<details class="bloque-correlacion">
      <summary>Correlación de entornos (Cliff δ)</summary>
      <div class="corr-contenido">${grupos}</div>
    </details>`;
  }
}
