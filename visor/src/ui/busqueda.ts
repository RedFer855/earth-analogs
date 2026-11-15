import type {
  ColumnaCapas7,
  CondicionBusqueda,
  DatosCapas7,
  OperadorCondicion,
} from '../datos/capas7';
import { escaparHtml, type ResultadoJson } from '../datos/contrato';

const ETIQUETAS_COL: Record<string, string> = {
  slope_mean_deg: 'Pendiente media (°)',
  slope_std_deg: 'Variación pendiente (°)',
  rug_rms_mean_m: 'Rugosidad RMS (m)',
  relieve_mean_m: 'Relieve local (m)',
  aridez_ai: 'Índice de aridez',
  ndvi_max_clim: 'NDVI máx.',
  rango_diurno_k: 'Rango diurno (K)',
  roca_volcanica_frac: 'Roca volcánica (0-1)',
  roca_evaporita_frac: 'Roca evaporita (0-1)',
  cueva_dist_km: 'Dist. tubo lava (km)',
  dist_crater_km: 'Dist. cráter (km)',
  dist_playa_km: 'Dist. salar (km)',
};

export interface FilaCondicionUi {
  activa: boolean;
  columna: string;
  op: OperadorCondicion;
  umbral: number;
}

export interface BusquedaCallbacks {
  alAplicarBusqueda: (condiciones: CondicionBusqueda[], soloTodas: boolean) => Promise<void>;
  alAplicarCoropletico: (columna: string | null) => Promise<void>;
  alCargarPresetSitio: (sitioId: string) => Promise<ResultadoJson | null>;
  /** Muestra en el mapa los candidatos ya calculados del sitio (lugares distintos, con nota). */
  alElegirSitio?: (sitioId: string) => void;
}

export class PanelBusqueda {
  private contenedor: HTMLElement;
  private datos: DatosCapas7;
  private callbacks: BusquedaCallbacks;
  private filas: FilaCondicionUi[] = [];
  private soloTodas = true;
  private coropleticoCol = '';
  private resumenEstado = '';

  constructor(contenedor: HTMLElement, datos: DatosCapas7, callbacks: BusquedaCallbacks) {
    this.contenedor = contenedor;
    this.datos = datos;
    this.callbacks = callbacks;

    this.filas = (
      [
        { activa: true, columna: 'slope_mean_deg', op: '<=', umbral: 5 },
        { activa: true, columna: 'aridez_ai', op: '<=', umbral: 0.05 },
        { activa: false, columna: 'cueva_dist_km', op: '<=', umbral: 50 },
        { activa: false, columna: 'roca_volcanica_frac', op: '>=', umbral: 0.5 },
      ] as FilaCondicionUi[]
    ).filter((f) => f.columna in datos.meta.columnas);

    this.contenedor.addEventListener('change', (ev) => {
      void this.manejarCambio(ev.target as HTMLElement | null);
    });
    this.contenedor.addEventListener('input', (ev) => {
      const target = ev.target as HTMLInputElement | null;
      if (!target || target.dataset.filaSlider === undefined) return;
      const idx = Number(target.dataset.filaSlider);
      const val = Number(target.value);
      if (Number.isInteger(idx) && this.filas[idx] && Number.isFinite(val)) {
        this.filas[idx].umbral = val;
        const span = this.contenedor.querySelector<HTMLElement>(`[data-fila-val="${idx}"]`);
        if (span) span.textContent = val.toFixed(2);
      }
    });
    this.contenedor.addEventListener('click', (ev) => {
      void this.manejarClic(ev.target as HTMLElement | null);
    });

    this.render();
  }

  establecerEstado(texto: string): void {
    this.resumenEstado = texto;
    const el = this.contenedor.querySelector<HTMLElement>('[data-busqueda-estado]');
    if (el) el.textContent = texto;
  }

  private async manejarCambio(target: HTMLElement | null): Promise<void> {
    if (!target) return;

    if (target instanceof HTMLInputElement && target.dataset.filaActiva !== undefined) {
      const idx = Number(target.dataset.filaActiva);
      if (this.filas[idx]) {
        this.filas[idx].activa = target.checked;
        await this.aplicarBusqueda();
      }
      return;
    }

    if (target instanceof HTMLSelectElement && target.dataset.filaOp !== undefined) {
      const idx = Number(target.dataset.filaOp);
      if (this.filas[idx]) {
        this.filas[idx].op = target.value === '>=' ? '>=' : '<=';
        await this.aplicarBusqueda();
      }
      return;
    }

    if (target instanceof HTMLInputElement && target.dataset.filaSlider !== undefined) {
      await this.aplicarBusqueda();
      return;
    }

    if (target instanceof HTMLInputElement && target.dataset.soloTodas !== undefined) {
      this.soloTodas = target.checked;
      await this.aplicarBusqueda();
      return;
    }

    if (target instanceof HTMLSelectElement && target.dataset.coropletico !== undefined) {
      this.coropleticoCol = target.value;
      this.render();
      await this.callbacks.alAplicarCoropletico(this.coropleticoCol || null);
    }
  }

  private async manejarClic(target: HTMLElement | null): Promise<void> {
    if (!target) return;
    const btnPreset = target.closest<HTMLButtonElement>('[data-preset-sitio]');
    if (btnPreset) {
      const id = btnPreset.dataset.presetSitio;
      if (id) await this.aplicarPreset(id);
      return;
    }

    if (target.closest('[data-accion="buscar-aplicar"]')) {
      await this.aplicarBusqueda();
      return;
    }

    if (target.closest('[data-accion="buscar-limpiar"]')) {
      this.coropleticoCol = '';
      for (const f of this.filas) f.activa = false;
      this.resumenEstado = '';
      this.render();
      await this.callbacks.alAplicarCoropletico(null);
      await this.callbacks.alAplicarBusqueda([], this.soloTodas);
    }
  }

  private async aplicarPreset(sitioId: string): Promise<void> {
    const res = await this.callbacks.alCargarPresetSitio(sitioId);
    if (!res) return;
    const nuevas: FilaCondicionUi[] = [];
    for (const vp of res.parametros.variables) {
      if (!(vp.id in this.datos.meta.columnas)) continue;
      const obj = res.objetivo.variables[vp.id];
      const val = obj?.valor_real ?? obj?.valor;
      if (val === undefined || !Number.isFinite(val)) continue;
      nuevas.push({
        activa: true,
        columna: vp.id,
        op: '<=',
        umbral: Number((val + vp.tolerancia).toFixed(3)),
      });
    }
    if (nuevas.length > 0) {
      this.filas = nuevas;
      this.coropleticoCol = '';
      if (this.callbacks.alElegirSitio) {
        // Los umbrales (valor del objetivo + tolerancia) se cumplen en decenas de miles de celdas: pintarlas todas
        // no responde «dónde se parece». Se muestran los candidatos del motor y los umbrales quedan para afinar.
        await this.callbacks.alAplicarBusqueda([], this.soloTodas);
        this.resumenEstado = `Se muestran los candidatos del motor para ${sitioId}. Ajusta los umbrales y pulsa «Buscar en el globo» para ver dónde se cumplen.`;
        this.render();
        this.callbacks.alElegirSitio(sitioId);
        return;
      }
      this.render();
      await this.aplicarBusqueda();
    }
  }

  private async aplicarBusqueda(): Promise<void> {
    this.coropleticoCol = '';
    const activas: CondicionBusqueda[] = this.filas
      .filter((f) => f.activa)
      .map((f) => ({ columna: f.columna, op: f.op, umbral: f.umbral }));
    await this.callbacks.alAplicarBusqueda(activas, this.soloTodas);
  }

  render(): void {
    const filasHtml = this.filas
      .map((f, idx) => {
        const meta: ColumnaCapas7 | undefined = this.datos.meta.columnas[f.columna];
        const min = meta ? meta.p1 : 0;
        const max = meta ? Math.max(meta.p99, f.umbral) : 100;
        const step = max - min <= 2 ? 0.01 : max - min <= 20 ? 0.1 : 1;
        const nombre = ETIQUETAS_COL[f.columna] ?? f.columna;
        return `<div class="cond-fila">
          <label class="cond-check">
            <input type="checkbox" data-fila-activa="${idx}"${f.activa ? ' checked' : ''} />
            <span>${escaparHtml(nombre)}</span>
          </label>
          <div class="cond-controles">
            <select data-fila-op="${idx}" aria-label="Operador">
              <option value="<="${f.op === '<=' ? ' selected' : ''}>≤</option>
              <option value=">="${f.op === '>=' ? ' selected' : ''}>≥</option>
            </select>
            <input type="range" min="${min}" max="${max}" step="${step}" value="${f.umbral}" data-fila-slider="${idx}" />
            <span class="cond-val" data-fila-val="${idx}">${f.umbral.toFixed(2)}</span>
          </div>
        </div>`;
      })
      .join('');

    const opcionesCoro = Object.entries(this.datos.meta.columnas)
      .map(([id]) => {
        const nombre = ETIQUETAS_COL[id] ?? id;
        return `<option value="${escaparHtml(id)}"${this.coropleticoCol === id ? ' selected' : ''}>${escaparHtml(nombre)}</option>`;
      })
      .join('');

    const colSel = this.coropleticoCol ? this.datos.meta.columnas[this.coropleticoCol] : undefined;
    const leyendaCoro = colSel
      ? `<div class="coro-leyenda">
          <div class="coro-barra"></div>
          <div class="coro-ticks">
            <span>p1: ${colSel.p1.toFixed(2)}</span>
            <span>p50: ${colSel.p50.toFixed(2)}</span>
            <span>p99: ${colSel.p99.toFixed(2)} ${escaparHtml(colSel.unidad)}</span>
          </div>
          <div class="coro-fuente">${escaparHtml(colSel.fuente)} (${escaparHtml(colSel.licencia)})</div>
        </div>`
      : '';

    this.contenedor.innerHTML = `
      <div class="busqueda-bloque">
        <div class="busqueda-presets">
          <button type="button" class="btn-mini" data-preset-sitio="JZ">Como Jezero</button>
          <button type="button" class="btn-mini" data-preset-sitio="SP">Como Shackleton</button>
          <button type="button" class="btn-mini" data-accion="buscar-limpiar">Limpiar</button>
        </div>
        <div class="cond-lista">${filasHtml}</div>
        <label class="cond-check">
          <input type="checkbox" data-solo-todas="1"${this.soloTodas ? ' checked' : ''} />
          <span>Solo celdas que cumplen todas</span>
        </label>
        <div class="busqueda-acciones">
          <button type="button" class="btn-primario" data-accion="buscar-aplicar">Buscar en el globo</button>
        </div>
        <p class="estado-lista" data-busqueda-estado>${escaparHtml(this.resumenEstado)}</p>
      </div>
      <div class="busqueda-bloque">
        <div class="subtitulo">Capa coroplética (nivel 7)</div>
        <select class="select-coro" data-coropletico="1">
          <option value="">Ninguna</option>
          ${opcionesCoro}
        </select>
        ${leyendaCoro}
      </div>
    `;
  }
}
