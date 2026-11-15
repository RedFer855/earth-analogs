import * as Cesium from 'cesium';
import { colorNota, type Celda } from '../datos/contrato';

const ALPHA_RELLENO = Math.round(0.75 * 255);
const PREFIJO_BORDE = 'borde:';

function colorInstancia(nota: number): Cesium.Color {
  const [r, g, b] = colorNota(nota);
  return Cesium.Color.fromBytes(r, g, b, ALPHA_RELLENO);
}

export class CapaCandidatos {
  private viewer: Cesium.Viewer;
  private alElegir?: (rango: number) => void;
  private primitivaRelleno: Cesium.Primitive | null = null;
  private primitivaBordes: Cesium.Primitive | null = null;
  private celdasPorRango = new Map<number, Celda>();
  private rangoResaltado: number | null = null;
  private manejador: Cesium.ScreenSpaceEventHandler;

  constructor(viewer: Cesium.Viewer, alElegir?: (rango: number) => void) {
    this.viewer = viewer;
    this.alElegir = alElegir;
    this.manejador = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    this.manejador.setInputAction((mov: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
      const picked = this.viewer.scene.pick(mov.position);
      if (!picked || picked.id === undefined || picked.id === null) return;
      let rango: number | null = null;
      if (typeof picked.id === 'number') {
        rango = picked.id;
      } else if (typeof picked.id === 'string' && picked.id.startsWith(PREFIJO_BORDE)) {
        const parsed = Number(picked.id.slice(PREFIJO_BORDE.length));
        if (Number.isInteger(parsed)) rango = parsed;
      }
      if (rango !== null && this.celdasPorRango.has(rango)) {
        this.alElegir?.(rango);
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
  }

  definirAlElegir(cb: (rango: number) => void): void {
    this.alElegir = cb;
  }

  mostrar(candidatos: Celda[]): void {
    this.limpiar(false);
    if (candidatos.length === 0) {
      this.viewer.scene.requestRender();
      return;
    }

    const instanciasRelleno: Cesium.GeometryInstance[] = [];
    const instanciasBordes: Cesium.GeometryInstance[] = [];

    for (const c of candidatos) {
      this.celdasPorRango.set(c.rango, c);
      const posiciones = Cesium.Cartesian3.fromDegreesArray(c.vertices.flat());
      const jerarquia = new Cesium.PolygonHierarchy(posiciones);

      instanciasRelleno.push(
        new Cesium.GeometryInstance({
          id: c.rango,
          geometry: new Cesium.PolygonGeometry({
            polygonHierarchy: jerarquia,
            vertexFormat: Cesium.PerInstanceColorAppearance.VERTEX_FORMAT,
          }),
          attributes: {
            color: Cesium.ColorGeometryInstanceAttribute.fromColor(colorInstancia(c.nota)),
          },
        }),
      );

      instanciasBordes.push(
        new Cesium.GeometryInstance({
          id: `${PREFIJO_BORDE}${c.rango}`,
          geometry: new Cesium.PolygonOutlineGeometry({
            polygonHierarchy: jerarquia,
          }),
          attributes: {
            color: Cesium.ColorGeometryInstanceAttribute.fromColor(
              Cesium.Color.fromBytes(255, 255, 255, 190),
            ),
          },
        }),
      );
    }

    this.primitivaRelleno = new Cesium.Primitive({
      geometryInstances: instanciasRelleno,
      appearance: new Cesium.PerInstanceColorAppearance({
        flat: true,
        translucent: true,
      }),
      asynchronous: false,
    });

    this.primitivaBordes = new Cesium.Primitive({
      geometryInstances: instanciasBordes,
      appearance: new Cesium.PerInstanceColorAppearance({
        flat: true,
        translucent: true,
      }),
      asynchronous: false,
    });

    this.viewer.scene.primitives.add(this.primitivaRelleno);
    this.viewer.scene.primitives.add(this.primitivaBordes);
    this.viewer.scene.requestRender();
  }

  resaltar(rango: number): void {
    if (!this.primitivaRelleno) return;

    if (!this.primitivaRelleno.ready) {
      const primitiva = this.primitivaRelleno;
      const quitar = this.viewer.scene.postRender.addEventListener(() => {
        if (this.primitivaRelleno !== primitiva || !primitiva.ready) return;
        quitar();
        this.resaltar(rango);
      });
      this.viewer.scene.requestRender();
      return;
    }

    if (this.rangoResaltado !== null && this.rangoResaltado !== rango) {
      const previa = this.celdasPorRango.get(this.rangoResaltado);
      if (previa) {
        const attrsPrev = this.primitivaRelleno.getGeometryInstanceAttributes(this.rangoResaltado);
        if (attrsPrev) {
          attrsPrev.color = Cesium.ColorGeometryInstanceAttribute.toValue(colorInstancia(previa.nota));
        }
      }
    }

    const attrs = this.primitivaRelleno.getGeometryInstanceAttributes(rango);
    if (attrs) {
      attrs.color = Cesium.ColorGeometryInstanceAttribute.toValue(Cesium.Color.WHITE);
      this.rangoResaltado = rango;
    }
    this.viewer.scene.requestRender();
  }

  limpiar(render = true): void {
    if (this.primitivaRelleno) {
      this.viewer.scene.primitives.remove(this.primitivaRelleno);
      this.primitivaRelleno = null;
    }
    if (this.primitivaBordes) {
      this.viewer.scene.primitives.remove(this.primitivaBordes);
      this.primitivaBordes = null;
    }
    this.celdasPorRango.clear();
    this.rangoResaltado = null;
    if (render) {
      this.viewer.scene.requestRender();
    }
  }

  destruir(): void {
    this.limpiar(false);
    if (!this.manejador.isDestroyed()) {
      this.manejador.destroy();
    }
  }
}
