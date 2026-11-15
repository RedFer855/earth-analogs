import 'cesium/Build/Cesium/Widgets/widgets.css';
import './style.css';
import * as Cesium from 'cesium';
import { CapaCandidatos } from './capas/candidatos';
import { CapaPines } from './capas/pines';
import {
  cargarCorrelacion,
  cargarIndice,
  cargarPuntos,
  cargarResultado,
  escaparHtml,
  type Celda,
  type ResultadoJson,
  type Sitio,
} from './datos/contrato';
import { crearGlobo } from './globo';
import { FichaCandidato } from './ui/ficha';
import { PanelLateral } from './ui/panel';

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
  let sitioActualId: string | null = null;
  let solicitudId = 0;

  const capa = new CapaCandidatos(viewer);
  const capaPines = new CapaPines(viewer);
  let panel: PanelLateral;

  const ficha = new FichaCandidato(
    ui,
    (candidato) => {
      capa.resaltar(candidato.rango);
      volarA(viewer, candidato.centro.lat, candidato.centro.lon);
    },
    () => {
      actualizarUrl(sitioActualId, null);
      panel.marcarCandidato(null);
    },
    (lat, lon) => volarA(viewer, lat, lon),
  );

  capaPines.definirAlElegir((punto) => {
    panel.marcarCandidato(null);
    ficha.mostrarPin(punto);
    const [lon, lat] = punto.geometry.coordinates;
    volarA(viewer, lat, lon);
  });

  const seleccionarCandidato = (rango: number, volar = true): void => {
    if (!resultadoActual) return;
    const candidato: Celda | undefined = resultadoActual.candidatos.find((c) => c.rango === rango);
    if (!candidato) return;
    capa.resaltar(rango);
    panel.marcarCandidato(rango);
    ficha.mostrar(candidato, resultadoActual, indice);
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
    sitioActualId = sitio.id;
    resultadoActual = null;
    capa.limpiar();
    ficha.ocultar();
    panel.establecerSitio(sitio.id, sitio.cuerpo);
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
      panel.mostrarCandidatos(res.candidatos);

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

  panel = new PanelLateral(ui, indice, {
    alElegirSitio: (sitio) => {
      void seleccionarSitio(sitio, null);
    },
    alElegirCandidato: (rango) => seleccionarCandidato(rango, true),
    alCambiarPines: (visibles) => capaPines.definirVisibles(visibles),
  });

  void cargarPuntos(BASE_DATOS).then((geojson) => {
    if (!geojson) return;
    const conteos = capaPines.cargar(geojson);
    panel.configurarPines(conteos);
  });

  void cargarCorrelacion(BASE_DATOS).then((corr) => {
    if (corr) panel.configurarCorrelacion(corr);
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
