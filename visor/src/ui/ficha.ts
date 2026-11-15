import {
  escaparHtml,
  objetivoDe,
  pareceHielo,
  type Celda,
  type CuerpoJson,
  type Indice,
  type Origen,
  type ResultadoJson,
  type VariableCat,
} from '../datos/contrato';

function formatoNum(v: number | null | undefined, decimales = 2): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return 'Sin dato';
  return v.toFixed(decimales);
}

function formatoPresion(pa: number): string {
  if (pa < 0.01) return `${pa.toExponential(1)} Pa`;
  return `${pa.toLocaleString('es-ES')} Pa`;
}

function urlSegura(url: string | null): string | null {
  if (!url) return null;
  if (url.startsWith('https://') || url.startsWith('http://')) return url;
  return null;
}

function claseEtiqueta(etiqueta: string): { clase: string; texto: string } {
  if (etiqueta === 'coincide') return { clase: 'badge-coincide', texto: 'Coincide' };
  if (etiqueta === 'difiere') return { clase: 'badge-difiere', texto: 'Difiere' };
  return { clase: 'badge-sin-dato', texto: 'Sin dato' };
}

export class FichaCandidato {
  private raiz: HTMLElement;
  private alVerEnGlobo: (candidato: Celda) => void;
  private alCerrar: () => void;
  private candidatoActual: Celda | null = null;

  constructor(
    contenedor: HTMLElement,
    alVerEnGlobo: (candidato: Celda) => void,
    alCerrar: () => void,
  ) {
    this.alVerEnGlobo = alVerEnGlobo;
    this.alCerrar = alCerrar;

    this.raiz = document.createElement('aside');
    this.raiz.className = 'panel panel-der oculto';
    contenedor.appendChild(this.raiz);

    this.raiz.addEventListener('click', (ev) => {
      const target = ev.target as HTMLElement | null;
      if (!target) return;

      if (target.closest('[data-accion="ver-globo"]') && this.candidatoActual) {
        ev.preventDefault();
        this.alVerEnGlobo(this.candidatoActual);
        return;
      }

      if (target.closest('[data-accion="cerrar"]')) {
        this.ocultar();
        this.alCerrar();
      }
    });
  }

  ocultar(): void {
    this.candidatoActual = null;
    this.raiz.classList.add('oculto');
    this.raiz.innerHTML = '';
  }

  mostrar(candidato: Celda, resultado: ResultadoJson, indice: Indice): void {
    this.candidatoActual = candidato;
    this.raiz.classList.remove('oculto');

    const varsPorId = new Map<string, VariableCat>();
    for (const v of indice.variables) {
      varsPorId.set(v.id, v);
    }

    const sitioInfo = indice.sitios_objetivo.find((s) => s.id === resultado.sitio);
    const cuerpoId = sitioInfo?.cuerpo ?? 'marte';
    const cuerpoObjetivo: CuerpoJson | undefined = indice.cuerpos[cuerpoId];
    const tierra: CuerpoJson | undefined = indice.cuerpos.tierra;

    const filasVariables = resultado.parametros.variables
      .map((vp) => {
        const meta = varsPorId.get(vp.id);
        const nombre = meta?.nombre ?? vp.id;
        const unidad = meta?.unidad ? ` (${meta.unidad})` : '';
        const celdaVar = candidato.variables[vp.id];
        const obj = objetivoDe(resultado, vp.id);
        const badge = claseEtiqueta(celdaVar?.etiqueta ?? 'sin_dato');

        return `<tr>
          <td>${escaparHtml(nombre)}<span class="unidad">${escaparHtml(unidad)}</span></td>
          <td class="num">${escaparHtml(formatoNum(celdaVar?.valor))}</td>
          <td class="num">${escaparHtml(formatoNum(obj))}</td>
          <td class="num">${escaparHtml(formatoNum(celdaVar?.diferencia))}</td>
          <td><span class="badge ${badge.clase}">${badge.texto}</span></td>
        </tr>`;
      })
      .join('');

    const faltan = candidato.cobertura.faltan;
    const textoFaltan =
      faltan.length > 0
        ? `Faltan: ${faltan.map((id) => escaparHtml(varsPorId.get(id)?.nombre ?? id)).join(', ')}`
        : 'Todas las variables del perfil tienen dato.';

    const diagEntries = Object.entries(candidato.diagnostico ?? {});
    const bloqueDiagnostico =
      diagEntries.length > 0
        ? `<section class="bloque">
            <h2>Temperatura (no puntúa)</h2>
            <p class="nota-explicativa">La atmósfera de la Tierra amortigua la temperatura: este rango no se alcanza en la Tierra, por eso se informa pero no se usa para puntuar.</p>
            <table>
              <thead><tr><th>Variable</th><th class="num">Tierra</th><th class="num">Objetivo</th><th class="num">Dif.</th></tr></thead>
              <tbody>
                ${diagEntries
                  .map(([id, d]) => {
                    const meta = varsPorId.get(id);
                    const nombre = meta?.nombre ?? id;
                    const unidad = meta?.unidad ? ` (${meta.unidad})` : '';
                    return `<tr>
                      <td>${escaparHtml(nombre)}<span class="unidad">${escaparHtml(unidad)}</span></td>
                      <td class="num">${escaparHtml(formatoNum(d.valor))}</td>
                      <td class="num">${escaparHtml(formatoNum(d.objetivo))}</td>
                      <td class="num">${escaparHtml(formatoNum(d.diferencia))}</td>
                    </tr>`;
                  })
                  .join('')}
              </tbody>
            </table>
          </section>`
        : '';

    const bloqueCuerpos =
      tierra && cuerpoObjetivo
        ? `<section class="bloque">
            <h2>Lo que ningún dato captura</h2>
            <table>
              <thead>
                <tr><th>Factor</th><th>${escaparHtml(tierra.nombre)}</th><th>${escaparHtml(cuerpoObjetivo.nombre)}</th></tr>
              </thead>
              <tbody>
                <tr><td>Gravedad</td><td>${tierra.gravedad_ms2.toFixed(2)} m/s²</td><td>${cuerpoObjetivo.gravedad_ms2.toFixed(2)} m/s²</td></tr>
                <tr><td>Presión</td><td>${escaparHtml(formatoPresion(tierra.presion_superficie_pa))}</td><td>${escaparHtml(formatoPresion(cuerpoObjetivo.presion_superficie_pa))}</td></tr>
                <tr><td>Atmósfera</td><td>${escaparHtml(tierra.atmosfera)}</td><td>${escaparHtml(cuerpoObjetivo.atmosfera)}</td></tr>
                <tr><td>Radiación</td><td>${escaparHtml(tierra.radiacion)}</td><td>${escaparHtml(cuerpoObjetivo.radiacion)}</td></tr>
              </tbody>
            </table>
            <p class="fuentes-nssdc">
              Referencia NSSDC:
              <a href="${escaparHtml(urlSegura(tierra.fuente) ?? '#')}" target="_blank" rel="noopener">${escaparHtml(tierra.nombre)}</a> ·
              <a href="${escaparHtml(urlSegura(cuerpoObjetivo.fuente) ?? '#')}" target="_blank" rel="noopener">${escaparHtml(cuerpoObjetivo.nombre)}</a>
            </p>
          </section>`
        : '';

    const origenesUnicos = new Map<string, Origen>();
    for (const vp of resultado.parametros.variables) {
      const clave = `${vp.origen.fuente ?? ''}|${vp.origen.url ?? ''}`;
      if (!origenesUnicos.has(clave)) origenesUnicos.set(clave, vp.origen);
    }
    for (const diag of resultado.parametros.diagnostico) {
      const clave = `${diag.fuente ?? ''}|${diag.url ?? ''}`;
      if (!origenesUnicos.has(clave)) origenesUnicos.set(clave, diag);
    }

    const listaFuentes = Array.from(origenesUnicos.values())
      .map((o) => {
        const nombre = o.fuente ?? o.columna;
        const href = urlSegura(o.url);
        const enlace = href
          ? `<a href="${escaparHtml(href)}" target="_blank" rel="noopener">${escaparHtml(nombre)}</a>`
          : escaparHtml(nombre);
        const lic = o.licencia ? ` <span class="licencia">(${escaparHtml(o.licencia)})</span>` : '';
        return `<li>${enlace}${lic}</li>`;
      })
      .join('');

    const avisoHielo = pareceHielo(candidato.centro.lat, candidato.centro.lon)
      ? `<p class="aviso-hielo">Puede caer sobre hielo: el filtro de vegetación no lo distingue.</p>`
      : '';

    this.raiz.innerHTML = `
      <header class="ficha-cabecera">
        <div>
          <div class="ficha-titulo">
            <span class="rango-grande">#${candidato.rango}</span>
            <span class="nota-grande">${(candidato.nota * 100).toFixed(1)}%</span>
          </div>
          <div class="ficha-meta">
            <span>${candidato.centro.lat.toFixed(3)}, ${candidato.centro.lon.toFixed(3)}</span>
            <a href="#" class="accion-link" data-accion="ver-globo">Ver en el globo</a>
          </div>
        </div>
        <button type="button" class="btn-cerrar" data-accion="cerrar" aria-label="Cerrar ficha">×</button>
      </header>
      ${avisoHielo}
      <section class="bloque">
        <h2>En qué coincide y en qué difiere</h2>
        <table>
          <thead>
            <tr><th>Variable</th><th class="num">Tierra</th><th class="num">Objetivo</th><th class="num">Dif.</th><th>Estado</th></tr>
          </thead>
          <tbody>${filasVariables}</tbody>
        </table>
      </section>
      <section class="bloque">
        <h2>Cobertura</h2>
        <p>${candidato.cobertura.usadas} / ${candidato.cobertura.total} variables usadas. ${textoFaltan}</p>
      </section>
      ${bloqueDiagnostico}
      ${bloqueCuerpos}
      <section class="bloque">
        <h2>Fuentes</h2>
        <ul class="lista-fuentes">${listaFuentes}</ul>
      </section>
    `;
  }
}
