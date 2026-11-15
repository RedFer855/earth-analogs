// Panel "Asistente IA" con dos modos:
// - Fácil: preguntas en lenguaje simple y una búsqueda guiada (qué importa más, dónde, cuántos).
// - Científico: todas las piezas del motor (peso y tolerancia por variable, área, separación, exclusión, k, piso).
// Pestañas: Chat (el agente explica y puede controlar el motor), Motor (los controles) y Clave API (BYOK).
// La clave vive solo en memoria (ver iaCliente.ts). Todo texto del modelo o de un error va por textContent.

import type { AnalogoTierra } from '../datos/analogos';
import { cargarResultado, type Celda, type Indice, type ResultadoJson } from '../datos/contrato';
import type { LecturaVariable } from '../datos/solidez';
import {
  PREAJUSTES,
  LIMITES,
  ajustesIniciales,
  aplicarCambios,
  cuerpoPuente,
  extraerAcciones,
  filtrarResultado,
  interpretarPeticion,
  resumenResultado,
  sistemaAgente,
  sistemaSinSitio,
  validarAccion,
  validarSitio,
  type Accion,
  type AjustesMotor,
  type ModoAsistente,
} from '../datos/agenteMotor';
import {
  PROVEEDORES,
  URL_PUENTE,
  borrarClaveIA,
  construirContextoAnalogo,
  construirContextoIA,
  detectarPuente,
  guardarClaveIA,
  hayClaveIA,
  preguntarIA,
  proveedorConClave,
  redactarSecretos,
  respuestaLocal,
  restaurarClaveIA,
  type EstadoPuente,
  type MensajeIA,
  type ProveedorIA,
} from '../datos/iaCliente';

export interface AsistenteCallbacks {
  /** Caja [lat1, lon1, lat2, lon2] de la vista actual, o null si se ve casi todo el globo. */
  bboxVista: () => [number, number, number, number] | null;
  /** Muestra en el globo un resultado recalculado o filtrado (no se publica). */
  alRecalcular: (resultado: ResultadoJson) => void;
  /** Enfoca un candidato por su rango. */
  alSeleccionar: (rango: number) => void;
  /** Carga un sitio objetivo (por su id) y resuelve cuando el visor ya le pasó su resultado al asistente. */
  alElegirSitio: (sitioId: string) => Promise<void>;
}

type Pestana = 'chat' | 'motor' | 'clave';

const SUGERENCIAS: Record<ModoAsistente, string[]> = {
  facil: [
    '¿Por qué este lugar se parece al objetivo?',
    '¿En qué es distinto de verdad?',
    'Busca lugares menos inclinados',
    'Muéstrame solo los muy parecidos',
  ],
  cientifico: [
    '¿Qué variables limitan la nota del mejor candidato?',
    'Sube el peso de la rugosidad a 3 y recalcula en la vista actual',
    'Relaja la tolerancia del relieve al doble y compara',
    '¿Qué procesos físicos no captura esta analogía?',
  ],
};

type Hijo = Node | string | null | undefined | false;

function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<Record<string, string | boolean | number>> = {},
  ...hijos: Hijo[]
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === false) continue;
    if (k === 'class') e.className = String(v);
    else if (k === 'text') e.textContent = String(v);
    else e.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of hijos) if (c !== null && c !== undefined && c !== false) e.append(c);
  return e;
}

function boton(texto: string, clase: string, alClic: () => void, extra: Record<string, string> = {}): HTMLButtonElement {
  const b = h('button', { type: 'button', class: clase, text: texto, ...extra });
  b.addEventListener('click', alClic);
  return b;
}

interface Mensaje extends MensajeIA {
  /** Mensajes del visor (avisos, acciones, respuestas locales): se muestran pero no van al modelo. */
  nota?: string;
}

export class Asistente {
  private readonly raiz: HTMLElement;
  private readonly abrir: HTMLButtonElement;
  private readonly cuerpo: HTMLElement;
  private readonly estadoEl: HTMLElement;
  private readonly cabCtx: HTMLElement;
  private readonly tabs = new Map<Pestana, HTMLButtonElement>();
  private readonly modos = new Map<ModoAsistente, HTMLButtonElement>();
  private pestana: Pestana = 'chat';
  private modo: ModoAsistente = 'facil';
  private indice: Indice | null = null;
  private base: ResultadoJson | null = null;
  private mostrado: ResultadoJson | null = null;
  private candidato: Celda | null = null;
  private analogo: AnalogoTierra | null = null;
  private lecturasAnalogo: LecturaVariable[] = [];
  private cambioPorAgente = false;
  private ajustes: AjustesMotor | null = null;
  private preajuste = 'equilibrado';
  private mensajes: Mensaje[] = [];
  private borrador = '';
  private puente: EstadoPuente = { activo: false, motor: false };
  private proveedor: ProveedorIA | 'local' = 'local';
  private modelo = '';
  private viaPuente = false;
  private recordar = false;
  private ocupado = false;
  private ultimoInforme: string | null = null;

  constructor(
    contenedor: HTMLElement,
    private readonly cb: AsistenteCallbacks,
    /** `embebido`: vive dentro de otro panel (pestaña Chat), sin botón flotante ni cabecera propia. */
    private readonly embebido = false,
  ) {
    this.abrir = boton('Asistente IA · motor', 'btn-primario asistente-abrir', () => void this.alternar(true));
    if (!embebido) contenedor.append(this.abrir);

    this.cabCtx = h('p', { class: 'asistente-contexto' });
    const tabs = h('div', { class: 'asistente-tabs', role: 'tablist' });
    for (const [k, t] of [['chat', 'Chat'], ['motor', 'Motor'], ['clave', 'Clave API']] as [Pestana, string][]) {
      const b = boton(t, 'asistente-tab', () => this.irA(k), { role: 'tab' });
      this.tabs.set(k, b);
      tabs.append(b);
    }
    const modos = h('div', { class: 'asistente-modos', role: 'radiogroup', 'aria-label': 'Modo' });
    for (const [k, t] of [['facil', 'Fácil'], ['cientifico', 'Científico']] as [ModoAsistente, string][]) {
      const b = boton(t, 'asistente-modo', () => {
        this.modo = k;
        this.pintar();
      }, { role: 'radio' });
      this.modos.set(k, b);
      modos.append(b);
    }
    this.cuerpo = h('div', { class: 'asistente-cuerpo' });
    this.estadoEl = h('p', { class: 'asistente-estado', 'aria-live': 'polite' });
    this.raiz = h(
      'section',
      { class: embebido ? 'asistente asistente-embebido' : 'panel asistente oculto', 'aria-label': 'Asistente IA' },
      embebido
        ? h('div', { class: 'asistente-cab asistente-cab-emb' }, modos)
        : h('header', { class: 'asistente-cab' }, h('h2', { text: 'Asistente IA' }), modos, boton('×', 'btn-cerrar', () => void this.alternar(false), { title: 'Cerrar' })),
      this.cabCtx,
      tabs,
      this.cuerpo,
      this.estadoEl,
    );
    contenedor.append(this.raiz);

    const restaurado = restaurarClaveIA();
    if (restaurado) {
      this.proveedor = restaurado;
      this.recordar = true;
    }
    this.modelo = PROVEEDORES.find((p) => p.id === this.proveedor)?.modeloPorOmision ?? '';
    this.pintar();
    if (embebido) void this.sondearPuente();
  }

  private async sondearPuente(): Promise<void> {
    this.puente = await detectarPuente();
    if (!this.puente.activo) this.viaPuente = false;
    this.pintar();
  }

  /** Lo llama el visor al cargar un sitio o elegir un candidato. */
  establecerContexto(indice: Indice, resultado: ResultadoJson | null, candidato: Celda | null): void {
    this.indice = indice;
    if (resultado && resultado !== this.mostrado) {
      // resultado nuevo publicado: se reinician base y ajustes; la conversación solo si cambia el sitio
      const otroSitio = !this.base || this.base.sitio !== resultado.sitio || this.base.perfil !== resultado.perfil;
      this.base = resultado;
      this.mostrado = resultado;
      this.ajustes = ajustesIniciales(resultado);
      this.preajuste = 'equilibrado';
      this.ultimoInforme = null;
      if (otroSitio && !this.cambioPorAgente) this.mensajes = [];
    }
    if (!resultado) {
      this.base = null;
      this.mostrado = null;
      this.ajustes = null;
    }
    this.candidato = candidato;
    this.analogo = null;
    this.lecturasAnalogo = [];
    this.pintar();
  }

  /** El usuario eligió un análogo documentado de la Tierra: el chat habla de él, sin tocar el motor. */
  establecerAnalogo(indice: Indice, resultado: ResultadoJson | null, analogo: AnalogoTierra, lecturas: LecturaVariable[] = []): void {
    const cambia = this.analogo?.codigo !== analogo.codigo;
    this.indice = indice;
    this.candidato = null;
    this.analogo = analogo;
    this.lecturasAnalogo = lecturas;
    if (resultado && resultado !== this.mostrado) {
      this.base = resultado;
      this.mostrado = resultado;
      this.ajustes = ajustesIniciales(resultado);
    }
    if (cambia) this.mensajes = [];
    this.pintar();
  }

  private async alternar(abrir: boolean): Promise<void> {
    this.raiz.classList.toggle('oculto', !abrir);
    this.abrir.classList.toggle('oculto', abrir);
    if (abrir) {
      // la sonda al puente solo corre cuando el usuario abre el panel
      this.puente = await detectarPuente();
      if (!this.puente.activo) this.viaPuente = false;
      this.pintar();
    }
  }

  private irA(p: Pestana): void {
    this.pestana = p;
    this.pintar();
  }

  private estado(t: string): void {
    this.estadoEl.textContent = t;
  }

  private motorDisponible(): boolean {
    return this.puente.activo && this.puente.motor;
  }

  private conClave(): boolean {
    return this.proveedor !== 'local' && hayClaveIA() && proveedorConClave() === this.proveedor;
  }

  // --- Pintado --------------------------------------------------------------------------------------------------

  private pintar(): void {
    for (const [k, b] of this.tabs) {
      b.classList.toggle('activa', k === this.pestana);
      b.setAttribute('aria-selected', String(k === this.pestana));
    }
    for (const [k, b] of this.modos) {
      b.classList.toggle('activa', k === this.modo);
      b.setAttribute('aria-checked', String(k === this.modo));
    }
    const tabClave = this.tabs.get('clave');
    if (tabClave) tabClave.textContent = this.conClave() ? 'Clave API ✓' : 'Clave API';
    const r = this.mostrado;
    this.cabCtx.textContent = r
      ? `${r.sitio} · ${r.candidatos.length} candidatos${r !== this.base ? ' (ajustado, no publicado)' : ''}` +
        (this.candidato ? ` · seleccionado #${this.candidato.rango}` : '')
      : 'Sin sitio elegido: pídeme uno («busca zonas como Jezero») o elígelo en la pestaña Mapa.';
    if (this.analogo) this.cabCtx.textContent = `Análogo ${this.analogo.nombre} (${this.analogo.codigo}) · ${this.analogo.lat.toFixed(3)}, ${this.analogo.lon.toFixed(3)}`;
    const contenido = this.pestana === 'chat' ? this.vistaChat() : this.pestana === 'motor' ? this.vistaMotor() : this.vistaClave();
    this.cuerpo.replaceChildren(contenido);
    if (this.pestana === 'chat') {
      const lista = this.cuerpo.querySelector('.asistente-chat');
      if (lista) lista.scrollTop = lista.scrollHeight;
    }
  }

  private vistaChat(): HTMLElement {
    const aviso = this.conClave()
      ? h('p', {
          class: 'asistente-nota',
          text: `Responde ${PROVEEDORES.find((p) => p.id === this.proveedor)?.nombre} con los números del motor${this.motorDisponible() ? ' y puede ajustar y correr el motor' : ''}.`,
        })
      : h(
          'div',
          { class: 'asistente-aviso-caja' },
          h('span', { text: 'Sin clave: respuestas automáticas con los datos del motor. ' }),
          boton('Poner mi clave API', 'btn-link', () => this.irA('clave')),
        );
    const lista = h('div', { class: 'asistente-chat', 'aria-live': 'polite' });
    if (this.mensajes.length === 0) {
      lista.append(
        h('div', {
          class: 'asistente-msg asistente',
          text:
            this.modo === 'facil'
              ? 'Hola. Te explico por qué un lugar de la Tierra se parece a uno de la Luna o Marte, y en qué no. También puedo cambiar la búsqueda por ti.'
              : 'Modo científico: pregunta por variables, tolerancias, cobertura o método, o pídeme ajustar pesos, tolerancias y área del motor.',
        }),
      );
    }
    for (const m of this.mensajes) {
      lista.append(h('div', { class: `asistente-msg ${m.rol}${m.nota ? ` ${m.nota}` : ''}`, text: m.texto }));
    }
    if (this.ocupado) lista.append(h('div', { class: 'asistente-msg asistente', text: 'Pensando…' }));
    const sugs = h('div', { class: 'asistente-rapidas' });
    for (const s of SUGERENCIAS[this.modo]) sugs.append(boton(s, 'btn-mini', () => void this.preguntar(s)));
    const area = h('textarea', { rows: 2, placeholder: 'Escribe tu pregunta (Enter envía)', maxlength: 600, 'aria-label': 'Pregunta' });
    area.value = this.borrador;
    area.disabled = this.ocupado;
    area.addEventListener('input', () => (this.borrador = area.value));
    area.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (area.value.trim()) void this.preguntar(area.value.trim());
      }
    });
    const enviar = boton('Enviar', 'btn-primario', () => {
      if (area.value.trim()) void this.preguntar(area.value.trim());
    });
    enviar.disabled = this.ocupado;
    return h(
      'div',
      { class: 'asistente-vista' },
      aviso,
      lista,
      sugs,
      h('div', { class: 'asistente-form' }, area, enviar),
      this.mensajes.length
        ? boton('Borrar conversación', 'btn-link', () => {
            this.mensajes = [];
            this.pintar();
          })
        : null,
    );
  }

  private vistaClave(): HTMLElement {
    const sel = h('select', { 'aria-label': 'Proveedor' });
    sel.append(new Option('Sin clave · respuestas automáticas', 'local'));
    for (const p of PROVEEDORES) sel.append(new Option(p.nombre + (p.soloPuente ? ' (por el puente)' : ''), p.id));
    sel.value = this.proveedor;
    sel.addEventListener('change', () => {
      this.proveedor = sel.value as ProveedorIA | 'local';
      const info = PROVEEDORES.find((p) => p.id === this.proveedor);
      this.modelo = info?.modeloPorOmision ?? '';
      if (info?.soloPuente) this.viaPuente = this.puente.activo;
      this.pintar();
    });
    const conClave = this.conClave();
    const tarjeta = h(
      'div',
      { class: 'asistente-tarjeta' },
      h(
        'div',
        { class: 'asistente-tarjeta-t' },
        h('span', { text: 'Proveedor de IA' }),
        h('span', { class: `pildora${conClave ? ' ok' : ''}`, text: conClave ? 'clave en memoria' : 'sin clave' }),
      ),
      sel,
    );
    if (this.proveedor !== 'local') {
      const info = PROVEEDORES.find((p) => p.id === this.proveedor);
      const modelo = h('input', { type: 'text', autocomplete: 'off', spellcheck: 'false', 'aria-label': 'Modelo' });
      modelo.value = this.modelo;
      modelo.addEventListener('input', () => (this.modelo = modelo.value.trim()));
      const clave = h('input', {
        type: 'password',
        autocomplete: 'new-password',
        spellcheck: 'false',
        autocapitalize: 'off',
        'data-lpignore': 'true',
        placeholder: conClave ? 'Cargada (pega otra para reemplazarla)' : 'Pega aquí tu clave API',
        'aria-label': 'Clave API',
      });
      const recordar = h('input', { type: 'checkbox' });
      recordar.checked = this.recordar;
      recordar.addEventListener('change', () => (this.recordar = recordar.checked));
      const puente = h('input', { type: 'checkbox' });
      puente.checked = this.viaPuente;
      puente.disabled = !this.puente.activo;
      puente.addEventListener('change', () => (this.viaPuente = puente.checked));
      const usar = (): void => {
        try {
          guardarClaveIA(this.proveedor as ProveedorIA, clave.value, this.recordar);
          clave.value = '';
          this.estado('Clave cargada solo en la memoria de esta página. Ya puedes usar el Chat.');
          this.pintar();
        } catch (e) {
          this.estado(redactarSecretos(e instanceof Error ? e.message : e));
        }
      };
      clave.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') usar();
      });
      tarjeta.append(
        h('label', { class: 'asistente-campo' }, h('span', { text: 'Clave API' }), clave),
        h('label', { class: 'asistente-campo' }, h('span', { text: 'Modelo' }), modelo),
        h('label', { class: 'asistente-chk' }, recordar, h('span', { text: 'Recordar solo en esta pestaña (se borra al cerrarla)' })),
        h('label', { class: 'asistente-chk' }, puente, h('span', { text: `Enviar por el puente local${this.puente.activo ? '' : ' (no está activo)'}` })),
        h(
          'div',
          { class: 'asistente-acciones' },
          boton('Usar clave', 'btn-primario', usar),
          boton('Borrar clave', 'btn-mini', () => {
            borrarClaveIA();
            this.recordar = false;
            this.estado('Clave borrada de la memoria y de la pestaña.');
            this.pintar();
          }),
        ),
        info?.soloPuente && !this.puente.activo
          ? h('p', { class: 'asistente-nota alerta', text: `${info.nombre} no acepta llamadas desde el navegador: inicia el puente (node scripts/mcp/puente-http.mjs).` })
          : '',
      );
    }
    const seguridad = h(
      'div',
      { class: 'asistente-tarjeta' },
      h('div', { class: 'asistente-tarjeta-t', text: 'Cómo se protege tu clave' }),
      h(
        'ul',
        { class: 'asistente-lista' },
        h('li', { text: 'Vive solo en la memoria de esta página: no va a disco, a localStorage, a cookies ni a la URL.' }),
        h('li', { text: 'Recargar la página o pulsar «Borrar clave» la elimina.' }),
        h('li', { text: 'Va directo al proveedor en un header (Gemini: x-goog-api-key, nunca ?key=). El puente local la reenvía sin guardarla.' }),
        h('li', { text: 'El modelo recibe solo los números del motor del sitio y del candidato que ves.' }),
      ),
    );
    return h('div', { class: 'asistente-vista' }, tarjeta, seguridad);
  }

  private vistaMotor(): HTMLElement {
    const r = this.base;
    const a = this.ajustes;
    if (!r || !a || !this.indice) return h('p', { class: 'asistente-nota', text: 'Elige primero un sitio objetivo.' });
    const motorOk = this.motorDisponible();
    const vista = h(
      'div',
      { class: 'asistente-vista' },
      motorOk
        ? h('p', { class: 'asistente-nota ok', text: 'Motor Rust conectado por el puente local: los cambios recalculan sobre la tabla completa.' })
        : h('p', { class: 'asistente-nota alerta', text: 'Motor no conectado: solo se filtra la lista publicada. Para recalcular: RUN=<corrida> node scripts/mcp/puente-http.mjs' }),
    );
    if (this.modo === 'facil') this.motorFacil(vista, r, a, motorOk);
    else this.motorCientifico(vista, r, a, motorOk);
    if (this.ultimoInforme) vista.append(h('pre', { class: 'asistente-informe', text: this.ultimoInforme }));
    return vista;
  }

  private motorFacil(vista: HTMLElement, r: ResultadoJson, a: AjustesMotor, motorOk: boolean): void {
    const opciones = h('div', { class: 'asistente-opciones', role: 'radiogroup', 'aria-label': '¿Qué importa más?' });
    for (const p of PREAJUSTES) {
      const b = boton('', `asistente-opcion${this.preajuste === p.id ? ' activa' : ''}`, () => {
        this.preajuste = p.id;
        this.cambiar({ pesos: Object.fromEntries(r.parametros.variables.map((v) => [v.id, p.pesos(v.id)])) });
      }, { role: 'radio', 'aria-checked': String(this.preajuste === p.id) });
      b.append(h('strong', { text: p.titulo }), h('small', { text: p.detalle }));
      opciones.append(b);
    }
    const donde = h(
      'div',
      { class: 'asistente-seg' },
      boton('Toda la Tierra', a.soloVista ? '' : 'activa', () => this.cambiar({ soloVista: false })),
      boton('Solo lo que veo', a.soloVista ? 'activa' : '', () => this.cambiar({ soloVista: true })),
    );
    const cuantos = h('div', { class: 'asistente-seg' });
    for (const n of [20, 50, 200]) cuantos.append(boton(String(n), a.candidatos === n ? 'activa' : '', () => this.cambiar({ candidatos: n })));
    const muy = h('input', { type: 'checkbox' });
    muy.checked = a.nota_min >= 0.9;
    muy.addEventListener('change', () => this.cambiar({ nota_min: muy.checked ? 0.9 : 0 }, false));
    vista.append(
      h('p', { class: 'subtitulo', text: '1. ¿Qué importa más?' }),
      opciones,
      h('p', { class: 'subtitulo', text: '2. ¿Dónde buscar?' }),
      donde,
      a.soloVista ? h('p', { class: 'asistente-nota', text: 'Acerca o aleja el globo hasta ver la zona. Debe tener al menos 40 000 km² de tierra.' }) : '',
      h('p', { class: 'subtitulo', text: '3. ¿Cuántos lugares?' }),
      cuantos,
      h('label', { class: 'asistente-chk' }, muy, h('span', { text: 'Mostrar solo los muy parecidos (90 % o más)' })),
      h(
        'div',
        { class: 'asistente-acciones' },
        boton(motorOk ? 'Buscar análogos' : 'Aplicar filtros', 'btn-primario', () => void this.correr()),
        boton('Volver a lo publicado', 'btn-mini', () => this.restablecer()),
      ),
    );
  }

  private motorCientifico(vista: HTMLElement, r: ResultadoJson, a: AjustesMotor, motorOk: boolean): void {
    const vars = new Map((this.indice?.variables ?? []).map((v) => [v.id, v]));
    const tabla = h('table', { class: 'asistente-tabla' });
    tabla.append(h('thead', {}, h('tr', {}, h('th', { text: 'Variable' }), h('th', { text: 'Peso' }), h('th', { text: 'Tolerancia' }))));
    const cuerpo = h('tbody');
    for (const v of r.parametros.variables) {
      const meta = vars.get(v.id);
      const unidad = meta?.unidad ?? '';
      const peso = h('input', { type: 'range', min: LIMITES.peso[0], max: LIMITES.peso[1], step: 0.25, 'aria-label': `Peso ${meta?.nombre ?? v.id}` });
      peso.value = String(a.pesos[v.id] ?? 1);
      const pesoOut = h('output', { text: (a.pesos[v.id] ?? 1).toFixed(2) });
      peso.addEventListener('input', () => {
        a.pesos[v.id] = Number(peso.value);
        pesoOut.textContent = Number(peso.value).toFixed(2);
      });
      const tol = h('input', { type: 'range', min: LIMITES.factorTol[0], max: LIMITES.factorTol[1], step: 0.25, 'aria-label': `Factor de tolerancia ${meta?.nombre ?? v.id}` });
      tol.value = String(a.factorTol[v.id] ?? 1);
      const textoTol = (f: number): string => `×${f.toFixed(2)} = ${(v.tolerancia * f).toFixed(2)} ${unidad}`;
      const tolOut = h('output', { text: textoTol(a.factorTol[v.id] ?? 1) });
      tol.addEventListener('input', () => {
        a.factorTol[v.id] = Number(tol.value);
        tolOut.textContent = textoTol(Number(tol.value));
      });
      const obj = r.objetivo.variables[v.id]?.valor;
      cuerpo.append(
        h(
          'tr',
          {},
          h('td', {}, h('span', { text: meta?.nombre ?? v.id }), h('small', { text: `objetivo ${obj === undefined ? 'sin dato' : obj.toFixed(2)} ${unidad}` })),
          h('td', {}, peso, pesoOut),
          h('td', {}, tol, tolOut),
        ),
      );
    }
    tabla.append(cuerpo);
    const numero = (etq: string, clave: 'candidatos' | 'separacion_km' | 'excluir_km' | 'k_area' | 'min_area_km2', ayuda: string, paso = '1'): HTMLElement => {
      const i = h('input', { type: 'number', step: paso, min: LIMITES[clave][0], max: LIMITES[clave][1], placeholder: 'por omisión' });
      const val = a[clave];
      i.value = val === null ? '' : String(val);
      i.addEventListener('change', () => {
        const n = i.value === '' ? null : Number(i.value);
        if (clave === 'candidatos') a.candidatos = n === null || !Number.isFinite(n) ? 200 : Math.round(Math.min(500, Math.max(1, n)));
        else a[clave] = n === null || !Number.isFinite(n) ? null : n;
      });
      return h('label', { class: 'asistente-campo', title: ayuda }, h('span', { text: etq }), i);
    };
    const chk = (etq: string, clave: 'soloVista' | 'usar_puntos' | 'solo_completos'): HTMLElement => {
      const i = h('input', { type: 'checkbox' });
      i.checked = a[clave];
      i.addEventListener('change', () => (a[clave] = i.checked));
      return h('label', { class: 'asistente-chk' }, i, h('span', { text: etq }));
    };
    const notaMin = h('input', { type: 'range', min: 0, max: 1, step: 0.05, 'aria-label': 'Nota mínima' });
    notaMin.value = String(a.nota_min);
    const notaOut = h('output', { text: `${Math.round(a.nota_min * 100)} %` });
    notaMin.addEventListener('input', () => {
      a.nota_min = Number(notaMin.value);
      notaOut.textContent = `${Math.round(a.nota_min * 100)} %`;
    });
    vista.append(
      h('p', { class: 'subtitulo', text: 'Perfil: peso relativo y factor de tolerancia' }),
      tabla,
      h('p', { class: 'asistente-nota', text: 'Peso 0 saca la variable de la nota. Un factor de tolerancia mayor que 1 acepta diferencias más grandes (pseudo-Huber, ADR-010).' }),
      h('p', { class: 'subtitulo', text: 'Área y selección' }),
      h(
        'div',
        { class: 'asistente-rejilla' },
        numero('Candidatos', 'candidatos', 'Celdas a escribir: la mejor de cada región de nivel 6 (1 a 500).'),
        numero('Separación (km)', 'separacion_km', 'Distancia mínima entre candidatos.'),
        numero('Excluir conocidos (km)', 'excluir_km', 'Radio alrededor de análogos ya conocidos que se excluye.'),
        numero('Factor k del área', 'k_area', 'radio_efectivo = min(radio, k·√área), en (0, 1]; 0,15 por omisión (provisional).', '0.05'),
        numero('Piso de tierra (km²)', 'min_area_km2', 'Mínimo de tierra elegible; 40 000 por omisión (provisional), 0 lo desactiva.', '1000'),
      ),
      chk('Solo en la vista actual del globo', 'soloVista'),
      chk('Informar distancia a tubos de lava, cráteres y salares', 'usar_puntos'),
      h('p', { class: 'subtitulo', text: 'Filtros de la lista' }),
      h('label', { class: 'asistente-campo' }, h('span', { text: 'Nota mínima' }), notaMin, notaOut),
      chk('Solo con dato en todas las variables', 'solo_completos'),
      h(
        'div',
        { class: 'asistente-acciones' },
        boton(motorOk ? 'Ejecutar motor' : 'Aplicar filtros', 'btn-primario', () => void this.correr()),
        motorOk ? boton('Solo filtrar', 'btn-mini', () => void this.filtrar()) : null,
        boton('Restablecer', 'btn-mini', () => this.restablecer()),
      ),
    );
  }

  private cambiar(c: Partial<AjustesMotor>, repintar = true): void {
    if (!this.ajustes) return;
    this.ajustes = aplicarCambios(this.ajustes, c);
    if (repintar) this.pintar();
  }

  private restablecer(): void {
    if (!this.base) return;
    this.ajustes = ajustesIniciales(this.base);
    this.preajuste = 'equilibrado';
    this.ultimoInforme = null;
    this.mostrado = this.base;
    this.cb.alRecalcular(this.base);
    this.estado('Vuelve a mostrar el resultado publicado.');
    this.pintar();
  }

  // --- Motor ----------------------------------------------------------------------------------------------------

  private filtrar(): ResultadoJson | null {
    if (!this.base || !this.ajustes) return null;
    const antes = this.mostrado?.candidatos.length ?? null;
    const r = filtrarResultado(this.base, this.ajustes, this.ajustes.soloVista ? this.cb.bboxVista() : null);
    this.mostrado = r;
    this.cb.alRecalcular(r);
    this.ultimoInforme = `Filtro sobre la lista: ${resumenResultado(r, antes)}`;
    this.estado(`Filtrado: ${r.candidatos.length} candidatos.`);
    this.pintar();
    return r;
  }

  /** Corre el motor por el puente si está; si no, filtra. Devuelve un resumen para el agente. */
  private async correr(): Promise<string> {
    if (!this.base || !this.ajustes) return 'No hay sitio elegido.';
    if (!this.motorDisponible()) {
      const r = this.filtrar();
      return r ? `Motor no disponible; se filtró la lista. ${resumenResultado(r, null)}` : 'Sin datos.';
    }
    const ajustes = this.ajustes;
    const base = this.base;
    const bbox = ajustes.soloVista ? this.cb.bboxVista() : null;
    let cuerpo: Record<string, unknown>;
    try {
      cuerpo = cuerpoPuente(ajustes, base, bbox);
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      this.estado(m);
      return m;
    }
    this.ocupado = true;
    this.estado(ajustes.soloVista && !bbox ? 'La vista abarca casi todo el globo: se busca en toda la Tierra…' : 'Motor corriendo…');
    this.pintar();
    try {
      const pedir = async (ruta: string, init?: RequestInit): Promise<Record<string, unknown>> => {
        const res = await fetch(`${URL_PUENTE}${ruta}`, { credentials: 'omit', ...init });
        const j = (await res.json()) as Record<string, unknown>;
        if (!res.ok) throw new Error(String(j.error ?? `HTTP ${res.status}`));
        return j;
      };
      let e = await pedir('/api/motor/ejecutar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Earth-Analogs': '1' },
        body: JSON.stringify(cuerpo),
      });
      const id = String(e.id);
      const t0 = Date.now();
      while (e.estado === 'corriendo' && Date.now() - t0 < 15 * 60_000) {
        await new Promise((s) => setTimeout(s, 800));
        e = await pedir(`/api/motor/estado/${encodeURIComponent(id)}`);
        this.estado(`Motor corriendo… ${Math.round((Date.now() - t0) / 1000)} s`);
      }
      if (e.estado !== 'ok') throw new Error(String(e.error ?? 'el motor no terminó'));
      const nuevo = await cargarResultado(`${URL_PUENTE}/api/motor/archivo/${encodeURIComponent(id)}/`, `resultados/${base.perfil}/${base.sitio}.json`);
      const antes = this.mostrado?.candidatos.length ?? null;
      const filtrado = filtrarResultado(nuevo, { ...ajustes, soloVista: false }, null);
      this.mostrado = filtrado;
      this.cb.alRecalcular(filtrado);
      const inf = (e.informe ?? {}) as Record<string, unknown>;
      const t = (inf.tiempos ?? {}) as Record<string, unknown>;
      this.ultimoInforme = [
        `Motor: ${String(e.duracion_s)} s · celdas en el área ${String(inf.celdas_en_area ?? inf.elegibles ?? '?')} · coinciden ${String(inf.coinciden ?? '?')}`,
        `Barrido ${String(t.barrido_s ?? '?')} s · ${resumenResultado(filtrado, antes)}`,
      ].join('\n');
      this.estado(`Recalculado en ${String(e.duracion_s)} s (no publicado).`);
      return this.ultimoInforme;
    } catch (err) {
      const m = `No se pudo recalcular: ${redactarSecretos(err instanceof Error ? err.message : err)}`;
      this.estado(m);
      return m;
    } finally {
      this.ocupado = false;
      this.pintar();
    }
  }

  private async ejecutarAccion(acc: Accion): Promise<string> {
    if (!this.ajustes) return 'Sin sitio elegido.';
    if (acc.tipo === 'seleccionar') {
      this.cb.alSeleccionar(acc.rango);
      return `Se enfocó el candidato #${acc.rango}.`;
    }
    this.ajustes = aplicarCambios(this.ajustes, acc.cambios);
    if (acc.tipo === 'filtrar') {
      const r = this.filtrar();
      return r ? `Filtro aplicado: ${resumenResultado(r, null)}` : 'Sin datos.';
    }
    return this.correr();
  }

  private describirAccion(acc: Accion): string {
    if (acc.tipo === 'seleccionar') return `▶ El agente enfoca el candidato #${acc.rango}.`;
    const partes = Object.entries(acc.cambios).map(([k, v]) => `${k} = ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`);
    return `▶ El agente ${acc.tipo === 'filtrar' ? 'filtra la lista' : 'ajusta y corre el motor'}: ${partes.join(', ') || 'ajustes actuales'}.`;
  }

  // --- Chat -----------------------------------------------------------------------------------------------------

  private historial(): MensajeIA[] {
    return this.mensajes
      .filter((m) => !m.nota)
      .map(({ rol, texto }) => ({ rol, texto: texto.slice(0, 3900) }))
      .slice(-10);
  }

  private sistema(): string {
    if (!this.mostrado || !this.ajustes) {
      return sistemaSinSitio({ modo: this.modo, indice: this.indice!, motorDisponible: this.motorDisponible() });
    }
    return sistemaAgente({
      modo: this.modo,
      indice: this.indice!,
      resultado: this.mostrado,
      candidato: this.candidato,
      ajustes: this.ajustes,
      motorDisponible: this.motorDisponible(),
    });
  }

  /** Carga un sitio objetivo en el visor. La conversación no se borra: el cambio lo pidió el usuario por el chat. */
  private async elegirSitio(sitioId: string): Promise<boolean> {
    this.cambioPorAgente = true;
    try {
      await this.cb.alElegirSitio(sitioId);
    } finally {
      this.cambioPorAgente = false;
    }
    return this.base?.sitio === sitioId;
  }

  /** Aviso si el proveedor elegido no puede usarse ahora, o null si todo está listo. */
  private avisoProveedor(): string | null {
    const info = PROVEEDORES.find((p) => p.id === this.proveedor);
    if (info?.soloPuente && !(this.viaPuente && this.puente.activo)) {
      return `${info.nombre} solo funciona con el puente local activo.`;
    }
    return null;
  }

  /** Pregunta del usuario; también la llaman los botones de pregunta rápida del panel. */
  async preguntar(pregunta: string): Promise<void> {
    if (this.ocupado) return;
    this.borrador = '';
    this.mensajes.push({ rol: 'usuario', texto: pregunta });
    if (!this.indice) {
      this.mensajes.push({ rol: 'asistente', texto: 'Los datos todavía están cargando; intenta de nuevo en un momento.', nota: 'aviso' });
      this.pintar();
      return;
    }
    if (this.analogo && !this.candidato) {
      await this.preguntarAnalogo();
      return;
    }
    if (!this.conClave()) {
      // Sin clave se entiende lo básico: «busca zonas como Jezero, 50 candidatos» elige el sitio y corre el motor.
      const peticion = interpretarPeticion(pregunta, this.indice);
      if (peticion) {
        await this.atenderPeticion(peticion.sitio, peticion.candidatos);
        return;
      }
      this.mensajes.push({
        rol: 'asistente',
        texto: this.mostrado
          ? this.respuestaSinClave()
          : 'Elige un sitio en la pestaña Mapa, o escribe por ejemplo «busca zonas como Jezero, 50 candidatos» y lo busco con el motor. Con una clave API puedo atender peticiones más libres.',
        nota: 'local',
      });
      this.pintar();
      return;
    }
    const aviso = this.avisoProveedor();
    if (aviso) {
      this.mensajes.push({ rol: 'asistente', texto: `${aviso}\n\n${this.respuestaSinClave()}`, nota: 'aviso' });
      this.pintar();
      return;
    }
    const viaPuente = this.viaPuente && this.puente.activo;
    this.ocupado = true;
    this.pintar();
    try {
      const r = await preguntarIA(this.modelo, this.sistema(), this.historial(), viaPuente);
      const { texto, crudas } = extraerAcciones(r);
      if (texto) this.mensajes.push({ rol: 'asistente', texto });
      let invalidas = 0;
      for (const cruda of crudas) {
        const sitioId = validarSitio(cruda, this.indice);
        if (sitioId) {
          this.mensajes.push({ rol: 'asistente', texto: `▶ El agente carga el sitio ${sitioId}.`, nota: 'accion' });
          const ok = await this.elegirSitio(sitioId);
          this.mensajes.push({ rol: 'asistente', texto: ok ? `Sitio ${sitioId} cargado.` : `No se pudo cargar el sitio ${sitioId}.`, nota: 'accion' });
          if (!ok) break;
          continue;
        }
        const acc = this.base ? validarAccion(cruda, this.base) : null;
        if (!acc) {
          invalidas += 1;
          continue;
        }
        this.mensajes.push({ rol: 'asistente', texto: this.describirAccion(acc), nota: 'accion' });
        this.pestana = 'chat';
        this.ocupado = false;
        const resumen = await this.ejecutarAccion(acc);
        this.ocupado = true;
        this.mensajes.push({ rol: 'asistente', texto: resumen, nota: 'accion' });
        this.pintar();
        if (acc.tipo !== 'seleccionar') {
          // segunda vuelta: el modelo explica el resultado con los números nuevos
          const explicacion = await preguntarIA(
            this.modelo,
            this.sistema(),
            [...this.historial(), { rol: 'usuario', texto: `El visor aplicó tu acción. ${resumen}\nExplica el resultado y qué cambió. No propongas otra acción.` }],
            viaPuente,
          );
          const limpio = extraerAcciones(explicacion).texto;
          if (limpio) this.mensajes.push({ rol: 'asistente', texto: limpio });
        }
      }
      if (invalidas > 0) {
        this.mensajes.push({ rol: 'asistente', texto: 'El agente propuso un cambio no válido; no se aplicó.', nota: 'aviso' });
      }
      this.estado('Respuesta generada por IA con los datos del motor; verifica las cifras en la ficha.');
    } catch (e) {
      this.mensajes.push({
        rol: 'asistente',
        texto: `Error: ${redactarSecretos(e instanceof Error ? e.message : e)}\n\n${this.respuestaSinClave()}`,
        nota: 'aviso',
      });
    } finally {
      this.ocupado = false;
      this.pintar();
    }
  }

  /** Petición sin clave: elige el sitio (si hace falta), fija cuántos candidatos y corre el motor. */
  private async atenderPeticion(sitioId: string | null, candidatos: number | null): Promise<void> {
    this.ocupado = true;
    this.pintar();
    try {
      if (sitioId && sitioId !== this.base?.sitio) {
        this.mensajes.push({ rol: 'asistente', texto: `▶ Cargo el sitio ${sitioId}.`, nota: 'accion' });
        if (!(await this.elegirSitio(sitioId))) {
          this.mensajes.push({ rol: 'asistente', texto: `No se pudo cargar el sitio ${sitioId}.`, nota: 'aviso' });
          return;
        }
      }
      if (!this.base || !this.ajustes) {
        this.mensajes.push({ rol: 'asistente', texto: 'Dime de qué sitio quieres buscar zonas parecidas (por ejemplo Jezero o Shackleton).', nota: 'aviso' });
        return;
      }
      if (candidatos !== null) this.ajustes = aplicarCambios(this.ajustes, { candidatos: Math.min(500, Math.max(1, candidatos)) });
      this.mensajes.push({
        rol: 'asistente',
        texto: `▶ ${this.motorDisponible() ? 'Corro el motor' : 'Filtro la lista publicada (el motor no está conectado)'} para ${this.base.sitio} con ${this.ajustes.candidatos} candidatos.`,
        nota: 'accion',
      });
      this.ocupado = false;
      const resumen = await this.correr();
      this.ocupado = true;
      this.mensajes.push({ rol: 'asistente', texto: resumen, nota: 'accion' });
    } finally {
      this.ocupado = false;
      this.pintar();
    }
  }

  /** Pregunta sobre un análogo documentado (sin acciones sobre el motor). */
  private async preguntarAnalogo(): Promise<void> {
    if (!this.indice || !this.analogo) return;
    const ctx = construirContextoAnalogo(this.indice, this.mostrado, this.analogo, this.lecturasAnalogo);
    if (!this.conClave()) {
      this.mensajes.push({ rol: 'asistente', texto: respuestaLocal(ctx), nota: 'local' });
      this.pintar();
      return;
    }
    const aviso = this.avisoProveedor();
    if (aviso) {
      this.mensajes.push({ rol: 'asistente', texto: `${aviso} Respuesta local:\n\n${respuestaLocal(ctx)}`, nota: 'aviso' });
      this.pintar();
      return;
    }
    this.ocupado = true;
    this.pintar();
    try {
      const r = await preguntarIA(this.modelo, ctx.sistema, this.historial(), this.viaPuente && this.puente.activo);
      this.mensajes.push({ rol: 'asistente', texto: r });
      this.estado('Respuesta generada por IA a partir de los datos del análogo; verifica las cifras en la ficha.');
    } catch (e) {
      this.mensajes.push({
        rol: 'asistente',
        texto: `Error: ${redactarSecretos(e instanceof Error ? e.message : e)}\n\nRespuesta local:\n\n${respuestaLocal(ctx)}`,
        nota: 'aviso',
      });
    } finally {
      this.ocupado = false;
      this.pintar();
    }
  }

  private respuestaSinClave(): string {
    const r = this.mostrado;
    if (!r || !this.indice) return 'Sin datos.';
    const c = this.candidato ?? r.candidatos[0];
    if (!c) return 'No hay candidatos con estos ajustes.';
    const base = respuestaLocal(construirContextoIA(this.indice, r, c));
    const pie =
      this.modo === 'facil'
        ? 'Para cambiar la búsqueda usa la pestaña Motor. Con una clave API me lo puedes pedir con palabras.'
        : 'Ajusta pesos, tolerancias y área en la pestaña Motor; con una clave API el agente lo hace desde el chat.';
    return `${this.candidato ? '' : 'Sobre el mejor candidato:\n'}${base}\n\n${pie}`;
  }
}
