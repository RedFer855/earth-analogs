// Panel de análogos: pestañas Mapa (sitio objetivo, lista y ficha), Buscar (capas a ~50 km) y Chat (asistente).
// La ficha cuenta, con los números publicados, en qué coincide y en qué difiere cada lugar, con la solidez del
// ajuste y su rango, minerales y suelo, entorno cercano y lo que ningún dato captura.
import './analogos.css';
import { svgIconoTipo, etiquetaTipoPunto } from '../capas/pines';
import type { AnalogoTierra, CatalogoAnalogos } from '../datos/analogos';
import type { DatosCapas7 } from '../datos/capas7';
import {
  escaparHtml as esc,
  pareceHielo,
  sitiosPorCuerpo,
  type Celda,
  type EstabilidadJson,
  type Indice,
  type PuntoFeature,
  type ResultadoJson,
  type Sitio,
  type TipoPunto,
} from '../datos/contrato';
import { construirContextoIA, respuestaLocal } from '../datos/iaCliente';
import { indiceCapas7, lectura, mineralesEn, nombreLugar, valoresEn, type Minerales, type ValorCapa } from '../datos/ficha';
import {
  PUNTOS,
  leerVariables,
  solidezDe,
  topMultivariable,
  type Estabilidad,
  type LecturaVariable,
  type Nivel,
  type Solidez,
  type TopItem,
} from '../datos/solidez';

export type Grupo = 'hallado' | 'candidato' | 'nuevo';
export const COLOR_GRUPO: Record<Grupo, string> = { hallado: '#3b82f6', candidato: '#f59e0b', nuevo: '#e879f9' };
const NOMBRE_GRUPO: Record<Grupo, string> = { hallado: 'Documentados', candidato: 'Candidatos', nuevo: 'Recalculados' };
const GRUPO_TXT: Record<Grupo, string> = {
  hallado: 'Análogo documentado',
  candidato: 'Candidato del motor, sin verificar',
  nuevo: 'Recalculado en vivo, sin publicar',
};
export const COLOR_NIVEL: Record<Nivel | 'sin', string> = { alta: '#22c55e', media: '#eab308', baja: '#ef4444', sin: '#64748b' };
const RGB_NIVEL: Record<Nivel, [number, number, number]> = { alta: [34, 197, 94], media: [234, 179, 8], baja: [239, 68, 68] };
const NIVELES: [Nivel | null, string][] = [[null, 'Todas'], ['alta', 'Alta'], ['media', 'Media'], ['baja', 'Baja']];
type Pestana = 'mapa' | 'buscar' | 'chat';
type Seleccion = { tipo: 'candidato'; rango: number } | { tipo: 'analogo'; codigo: string } | { tipo: 'pin'; punto: PuntoFeature } | null;

export interface PanelAnalogosCallbacks {
  alElegirSitio: (s: Sitio) => void;
  alElegirCandidato: (rango: number) => void;
  alElegirAnalogo: (a: AnalogoTierra) => void;
  alIr: (lat: number, lon: number) => void;
  alCerrarFicha: () => void;
  alColorear: (fn: ((c: Celda) => [number, number, number]) | null) => void;
  alVerGrupo: (g: Grupo, visible: boolean) => void;
  alCambiarPines: (visibles: Set<TipoPunto>) => void;
  alPreguntar: (pregunta: string) => void;
}

const num = (x: number | null | undefined, d?: number): string => {
  if (x === null || x === undefined || !Number.isFinite(x)) return '—';
  if (d !== undefined) return x.toFixed(d);
  return Math.abs(x) >= 100 ? x.toFixed(0) : Math.abs(x) >= 1 ? x.toFixed(1) : x.toFixed(2);
};

export class PanelAnalogos {
  private el = document.createElement('aside');
  private scroll = document.createElement('div');
  private divMapa = document.createElement('div');
  private divBuscar = document.createElement('div');
  private divChat = document.createElement('div');
  private pestana: Pestana = 'mapa';
  private cuerpo: 'luna' | 'marte' = 'marte';
  private sitioId: string | null = null;
  private resultado: ResultadoJson | null = null;
  private esNuevo = false;
  private estabilidad: EstabilidadJson | null = null;
  private catalogo: CatalogoAnalogos | null = null;
  private datos7: DatosCapas7 | null = null;
  private base7 = 'datos/capas7/';
  private activos = new Set<Grupo>(['hallado', 'candidato', 'nuevo']);
  private colorModo: 'nota' | 'solidez' = 'nota';
  private nivel: Nivel | null = null;
  private texto = '';
  private seleccion: Seleccion = null;
  private solidez = new Map<number, Solidez>();
  private top: TopItem[] = [];
  private lugar = new Map<string, string | null>();
  private minerales = new Map<string, Minerales | null | 'cargando'>();
  private valores7 = new Map<string, Record<string, number | null> | 'cargando'>();
  private conteoPines: Record<TipoPunto, number> | null = null;
  private pinesVisibles = new Set<TipoPunto>(['tubo_lava', 'crater_impacto', 'playa_salar']);
  private error: string | null = null;
  private plegado = false;

  constructor(
    contenedor: HTMLElement,
    private readonly indice: Indice,
    private readonly cb: PanelAnalogosCallbacks,
  ) {
    this.el.className = 'panel-an';
    this.el.setAttribute('aria-label', 'Análogos de la Tierra');
    contenedor.appendChild(this.el);
    this.scroll.className = 'mp-scroll';
    for (const [d, k] of [[this.divMapa, 'mapa'], [this.divBuscar, 'buscar'], [this.divChat, 'chat']] as const) {
      d.className = 'mp-pestana';
      d.dataset.p = k;
      this.scroll.append(d);
    }
    this.divBuscar.innerHTML = '<p class="mp-nota">Cargando las capas de la Tierra…</p>';
    this.el.addEventListener('click', (e) => this.alClic(e));
    this.el.addEventListener('change', (e) => {
      const t = e.target as HTMLSelectElement;
      if (t.dataset?.a === 'sitio' && t.value) this.elegirSitio(t.value);
    });
    this.el.addEventListener('input', (e) => {
      const t = e.target as HTMLInputElement;
      if (t.id === 'mp-q') {
        this.texto = t.value;
        this.pintarMapa(true);
      }
    });
    this.pintarMarco();
    this.pintarMapa();
  }

  // ---------- entradas desde main ----------
  /** Contenedor donde vive el asistente (pestaña Chat). */
  contenedorChat(): HTMLElement {
    return this.divChat;
  }

  configurarBusqueda(div: HTMLElement): void {
    this.divBuscar.replaceChildren(div);
  }

  configurarAnalogos(c: CatalogoAnalogos | null): void {
    this.catalogo = c;
    this.pintarMapa();
  }

  configurarDatos7(d: DatosCapas7, base: string): void {
    this.datos7 = d;
    this.base7 = base;
    this.pintarMapa();
  }

  configurarPines(conteos: Record<TipoPunto, number>): void {
    this.conteoPines = conteos;
    this.pintarMapa();
  }

  configurarTop(resultados: ResultadoJson[]): void {
    this.top = topMultivariable(resultados, 3);
    this.pintarMapa();
  }

  establecerSitio(sitioId: string): void {
    this.sitioId = sitioId;
    const s = this.indice.sitios_objetivo.find((x) => x.id === sitioId);
    if (s?.cuerpo === 'luna' || s?.cuerpo === 'marte') this.cuerpo = s.cuerpo;
    this.resultado = null;
    this.seleccion = null;
    this.error = null;
    this.pintarMapa();
  }

  establecerResultado(r: ResultadoJson, estabilidad: EstabilidadJson | null, esNuevo = false): void {
    this.resultado = r;
    this.esNuevo = esNuevo;
    this.estabilidad = estabilidad;
    this.solidez.clear();
    const celdasEst = new Map((estabilidad?.objetivos?.[r.sitio]?.celdas ?? []).map((c) => [c.ipix, c]));
    const nEsc = estabilidad?.objetivos?.[r.sitio]?.n_escenarios ?? 0;
    for (const c of r.candidatos) {
      const e = celdasEst.get(c.ipix);
      const est: Estabilidad | null = nEsc > 0 ? { aparece_en: e?.aparece_en ?? 0, n_escenarios: nEsc } : null;
      this.solidez.set(c.rango, solidezDe(leerVariables(r, (id) => c.variables[id]?.valor ?? null), est));
    }
    if (esNuevo) this.activos.add('nuevo');
    const grupoActivo: Grupo = esNuevo ? 'nuevo' : 'candidato';
    this.cb.alVerGrupo(grupoActivo, this.activos.has(grupoActivo));
    this.aplicarColor();
    this.pintarMapa();
  }

  mostrarError(msg: string): void {
    this.error = msg;
    this.pintarMapa();
  }

  seleccionarCandidato(rango: number | null): void {
    this.seleccion = rango === null ? null : { tipo: 'candidato', rango };
    this.pestana = 'mapa';
    this.plegado = false;
    this.pintarMarco();
    this.pintarMapa();
    if (rango !== null) this.cargarExtras();
  }

  seleccionarAnalogo(a: AnalogoTierra): void {
    this.seleccion = { tipo: 'analogo', codigo: a.codigo };
    this.pestana = 'mapa';
    this.plegado = false;
    this.pintarMarco();
    this.pintarMapa();
    this.cargarExtras();
  }

  mostrarPin(p: PuntoFeature): void {
    this.seleccion = { tipo: 'pin', punto: p };
    this.pestana = 'mapa';
    this.plegado = false;
    this.pintarMarco();
    this.pintarMapa();
    this.cargarExtras();
  }

  contextoAnalogo(): { analogo: AnalogoTierra; lecturas: LecturaVariable[] } | null {
    if (this.seleccion?.tipo !== 'analogo') return null;
    const codigo = this.seleccion.codigo;
    const analogo = this.catalogo?.sitios.find((x) => x.codigo === codigo);
    if (!analogo) return null;
    const r = this.resultado;
    const v = r ? this.valores7.get(`${analogo.codigo}|${r.sitio}`) : undefined;
    const lecturas = r && v && v !== 'cargando' ? leerVariables(r, (id) => v[id] ?? null) : [];
    return { analogo, lecturas };
  }

  irAChat(): void {
    this.pestana = 'chat';
    this.pintarMarco();
  }

  // ---------- armazón ----------
  private pintarMarco(): void {
    const tabs = (
      [
        ['mapa', 'Mapa'],
        ['buscar', 'Buscar'],
        ['chat', 'Chat'],
      ] as [Pestana, string][]
    )
      .map(([k, t]) => `<button role="tab" aria-selected="${this.pestana === k}" class="${this.pestana === k ? 'on' : ''}" data-a="tab" data-t="${k}">${t}</button>`)
      .join('');
    if (!this.el.querySelector('.mp-cab')) {
      this.el.innerHTML = `<header class="mp-cab"><div class="mp-tit"><strong>Análogos de la Tierra</strong></div>
        <div class="mp-cab-der"><button class="mp-btn-icono" data-a="plegar" aria-label="Plegar panel">▴</button></div></header>
        <nav class="mp-tabs" role="tablist"></nav>`;
      this.el.append(this.scroll);
    }
    const nav = this.el.querySelector('.mp-tabs');
    if (nav) nav.innerHTML = tabs;
    const pl = this.el.querySelector('[data-a="plegar"]');
    if (pl) pl.textContent = this.plegado ? '▾' : '▴';
    this.el.classList.toggle('plegado', this.plegado);
    for (const d of [this.divMapa, this.divBuscar, this.divChat]) d.hidden = d.dataset.p !== this.pestana;
  }

  private pintarMapa(soloLista = false): void {
    if (soloLista) {
      const wrap = this.divMapa.querySelector('.mp-lista-wrap');
      if (wrap) {
        wrap.outerHTML = this.htmlLista();
        return;
      }
    }
    const scroll = this.scroll.scrollTop;
    const foco = document.activeElement as HTMLInputElement | null;
    const enBusqueda = foco?.id === 'mp-q';
    const pos = enBusqueda ? foco.selectionStart : null;
    this.divMapa.innerHTML = this.seleccion ? this.htmlFicha() : this.htmlInicio();
    this.scroll.scrollTop = this.seleccion ? 0 : scroll;
    if (enBusqueda) {
      const q = this.divMapa.querySelector<HTMLInputElement>('#mp-q');
      q?.focus();
      if (q && pos !== null) q.setSelectionRange(pos, pos);
    }
  }

  // ---------- pestaña Mapa: inicio ----------
  private htmlInicio(): string {
    const grupos = sitiosPorCuerpo(this.indice);
    const sitios = grupos[this.cuerpo]
      .map((s) => `<option value="${esc(s.id)}" ${s.id === this.sitioId ? 'selected' : ''}>${esc(s.id)} · ${esc(s.nombre)}${s.mejor ? ` (${Math.round(s.mejor.nota * 100)} %)` : ''}</option>`)
      .join('');
    const cuerpos = (['luna', 'marte'] as const)
      .map((c) => `<button class="${this.cuerpo === c ? 'on' : ''}" data-a="cuerpo" data-c="${c}">${c === 'luna' ? 'Luna' : 'Marte'} <b>${grupos[c].length}</b></button>`)
      .join('');
    const conteo: Record<Grupo, number> = {
      hallado: this.analogosFiltrados().length,
      candidato: this.esNuevo ? 0 : (this.resultado?.candidatos.length ?? 0),
      nuevo: this.esNuevo ? (this.resultado?.candidatos.length ?? 0) : 0,
    };
    const chips = (Object.keys(NOMBRE_GRUPO) as Grupo[])
      .map((g) => `<button class="mp-chip ${this.activos.has(g) ? 'on' : ''}" data-a="grupo" data-g="${g}" aria-pressed="${this.activos.has(g)}"><i style="background:${COLOR_GRUPO[g]}"></i>${NOMBRE_GRUPO[g]}<b>${conteo[g]}</b></button>`)
      .join('');
    const modo = `<div class="mp-modo" role="group" aria-label="Colorear celdas"><span>Colorear por</span>
      <button class="${this.colorModo === 'nota' ? 'on' : ''}" data-a="modo" data-m="nota">Parecido</button>
      <button class="${this.colorModo === 'solidez' ? 'on' : ''}" data-a="modo" data-m="solidez">Solidez</button></div>
      ${this.colorModo === 'solidez' ? `<div class="mp-leyenda">${(['alta', 'media', 'baja'] as const).map((n) => `<span><i style="background:${COLOR_NIVEL[n]}"></i>${n}</span>`).join('')}</div>` : ''}`;
    const enLista = this.resultado?.candidatos ?? [];
    const nivelChips = NIVELES.map(([k, t]) => {
      const n = k ? enLista.filter((c) => this.solidez.get(c.rango)?.nivel === k).length : enLista.length;
      return `<button class="${this.nivel === k ? 'on' : ''}" data-a="nivel" data-n="${k ?? ''}">${k ? `<i style="background:${COLOR_NIVEL[k]}"></i>` : ''}${t} <b>${n}</b></button>`;
    }).join('');
    const top = this.top.length
      ? `<div class="mp-top"><div class="mp-sec-t">★ Top 3 multivariable</div>${this.top
          .map(
            (t, i) =>
              `<button class="mp-top-fila" data-a="ir-top" data-lat="${t.lat}" data-lon="${t.lon}"><b>${i + 1}</b><span><strong>${num(t.lat, 2)}°, ${num(t.lon, 2)}°</strong><small>Se parece a ${t.objetivos.length} sitios (${t.objetivos.map((o) => esc(o.sitio)).join(', ')}) · nota media ${Math.round(t.nota_media * 100)} %</small></span></button>`,
          )
          .join('')}</div>`
      : '';
    const pines = this.conteoPines
      ? `<details class="mp-sec"><summary class="mp-sec-t">Pines de referencia</summary><div class="mp-chips">${(Object.keys(this.conteoPines) as TipoPunto[])
          .map((t) => `<button class="mp-chip ${this.pinesVisibles.has(t) ? 'on' : ''}" data-a="pin-tipo" data-t="${t}"><span class="mp-ico">${svgIconoTipo(t)}</span>${esc(etiquetaTipoPunto(t))}<b>${this.conteoPines?.[t] ?? 0}</b></button>`)
          .join('')}</div></details>`
      : '';
    return `<div class="mp-modo">${cuerpos}</div>
      <select class="mp-input" data-a="sitio" aria-label="Sitio objetivo"><option value="">Elige un sitio objetivo…</option>${sitios}</select>
      ${this.error ? `<p class="mp-error">${esc(this.error)}</p>` : ''}
      <div class="mp-chips">${chips}</div>${modo}
      <div class="mp-modo mp-niveles" role="group" aria-label="Filtrar por solidez"><span>Solidez</span>${nivelChips}</div>
      ${top}
      <input id="mp-q" class="mp-input" type="search" placeholder="Buscar por nombre, país o rango" value="${esc(this.texto)}" aria-label="Filtrar lista">
      ${this.htmlLista()}
      ${pines}`;
  }

  private analogosFiltrados(): AnalogoTierra[] {
    const lista = this.catalogo?.sitios ?? [];
    return lista.filter((a) => a.cuerpo === 'ambos' || a.cuerpo === this.cuerpo);
  }

  private htmlLista(): string {
    const q = this.texto.trim().toLowerCase();
    const filas: string[] = [];
    if (this.activos.has('hallado') && !this.nivel) {
      for (const a of this.analogosFiltrados()) {
        if (q && !`${a.nombre} ${a.pais} ${a.programa}`.toLowerCase().includes(q)) continue;
        filas.push(`<li><button class="mp-fila" data-a="analogo" data-id="${esc(a.codigo)}"><i style="background:${COLOR_GRUPO.hallado}"></i>
          <span><b>${esc(a.nombre)}</b><small>${esc(a.pais)} · ${esc(a.programa)}</small></span></button></li>`);
      }
    }
    const g: Grupo = this.esNuevo ? 'nuevo' : 'candidato';
    if (this.resultado && this.activos.has(g)) {
      let cands = this.resultado.candidatos.filter((c) => !this.nivel || this.solidez.get(c.rango)?.nivel === this.nivel);
      if (q) cands = cands.filter((c) => `#${c.rango} ${this.nombreAnalogo(c.analogo_conocido)} ${this.lugar.get(this.claveLugar(c.centro.lat, c.centro.lon)) ?? ''}`.toLowerCase().includes(q));
      if (this.nivel) cands = [...cands].sort((a, b) => (this.solidez.get(b.rango)?.puntaje ?? 0) - (this.solidez.get(a.rango)?.puntaje ?? 0));
      for (const c of cands.slice(0, 150)) {
        const s = this.solidez.get(c.rango);
        const color = this.colorModo === 'solidez' && s ? COLOR_NIVEL[s.nivel] : COLOR_GRUPO[g];
        const lugar = this.lugar.get(this.claveLugar(c.centro.lat, c.centro.lon));
        filas.push(`<li><button class="mp-fila" data-a="candidato" data-r="${c.rango}"><i style="background:${color}"></i>
          <span><b>#${c.rango} ${lugar ? esc(lugar) : `${num(c.centro.lat, 2)}°, ${num(c.centro.lon, 2)}°`}</b>
          <small>Se parece a ${esc(this.resultado.sitio)} · <b>${(c.nota * 100).toFixed(1)} %</b>${c.analogo_conocido ? ` · cerca de ${esc(this.nombreAnalogo(c.analogo_conocido))}` : ''}</small></span>
          ${s ? `<em class="mp-nv n-${s.nivel}" title="Solidez ${s.nivel}: ${s.puntaje} % (rango ${s.bajo}–${s.alto})">${s.puntaje}</em>` : ''}</button></li>`);
      }
    }
    const nota = !this.sitioId ? 'Elige un sitio objetivo para ver sus candidatos.' : `${filas.length} lugares. Toca una fila o el globo para ver por qué se parece.`;
    return `<div class="mp-lista-wrap"><ul class="mp-lista">${filas.join('') || '<li class="mp-vacio">Sin lugares con este filtro.</li>'}</ul><p class="mp-nota">${esc(nota)}</p></div>`;
  }

  // ---------- ficha ----------
  private htmlFicha(): string {
    const s = this.seleccion;
    if (!s) return '';
    if (s.tipo === 'pin') return this.htmlFichaPin(s.punto);
    if (s.tipo === 'analogo') {
      const a = this.catalogo?.sitios.find((x) => x.codigo === s.codigo);
      return a ? this.htmlFichaAnalogo(a) : '';
    }
    const c = this.resultado?.candidatos.find((x) => x.rango === s.rango);
    return c && this.resultado ? this.htmlFichaCandidato(c, this.resultado) : '';
  }

  /** Nombre del análogo documentado a partir de su código (metrics.json lo trae en analogos_conocidos). */
  private nombreAnalogo(id: string | null): string {
    if (!id) return '';
    return this.indice.analogos_conocidos.find((a) => a.id === id)?.nombre ?? this.catalogo?.sitios.find((a) => a.codigo === id)?.nombre ?? id;
  }

  private claveLugar(lat: number, lon: number): string {
    return `${lat.toFixed(2)},${lon.toFixed(2)}`;
  }

  private htmlLugar(lat: number, lon: number, extra: string): string {
    const l = this.lugar.get(this.claveLugar(lat, lon));
    const txt = l === undefined ? '<span class="mp-cargando">buscando el lugar…</span>' : l ? esc(l) : 'Lugar sin nombre en OpenStreetMap';
    return `<div class="mp-lugar"><span aria-hidden="true">◎</span><div><strong>${txt}</strong><small>${num(lat, 3)}°, ${num(lon, 3)}° · ${extra}</small></div></div>`;
  }

  private htmlFichaCandidato(c: Celda, r: ResultadoJson): string {
    const g: Grupo = this.esNuevo ? 'nuevo' : 'candidato';
    const sitio = this.indice.sitios_objetivo.find((x) => x.id === r.sitio);
    const cuerpoTxt = sitio?.cuerpo === 'luna' ? 'la Luna' : 'Marte';
    const sol = this.solidez.get(c.rango);
    const estC = this.estabilidad?.objetivos?.[r.sitio]?.celdas.find((x) => x.ipix === c.ipix);
    const nEsc = this.estabilidad?.objetivos?.[r.sitio]?.n_escenarios;
    const lecturas = leerVariables(r, (id) => c.variables[id]?.valor ?? null);
    const lugar = this.lugar.get(this.claveLugar(c.centro.lat, c.centro.lon));
    const titulo = lugar || `Candidato #${c.rango}`;
    const diag = Object.entries(c.diagnostico ?? {});
    const vars = new Map(this.indice.variables.map((v) => [v.id, v]));
    const ctx = construirContextoIA(this.indice, r, c);
    return `<article class="mp-det" style="--c:${COLOR_GRUPO[g]}">
      <button class="mp-volver" data-a="cerrar">← Volver a la lista</button>
      <div class="mp-det-cab"><h3>${esc(titulo)}</h3><span class="mp-id">#${c.rango} · celda ${c.ipix}</span></div>
      <div class="mp-badges"><span class="mp-badge"><i></i>${GRUPO_TXT[g]}</span>${c.analogo_conocido ? `<span class="mp-estado-t">a menos de 50 km de ${esc(this.nombreAnalogo(c.analogo_conocido))}</span>` : ''}</div>
      ${this.htmlLugar(c.centro.lat, c.centro.lon, `HEALPix nivel ${r.healpix.nivel}`)}
      ${pareceHielo(c.centro.lat, c.centro.lon) ? '<div class="mp-aviso">Puede caer sobre hielo o nieve permanente: el filtro de vegetación no distingue el hielo de la roca desnuda.</div>' : ''}
      ${sol ? this.htmlSolidez(sol) : ''}
      <div class="mp-sec"><div class="mp-sec-t">Se parece a</div>
        <div class="mp-objetivo"><strong>${esc(sitio?.nombre ?? r.sitio)}</strong><small>${esc(r.sitio)} · ${cuerpoTxt} · perfil ${esc(r.perfil)}</small></div>
        ${this.medidor('Parecido del motor', c.nota * 100, `${(c.nota * 100).toFixed(1)} %`)}
        ${estC && nEsc ? this.medidor('Salió entre los mejores en', estC.fraccion * 100, `${estC.aparece_en} de ${nEsc} escenarios`) : ''}
        <p class="mp-nota">Cobertura: ${c.cobertura.usadas} de ${c.cobertura.total} variables con dato.</p></div>
      ${this.htmlVariables(lecturas, 'Valores de la celda del candidato. La barra mide cuánto se aleja del objetivo: la marca central es el límite de la tolerancia. «Difiere» no es un error, es un valor fuera de ese margen.')}
      ${diag.length ? `<div class="mp-sec"><div class="mp-sec-t">Temperatura (no puntúa)</div><table class="mp-tabla">${diag
        .map(([id, d]) => `<tr><td>${esc(vars.get(id)?.nombre ?? id)}</td><td>Tierra ${num(d.valor)} · objetivo ${num(d.objetivo)} ${esc(vars.get(id)?.unidad ?? '')}</td></tr>`)
        .join('')}</table><p class="mp-nota">La atmósfera de la Tierra amortigua la temperatura: este rango no se alcanza aquí y por eso no puntúa.</p></div>` : ''}
      ${this.htmlMinerales(c.centro.lat, c.centro.lon)}
      ${c.cerca_de ? this.htmlCerca(c.cerca_de) : ''}
      ${this.htmlCuerpos(sitio?.cuerpo)}
      <details class="mp-sec mp-expl" open><summary><span class="mp-sec-t">En palabras simples</span><small>Resumen con los datos reales del motor</small></summary>
        <p style="white-space:pre-line">${esc(respuestaLocal(ctx))}</p>
        <div class="mp-fila-btn"><button class="mp-btn" data-a="preguntar" data-q="¿Por qué se parece y en qué difiere físicamente?">Preguntar al chat</button></div></details>
      <p class="mp-fuente">Fuentes: ${[...new Set(r.parametros.variables.map((v) => v.origen.fuente ?? '').filter(Boolean))].map((f) => esc(f)).join(' · ')}</p>
    </article>`;
  }

  private htmlFichaAnalogo(a: AnalogoTierra): string {
    const r = this.resultado;
    const v = this.valores7.get(`${a.codigo}|${r?.sitio ?? ''}`);
    let comparacion = '';
    if (!r) comparacion = '<p class="mp-nota">Elige un sitio objetivo para comparar este análogo variable por variable.</p>';
    else if (v === 'cargando' || v === undefined) comparacion = '<p class="mp-cargando">Leyendo las capas de la Tierra…</p>';
    else {
      const sitio = this.indice.sitios_objetivo.find((x) => x.id === r.sitio);
      const lect = leerVariables(r, (id) => v[id] ?? null);
      const sol = solidezDe(lect, null);
      comparacion = `<div class="mp-sec"><div class="mp-sec-t">Comparado con ${esc(sitio?.nombre ?? r.sitio)} (${esc(r.sitio)})</div>
        ${this.medidor('Variables dentro de la tolerancia', (lect.filter((l) => l.coincide).length / Math.max(1, lect.length)) * 100, `${lect.filter((l) => l.coincide).length} de ${lect.length}`)}</div>
        ${this.htmlSolidez(sol, true)}
        ${this.htmlVariables(lect, 'Mediana de la celda de ~50 km (capas7) que contiene el centro del análogo, contra el objetivo y la tolerancia del perfil. Es una escala gruesa: el sitio puntual puede diferir.')}`;
    }
    return `<article class="mp-det" style="--c:${COLOR_GRUPO.hallado}">
      <button class="mp-volver" data-a="cerrar">← Volver a la lista</button>
      <div class="mp-det-cab"><h3>${esc(a.nombre)}</h3><span class="mp-id">${esc(a.codigo)}</span></div>
      <div class="mp-badges"><span class="mp-badge"><i></i>${GRUPO_TXT.hallado}</span><span class="mp-estado-t">${esc(a.programa)}</span></div>
      ${this.htmlLugar(a.lat, a.lon, `radio ${a.radio_km} km <em>(círculo aproximado, coordenadas no verificadas)</em>`)}
      <div class="mp-sec"><div class="mp-sec-t">Por qué es análogo</div><p>${esc(a.uso)}</p>
        <p class="mp-nota">Análogo de ${a.cuerpo === 'ambos' ? 'la Luna y Marte' : a.cuerpo === 'luna' ? 'la Luna' : 'Marte'} según la investigación ${esc(this.catalogo?.fuente.investigacion ?? 'I-03')}.</p></div>
      ${comparacion}
      ${this.htmlMinerales(a.lat, a.lon)}
      ${this.htmlCuerpos(r ? this.indice.sitios_objetivo.find((x) => x.id === r.sitio)?.cuerpo : a.cuerpo === 'luna' ? 'luna' : 'marte')}
      <div class="mp-fila-btn"><button class="mp-btn" data-a="preguntar" data-q="¿Qué hace de ${esc(a.nombre)} un análogo y en qué difiere físicamente?">Preguntar al chat</button></div>
      <p class="mp-fuente">${esc(this.catalogo?.fuente.nota ?? '')}</p>
    </article>`;
  }

  private htmlFichaPin(p: PuntoFeature): string {
    const [lon, lat] = p.geometry.coordinates;
    const pr = p.properties;
    return `<article class="mp-det" style="--c:${COLOR_GRUPO.hallado}">
      <button class="mp-volver" data-a="cerrar">← Volver a la lista</button>
      <div class="mp-det-cab"><h3>${esc(pr.nombre)}</h3><span class="mp-id">${esc(pr.id)}</span></div>
      <div class="mp-badges"><span class="mp-badge"><i></i>${esc(etiquetaTipoPunto(pr.tipo))}</span>${pr.confirmado === false ? '<span class="mp-estado-t">sin confirmar</span>' : ''}</div>
      ${this.htmlLugar(lat, lon, pr.diametro_km ? `diámetro ${num(pr.diametro_km)} km` : 'pin de referencia')}
      ${this.htmlMinerales(lat, lon)}
      <p class="mp-fuente">Fuente: ${esc(pr.fuente)} · ${esc(pr.licencia)} · ${esc(pr.atribucion)}</p>
    </article>`;
  }

  /** Nivel, puntaje y rango: barra de 0 a 100 con zonas, el rango sombreado y la marca del puntaje. */
  private htmlSolidez(c: Solidez, referencia = false): string {
    const nombres: Record<string, string> = {
      ajuste: 'Ajuste con el objetivo',
      discriminacion: 'Variables que discriminan',
      robustez: 'Robustez entre escenarios',
      calidad: 'Calidad del perfil',
      cobertura: 'Cobertura de datos',
    };
    const comp = Object.entries(c.componentes)
      .map(([k, v]) => {
        const max = PUNTOS[k as keyof typeof PUNTOS];
        return `<li><span>${esc(nombres[k] ?? k)}</span><div class="mp-barra"><i style="width:${Math.round((v / max) * 100)}%"></i></div><b>${v.toFixed(0)}/${max}</b></li>`;
      })
      .join('');
    const limitado = c.puntaje_bruto > c.puntaje;
    return `<div class="mp-conf n-${c.nivel}">
      <div class="mp-conf-t"><span class="mp-sec-t">Solidez del ajuste${referencia ? ' (capas a ~50 km)' : ''}</span><b>${c.nivel.toUpperCase()} · ${c.puntaje} % <small>${limitado ? `(sin el tope: ${c.puntaje_bruto} %, rango ${c.bajo}–${c.alto} %)` : `(rango ${c.bajo}–${c.alto} %)`}</small></b></div>
      <div class="mp-regla" role="img" aria-label="Solidez ${c.puntaje} por ciento, rango ${c.bajo} a ${c.alto}">
        <span class="z baja"></span><span class="z media"></span><span class="z alta"></span>
        <i class="rango" style="left:${c.bajo}%;width:${Math.max(1, c.alto - c.bajo)}%"></i>${limitado ? `<i class="marca bruta" style="left:${c.puntaje_bruto}%"></i>` : ''}<i class="marca" style="left:${c.puntaje}%"></i>
      </div>
      <div class="mp-regla-e"><span>0</span><span>40</span><span>65</span><span>100</span></div>
      ${c.limitantes.length ? `<p class="mp-limite">Nivel limitado: ${c.limitantes.map(esc).join('; ')}.</p>` : ''}
      <details><summary>Cómo se calcula</summary><ul class="mp-conf-comp">${comp}</ul>
        <ul class="mp-seg-lista">${c.razones.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
        <p class="mp-nota">Es un índice orientativo (ajuste estadístico, variables que discriminan y estabilidad entre escenarios), no una probabilidad.</p></details>
    </div>`;
  }

  private htmlVariables(lect: LecturaVariable[], nota: string): string {
    const vars = new Map(this.indice.variables.map((v) => [v.id, v]));
    const filas = lect
      .map((v) => {
        const clase = v.coincide === null ? 'sd' : v.coincide ? 'ok' : 'no';
        const tag = v.coincide === null ? 'Sin dato' : v.coincide ? 'Coincide' : `Difiere · ${v.direccion}`;
        const u = vars.get(v.id)?.unidad ? ` ${esc(vars.get(v.id)?.unidad ?? '')}` : '';
        const detalle =
          v.veces_tolerancia === null ? '' : v.coincide ? 'dentro de la tolerancia' : `${v.direccion} que el objetivo (${v.veces_tolerancia}× la tolerancia)`;
        return `<li class="mp-var ${clase}"><div class="mp-var-t"><span>${esc(vars.get(v.id)?.nombre ?? v.id)}</span><em>${tag}</em></div>
          <div class="mp-barra dev" title="La marca central es el límite de la tolerancia"><i style="width:${Math.min(100, (v.veces_tolerancia ?? 0) * 50)}%"></i></div>
          <div class="mp-var-n">aquí <b>${num(v.aqui)}${u}</b> · objetivo <b>${num(v.objetivo)}${u}</b> ± ${num(v.tolerancia)}${u} · ${detalle}</div>
          ${v.objetivo_real !== null ? `<div class="mp-var-aviso">El valor real del objetivo (${num(v.objetivo_real)}${u}) no existe en la Tierra; se buscó el más cercano.</div>` : ''}</li>`;
      })
      .join('');
    return `<div class="mp-sec"><div class="mp-sec-t">Variable por variable</div><ul class="mp-vars">${filas}</ul><p class="mp-nota">${esc(nota)}</p></div>`;
  }

  private htmlMinerales(lat: number, lon: number): string {
    if (!this.datos7) return '';
    const m = this.minerales.get(this.claveLugar(lat, lon));
    if (m === undefined || m === 'cargando') return '<div class="mp-sec"><div class="mp-sec-t">Minerales y roca</div><p class="mp-cargando">Leyendo minerales y suelo…</p></div>';
    if (m === null) return '<div class="mp-sec"><div class="mp-sec-t">Minerales y roca</div><p class="mp-nota">La celda de ~50 km no tiene tierra en la tabla.</p></div>';
    const barra = (x: ValorCapa, extra = '') =>
      x.valor === null
        ? `<li class="mp-min sd"><div class="mp-var-t"><span>${esc(x.nombre)}</span><em>Sin dato</em></div></li>`
        : `<li class="mp-min"><div class="mp-var-t"><span>${esc(x.nombre)}</span>${x.percentil !== null ? `<em class="l-${lectura(x.percentil)}">${lectura(x.percentil)}</em>` : ''}</div>
          <div class="mp-barra"><i style="width:${x.percentil ?? 0}%"></i></div>
          <div class="mp-var-n"><b>${num(x.valor, 3)}</b> ${esc(x.unidad)}${x.percentil !== null ? ` · más alto que el <b>${x.percentil} %</b> de la Tierra` : ''}. ${esc(x.pista ?? '')}${extra}</div></li>`;
    const roca = m.roca.filter((x) => x.valor !== null);
    const emit = m.emit.filter((x) => (x.valor ?? 0) > 0).sort((a, b) => (b.valor ?? 0) - (a.valor ?? 0)).slice(0, 6);
    const suelo = m.suelo.filter((x) => x.valor !== null);
    return `<div class="mp-sec"><div class="mp-sec-t">Minerales y roca</div>
      ${roca.length ? `<div class="mp-datos">${roca.map((x) => `<span class="mp-dato"><small>${esc(x.nombre)}</small><b>${Math.round((x.valor ?? 0) * 100)} %</b></span>`).join('')}</div>` : ''}
      <div class="mp-sub">Índices espectrales (ASTER)</div><ul class="mp-vars">${m.aster.some((x) => x.valor !== null) ? m.aster.map((x) => barra(x)).join('') : '<li class="mp-nota">ASTER no tiene dato en esta celda.</li>'}</ul>
      <div class="mp-sub">Minerales en superficie (EMIT)</div><ul class="mp-vars">${emit.length ? emit.map((x) => barra(x)).join('') : '<li class="mp-nota">EMIT no cubre esta zona o no detecta minerales en ella.</li>'}</ul>
      ${suelo.length ? `<div class="mp-sub">Suelo (SoilGrids)</div><div class="mp-datos">${suelo.map((x) => `<span class="mp-dato"><small>${esc(x.nombre)}</small><b>${num(x.valor)} ${esc(x.unidad)}</b></span>`).join('')}</div>` : ''}
      <p class="mp-nota">Mediana de la celda de ~50 km. Fuentes: ${m.fuentes.map(esc).join('; ')}. Sin verificar en campo.</p></div>`;
  }

  private htmlCerca(cd: NonNullable<Celda['cerca_de']>): string {
    const km = (v: number | null | undefined) => (v === null || v === undefined ? 'sin dato' : `${num(v, 1)} km`);
    return `<div class="mp-sec"><div class="mp-sec-t">Entorno cercano (no puntúa)</div><table class="mp-tabla">
      <tr><td>Tubo de lava más cercano</td><td>${km(cd.tubo_lava_km)}</td></tr>
      <tr><td>Cráter de impacto más cercano</td><td>${km(cd.crater_km)}</td></tr>
      <tr><td>Salar más cercano</td><td>${km(cd.salar_km)}</td></tr></table></div>`;
  }

  private htmlCuerpos(cuerpoId: string | undefined): string {
    const t = this.indice.cuerpos.tierra;
    const o = cuerpoId ? this.indice.cuerpos[cuerpoId] : undefined;
    if (!t || !o) return '';
    const pres = (pa: number) => (pa >= 1000 ? `${num(pa / 1000, 1)} kPa` : pa >= 1 ? `${num(pa, 0)} Pa` : `${pa.toExponential(1)} Pa`);
    return `<div class="mp-sec"><div class="mp-sec-t">Lo que ningún dato captura</div><table class="mp-tabla">
      <tr><td>Gravedad</td><td>${num(t.gravedad_ms2, 2)} vs ${num(o.gravedad_ms2, 2)} m/s²</td></tr>
      <tr><td>Presión</td><td>${pres(t.presion_superficie_pa)} vs ${pres(o.presion_superficie_pa)}</td></tr>
      <tr><td>Atmósfera</td><td>${esc(o.atmosfera)}</td></tr>
      <tr><td>Radiación</td><td>${esc(o.radiacion)}</td></tr></table></div>`;
  }

  private medidor(titulo: string, pct: number, texto: string): string {
    return `<div class="mp-med"><div class="mp-med-t"><span>${esc(titulo)}</span><b>${esc(texto)}</b></div><div class="mp-barra grande"><i style="width:${Math.max(0, Math.min(100, pct))}%"></i></div></div>`;
  }

  // ---------- datos que llegan después ----------
  private puntoSeleccion(): [number, number, string | null] | null {
    const s = this.seleccion;
    if (!s) return null;
    if (s.tipo === 'candidato') {
      const c = this.resultado?.candidatos.find((x) => x.rango === s.rango);
      return c ? [c.centro.lat, c.centro.lon, null] : null;
    }
    if (s.tipo === 'analogo') {
      const a = this.catalogo?.sitios.find((x) => x.codigo === s.codigo);
      return a ? [a.lat, a.lon, a.codigo] : null;
    }
    const [lon, lat] = s.punto.geometry.coordinates;
    return [lat, lon, null];
  }

  private cargarExtras(): void {
    const p = this.puntoSeleccion();
    if (!p) return;
    const [lat, lon, codigo] = p;
    const clave = this.claveLugar(lat, lon);
    if (!this.lugar.has(clave)) {
      void nombreLugar(lat, lon).then((n) => {
        this.lugar.set(clave, n);
        this.pintarMapa();
      });
    }
    const d = this.datos7;
    if (d && !this.minerales.has(clave)) {
      this.minerales.set(clave, 'cargando');
      void mineralesEn(d, lat, lon, this.base7)
        .then((m) => this.minerales.set(clave, m))
        .catch(() => this.minerales.set(clave, null))
        .finally(() => this.pintarMapa());
    }
    if (d && codigo && this.resultado) {
      const k = `${codigo}|${this.resultado.sitio}`;
      if (!this.valores7.has(k)) {
        this.valores7.set(k, 'cargando');
        const cols = this.resultado.parametros.variables.map((v) => v.id);
        void valoresEn(d, indiceCapas7(d, lat, lon), cols, this.base7)
          .then((v) => this.valores7.set(k, v))
          .finally(() => this.pintarMapa());
      }
    }
  }

  private aplicarColor(): void {
    if (this.colorModo === 'nota') {
      this.cb.alColorear(null);
      return;
    }
    const sol = this.solidez;
    this.cb.alColorear((c) => RGB_NIVEL[sol.get(c.rango)?.nivel ?? 'baja']);
  }

  // ---------- eventos ----------
  private alClic(e: Event): void {
    const t = (e.target as HTMLElement).closest<HTMLElement>('[data-a]');
    if (!t || t.tagName === 'SELECT') return;
    const a = t.dataset.a;
    switch (a) {
      case 'tab':
        this.pestana = t.dataset.t as Pestana;
        this.pintarMarco();
        break;
      case 'plegar':
        this.plegado = !this.plegado;
        this.pintarMarco();
        break;
      case 'cuerpo':
        this.cuerpo = t.dataset.c === 'luna' ? 'luna' : 'marte';
        this.pintarMapa();
        break;
      case 'grupo': {
        const g = t.dataset.g as Grupo;
        if (this.activos.has(g)) this.activos.delete(g);
        else this.activos.add(g);
        this.cb.alVerGrupo(g, this.activos.has(g));
        this.pintarMapa();
        break;
      }
      case 'modo':
        this.colorModo = t.dataset.m === 'solidez' ? 'solidez' : 'nota';
        this.aplicarColor();
        this.pintarMapa();
        break;
      case 'nivel':
        this.nivel = (t.dataset.n || null) as Nivel | null;
        this.pintarMapa();
        break;
      case 'candidato':
        this.cb.alElegirCandidato(Number(t.dataset.r));
        break;
      case 'analogo': {
        const an = this.catalogo?.sitios.find((x) => x.codigo === t.dataset.id);
        if (an) this.cb.alElegirAnalogo(an);
        break;
      }
      case 'ir-top':
        this.cb.alIr(Number(t.dataset.lat), Number(t.dataset.lon));
        break;
      case 'pin-tipo': {
        const tp = t.dataset.t as TipoPunto;
        if (this.pinesVisibles.has(tp)) this.pinesVisibles.delete(tp);
        else this.pinesVisibles.add(tp);
        this.cb.alCambiarPines(new Set(this.pinesVisibles));
        this.pintarMapa();
        break;
      }
      case 'cerrar':
        this.seleccion = null;
        this.cb.alCerrarFicha();
        this.pintarMapa();
        break;
      case 'preguntar':
        this.irAChat();
        this.cb.alPreguntar(t.dataset.q ?? '¿Por qué se parece?');
        break;
      default:
        break;
    }
  }

  private elegirSitio(id: string): void {
    const s = sitiosPorCuerpo(this.indice)[this.cuerpo].find((x) => x.id === id);
    if (s) this.cb.alElegirSitio(s);
  }
}
