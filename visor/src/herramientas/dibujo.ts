import * as Cesium from 'cesium';
import type { Coordenada } from '../datos/coordenadas';
import {
  destorcerPoligono,
  distanciaGeodesicaM,
  hayAutoInterseccion,
  normalizarLon,
} from '../datos/geometria';

export type FormaDibujo = 'cuadro' | 'circulo' | 'poligono';
export type ModoDibujo = 'navegar' | FormaDibujo;

export interface EstadoDibujo {
  modo: ModoDibujo;
  vertices: number;
  cruza: boolean;
}

const COLOR_TRAZO = Cesium.Color.fromCssColorString('#38bdf8');
const COLOR_RELLENO = Cesium.Color.fromCssColorString('#38bdf8').withAlpha(0.2);

export class DibujoTerritorio {
  private readonly handler: Cesium.ScreenSpaceEventHandler;
  private modo: ModoDibujo = 'navegar';
  private vertices: Coordenada[] = [];
  private cursor: Coordenada | null = null;
  private entidadesPreview: Cesium.Entity[] = [];

  constructor(
    private readonly viewer: Cesium.Viewer,
    private readonly alCompletar: (coords: Coordenada[], forma: FormaDibujo) => void,
    private readonly alCambiarEstado: (estado: EstadoDibujo) => void,
  ) {
    this.handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    this.registrarEventos();
  }

  establecerModo(nuevoModo: ModoDibujo): void {
    this.limpiarPreview();
    this.vertices = [];
    this.cursor = null;
    this.modo = nuevoModo;
    this.viewer.scene.canvas.style.cursor = nuevoModo === 'navegar' ? '' : 'crosshair';
    this.notificar();
  }

  deshacerPunto(): void {
    if (this.vertices.length === 0) return;
    this.vertices.pop();
    this.actualizarPreview();
    this.notificar();
  }

  cancelar(): void {
    this.establecerModo('navegar');
  }

  terminar(): void {
    if (this.modo === 'poligono' && this.vertices.length >= 3) {
      const limpias = hayAutoInterseccion(this.vertices)
        ? destorcerPoligono(this.vertices)
        : this.vertices.map((c) => ({ ...c }));
      this.establecerModo('navegar');
      this.alCompletar(limpias, 'poligono');
    }
  }

  destruir(): void {
    this.limpiarPreview();
    this.handler.destroy();
  }

  private registrarEventos(): void {
    this.handler.setInputAction((mov: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
      if (this.modo === 'navegar') return;
      const coord = this.picarCoord(mov.position);
      if (!coord) return;

      if (this.modo === 'cuadro') {
        if (this.vertices.length === 0) {
          this.vertices.push(coord);
          this.actualizarPreview();
          this.notificar();
        } else {
          const p0 = this.vertices[0];
          const cuadro = this.construirCuadro(p0, coord);
          this.establecerModo('navegar');
          this.alCompletar(cuadro, 'cuadro');
        }
        return;
      }

      if (this.modo === 'circulo') {
        if (this.vertices.length === 0) {
          this.vertices.push(coord);
          this.actualizarPreview();
          this.notificar();
        } else {
          const circulo = this.construirCirculo(this.vertices[0], coord);
          this.establecerModo('navegar');
          this.alCompletar(circulo, 'circulo');
        }
        return;
      }

      if (this.modo === 'poligono') {
        this.vertices.push(coord);
        this.actualizarPreview();
        this.notificar();
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    this.handler.setInputAction((mov: Cesium.ScreenSpaceEventHandler.MotionEvent) => {
      if (this.modo === 'navegar' || this.vertices.length === 0) return;
      const coord = this.picarCoord(mov.endPosition);
      if (!coord) return;
      this.cursor = coord;
      this.actualizarPreview();
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    this.handler.setInputAction(() => {
      if (this.modo === 'poligono' && this.vertices.length >= 3) {
        this.terminar();
      }
    }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
  }

  private picarCoord(pos: Cesium.Cartesian2): Coordenada | null {
    const rayo = this.viewer.camera.getPickRay(pos);
    const punto = rayo ? this.viewer.scene.globe.pick(rayo, this.viewer.scene) : undefined;
    const cartesiano =
      punto ?? this.viewer.camera.pickEllipsoid(pos, this.viewer.scene.globe.ellipsoid);
    if (!cartesiano) return null;
    const carto = Cesium.Cartographic.fromCartesian(cartesiano);
    return {
      lat: Cesium.Math.toDegrees(carto.latitude),
      lon: normalizarLon(Cesium.Math.toDegrees(carto.longitude)),
    };
  }

  private construirCuadro(a: Coordenada, b: Coordenada): Coordenada[] {
    return [
      { lat: a.lat, lon: a.lon },
      { lat: a.lat, lon: b.lon },
      { lat: b.lat, lon: b.lon },
      { lat: b.lat, lon: a.lon },
    ];
  }

  private construirCirculo(centro: Coordenada, borde: Coordenada, segmentos = 48): Coordenada[] {
    const radioM = Math.max(50, distanciaGeodesicaM(centro, borde));
    const cosLat = Math.max(0.05, Math.cos(Cesium.Math.toRadians(centro.lat)));
    const rad = Math.PI / 180;
    const radioTierra = 6_371_008.8;
    const pts: Coordenada[] = [];
    for (let i = 0; i < segmentos; i += 1) {
      const ang = (i / segmentos) * 2 * Math.PI;
      const dLat = (radioM * Math.sin(ang)) / radioTierra / rad;
      const dLon = (radioM * Math.cos(ang)) / (radioTierra * cosLat) / rad;
      pts.push({ lat: centro.lat + dLat, lon: normalizarLon(centro.lon + dLon) });
    }
    return pts;
  }

  private limpiarPreview(): void {
    if (this.viewer.isDestroyed()) return;
    for (const ent of this.entidadesPreview) {
      this.viewer.entities.remove(ent);
    }
    this.entidadesPreview = [];
    this.viewer.scene.requestRender();
  }

  private actualizarPreview(): void {
    this.limpiarPreview();
    if (this.vertices.length === 0) return;

    for (const v of this.vertices) {
      this.entidadesPreview.push(
        this.viewer.entities.add({
          position: Cesium.Cartesian3.fromDegrees(v.lon, v.lat),
          point: {
            pixelSize: 7,
            color: COLOR_TRAZO,
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: 1.5,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
        }),
      );
    }

    let ptsPreview: Coordenada[] = [];
    if (this.modo === 'cuadro' && this.cursor) {
      ptsPreview = this.construirCuadro(this.vertices[0], this.cursor);
    } else if (this.modo === 'circulo' && this.cursor) {
      ptsPreview = this.construirCirculo(this.vertices[0], this.cursor);
    } else if (this.modo === 'poligono') {
      ptsPreview = this.cursor ? [...this.vertices, this.cursor] : [...this.vertices];
    }

    if (ptsPreview.length >= 2) {
      const grados = ptsPreview.flatMap((p) => [p.lon, p.lat]);
      if (ptsPreview.length >= 3) {
        this.entidadesPreview.push(
          this.viewer.entities.add({
            polygon: {
              hierarchy: Cesium.Cartesian3.fromDegreesArray(grados),
              material: COLOR_RELLENO,
              outline: true,
              outlineColor: COLOR_TRAZO,
            },
          }),
        );
      } else {
        this.entidadesPreview.push(
          this.viewer.entities.add({
            polyline: {
              positions: Cesium.Cartesian3.fromDegreesArray(grados),
              width: 2,
              material: COLOR_TRAZO,
              clampToGround: true,
            },
          }),
        );
      }
    }

    this.viewer.scene.requestRender();
  }

  private notificar(): void {
    this.alCambiarEstado({
      modo: this.modo,
      vertices: this.vertices.length,
      cruza: this.modo === 'poligono' && hayAutoInterseccion(this.vertices),
    });
  }
}
