import {
  escaparHtml,
  objetivoDe,
  pareceHielo,
  type Celda,
  type CuerpoJson,
  type Indice,
  type Origen,
  type PuntoFeature,
  type ResultadoJson,
  type VariableCat,
} from '../datos/contrato';
import { etiquetaTipoPunto } from '../capas/pines';

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
  private alVerPinEnGlobo?: (lat: number, lon: number) => void;
  private candidatoActual: Celda | null = null;
  private pinActual: PuntoFeature | null = null;

  constructor(
    contenedor: HTMLElement,
    alVerEnGlobo: (candidato: Celda) => void,
    alCerrar: () => void,
    alVerPinEnGlobo?: (lat: number, lon: number) => void,
  ) {
    this.alVerEnGlobo = alVerEnGlobo;
    this.alCerrar = alCerrar;
    this.alVerPinEnGlobo = alVerPinEnGlobo;

    this.raiz = document.createElement('aside');
    this.raiz.className = 'panel panel-der oculto';
    contenedor.appendChild(this.raiz);

    this.raiz.addEventListener('click', (ev) => {
      const target = ev.target as HTMLElement | null;
      if (!target) return;

      if (target.closest('[data-accion="ver-globo"]')) {
        ev.preventDefault();
        if (this.candidatoActual) {
          this.alVerEnGlobo(this.candidatoActual);
        } else if (this.pinActual && this.alVerPinEnGlobo) {
          const [lon, lat] = this.pinActual.geometry.coordinates;
          this.alVerPinEnGlobo(lat, lon);
        }
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

    const cd = candidato.cerca_de;
    const formatoKm = (v: number | null | undefined): string =>
      v === null || v === undefined || !Number.isFinite(v) ? 'Sin dato' : `${v.toFixed(1)} km`;
    const bloqueCercaDe = cd
      ? `<section class="bloque">
          <h2>Entorno cercano (no puntúa)</h2>
          <table>
            <tbody>
              <tr><td>Tubo de lava más cercano</td><td class="num">${escaparHtml(formatoKm(cd.tubo_lava_km))}</td></tr>
              <tr><td>Cráter de impacto más cercano</td><td class="num">${escaparHtml(formatoKm(cd.crater_km))}</td></tr>
              <tr><td>Salar más cercano</td><td class="num">${escaparHtml(formatoKm(cd.salar_km))}</td></tr>
            </tbody>
          </table>
        </section>`
      : '';

    this.pinActual = null;
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
      ${bloqueCercaDe}
      ${bloqueCuerpos}
      <section class="bloque">
        <h2>Fuentes</h2>
        <ul class="lista-fuentes">${listaFuentes}</ul>
      </section>
    `;
  }

  mostrarPin(punto: PuntoFeature): void {
    this.candidatoActual = null;
    this.pinActual = punto;
    this.raiz.classList.remove('oculto');

    const p = punto.properties;
    const [lon, lat] = punto.geometry.coordinates;
    const href = urlSegura(p.url ?? null);
    const enlaceFuente = href
      ? `<a href="${escaparHtml(href)}" target="_blank" rel="noopener">${escaparHtml(p.fuente)}</a>`
      : escaparHtml(p.fuente);

    const filas: string[] = [
      `<tr><td>Tipo</td><td>${escaparHtml(etiquetaTipoPunto(p.tipo))}</td></tr>`,
      `<tr><td>ID</td><td>${escaparHtml(p.id)}</td></tr>`,
    ];
    if (p.diametro_km !== null && p.diametro_km !== undefined && Number.isFinite(p.diametro_km)) {
      filas.push(`<tr><td>Diámetro</td><td>${p.diametro_km.toFixed(2)} km</td></tr>`);
    }
    if (p.confirmado !== undefined) {
      filas.push(`<tr><td>Confirmado</td><td>${p.confirmado ? 'Sí' : 'No'}</td></tr>`);
    }

    this.raiz.innerHTML = `
      <header class="ficha-cabecera">
        <div>
          <div class="ficha-titulo">
            <span class="rango-grande">${escaparHtml(p.nombre || p.id)}</span>
          </div>
          <div class="ficha-meta">
            <span>${lat.toFixed(3)}, ${lon.toFixed(3)}</span>
            <a href="#" class="accion-link" data-accion="ver-globo">Ver en el globo</a>
          </div>
        </div>
        <button type="button" class="btn-cerrar" data-accion="cerrar" aria-label="Cerrar ficha">×</button>
      </header>
      <section class="bloque">
        <h2>Detalles del sitio de referencia</h2>
        <table><tbody>${filas.join('')}</tbody></table>
      </section>
      <section class="bloque">
        <h2>Fuente y atribución</h2>
        <ul class="lista-fuentes">
          <li>${enlaceFuente} <span class="licencia">(${escaparHtml(p.licencia)})</span></li>
          <li>${escaparHtml(p.atribucion)}</li>
        </ul>
      </section>
    `;
  }
}
