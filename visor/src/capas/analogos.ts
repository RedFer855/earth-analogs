// Análogos documentados de la Tierra (etl/sitios/analogos-tierra.json, investigación I-03): un punto azul y el
// círculo de su escala aproximada. Clic: abre su ficha.
import * as Cesium from 'cesium';
import type { AnalogoTierra } from '../datos/analogos';

export const COLOR_HALLADO = '#3b82f6';

export class CapaAnalogos {
  private fuente = new Cesium.CustomDataSource('analogos');
  private porEntidad = new Map<Cesium.Entity, AnalogoTierra>();
  private manejador: Cesium.ScreenSpaceEventHandler;
  private alElegir: ((a: AnalogoTierra) => void) | null = null;

  constructor(private readonly viewer: Cesium.Viewer) {
    void viewer.dataSources.add(this.fuente);
    this.manejador = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    this.manejador.setInputAction((mov: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
      const pick = this.viewer.scene.pick(mov.position);
      if (!Cesium.defined(pick) || !(pick.id instanceof Cesium.Entity)) return;
      const a = this.porEntidad.get(pick.id);
      if (a) this.alElegir?.(a);
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
  }

  definirAlElegir(cb: (a: AnalogoTierra) => void): void {
    this.alElegir = cb;
  }

  cargar(lista: AnalogoTierra[]): void {
    this.fuente.entities.removeAll();
    this.porEntidad.clear();
    const azul = Cesium.Color.fromCssColorString(COLOR_HALLADO);
    for (const a of lista) {
      const e = this.fuente.entities.add({
        position: Cesium.Cartesian3.fromDegrees(a.lon, a.lat),
        point: { pixelSize: 10, color: azul, outlineColor: Cesium.Color.WHITE, outlineWidth: 2 },
        ellipse: {
          semiMajorAxis: a.radio_km * 1000,
          semiMinorAxis: a.radio_km * 1000,
          material: azul.withAlpha(0.12),
          outline: true,
          outlineColor: azul.withAlpha(0.8),
          height: 0,
        },
        label: {
          text: a.nombre,
          font: '12px system-ui, sans-serif',
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 3,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cesium.Cartesian2(0, -16),
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 3_000_000),
        },
      });
      this.porEntidad.set(e, a);
    }
    this.viewer.scene.requestRender();
  }

  visible(v: boolean): void {
    this.fuente.show = v;
    this.viewer.scene.requestRender();
  }
}
