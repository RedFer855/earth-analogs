// Panel "Asistente IA": sin clave da el resumen científico local; con clave (BYOK) pregunta al modelo con los
// números del candidato seleccionado. Si el puente local está activo, permite recalcular con el motor Rust.
// Todo lo que viene del modelo o de un error se pinta con textContent (nunca innerHTML).

import type { AnalogoTierra } from '../datos/analogos';
import { cargarResultado, type Celda, type Indice, type ResultadoJson } from '../datos/contrato';
import type { LecturaVariable } from '../datos/solidez';
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
  /** Caja [lat1, lon1, lat2, lon2] de la vista actual, o null si no se puede calcular. */
  bboxVista: () => [number, number, number, number] | null;
  /** Muestra en el globo un resultado recalculado con el motor (no se publica). */
  alRecalcular: (resultado: ResultadoJson) => void;
}

const PREGUNTAS = [
  '¿Por qué coincide con el objetivo?',
  '¿En qué difiere físicamente?',
  '¿Qué riesgos o límites tiene para probar exploración?',
];

function el<K extends keyof HTMLElementTagNameMap>(tag: K, clase?: string, texto?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (clase) e.className = clase;
  if (texto !== undefined) e.textContent = texto;
  return e;
}

export class Asistente {
  private readonly raiz: HTMLElement;
  private readonly boton: HTMLButtonElement;
  private readonly cuerpoChat: HTMLElement;
  private readonly estadoEl: HTMLElement;
  private readonly contextoEl: HTMLElement;
  private readonly selProveedor: HTMLSelectElement;
  private readonly inModelo: HTMLInputElement;
  private readonly inClave: HTMLInputElement;
  private readonly chkSesion: HTMLInputElement;
  private readonly chkPuente: HTMLInputElement;
  private readonly bloqueClave: HTMLElement;
  private readonly bloqueMotor: HTMLElement;
  private readonly inPregunta: HTMLInputElement;
  private historial: MensajeIA[] = [];
  private indice: Indice | null = null;
  private resultado: ResultadoJson | null = null;
  private candidato: Celda | null = null;
  private analogo: AnalogoTierra | null = null;
  private lecturasAnalogo: LecturaVariable[] = [];
  private puente: EstadoPuente = { activo: false, motor: false };
  private ocupado = false;

  /** `embebido`: vive dentro de otro panel (pestaña Chat), sin botón flotante ni cabecera propia. */
  constructor(
    contenedor: HTMLElement,
    private readonly callbacks: AsistenteCallbacks,
    private readonly embebido = false,
  ) {
    this.boton = el('button', 'btn-primario asistente-abrir', 'Asistente IA');
    this.boton.type = 'button';
    if (!embebido) contenedor.appendChild(this.boton);

    this.raiz = el('section', embebido ? 'asistente asistente-embebido' : 'panel asistente oculto');
    this.raiz.setAttribute('aria-label', 'Asistente IA');
    contenedor.appendChild(this.raiz);

    const cab = el('header', 'asistente-cab');
    cab.append(el('h2', undefined, 'Asistente IA'));
    const cerrar = el('button', 'btn-cerrar', '×');
    cerrar.type = 'button';
    cerrar.title = 'Cerrar';
    cab.append(cerrar);
    if (!embebido) this.raiz.append(cab);

    this.contextoEl = el('p', 'asistente-contexto', 'Elige un candidato en el globo o en la lista.');
    this.raiz.append(this.contextoEl);

    // modo y clave
    this.bloqueClave = el('div', 'asistente-clave');
    this.selProveedor = el('select');
    this.selProveedor.append(new Option('Sin clave · resumen local', 'local'));
    for (const p of PROVEEDORES) this.selProveedor.append(new Option(p.nombre, p.id));
    this.inModelo = el('input');
    this.inModelo.type = 'text';
    this.inModelo.placeholder = 'modelo';
    this.inModelo.autocomplete = 'off';
    this.inModelo.spellcheck = false;
    this.inClave = el('input');
    this.inClave.type = 'password';
    this.inClave.autocomplete = 'off';
    this.inClave.placeholder = 'Pega tu clave API';
    this.inClave.spellcheck = false;
    this.inClave.setAttribute('data-lpignore', 'true');
    const filaChk = el('label', 'asistente-chk');
    this.chkSesion = el('input');
    this.chkSesion.type = 'checkbox';
    filaChk.append(this.chkSesion, document.createTextNode(' Recordar solo en esta pestaña (sessionStorage)'));
    const filaPuente = el('label', 'asistente-chk');
    this.chkPuente = el('input');
    this.chkPuente.type = 'checkbox';
    this.chkPuente.disabled = true;
    filaPuente.append(this.chkPuente, document.createTextNode(' Enviar por el puente local (127.0.0.1)'));
    const usar = el('button', 'btn-mini', 'Usar clave');
    usar.type = 'button';
    const borrar = el('button', 'btn-mini', 'Borrar clave');
    borrar.type = 'button';
    const acciones = el('div', 'asistente-acciones');
    acciones.append(usar, borrar);
    const aviso = el('p', 'asistente-aviso', 'La clave queda solo en la memoria de esta página: no se guarda en disco, en la URL ni en el servidor.');
    this.bloqueClave.append(this.selProveedor, this.inModelo, this.inClave, filaChk, filaPuente, acciones, aviso);
    this.raiz.append(this.bloqueClave);

    // preguntas
    const rapidas = el('div', 'asistente-rapidas');
    for (const p of PREGUNTAS) {
      const b = el('button', 'btn-mini', p);
      b.type = 'button';
      b.addEventListener('click', () => void this.preguntar(p));
      rapidas.append(b);
    }
    this.raiz.append(rapidas);

    this.cuerpoChat = el('div', 'asistente-chat');
    this.cuerpoChat.setAttribute('aria-live', 'polite');
    this.raiz.append(this.cuerpoChat);

    const form = el('form', 'asistente-form');
    this.inPregunta = el('input');
    this.inPregunta.type = 'text';
    this.inPregunta.placeholder = 'Pregunta sobre este candidato…';
    this.inPregunta.maxLength = 600;
    const enviar = el('button', 'btn-primario', 'Enviar');
    enviar.type = 'submit';
    form.append(this.inPregunta, enviar);
    this.raiz.append(form);

    this.bloqueMotor = el('div', 'asistente-motor oculto');
    this.raiz.append(this.bloqueMotor);

    this.estadoEl = el('p', 'asistente-estado');
    this.raiz.append(this.estadoEl);

    this.boton.addEventListener('click', () => void this.alternar(true));
    cerrar.addEventListener('click', () => void this.alternar(false));
    this.selProveedor.addEventListener('change', () => this.alCambiarProveedor());
    usar.addEventListener('click', () => this.usarClave());
    borrar.addEventListener('click', () => this.borrarClave());
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const q = this.inPregunta.value.trim();
      if (q) void this.preguntar(q);
    });

    const restaurado = restaurarClaveIA();
    if (restaurado) {
      this.selProveedor.value = restaurado;
      this.chkSesion.checked = true;
    }
    this.alCambiarProveedor();
    if (embebido) void this.sondearPuente();
  }

  private async sondearPuente(): Promise<void> {
    this.puente = await detectarPuente();
    this.chkPuente.disabled = !this.puente.activo;
    this.alCambiarProveedor();
    this.pintarMotor();
  }

  establecerContexto(indice: Indice, resultado: ResultadoJson | null, candidato: Celda | null): void {
    const cambia =
      this.analogo !== null ||
      candidato?.ipix !== this.candidato?.ipix ||
      resultado?.sitio !== this.resultado?.sitio;
    this.indice = indice;
    this.resultado = resultado;
    this.candidato = candidato;
    this.analogo = null;
    this.lecturasAnalogo = [];
    if (cambia) {
      this.historial = [];
      this.cuerpoChat.replaceChildren();
    }
    this.contextoEl.textContent =
      resultado && candidato
        ? `Candidato #${candidato.rango} de ${resultado.sitio} · ${candidato.centro.lat.toFixed(3)}, ${candidato.centro.lon.toFixed(3)} · nota ${(candidato.nota * 100).toFixed(1)} %`
        : resultado
          ? `Sitio ${resultado.sitio}: elige un candidato.`
          : 'Elige un candidato en el globo o en la lista.';
    this.pintarMotor();
  }

  establecerAnalogo(
    indice: Indice,
    resultado: ResultadoJson | null,
    analogo: AnalogoTierra,
    lecturas: LecturaVariable[] = [],
  ): void {
    const cambia = this.analogo?.codigo !== analogo.codigo || resultado?.sitio !== this.resultado?.sitio;
    this.indice = indice;
    this.resultado = resultado;
    this.candidato = null;
    this.analogo = analogo;
    this.lecturasAnalogo = lecturas;
    if (cambia) {
      this.historial = [];
      this.cuerpoChat.replaceChildren();
    }
    this.contextoEl.textContent = `Análogo ${analogo.nombre} (${analogo.codigo}) · ${analogo.lat.toFixed(3)}, ${analogo.lon.toFixed(3)} · ${analogo.programa}`;
    this.pintarMotor();
  }

  private async alternar(abrir: boolean): Promise<void> {
    this.raiz.classList.toggle('oculto', !abrir);
    this.boton.classList.toggle('oculto', abrir);
    if (abrir) {
      // la sonda al puente solo corre cuando el usuario abre el panel
      this.puente = await detectarPuente();
      this.chkPuente.disabled = !this.puente.activo;
      if (!this.puente.activo) this.chkPuente.checked = false;
      this.alCambiarProveedor();
      this.pintarMotor();
    }
  }

  private proveedor(): ProveedorIA | 'local' {
    return this.selProveedor.value as ProveedorIA | 'local';
  }

  private alCambiarProveedor(): void {
    const p = this.proveedor();
    const info = PROVEEDORES.find((x) => x.id === p);
    const conClave = p !== 'local';
    this.inModelo.hidden = !conClave;
    this.inClave.hidden = !conClave;
    this.inModelo.value = info?.modeloPorOmision ?? '';
    if (info?.soloPuente) {
      this.chkPuente.checked = this.puente.activo;
    }
    if (!conClave) this.estado('Modo sin clave: respuestas deterministas con los datos del motor.');
    else if (proveedorConClave() === p) this.estado(`Clave de ${info?.nombre} cargada en memoria.`);
    else if (info?.soloPuente && !this.puente.activo) {
      this.estado(`${info.nombre} no acepta llamadas desde el navegador: inicia el puente local (node scripts/mcp/puente-http.mjs).`);
    } else this.estado('Pega tu clave y pulsa «Usar clave».');
  }

  private usarClave(): void {
    const p = this.proveedor();
    if (p === 'local') return;
    try {
      guardarClaveIA(p, this.inClave.value, this.chkSesion.checked);
      this.inClave.value = '';
      this.estado('Clave cargada solo en memoria de esta página.');
    } catch (e) {
      this.estado(redactarSecretos(e instanceof Error ? e.message : e));
    }
  }

  private borrarClave(): void {
    borrarClaveIA();
    this.inClave.value = '';
    this.chkSesion.checked = false;
    this.estado('Clave borrada de la memoria y de la pestaña.');
  }

  private estado(t: string): void {
    this.estadoEl.textContent = t;
  }

  private agregar(rol: MensajeIA['rol'], texto: string, clase = ''): void {
    const p = el('div', `asistente-msg ${rol} ${clase}`.trim());
    p.textContent = texto;
    this.cuerpoChat.append(p);
    this.cuerpoChat.scrollTop = this.cuerpoChat.scrollHeight;
  }

  async preguntar(pregunta: string): Promise<void> {
    if (this.ocupado) return;
    if (!this.indice || (!this.candidato && !this.analogo)) {
      this.estado('Primero elige un candidato o un análogo.');
      return;
    }
    const ctx =
      this.candidato && this.resultado
        ? construirContextoIA(this.indice, this.resultado, this.candidato)
        : this.analogo
          ? construirContextoAnalogo(this.indice, this.resultado, this.analogo, this.lecturasAnalogo)
          : null;
    if (!ctx) {
      this.estado('Primero elige un candidato o un análogo.');
      return;
    }
    this.inPregunta.value = '';
    this.agregar('usuario', pregunta);
    const p = this.proveedor();
    if (p === 'local') {
      this.agregar('asistente', respuestaLocal(ctx));
      return;
    }
    if (!hayClaveIA() || proveedorConClave() !== p) {
      this.agregar('asistente', 'Sin clave de este proveedor. Respuesta local:\n\n' + respuestaLocal(ctx), 'aviso');
      return;
    }
    const viaPuente = this.chkPuente.checked && this.puente.activo;
    const info = PROVEEDORES.find((x) => x.id === p);
    if (info?.soloPuente && !viaPuente) {
      this.agregar('asistente', `${info.nombre} requiere el puente local. Respuesta local:\n\n${respuestaLocal(ctx)}`, 'aviso');
      return;
    }
    this.ocupado = true;
    this.estado('Consultando al modelo…');
    this.historial.push({ rol: 'usuario', texto: pregunta });
    try {
      const r = await preguntarIA(this.inModelo.value.trim(), ctx.sistema, this.historial, viaPuente);
      this.historial.push({ rol: 'asistente', texto: r });
      this.agregar('asistente', r);
      this.estado('Respuesta generada por IA a partir de los datos del motor; verifica las cifras en la ficha.');
    } catch (e) {
      this.historial.pop();
      this.agregar('asistente', `Error: ${redactarSecretos(e instanceof Error ? e.message : e)}\n\nRespuesta local:\n\n${respuestaLocal(ctx)}`, 'aviso');
      this.estado('');
    } finally {
      this.ocupado = false;
    }
  }

  // --- Motor por el puente --------------------------------------------------------------------------------------

  private pintarMotor(): void {
    const visible = this.puente.activo && this.puente.motor && this.resultado !== null;
    this.bloqueMotor.classList.toggle('oculto', !visible);
    if (!visible || !this.resultado) return;
    this.bloqueMotor.replaceChildren();
    const titulo = el('p', 'subtitulo', `Recalcular ${this.resultado.sitio} con el motor Rust (puente local)`);
    const fila = el('label', 'asistente-chk');
    const chk = el('input');
    chk.type = 'checkbox';
    chk.checked = true;
    fila.append(chk, document.createTextNode(' Solo en la vista actual'));
    const b = el('button', 'btn-mini', 'Recalcular con motor Rust');
    b.type = 'button';
    b.addEventListener('click', () => void this.recalcular(chk.checked, b));
    this.bloqueMotor.append(titulo, fila, b);
  }

  private async recalcular(soloVista: boolean, boton: HTMLButtonElement): Promise<void> {
    if (!this.resultado) return;
    const objetivo = this.resultado.sitio;
    const perfil = this.resultado.perfil;
    const cuerpo: Record<string, unknown> = { objetivo, perfil, candidatos: 200 };
    if (soloVista) {
      const caja = this.callbacks.bboxVista();
      if (caja) cuerpo.bbox = caja;
    }
    boton.disabled = true;
    this.estado('Motor corriendo…');
    try {
      const pedir = async (ruta: string, init?: RequestInit) => {
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
        await new Promise((r) => setTimeout(r, 1000));
        e = await pedir(`/api/motor/estado/${encodeURIComponent(id)}`);
        this.estado(`Motor corriendo… ${Math.round((Date.now() - t0) / 1000)} s`);
      }
      if (e.estado !== 'ok') throw new Error(String(e.error ?? 'el motor no terminó'));
      const res = await cargarResultado(`${URL_PUENTE}/api/motor/archivo/${encodeURIComponent(id)}/`, `resultados/${perfil}/${objetivo}.json`);
      this.callbacks.alRecalcular(res);
      this.estado(`Recalculado en ${e.duracion_s} s: ${res.candidatos.length} candidatos (no publicado).`);
    } catch (err) {
      this.estado(`No se pudo recalcular: ${redactarSecretos(err instanceof Error ? err.message : err)}`);
    } finally {
      boton.disabled = false;
    }
  }
}
