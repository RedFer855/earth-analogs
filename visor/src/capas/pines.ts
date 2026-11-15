import * as Cesium from 'cesium';
import type { PuntoFeature, PuntosGeoJson, TipoPunto } from '../datos/contrato';

const COLORES_TIPO: Record<TipoPunto, Cesium.Color> = {
  tubo_lava: Cesium.Color.fromCssColorString('#f97316'),
  crater_impacto: Cesium.Color.fromCssColorString('#38bdf8'),
  playa_salar: Cesium.Color.fromCssColorString('#eab308'),
};

const ETIQUETAS_TIPO: Record<TipoPunto, string> = {
  tubo_lava: 'Tubos de lava',
  crater_impacto: 'Cráteres de impacto',
  playa_salar: 'Salares',
};

const SVG_POR_TIPO: Record<TipoPunto, string> = {
  tubo_lava:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28">' +
    '<circle cx="14" cy="14" r="12.5" fill="#1e293b" stroke="#f97316" stroke-width="2"/>' +
    '<path d="M5 20 L10 9 L14 13 L18 8 L23 20 Z" fill="#fdba74"/>' +
    '<path d="M10.5 20 C10.5 14.5 17.5 14.5 17.5 20 Z" fill="#0f172a"/>' +
    '</svg>',
  crater_impacto:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28">' +
    '<circle cx="14" cy="14" r="12.5" fill="#1e293b" stroke="#38bdf8" stroke-width="2"/>' +
    '<ellipse cx="14" cy="15" rx="8.5" ry="4.5" fill="#0f172a" stroke="#7dd3fc" stroke-width="1.8"/>' +
    '<path d="M7.5 15.5 C10 18.2 18 18.2 20.5 15.5" fill="none" stroke="#38bdf8" stroke-width="1.2"/>' +
    '</svg>',
  playa_salar:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28">' +
    '<circle cx="14" cy="14" r="12.5" fill="#1e293b" stroke="#eab308" stroke-width="2"/>' +
    '<polygon points="14,6 20,10.5 20,17.5 14,22 8,17.5 8,10.5" fill="#fde047" stroke="#fef08a" stroke-width="1.2"/>' +
    '<line x1="14" y1="6" x2="14" y2="22" stroke="#854d0e" stroke-width="1"/>' +
    '<line x1="8" y1="10.5" x2="20" y2="17.5" stroke="#854d0e" stroke-width="1"/>' +
    '<line x1="20" y1="10.5" x2="8" y2="17.5" stroke="#854d0e" stroke-width="1"/>' +
    '</svg>',
};

export function svgIconoTipo(tipo: TipoPunto): string {
  return SVG_POR_TIPO[tipo];
}

function dataUrlIconoTipo(tipo: TipoPunto): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(SVG_POR_TIPO[tipo])}`;
}

export class CapaPines {
  private viewer: Cesium.Viewer;
  private fuentes = new Map<TipoPunto, Cesium.CustomDataSource>();
  private puntosPorEntidad = new Map<Cesium.Entity, PuntoFeature>();
  private manejador: Cesium.ScreenSpaceEventHandler;
  private alElegir: ((punto: PuntoFeature) => void) | null = null;

  constructor(viewer: Cesium.Viewer) {
    this.viewer = viewer;
    this.manejador = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    this.manejador.setInputAction((mov: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
      const pick = this.viewer.scene.pick(mov.position);
      if (!Cesium.defined(pick) || !(pick.id instanceof Cesium.Entity)) return;
      const punto = this.puntosPorEntidad.get(pick.id);
      if (punto && this.alElegir) {
        this.alElegir(punto);
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
  }

  definirAlElegir(cb: (punto: PuntoFeature) => void): void {
    this.alElegir = cb;
  }

  cargar(geojson: PuntosGeoJson): Record<TipoPunto, number> {
    this.limpiar();
    const conteos: Record<TipoPunto, number> = {
      tubo_lava: 0,
      crater_impacto: 0,
      playa_salar: 0,
    };

    const tipos: TipoPunto[] = ['tubo_lava', 'crater_impacto', 'playa_salar'];
    for (const tipo of tipos) {
      const ds = new Cesium.CustomDataSource(`pines-${tipo}`);
      ds.clustering.enabled = true;
      ds.clustering.pixelRange = 28;
      ds.clustering.minimumClusterSize = 3;
      ds.clustering.clusterEvent.addEventListener((clusteredEntities, cluster) => {
        cluster.label.show = true;
        cluster.label.text = `${clusteredEntities.length}`;
        cluster.label.font = 'bold 11px sans-serif';
        cluster.label.fillColor = Cesium.Color.WHITE;
        cluster.label.outlineColor = Cesium.Color.BLACK;
        cluster.label.outlineWidth = 2;
        cluster.label.style = Cesium.LabelStyle.FILL_AND_OUTLINE;
        cluster.label.verticalOrigin = Cesium.VerticalOrigin.CENTER;
        cluster.label.horizontalOrigin = Cesium.HorizontalOrigin.CENTER;
        cluster.point.show = true;
        cluster.point.pixelSize = 18;
        cluster.point.color = COLORES_TIPO[tipo].withAlpha(0.9);
        cluster.point.outlineColor = Cesium.Color.WHITE;
        cluster.point.outlineWidth = 1.5;
      });
      this.fuentes.set(tipo, ds);
      void this.viewer.dataSources.add(ds);
    }

    for (const feat of geojson.features) {
      const tipo = feat.properties?.tipo;
      if (!tipo || !(tipo in conteos)) continue;
      const [lon, lat] = feat.geometry.coordinates;
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      const ds = this.fuentes.get(tipo);
      if (!ds) continue;

      const entidad = ds.entities.add({
        name: feat.properties.nombre || feat.properties.id,
        position: Cesium.Cartesian3.fromDegrees(lon, lat),
        billboard: {
          image: dataUrlIconoTipo(tipo),
          width: 24,
          height: 24,
          verticalOrigin: Cesium.VerticalOrigin.CENTER,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });
      this.puntosPorEntidad.set(entidad, feat);
      conteos[tipo] += 1;
    }

    this.viewer.scene.requestRender();
    return conteos;
  }

  definirVisibles(visibles: Set<TipoPunto>): void {
    for (const [tipo, ds] of this.fuentes.entries()) {
      ds.show = visibles.has(tipo);
    }
    this.viewer.scene.requestRender();
  }

  limpiar(): void {
    for (const ds of this.fuentes.values()) {
      this.viewer.dataSources.remove(ds, true);
    }
    this.fuentes.clear();
    this.puntosPorEntidad.clear();
  }

  destruir(): void {
    this.limpiar();
    if (!this.manejador.isDestroyed()) {
      this.manejador.destroy();
    }
  }
}

export function etiquetaTipoPunto(tipo: TipoPunto): string {
  return ETIQUETAS_TIPO[tipo] ?? tipo;
}
