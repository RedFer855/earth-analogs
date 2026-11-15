import '../panel/catalogo.css';
import { COLOR_PIN, type CapaPinesUsuario } from '../capas/pinesUsuario';
import { PALETA_ZONAS, type CapaZonas } from '../capas/zonas';
import {
  COLORES_POR_CUERPO,
  esCategoriaPin,
  esCuerpoZona,
  exportarCatalogoAGeoJson,
  importarCatalogoGeoJson,
  type CategoriaPin,
} from '../datos/catalogo';
import { obtenerColumnaCapas7, type DatosCapas7 } from '../datos/capas7';
import { escaparHtml, type SitioObjetivoCat } from '../datos/contrato';
import type { Coordenada } from '../datos/coordenadas';
import {
  resumirColumnasEnZona,
  seleccionarCeldasEnZona,
  type ResumenVariableZona,
  type ZonaGuardada,
} from '../datos/cruceZona';
import { descargarTexto, fechaHoy } from '../util/descarga';

/*
 * Panel izquierdo "Catálogo y Misiones": zonas dibujadas y pines guardados, con filtro Marte/Luna,
 * tarjetas con métricas reales del ETL, y exportar/importar GeoJSON. Solo arma HTML; un único
 * listener por tipo de evento atiende los botones. Todo texto de usuario o de archivo pasa por escaparHtml.
 */

type Pestana = 'zonas' | 'pines';
type FiltroCuerpo = 'todas' | 'marte' | 'luna';
type FiltroPin = 'todos' | CategoriaPin;

interface ResumenEtl {
  celdas: number;
  aproximado: boolean;
  filas: ResumenVariableZona[];
}

export interface AccionesCatalogo {
  /** Traza un cuadro o círculo alrededor de la coordenada con los valores de la barra. */
  medirEn: (coord: Coordenada) => void;
  /** Abre el panel de capas temáticas (geología, suelos, radiación, agua, NDVI) para la zona. */
  abrirCapas?: (zona: ZonaGuardada) => void;
  /** Avisa que una zona se borró, para cerrar lo que dependa de ella. */
  alBorrarZona?: (id: string) => void;
}

const COLUMNAS_TARJETA: { columna: string; etiqueta: string }[] = [
  { columna: 'slope_mean_deg', etiqueta: 'Pendiente media' },
  { columna: 'relieve_mean_m', etiqueta: 'Relieve medio' },
  { columna: 'rug_rms_mean_m', etiqueta: 'Rugosidad RMS' },
  { columna: 'aridez_ai', etiqueta: 'Aridez (AI)' },
  { columna: 'rango_diurno_k', etiqueta: 'Rango diurno' },
  { columna: 'ndvi_max_clim', etiqueta: 'NDVI máx.' },
];

const ETIQUETA_CATEGORIA: Record<CategoriaPin, string> = {
  tierra: 'Ref. terrestre',
  marte: 'Análogo Marte',
  luna: 'Análogo Luna',
};

/** Número con cifras útiles y una unidad corta; las unidades largas («adimensional (P/ET0)») se omiten. */
export function valorConUnidad(valor: number, unidad: string): string {
  if (valor !== 0 && Math.abs(valor) < 0.01) return `<0.01${unidad.length > 0 && unidad.length <= 6 ? ` ${unidad}` : ''}`;
  const num = Math.abs(valor) < 10 ? Number(valor.toPrecision(2)).toString() : valor.toFixed(1);
  const u = unidad.toLowerCase().startsWith('grado') ? '°' : unidad.length > 6 ? '' : unidad;
  return u ? `${num} ${u}`.replace(' °', '°') : num;
}

function areaTexto(km2: number): string {
  return km2 >= 1 ? `${km2.toFixed(2)} km² (${(km2 * 100).toFixed(0)} ha)` : `${(km2 * 100).toFixed(1)} ha`;
}

export class PanelCatalogo {
  private readonly el = document.createElement('aside');
  private readonly pildora = document.createElement('button');
  private pestana: Pestana = 'zonas';
  private filtroZona: FiltroCuerpo = 'todas';
  private filtroPin: FiltroPin = 'todos';
  private paletaAbierta: string | null = null;
  private mensaje = '';
  private datos7: DatosCapas7 | null = null;
  private baseDatos = 'datos/';
  private readonly resumenes = new Map<string, ResumenEtl | 'cargando'>();

  constructor(
    contenedor: HTMLElement,
    private readonly zonas: CapaZonas,
    private readonly pines: CapaPinesUsuario,
    private readonly sitios: SitioObjetivoCat[],
    private readonly acciones: AccionesCatalogo,
  ) {
    this.el.className = 'panel-cat';
    this.el.setAttribute('aria-label', 'Catálogo y misiones');
    this.pildora.type = 'button';
    this.pildora.className = 'cat-pildora oculto';
    this.pildora.textContent = 'Catálogo';
    this.pildora.addEventListener('click', () => this.mostrar());
    contenedor.append(this.el, this.pildora);

    this.el.addEventListener('click', (ev) => this.alClic(ev));
    this.el.addEventListener('change', (ev) => this.alCambio(ev));

    zonas.alCambiar(() => this.pintar());
    pines.alCambiar(() => this.pintar());
    this.pintar();
  }

  configurarDatos7(datos7: DatosCapas7, baseDatos: string): void {
    this.datos7 = datos7;
    this.baseDatos = baseDatos;
    this.resumenes.clear();
    this.pintar();
  }

  /** Abre la pestaña de pines y lo deja visible (lo usa "Guardar Pin" de la barra). */
  mostrarPestana(p: Pestana): void {
    this.pestana = p;
    this.mostrar();
    this.pintar();
  }

  mostrar(): void {
    this.el.classList.remove('oculto');
    this.pildora.classList.add('oculto');
  }

  private ocultar(): void {
    this.el.classList.add('oculto');
    this.pildora.classList.remove('oculto');
  }

  // ---------- datos de las tarjetas ----------

  private solicitarResumen(z: ZonaGuardada): void {
    if (!this.datos7 || this.resumenes.has(z.id)) return;
    this.resumenes.set(z.id, 'cargando');
    const datos = this.datos7;
    void (async () => {
      try {
        const sel = seleccionarCeldasEnZona(z.coords, datos.ipix, datos.meta.nside);
        const cols = COLUMNAS_TARJETA.map((c) => c.columna).filter((c) => c in datos.meta.columnas);
        await Promise.all(
          cols.filter((c) => !datos.cacheColumnas.has(c)).map((c) => obtenerColumnaCapas7(datos, c, `${this.baseDatos}capas7/`)),
        );
        const filas = sel.indices.length
          ? resumirColumnasEnZona(
              sel.indices,
              Object.fromEntries(cols.map((c) => [c, datos.meta.columnas[c]])),
              datos.cacheColumnas,
            )
          : [];
        this.resumenes.set(z.id, { celdas: sel.indices.length, aproximado: sel.aproximacionPorCercania, filas });
      } catch {
        this.resumenes.set(z.id, { celdas: 0, aproximado: false, filas: [] });
      }
      this.pintarCuandoLibre();
    })();
  }

  /** No repinta mientras el usuario escribe en un campo del panel: perdería el foco. */
  private pintarCuandoLibre(): void {
    const activo = document.activeElement;
    if (activo instanceof HTMLInputElement && this.el.contains(activo)) {
      window.setTimeout(() => this.pintarCuandoLibre(), 600);
      return;
    }
    this.pintar();
  }

  // ---------- pintado ----------

  private pintar(): void {
    const todasZonas = this.zonas.listar();
    const todosPines = this.pines.listar();
    const cuerpo = this.pestana === 'zonas' ? this.cuerpoZonas(todasZonas) : this.cuerpoPines(todosPines);
    const puedeExportar = todasZonas.length + todosPines.length > 0;

    this.el.innerHTML = `
      <header class="cat-cab">
        <div>
          <strong>Catálogo y Misiones</strong>
          <small>Zonas delimitadas y pines de referencia</small>
        </div>
        <button type="button" class="cat-btn" data-a="ocultar" aria-label="Ocultar catálogo">‹ Ocultar</button>
      </header>
      <nav class="cat-tabs" role="tablist">
        <button type="button" role="tab" class="${this.pestana === 'zonas' ? 'on' : ''}" data-pestana="zonas" aria-selected="${this.pestana === 'zonas'}">Zonas poligonales <b>${todasZonas.length}</b></button>
        <button type="button" role="tab" class="${this.pestana === 'pines' ? 'on' : ''}" data-pestana="pines" aria-selected="${this.pestana === 'pines'}">Puntos y pines <b>${todosPines.length}</b></button>
      </nav>
      ${cuerpo}
      <footer class="cat-pie">
        ${this.mensaje ? `<p class="cat-msg" role="status">${escaparHtml(this.mensaje)}</p>` : ''}
        <div class="cat-pie-btns">
          <button type="button" class="cat-btn" data-a="exportar" ${puedeExportar ? '' : 'disabled'}>Exportar GeoJSON</button>
          <button type="button" class="cat-btn" data-a="importar">Importar</button>
          <input type="file" accept=".geojson,.json,application/geo+json,application/json" data-importar hidden />
        </div>
      </footer>`;
  }

  private cuerpoZonas(todas: ZonaGuardada[]): string {
    const nMarte = todas.filter((z) => z.cuerpo === 'marte').length;
    const nLuna = todas.filter((z) => z.cuerpo === 'luna').length;
    const visibles = this.filtroZona === 'todas' ? todas : todas.filter((z) => z.cuerpo === this.filtroZona);
    const chip = (f: FiltroCuerpo, txt: string, n: number, cls = ''): string =>
      `<button type="button" class="cat-chip ${this.filtroZona === f ? 'on' : ''}" data-filtro="${f}">${cls ? `<i class="${cls}"></i>` : ''}${txt} (${n})</button>`;

    const lista = visibles.length
      ? visibles.map((z) => this.tarjetaZona(z)).join('')
      : `<div class="cat-vacio"><p>No hay zonas en esta categoría.</p>
          <small>Usa «Cuadro», «Círculo» o «Polígono» en la barra de herramientas, guarda la zona y aparecerá aquí.</small></div>`;
    return `<div class="cat-filtros">${chip('todas', 'Todas', todas.length)}${chip('marte', 'Marte', nMarte, 'pt-marte')}${chip('luna', 'Luna', nLuna, 'pt-luna')}</div>
      <div class="cat-lista">${lista}</div>`;
  }

  private tarjetaZona(z: ZonaGuardada): string {
    this.solicitarResumen(z);
    const id = escaparHtml(z.id);
    const cuerpo = z.cuerpo;
    const badge = cuerpo
      ? `<span class="cat-badge ${cuerpo}"><i class="pt-${cuerpo}"></i>Análogo ${cuerpo === 'marte' ? 'Marte' : 'Luna'}</span>`
      : '<span class="cat-badge"><i></i>Sin asignar</span>';
    const forma = z.forma === 'cuadro' ? 'Cuadro' : z.forma === 'circulo' ? 'Círculo' : 'Polígono';
    const opcionesSitio = this.sitios
      .filter((s) => !cuerpo || s.cuerpo === cuerpo)
      .map(
        (s) =>
          `<option value="${escaparHtml(s.id)}"${s.id === z.objetivo ? ' selected' : ''}>${escaparHtml(s.id)} · ${escaparHtml(s.nombre)}</option>`,
      )
      .join('');
    const r = this.resumenes.get(z.id);
    const celda = (etq: string, val: string, extra = ''): string =>
      `<div class="cat-celda ${extra}"><span>${escaparHtml(etq)}</span><strong>${escaparHtml(val)}</strong></div>`;
    let etl = '';
    let nota = '';
    if (!this.datos7) {
      nota = 'Variables del ETL: cargando la malla…';
    } else if (r === undefined || r === 'cargando') {
      nota = 'Calculando variables del ETL…';
    } else if (r.celdas === 0) {
      nota = 'Sin celdas del ETL dentro de esta zona.';
    } else {
      etl = COLUMNAS_TARJETA.map(({ columna, etiqueta }) => {
        const f = r.filas.find((x) => x.columna === columna);
        return f ? celda(etiqueta, valorConUnidad(f.media, f.unidad)) : '';
      }).join('');
      nota = r.aproximado
        ? 'Valor de la celda nivel 7 más cercana (zona pequeña).'
        : `Media de ${r.celdas} celdas nivel 7 (HEALPix). La fuente de cada variable está en el panel de datos.`;
    }

    return `<article class="cat-tarjeta ${cuerpo ?? ''}" data-id="${id}" style="--zc:${escaparHtml(z.color)}">
      <div class="cat-fila-sup">${badge}<span class="cat-forma">${forma}</span></div>
      <input class="cat-titulo" data-campo="nombre" data-id="${id}" value="${escaparHtml(z.nombre)}" maxlength="80" aria-label="Nombre de la zona" />
      <div class="cat-objetivo">
        <label>Cuerpo
          <select data-campo="cuerpo" data-id="${id}" aria-label="Cuerpo objetivo">
            <option value=""${cuerpo ? '' : ' selected'}>Sin asignar</option>
            <option value="marte"${cuerpo === 'marte' ? ' selected' : ''}>Marte</option>
            <option value="luna"${cuerpo === 'luna' ? ' selected' : ''}>Luna</option>
          </select>
        </label>
        <label>Se parece a
          <select data-campo="objetivo" data-id="${id}" aria-label="Sitio objetivo">
            <option value=""${z.objetivo ? '' : ' selected'}>Sin elegir</option>${opcionesSitio}
          </select>
        </label>
      </div>
      <div class="cat-metricas">
        ${celda('Superficie', areaTexto(z.areaKm2))}
        ${celda('Perímetro', `${z.perimetroKm.toFixed(2)} km`)}
        ${etl}
      </div>
      <p class="cat-nota">${escaparHtml(nota)}</p>
      <div class="cat-acciones">
        <button type="button" class="cat-btn" data-a="volar" data-id="${id}">Volar</button>
        <button type="button" class="cat-btn" data-a="capas" data-id="${id}" title="Geología, suelos, radiación, agua y NDVI recortados a esta zona">Capas</button>
        <button type="button" class="cat-btn" data-a="relleno" data-id="${id}" title="Alternar relleno para ver el terreno">${this.zonas.rellenoDeZona(z.id) ? 'Relleno' : 'Contorno'}</button>
        <button type="button" class="cat-btn" data-a="geojson-zona" data-id="${id}">GeoJSON</button>
        <button type="button" class="cat-btn cat-color" data-a="color" data-id="${id}" title="Cambiar color" aria-label="Cambiar color de la zona"><i style="background:${escaparHtml(z.color)}"></i></button>
        <button type="button" class="cat-btn cat-borrar" data-a="borrar-zona" data-id="${id}" title="Eliminar zona" aria-label="Eliminar zona">Borrar</button>
      </div>
      <div class="cat-paleta${this.paletaAbierta === z.id ? '' : ' oculto'}">
        ${PALETA_ZONAS.map(
          (c) =>
            `<button type="button" class="cat-muestra${c.toLowerCase() === z.color.toLowerCase() ? ' on' : ''}" data-a="poner-color" data-id="${id}" data-color="${c}" style="background:${c}" aria-label="Color ${c}"></button>`,
        ).join('')}
        <label class="cat-muestra-libre" title="Color personalizado"><input type="color" data-campo="color" data-id="${id}" value="${escaparHtml(z.color)}" />+</label>
      </div>
    </article>`;
  }

  private cuerpoPines(todos: ReturnType<CapaPinesUsuario['listar']>): string {
    const cuenta = (c: CategoriaPin): number => todos.filter((p) => p.categoria === c).length;
    const visibles = this.filtroPin === 'todos' ? todos : todos.filter((p) => p.categoria === this.filtroPin);
    const chip = (f: FiltroPin, txt: string, n: number, cls = ''): string =>
      `<button type="button" class="cat-chip ${this.filtroPin === f ? 'on' : ''}" data-filtro-pin="${f}">${cls ? `<i class="${cls}"></i>` : ''}${txt} (${n})</button>`;
    const lista = visibles.length
      ? visibles
          .map((p) => {
            const id = escaparHtml(p.id);
            return `<article class="cat-tarjeta pin ${p.categoria}" data-id="${id}" style="--zc:${COLOR_PIN[p.categoria]}">
          <div class="cat-fila-sup"><span class="cat-badge ${p.categoria}"><i class="pt-${p.categoria}"></i>${ETIQUETA_CATEGORIA[p.categoria]}</span><span class="cat-forma">Pin</span></div>
          <input class="cat-titulo" data-campo="pin-nombre" data-id="${id}" value="${escaparHtml(p.nombre)}" maxlength="80" aria-label="Nombre del pin" />
          <div class="cat-objetivo">
            <label>Categoría
              <select data-campo="pin-categoria" data-id="${id}" aria-label="Categoría del pin">
                <option value="tierra"${p.categoria === 'tierra' ? ' selected' : ''}>Tierra</option>
                <option value="marte"${p.categoria === 'marte' ? ' selected' : ''}>Marte</option>
                <option value="luna"${p.categoria === 'luna' ? ' selected' : ''}>Luna</option>
              </select>
            </label>
          </div>
          <div class="cat-metricas">
            <div class="cat-celda"><span>Latitud</span><strong>${p.lat.toFixed(5)}°</strong></div>
            <div class="cat-celda"><span>Longitud</span><strong>${p.lon.toFixed(5)}°</strong></div>
          </div>
          <input class="cat-notas" data-campo="pin-notas" data-id="${id}" value="${escaparHtml(p.notas)}" maxlength="400" placeholder="Notas (opcional)" aria-label="Notas del pin" />
          <div class="cat-acciones">
            <button type="button" class="cat-btn" data-a="volar-pin" data-id="${id}">Volar</button>
            <button type="button" class="cat-btn" data-a="medir-pin" data-id="${id}" title="Mide un cuadro o círculo alrededor del pin con los valores de la barra">Medir</button>
            <button type="button" class="cat-btn" data-a="geojson-pin" data-id="${id}">GeoJSON</button>
            <button type="button" class="cat-btn cat-borrar" data-a="borrar-pin" data-id="${id}" aria-label="Eliminar pin">Borrar</button>
          </div>
        </article>`;
          })
          .join('')
      : `<div class="cat-vacio"><p>No hay pines en esta categoría.</p>
          <small>Escribe coordenadas en la barra (o usa «Marcar Pin» y haz clic en el globo) y pulsa «Guardar Pin».</small></div>`;
    return `<div class="cat-filtros">${chip('todos', 'Todos', todos.length)}${chip('tierra', 'Tierra', cuenta('tierra'), 'pt-tierra')}${chip('marte', 'Marte', cuenta('marte'), 'pt-marte')}${chip('luna', 'Luna', cuenta('luna'), 'pt-luna')}</div>
      <div class="cat-lista">${lista}</div>`;
  }

  // ---------- eventos ----------

  private alClic(ev: MouseEvent): void {
    const t = ev.target as HTMLElement;
    const pest = t.closest<HTMLElement>('[data-pestana]');
    if (pest) {
      this.pestana = pest.dataset.pestana === 'pines' ? 'pines' : 'zonas';
      this.pintar();
      return;
    }
    const fz = t.closest<HTMLElement>('[data-filtro]');
    if (fz) {
      const v = fz.dataset.filtro;
      this.filtroZona = v === 'marte' || v === 'luna' ? v : 'todas';
      this.pintar();
      return;
    }
    const fp = t.closest<HTMLElement>('[data-filtro-pin]');
    if (fp) {
      const v = fp.dataset.filtroPin;
      this.filtroPin = esCategoriaPin(v) ? v : 'todos';
      this.pintar();
      return;
    }
    const btn = t.closest<HTMLElement>('[data-a]');
    if (!btn || (btn as HTMLButtonElement).disabled) return;
    const id = btn.dataset.id ?? '';
    switch (btn.dataset.a) {
      case 'ocultar':
        this.ocultar();
        break;
      case 'volar':
        this.zonas.volarAZona(id);
        break;
      case 'capas': {
        const z = this.zonas.obtener(id);
        if (z) this.acciones.abrirCapas?.(z);
        break;
      }
      case 'relleno':
        this.zonas.alternarRellenoZona(id);
        break;
      case 'geojson-zona': {
        const txt = this.zonas.exportarUna(id);
        if (txt) descargarTexto(`zona-${fechaHoy()}.geojson`, txt);
        break;
      }
      case 'color':
        this.paletaAbierta = this.paletaAbierta === id ? null : id;
        this.pintar();
        break;
      case 'poner-color':
        if (btn.dataset.color) this.zonas.actualizar(id, { color: btn.dataset.color });
        break;
      case 'borrar-zona':
        this.resumenes.delete(id);
        this.acciones.alBorrarZona?.(id);
        this.zonas.eliminar(id);
        break;
      case 'volar-pin':
        this.pines.volarA(id);
        break;
      case 'medir-pin': {
        const p = this.pines.obtener(id);
        if (p) this.acciones.medirEn({ lat: p.lat, lon: p.lon });
        break;
      }
      case 'geojson-pin': {
        const txt = this.pines.exportarUno(id);
        if (txt) descargarTexto(`pin-${fechaHoy()}.geojson`, txt);
        break;
      }
      case 'borrar-pin':
        this.pines.eliminar(id);
        break;
      case 'exportar':
        descargarTexto(
          `earth-analogs-catalogo-${fechaHoy()}.geojson`,
          exportarCatalogoAGeoJson(this.zonas.listar(), this.pines.listar()),
        );
        this.mensaje = 'Catálogo exportado.';
        this.pintar();
        break;
      case 'importar':
        this.el.querySelector<HTMLInputElement>('[data-importar]')?.click();
        break;
    }
  }

  private alCambio(ev: Event): void {
    const t = ev.target as HTMLInputElement | HTMLSelectElement;
    if (t.matches('[data-importar]')) {
      const f = (t as HTMLInputElement).files?.[0];
      if (f) void this.importar(f);
      return;
    }
    const campo = t.dataset.campo;
    const id = t.dataset.id;
    if (!campo || !id) return;
    switch (campo) {
      case 'nombre':
        this.zonas.actualizar(id, { nombre: t.value.trim() || 'Zona' });
        break;
      case 'cuerpo': {
        const cuerpo = esCuerpoZona(t.value) ? t.value : undefined;
        const zona = this.zonas.obtener(id);
        // Si el objetivo elegido no es del cuerpo nuevo, se quita.
        const sigue = zona?.objetivo && this.sitios.find((s) => s.id === zona.objetivo)?.cuerpo === cuerpo;
        this.zonas.actualizar(id, {
          cuerpo,
          ...(sigue ? {} : { objetivo: undefined, objetivoNombre: undefined }),
          ...(cuerpo && zona && PALETA_ZONAS.includes(zona.color) ? { color: COLORES_POR_CUERPO[cuerpo] } : {}),
        });
        break;
      }
      case 'objetivo': {
        const sitio = this.sitios.find((s) => s.id === t.value);
        this.zonas.actualizar(
          id,
          sitio
            ? {
                objetivo: sitio.id,
                objetivoNombre: sitio.nombre,
                cuerpo: esCuerpoZona(sitio.cuerpo) ? sitio.cuerpo : undefined,
              }
            : { objetivo: undefined, objetivoNombre: undefined },
        );
        break;
      }
      case 'color':
        if (/^#[0-9a-fA-F]{6}$/.test(t.value)) this.zonas.actualizar(id, { color: t.value });
        break;
      case 'pin-nombre':
        this.pines.actualizar(id, { nombre: t.value });
        break;
      case 'pin-categoria':
        if (esCategoriaPin(t.value)) this.pines.actualizar(id, { categoria: t.value });
        break;
      case 'pin-notas':
        this.pines.actualizar(id, { notas: t.value });
        break;
    }
  }

  private async importar(archivo: File): Promise<void> {
    try {
      const res = importarCatalogoGeoJson(await archivo.text());
      this.zonas.agregarVarias(res.zonas);
      this.pines.agregarVarios(res.pines);
      this.pestana = res.zonas.length >= res.pines.length ? 'zonas' : 'pines';
      this.mensaje =
        `Importado: ${res.zonas.length} zona(s) y ${res.pines.length} pin(es)` +
        (res.omitidos ? `; ${res.omitidos} omitido(s) por no ser válidos.` : '.');
    } catch (e) {
      this.mensaje = e instanceof Error ? e.message : 'No se pudo importar el archivo.';
    }
    this.pintar();
  }
}
