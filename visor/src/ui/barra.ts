import * as Cesium from 'cesium';
import { type Coordenada, formatearAlturaM, parsearCoordenadas } from '../datos/coordenadas';
import {
  areaEsfericaM2,
  construirCirculoPorPerimetro,
  construirCuadroPorPerimetro,
  perimetroEsfericoM,
} from '../datos/geometria';
import { ajustarZoom, alternarVista3D, obtenerAlturaCamaraM } from '../globo';
import {
  DibujoTerritorio,
  type EstadoDibujo,
  type FormaDibujo,
  type ModoDibujo,
} from '../herramientas/dibujo';

const ALTURA_SALTO_COORD_M = 12_000;

export class BarraNavegacion {
  private readonly raiz: HTMLElement;
  private readonly barra: HTMLElement;
  private readonly pildora: HTMLButtonElement;
  private readonly resumenEl: HTMLElement;
  private readonly inputCoord: HTMLInputElement;
  private readonly selectFormaPin: HTMLSelectElement;
  private readonly inputPerimetroKm: HTMLInputElement;
  private readonly btnQuitarPin: HTMLButtonElement;
  private readonly btnTerminar: HTMLButtonElement;
  private readonly btnDeshacer: HTMLButtonElement;
  private readonly btnCancelar: HTMLButtonElement;
  private readonly badgeAltura: HTMLElement;
  private readonly btn3D: HTMLButtonElement;
  private readonly dibujo: DibujoTerritorio;
  private readonly botonesModo = new Map<ModoDibujo, HTMLButtonElement>();
  private readonly btnMarcar: HTMLButtonElement;
  private manejadorMarcar: Cesium.ScreenSpaceEventHandler | null = null;
  private marcador: Cesium.Entity | null = null;
  private zonaMedida: Cesium.Entity | null = null;

  constructor(
    contenedor: HTMLElement,
    private readonly viewer: Cesium.Viewer,
    private readonly alCompletarZona?: (coords: Coordenada[], forma: FormaDibujo) => void,
    private readonly alGuardarPin?: (coord: Coordenada) => void,
  ) {
    this.raiz = document.createElement('div');
    this.raiz.className = 'barra-nav-contenedor';

    this.pildora = document.createElement('button');
    this.pildora.type = 'button';
    this.pildora.className = 'btn-mini barra-nav-pildora oculto';
    this.pildora.textContent = 'Navegación y Dibujo';
    this.pildora.title = 'Mostrar barra de herramientas';

    this.barra = document.createElement('div');
    this.barra.className = 'barra-nav';
    this.barra.innerHTML = `
      <div class="barra-nav-grupo">
        <button type="button" class="btn-mini activo" data-modo="navegar" title="Explorar globo">Navegar</button>
        <button type="button" class="btn-mini" data-modo="cuadro" title="Dibujar cuadro (2 clics)">Cuadro</button>
        <button type="button" class="btn-mini" data-modo="circulo" title="Dibujar círculo (centro y borde)">Círculo</button>
        <button type="button" class="btn-mini" data-modo="poligono" title="Dibujar polígono (doble clic para cerrar)">Polígono</button>
        <button type="button" class="btn-mini btn-ir oculto" data-accion="terminar">Terminar</button>
        <button type="button" class="btn-mini oculto" data-accion="deshacer" title="Deshacer último punto">Deshacer</button>
        <button type="button" class="btn-mini oculto" data-accion="cancelar" title="Cancelar dibujo (Esc)">Cancelar</button>
      </div>
      <span class="barra-sep" aria-hidden="true"></span>
      <div class="barra-nav-grupo">
        <button type="button" class="btn-mini" data-accion="marcar-pin" aria-pressed="false" title="Haz clic en el globo para marcar una coordenada">Marcar Pin</button>
        <input
          type="text"
          class="input-coord"
          data-coord-input
          placeholder="Lat, Lon (ej. 14.05, -87.25)"
          aria-label="Ir a coordenadas Lat, Lon"
        />
        <button type="button" class="btn-mini btn-ir" data-accion="ir">Ir</button>
        <button type="button" class="btn-mini" data-accion="guardar-pin" title="Guardar la coordenada como pin en el catálogo">Guardar Pin</button>
        <button type="button" class="btn-mini oculto" data-accion="quitar-pin" title="Quitar marcador temporal">×</button>
        <select class="select-coro select-mini" data-pin-forma aria-label="Forma de medición">
          <option value="cuadro">Cuadro</option>
          <option value="circulo">Círculo</option>
        </select>
        <input type="number" class="input-km" data-pin-km min="0.5" max="2000" step="0.5" value="16" title="Perímetro en km" aria-label="Perímetro en km" />
        <span class="km-unidad">km</span>
        <button type="button" class="btn-mini" data-accion="medir-pin" title="Trazar y medir zona alrededor de coordenadas o centro actual">Medir</button>
      </div>
      <span class="barra-sep" aria-hidden="true"></span>
      <div class="barra-nav-grupo">
        <button type="button" class="btn-mini" data-accion="zoom-in" title="Acercar (+50%)">+</button>
        <button type="button" class="btn-mini" data-accion="zoom-out" title="Alejar (-50%)">−</button>
        <span class="altura-badge" data-altura title="Altura de cámara">—</span>
        <button type="button" class="btn-mini" data-accion="vista-3d" aria-pressed="false" title="Alternar vista 3D / 2D">2D</button>
      </div>
      <span class="barra-sep" aria-hidden="true"></span>
      <button type="button" class="btn-mini" data-accion="minimizar" title="Ocultar barra">Ocultar</button>
    `;

    this.resumenEl = document.createElement('div');
    this.resumenEl.className = 'barra-medida-resumen oculto';

    this.raiz.appendChild(this.pildora);
    this.raiz.appendChild(this.barra);
    this.raiz.appendChild(this.resumenEl);
    contenedor.appendChild(this.raiz);

    this.inputCoord = this.barra.querySelector<HTMLInputElement>('[data-coord-input]')!;
    this.selectFormaPin = this.barra.querySelector<HTMLSelectElement>('[data-pin-forma]')!;
    this.inputPerimetroKm = this.barra.querySelector<HTMLInputElement>('[data-pin-km]')!;
    this.btnQuitarPin = this.barra.querySelector<HTMLButtonElement>('[data-accion="quitar-pin"]')!;
    this.btnTerminar = this.barra.querySelector<HTMLButtonElement>('[data-accion="terminar"]')!;
    this.btnDeshacer = this.barra.querySelector<HTMLButtonElement>('[data-accion="deshacer"]')!;
    this.btnCancelar = this.barra.querySelector<HTMLButtonElement>('[data-accion="cancelar"]')!;
    this.badgeAltura = this.barra.querySelector<HTMLElement>('[data-altura]')!;
    this.btn3D = this.barra.querySelector<HTMLButtonElement>('[data-accion="vista-3d"]')!;
    this.btnMarcar = this.barra.querySelector<HTMLButtonElement>('[data-accion="marcar-pin"]')!;

    for (const btn of this.barra.querySelectorAll<HTMLButtonElement>('[data-modo]')) {
      const modo = btn.dataset.modo as ModoDibujo;
      this.botonesModo.set(modo, btn);
      btn.addEventListener('click', () => {
        this.detenerMarcado();
        this.dibujo.establecerModo(modo);
      });
    }

    this.dibujo = new DibujoTerritorio(
      this.viewer,
      (coords, forma) => this.mostrarZonaMedida(coords, forma),
      (estado) => this.actualizarEstadoDibujo(estado),
    );

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
    this.btnMarcar.addEventListener('click', () => {
      if (this.manejadorMarcar) this.detenerMarcado();
      else this.iniciarMarcado();
    });
    this.barra.querySelector('[data-accion="guardar-pin"]')?.addEventListener('click', () => {
      this.guardarPin();
    });
    this.barra.querySelector('[data-accion="medir-pin"]')?.addEventListener('click', () => {
      this.medirAlrededorDePin();
    });
    this.btnTerminar.addEventListener('click', () => this.dibujo.terminar());
    this.btnDeshacer.addEventListener('click', () => this.dibujo.deshacerPunto());
    this.btnCancelar.addEventListener('click', () => this.dibujo.cancelar());

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

    window.addEventListener('keydown', (ev) => {
      if (ev.target instanceof HTMLInputElement || ev.target instanceof HTMLTextAreaElement) return;
      if (ev.key === 'Escape') this.dibujo.cancelar();
      if (ev.key === 'Backspace') this.dibujo.deshacerPunto();
    });

    this.viewer.camera.percentageChanged = 0.02;
    this.viewer.camera.changed.addEventListener(() => this.actualizarAltura());
    this.viewer.camera.moveEnd.addEventListener(() => this.actualizarAltura());
  }

  private actualizarEstadoDibujo(estado: EstadoDibujo): void {
    for (const [modo, btn] of this.botonesModo) {
      btn.classList.toggle('activo', modo === estado.modo);
    }
    const dibujando = estado.modo !== 'navegar';
    this.btnCancelar.classList.toggle('oculto', !dibujando);
    this.btnDeshacer.classList.toggle('oculto', !(estado.modo === 'poligono' && estado.vertices > 0));
    this.btnTerminar.classList.toggle('oculto', !(estado.modo === 'poligono' && estado.vertices >= 3));
  }

  private medirAlrededorDePin(): void {
    let centro = parsearCoordenadas(this.inputCoord.value);
    if (!centro) {
      const carto = this.viewer.camera.positionCartographic;
      centro = {
        lat: Cesium.Math.toDegrees(carto.latitude),
        lon: Cesium.Math.toDegrees(carto.longitude),
      };
    }
    this.medirEn(centro);
  }

  /** Traza el cuadro o círculo de la barra alrededor de una coordenada (lo usa el catálogo). */
  medirEn(centro: Coordenada): void {
    const perimKm = Number(this.inputPerimetroKm.value);
    if (!Number.isFinite(perimKm) || perimKm <= 0) return;
    const forma = this.selectFormaPin.value === 'circulo' ? 'circulo' : 'cuadro';
    const coords =
      forma === 'circulo'
        ? construirCirculoPorPerimetro(centro, perimKm)
        : construirCuadroPorPerimetro(centro, perimKm);
    this.mostrarZonaMedida(coords, forma);
  }

  private iniciarMarcado(): void {
    this.dibujo.establecerModo('navegar');
    this.manejadorMarcar = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);
    this.manejadorMarcar.setInputAction((mov: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
      const punto = this.viewer.camera.pickEllipsoid(mov.position, this.viewer.scene.globe.ellipsoid);
      if (!punto) return;
      const c = Cesium.Cartographic.fromCartesian(punto);
      const coord = { lat: Cesium.Math.toDegrees(c.latitude), lon: Cesium.Math.toDegrees(c.longitude) };
      this.inputCoord.value = `${coord.lat.toFixed(5)}, ${coord.lon.toFixed(5)}`;
      this.inputCoord.removeAttribute('aria-invalid');
      this.ponerMarcador(coord, false);
      this.detenerMarcado();
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    this.btnMarcar.classList.add('activo');
    this.btnMarcar.setAttribute('aria-pressed', 'true');
    this.viewer.scene.canvas.style.cursor = 'crosshair';
  }

  private detenerMarcado(): void {
    if (this.manejadorMarcar && !this.manejadorMarcar.isDestroyed()) this.manejadorMarcar.destroy();
    this.manejadorMarcar = null;
    this.btnMarcar.classList.remove('activo');
    this.btnMarcar.setAttribute('aria-pressed', 'false');
    if (!this.viewer.isDestroyed()) this.viewer.scene.canvas.style.cursor = '';
  }

  private guardarPin(): void {
    const coord = parsearCoordenadas(this.inputCoord.value);
    if (!coord) {
      this.inputCoord.setAttribute('aria-invalid', 'true');
      this.inputCoord.focus();
      return;
    }
    this.alGuardarPin?.(coord);
    this.limpiarMarcador();
    this.inputCoord.value = '';
  }

  private mostrarZonaMedida(coords: Coordenada[], forma: FormaDibujo): void {
    this.limpiarZonaMedida();
    const grados = coords.flatMap((c) => [c.lon, c.lat]);
    this.zonaMedida = this.viewer.entities.add({
      polygon: {
        hierarchy: Cesium.Cartesian3.fromDegreesArray(grados),
        material: Cesium.Color.fromCssColorString('#f97316').withAlpha(0.18),
        outline: true,
        outlineColor: Cesium.Color.fromCssColorString('#f97316'),
      },
    });
    this.viewer.scene.requestRender();

    const areaM2 = areaEsfericaM2(coords);
    const perimM = perimetroEsfericoM(coords);
    const areaKm2 = areaM2 / 1_000_000;
    const areaHa = areaM2 / 10_000;
    const perimKm = perimM / 1000;
    const areaTxt = areaKm2 >= 1 ? `${areaKm2.toFixed(2)} km²` : `${areaHa.toFixed(1)} ha`;

    this.resumenEl.innerHTML = `
      <span>Zona (${forma}): <strong>${areaTxt}</strong> · Perímetro <strong>${perimKm.toFixed(2)} km</strong></span>
      <button type="button" class="btn-mini" data-accion="limpiar-zona">Limpiar</button>
    `;
    this.resumenEl.classList.remove('oculto');
    this.resumenEl.querySelector('[data-accion="limpiar-zona"]')?.addEventListener('click', () => {
      this.limpiarZonaMedida();
    });

    this.alCompletarZona?.(coords, forma);
  }

  private limpiarZonaMedida(): void {
    if (this.zonaMedida && !this.viewer.isDestroyed()) {
      this.viewer.entities.remove(this.zonaMedida);
      this.viewer.scene.requestRender();
    }
    this.zonaMedida = null;
    this.resumenEl.classList.add('oculto');
    this.resumenEl.innerHTML = '';
  }

  private irACoord(): void {
    const coord = parsearCoordenadas(this.inputCoord.value);
    if (!coord) {
      this.inputCoord.setAttribute('aria-invalid', 'true');
      return;
    }
    this.ponerMarcador(coord, true);
  }

  private ponerMarcador(coord: Coordenada, volar: boolean): void {
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

    if (volar) {
      this.viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(coord.lon, coord.lat, ALTURA_SALTO_COORD_M),
        duration: 1.0,
      });
    }
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
