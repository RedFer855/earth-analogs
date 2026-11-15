import * as Cesium from 'cesium';
import { formatearAlturaM, parsearCoordenadas } from '../datos/coordenadas';
import { ajustarZoom, alternarVista3D, obtenerAlturaCamaraM } from '../globo';

const ALTURA_SALTO_COORD_M = 12_000;

export class BarraNavegacion {
  private readonly raiz: HTMLElement;
  private readonly barra: HTMLElement;
  private readonly pildora: HTMLButtonElement;
  private readonly inputCoord: HTMLInputElement;
  private readonly btnQuitarPin: HTMLButtonElement;
  private readonly badgeAltura: HTMLElement;
  private readonly btn3D: HTMLButtonElement;
  private marcador: Cesium.Entity | null = null;

  constructor(contenedor: HTMLElement, private readonly viewer: Cesium.Viewer) {
    this.raiz = document.createElement('div');
    this.raiz.className = 'barra-nav-contenedor';

    this.pildora = document.createElement('button');
    this.pildora.type = 'button';
    this.pildora.className = 'btn-mini barra-nav-pildora oculto';
    this.pildora.textContent = 'Navegación';
    this.pildora.title = 'Mostrar barra de navegación y coordenadas';

    this.barra = document.createElement('div');
    this.barra.className = 'barra-nav';
    this.barra.innerHTML = `
      <div class="barra-nav-grupo">
        <input
          type="text"
          class="input-coord"
          data-coord-input
          placeholder="Lat, Lon (ej. 14.05, -87.25)"
          aria-label="Ir a coordenadas Lat, Lon"
          title="Pega coordenadas tipo Google Maps: Latitud, Longitud"
        />
        <button type="button" class="btn-mini btn-ir" data-accion="ir">Ir</button>
        <button type="button" class="btn-mini oculto" data-accion="quitar-pin" title="Quitar marcador temporal">×</button>
      </div>
      <span class="barra-sep" aria-hidden="true"></span>
      <div class="barra-nav-grupo">
        <button type="button" class="btn-mini" data-accion="zoom-in" title="Acercar (+50%)">+</button>
        <button type="button" class="btn-mini" data-accion="zoom-out" title="Alejar (-50%)">−</button>
        <span class="altura-badge" data-altura title="Altura de cámara sobre suelo/elipsoide">—</span>
        <button type="button" class="btn-mini" data-accion="vista-3d" aria-pressed="false" title="Alternar vista 3D inclinada / 2D cenital">2D</button>
      </div>
      <span class="barra-sep" aria-hidden="true"></span>
      <button type="button" class="btn-mini" data-accion="minimizar" title="Ocultar barra">Ocultar</button>
    `;

    this.raiz.appendChild(this.pildora);
    this.raiz.appendChild(this.barra);
    contenedor.appendChild(this.raiz);

    this.inputCoord = this.barra.querySelector<HTMLInputElement>('[data-coord-input]')!;
    this.btnQuitarPin = this.barra.querySelector<HTMLButtonElement>('[data-accion="quitar-pin"]')!;
    this.badgeAltura = this.barra.querySelector<HTMLElement>('[data-altura]')!;
    this.btn3D = this.barra.querySelector<HTMLButtonElement>('[data-accion="vista-3d"]')!;

    this.enlazarEventos();
    this.actualizarAltura();
  }

  private enlazarEventos(): void {
    this.barra.querySelector('[data-accion="ir"]')?.addEventListener('click', () => this.irACoord());
    this.inputCoord.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        this.irACoord();
      }
    });
    this.inputCoord.addEventListener('input', () => {
      this.inputCoord.removeAttribute('aria-invalid');
    });

    this.btnQuitarPin.addEventListener('click', () => this.limpiarMarcador());
    this.barra.querySelector('[data-accion="zoom-in"]')?.addEventListener('click', () => {
      ajustarZoom(this.viewer, 0.5);
    });
    this.barra.querySelector('[data-accion="zoom-out"]')?.addEventListener('click', () => {
      ajustarZoom(this.viewer, 2.0);
    });

    this.btn3D.addEventListener('click', () => {
      const en3D = alternarVista3D(this.viewer);
      this.btn3D.setAttribute('aria-pressed', String(en3D));
      this.btn3D.textContent = en3D ? '3D' : '2D';
      this.btn3D.classList.toggle('activo', en3D);
    });

    this.barra.querySelector('[data-accion="minimizar"]')?.addEventListener('click', () => {
      this.barra.classList.add('oculto');
      this.pildora.classList.remove('oculto');
    });
    this.pildora.addEventListener('click', () => {
      this.pildora.classList.add('oculto');
      this.barra.classList.remove('oculto');
    });

    this.viewer.camera.percentageChanged = 0.02;
    this.viewer.camera.changed.addEventListener(() => this.actualizarAltura());
    this.viewer.camera.moveEnd.addEventListener(() => this.actualizarAltura());
  }

  private irACoord(): void {
    const coord = parsearCoordenadas(this.inputCoord.value);
    if (!coord) {
      this.inputCoord.setAttribute('aria-invalid', 'true');
      return;
    }

    this.limpiarMarcador();
    this.marcador = this.viewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(coord.lon, coord.lat),
      point: {
        pixelSize: 10,
        color: Cesium.Color.fromCssColorString('#38bdf8'),
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      label: {
        text: `${coord.lat.toFixed(4)}, ${coord.lon.toFixed(4)}`,
        font: '11px system-ui, sans-serif',
        fillColor: Cesium.Color.WHITE,
        showBackground: true,
        backgroundColor: Cesium.Color.fromCssColorString('rgba(15, 23, 42, 0.85)'),
        pixelOffset: new Cesium.Cartesian2(0, -16),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });
    this.btnQuitarPin.classList.remove('oculto');

    this.viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(coord.lon, coord.lat, ALTURA_SALTO_COORD_M),
      duration: 1.0,
    });
    this.viewer.scene.requestRender();
  }

  private limpiarMarcador(): void {
    if (this.marcador && !this.viewer.isDestroyed()) {
      this.viewer.entities.remove(this.marcador);
      this.viewer.scene.requestRender();
    }
    this.marcador = null;
    this.btnQuitarPin.classList.add('oculto');
  }

  private actualizarAltura(): void {
    const h = obtenerAlturaCamaraM(this.viewer);
    this.badgeAltura.textContent = formatearAlturaM(h);
  }
}
