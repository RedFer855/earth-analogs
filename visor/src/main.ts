import 'cesium/Build/Cesium/Widgets/widgets.css';
import './style.css';
import * as Cesium from 'cesium';
import { CapaCandidatos } from './capas/candidatos';
import { CapaAnalogos } from './capas/analogos';
import { CapaCapas7 } from './capas/capas7';
import { CapaOverlaysZona } from './capas/overlaysZona';
import { CapaPines } from './capas/pines';
import { CapaPinesUsuario } from './capas/pinesUsuario';
import { ZoneLayerManager } from './capas/gestorCapasZona';
import { CapaZonas } from './capas/zonas';
import {
  cargarCapas7,
  evaluarCondiciones,
  obtenerColumnaCapas7,
} from './datos/capas7';
import { cargarAnalogos, type AnalogoTierra } from './datos/analogos';
import {
  cargarEstabilidad,
  cargarIndice,
  cargarPuntos,
  cargarResultado,
  escaparHtml,
  type Celda,
  type EstabilidadJson,
  type ResultadoJson,
  type Sitio,
} from './datos/contrato';
import { cambiarMapaBase, crearGlobo, type TipoMapaBase } from './globo';
import { GloboObjetivo } from './globo-objetivo';
import { BarraNavegacion } from './ui/barra';
import { PanelBusqueda } from './ui/busqueda';
import { PanelAnalogos } from './panel/panelAnalogos';
import { PanelCatalogo } from './ui/catalogo';
import { ZoneLayerPanel } from './ui/panelCapasZona';
import { PanelZona } from './ui/panelZona';
import { Asistente } from './ui/asistente';

const BASE_DATOS = 'datos/';
const ALTURA_VUELO_M = 150_000;

function volarA(viewer: Cesium.Viewer, lat: number, lon: number, alturaM = ALTURA_VUELO_M): void {
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(lon, lat, alturaM),
    duration: 1.2,
  });
  viewer.scene.requestRender();
}

function actualizarUrl(sitioId: string | null, rango: number | null): void {
  const url = new URL(window.location.href);
  if (sitioId) {
    url.searchParams.set('sitio', sitioId);
  } else {
    url.searchParams.delete('sitio');
  }
  if (rango !== null) {
    url.searchParams.set('candidato', String(rango));
  } else {
    url.searchParams.delete('candidato');
  }
  window.history.replaceState(null, '', url.toString());
}

function mostrarErrorFatal(contenedor: HTMLElement, mensaje: string): void {
  const caja = document.createElement('div');
  caja.className = 'error-fatal';
  caja.innerHTML = `<h2>No se pudieron cargar los datos</h2><p>${escaparHtml(mensaje)}</p>`;
  contenedor.appendChild(caja);
}

async function iniciar(): Promise<void> {
  const ui = document.getElementById('ui');
  if (!ui) return;

  const [viewer, indiceRes] = await Promise.all([
    crearGlobo('globo'),
    cargarIndice(BASE_DATOS).then(
      (valor) => ({ ok: true as const, valor }),
      (err: unknown) => ({ ok: false as const, err }),
    ),
  ]);

  if (!indiceRes.ok) {
    const msg =
      indiceRes.err instanceof Error ? indiceRes.err.message : 'Error desconocido al leer el índice.';
    mostrarErrorFatal(ui, msg);
    return;
  }
  const indice = indiceRes.valor;

  let resultadoActual: ResultadoJson | null = null;
  let sitioActual: Sitio | null = null;
  let sitioActualId: string | null = null;
  let solicitudId = 0;
  let estabilidad: EstabilidadJson | null = null;

  void cargarEstabilidad(BASE_DATOS).then((est) => {
    estabilidad = est;
    if (est && resultadoActual) panel.establecerResultado(resultadoActual, est);
  });

  const barra = document.createElement('div');
  barra.className = 'barra-estado';
  barra.innerHTML = `<span class="fps-badge" data-fps>-- FPS</span>
    <select class="select-coro" data-mapa-base aria-label="Mapa base">
      <option value="sentinel2-eox" selected>EOX 2025 · 10 m</option>
      <option value="gibs-bluemarble">GIBS Marble · 500 m</option>
      <option value="naturalearth">NaturalEarth · Offline</option>
    </select>
    <button type="button" class="btn-mini" data-accion="toggle-objetivo" disabled>Ver objetivo (Luna/Marte)</button>`;
  ui.appendChild(barra);

  barra.querySelector<HTMLSelectElement>('[data-mapa-base]')?.addEventListener('change', (ev) => {
    const sel = ev.target as HTMLSelectElement;
    void cambiarMapaBase(viewer, sel.value as TipoMapaBase);
  });

  const panelObj = document.createElement('div');
  panelObj.className = 'panel-objetivo oculto';
  panelObj.innerHTML = `<div class="panel-objetivo-cab">
      <span data-obj-titulo>Objetivo</span>
      <button type="button" class="btn-cerrar" data-accion="cerrar-objetivo" aria-label="Cerrar globo objetivo">×</button>
    </div>
    <div class="globo-objetivo-lienzo"></div>`;
  ui.appendChild(panelObj);

  const lienzoObj = panelObj.querySelector<HTMLElement>('.globo-objetivo-lienzo')!;
  const globoObj = new GloboObjetivo(lienzoObj);
  let objVisible = false;

  const btnObj = barra.querySelector<HTMLButtonElement>('[data-accion="toggle-objetivo"]')!;
  const actualizarGloboObj = (): void => {
    if (!objVisible || !sitioActual) return;
    const tit = panelObj.querySelector<HTMLElement>('[data-obj-titulo]');
    if (tit) tit.textContent = `${sitioActual.id} · ${sitioActual.nombre}`;
    globoObj.mostrarSitio(sitioActual);
  };

  btnObj.addEventListener('click', () => {
    objVisible = !objVisible;
    panelObj.classList.toggle('oculto', !objVisible);
    btnObj.textContent = objVisible ? 'Ocultar objetivo' : 'Ver objetivo (Luna/Marte)';
    if (objVisible) actualizarGloboObj();
  });
  panelObj.querySelector('[data-accion="cerrar-objetivo"]')?.addEventListener('click', () => {
    objVisible = false;
    panelObj.classList.add('oculto');
    btnObj.textContent = 'Ver objetivo (Luna/Marte)';
  });

  const fpsEl = barra.querySelector<HTMLElement>('[data-fps]')!;
  let frames = 0;
  let ultimoT = performance.now();
  const medirFps = (ahora: number): void => {
    frames += 1;
    if (ahora - ultimoT >= 500) {
      const fps = Math.round((frames * 1000) / (ahora - ultimoT));
      fpsEl.textContent = `${fps} FPS`;
      frames = 0;
      ultimoT = ahora;
    }
    requestAnimationFrame(medirFps);
  };
  requestAnimationFrame(medirFps);

  const capa = new CapaCandidatos(viewer);
  const capaPines = new CapaPines(viewer);
  const capaAnalogos = new CapaAnalogos(viewer);
  const capaZonas = new CapaZonas(viewer);
  const overlaysZona = new CapaOverlaysZona(viewer);
  let panel: PanelAnalogos;
  let seleccionarCandidato: (rango: number, volar?: boolean) => void = () => {};
  const panelZona = new PanelZona(ui, BASE_DATOS, capaZonas, overlaysZona, (rango) => {
    seleccionarCandidato(rango, true);
  });
  const capaPinesUsuario = new CapaPinesUsuario(viewer);
  const panelCapas = new ZoneLayerPanel(ui, new ZoneLayerManager(viewer));
  const catalogo = new PanelCatalogo(ui, capaZonas, capaPinesUsuario, indice.sitios_objetivo, {
    medirEn: (coord) => barraNav.medirEn(coord),
    abrirCapas: (z) => panelCapas.openForZone({ id: z.id, name: z.nombre, coordinates: z.coords }),
    alBorrarZona: (id) => panelCapas.handleZoneDeleted(id),
  });
  const barraNav = new BarraNavegacion(
    ui,
    viewer,
    (coords, forma) => {
      panelZona.mostrarAnalisis(coords, forma);
    },
    (coord) => {
      capaPinesUsuario.agregar(coord);
      catalogo.mostrarPestana('pines');
    },
  );

  let asistente: Asistente;
  let resultadoEsNuevo = false;
  const seleccionarAnalogo = (a: AnalogoTierra): void => {
    panel.seleccionarAnalogo(a);
    asistente.establecerAnalogo(indice, resultadoActual, a);
    volarA(viewer, a.lat, a.lon, Math.max(400_000, a.radio_km * 6_000));
  };
  const mostrarResultadoNuevo = (res: ResultadoJson): void => {
    resultadoEsNuevo = true;
    resultadoActual = res;
    capa.mostrar(res.candidatos);
    panelZona.configurarCandidatos(res.candidatos);
    panel.establecerResultado(res, estabilidad, true);
    asistente.establecerContexto(indice, res, null);
    const mejor = res.candidatos[0];
    if (mejor) volarA(viewer, mejor.centro.lat, mejor.centro.lon);
  };

  panel = new PanelAnalogos(ui, indice, {
    alElegirSitio: (sitio) => {
      void seleccionarSitio(sitio, null);
    },
    alElegirCandidato: (rango) => seleccionarCandidato(rango, true),
    alElegirAnalogo: seleccionarAnalogo,
    alIr: (lat, lon) => volarA(viewer, lat, lon, 900_000),
    alCerrarFicha: () => {
      actualizarUrl(sitioActualId, null);
      asistente.establecerContexto(indice, resultadoActual, null);
    },
    alColorear: (fn) => capa.colorear(fn),
    alVerGrupo: (g, visible) => {
      if (g === 'hallado') capaAnalogos.visible(visible);
      else if ((g === 'nuevo') === resultadoEsNuevo) capa.visible(visible);
    },
    alCambiarPines: (visibles) => capaPines.definirVisibles(visibles),
    alPreguntar: (q) => {
      const ctxAnalogo = panel.contextoAnalogo();
      if (ctxAnalogo) {
        asistente.establecerAnalogo(indice, resultadoActual, ctxAnalogo.analogo, ctxAnalogo.lecturas);
      }
      void asistente.preguntar(q);
    },
  });

  asistente = new Asistente(
    panel.contenedorChat(),
    {
      bboxVista: () => {
        const r = viewer.camera.computeViewRectangle();
        if (!r) return null;
        const g = Cesium.Math.toDegrees;
        const caja: [number, number, number, number] = [g(r.south), g(r.west), g(r.north), g(r.east)];
        return caja[2] - caja[0] > 170 ? null : caja;
      },
      alRecalcular: mostrarResultadoNuevo,
    },
    true,
  );

  capaPines.definirAlElegir((punto) => {
    panel.mostrarPin(punto);
    asistente.establecerContexto(indice, resultadoActual, null);
    const [lon, lat] = punto.geometry.coordinates;
    volarA(viewer, lat, lon);
  });

  capaAnalogos.definirAlElegir(seleccionarAnalogo);

  seleccionarCandidato = (rango: number, volar = true): void => {
    if (!resultadoActual) return;
    const candidato: Celda | undefined = resultadoActual.candidatos.find((c) => c.rango === rango);
    if (!candidato) return;
    capa.resaltar(rango);
    panel.seleccionarCandidato(rango);
    asistente.establecerContexto(indice, resultadoActual, candidato);
    actualizarUrl(sitioActualId, rango);
    if (volar) {
      volarA(viewer, candidato.centro.lat, candidato.centro.lon);
    }
  };

  capa.definirAlElegir((rango) => seleccionarCandidato(rango, true));

  const seleccionarSitio = async (
    sitio: Sitio,
    candidatoInicial: number | null = null,
  ): Promise<void> => {
    const miSolicitud = ++solicitudId;
    resultadoEsNuevo = false;
    sitioActual = sitio;
    sitioActualId = sitio.id;
    btnObj.disabled = false;
    actualizarGloboObj();
    resultadoActual = null;
    capa.limpiar();
    panel.establecerSitio(sitio.id);
    actualizarUrl(sitio.id, candidatoInicial);

    const archivo =
      sitio.archivo ??
      indice.resultados.find((r) => r.sitio === sitio.id)?.archivo ??
      null;
    if (!archivo) {
      panel.mostrarError(`No hay resultados publicados para ${sitio.id}.`);
      return;
    }

    try {
      const res = await cargarResultado(BASE_DATOS, archivo);
      if (miSolicitud !== solicitudId) return;

      resultadoActual = res;
      capa.mostrar(res.candidatos);
      panel.establecerResultado(res, estabilidad);
      panelZona.configurarCandidatos(res.candidatos);
      asistente.establecerContexto(indice, res, null);

      if (candidatoInicial !== null) {
        const existe = res.candidatos.some((c) => c.rango === candidatoInicial);
        if (existe) {
          seleccionarCandidato(candidatoInicial, true);
          return;
        }
      }

      const mejor = res.candidatos[0];
      if (mejor) {
        volarA(viewer, mejor.centro.lat, mejor.centro.lon);
      }
      actualizarUrl(sitio.id, null);
    } catch (err) {
      if (miSolicitud !== solicitudId) return;
      const msg = err instanceof Error ? err.message : 'Error al cargar el sitio.';
      panel.mostrarError(msg);
    }
  };

  void cargarPuntos(BASE_DATOS).then((geojson) => {
    if (!geojson) return;
    const conteos = capaPines.cargar(geojson);
    panel.configurarPines(conteos);
    panelZona.configurarPuntos(geojson);
  });

  void cargarAnalogos(BASE_DATOS).then((cat) => {
    if (!cat) return;
    capaAnalogos.cargar(cat.sitios);
    panel.configurarAnalogos(cat);
  });

  // Top multivariable: lugares que salen entre los candidatos de varios objetivos a la vez
  void Promise.all(
    indice.resultados.slice(0, 24).map((r) => cargarResultado(BASE_DATOS, r.archivo).catch(() => null)),
  ).then((todos) => panel.configurarTop(todos.filter((x): x is ResultadoJson => x !== null)));

  const capaCapas7 = new CapaCapas7(viewer);
  void cargarCapas7(`${BASE_DATOS}capas7/`).then((datos7) => {
    if (!datos7) return;
    panelZona.configurarDatos7(datos7);
    catalogo.configurarDatos7(datos7, BASE_DATOS);
    panel.configurarDatos7(datos7, `${BASE_DATOS}capas7/`);
    const divBusqueda = document.createElement('div');
    const panelBusqueda = new PanelBusqueda(divBusqueda, datos7, {
      alAplicarBusqueda: async (condiciones, soloTodas) => {
        if (condiciones.length === 0) {
          capaCapas7.limpiar();
          panelBusqueda.establecerEstado('');
          return;
        }
        panelBusqueda.establecerEstado('Cargando capas...');
        await Promise.all(
          condiciones.map((c) => obtenerColumnaCapas7(datos7, c.columna, `${BASE_DATOS}capas7/`)),
        );
        const res = evaluarCondiciones(datos7.meta.n_celdas, datos7.cacheColumnas, condiciones);
        const pintadas = capaCapas7.mostrarBusqueda(
          datos7.ipix,
          datos7.meta.nside,
          res.conteos,
          res.totalCondiciones,
          soloTodas,
        );
        panelBusqueda.establecerEstado(
          `${res.celdasTodas.toLocaleString('es-ES')} celdas cumplen todas; agrupadas en ${pintadas.toLocaleString('es-ES')} zonas (el punto es más grande si hay más celdas).`,
        );
      },
      alAplicarCoropletico: async (columna) => {
        if (!columna) {
          capaCapas7.limpiar();
          return;
        }
        const vals = await obtenerColumnaCapas7(datos7, columna, `${BASE_DATOS}capas7/`);
        const meta = datos7.meta.columnas[columna];
        if (meta) {
          capaCapas7.mostrarCoropletico(datos7.ipix, datos7.meta.nside, vals, meta);
        }
      },
      alElegirSitio: (sitioId) => {
        const objetivo = indice.sitios_objetivo.find((s) => s.id === sitioId);
        if (!objetivo) return;
        const resMeta = indice.resultados.find((r) => r.sitio === objetivo.id);
        void seleccionarSitio({
          ...objetivo,
          archivo: resMeta?.archivo ?? null,
          n_candidatos: resMeta?.n_candidatos ?? 0,
          mejor: resMeta?.mejor ?? null,
        });
      },
      alCargarPresetSitio: async (sitioId) => {
        const meta = indice.resultados.find((r) => r.sitio === sitioId);
        if (!meta?.archivo) return null;
        return cargarResultado(BASE_DATOS, meta.archivo);
      },
    });
    panel.configurarBusqueda(divBusqueda);
  });

  const params = new URLSearchParams(window.location.search);
  const sitioUrl = params.get('sitio')?.trim();
  const candRaw = params.get('candidato');
  const candUrl = candRaw !== null && Number.isInteger(Number(candRaw)) ? Number(candRaw) : null;

  if (sitioUrl) {
    const objetivo = indice.sitios_objetivo.find((s) => s.id === sitioUrl);
    if (objetivo) {
      const resMeta = indice.resultados.find((r) => r.sitio === objetivo.id);
      void seleccionarSitio(
        {
          ...objetivo,
          archivo: resMeta?.archivo ?? null,
          n_candidatos: resMeta?.n_candidatos ?? 0,
          mejor: resMeta?.mejor ?? null,
        },
        candUrl,
      );
    }
  }
}

void iniciar();
