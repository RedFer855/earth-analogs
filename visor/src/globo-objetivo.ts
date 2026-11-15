import * as Cesium from 'cesium';
import type { Sitio } from './datos/contrato';

const URL_MOON_TREK =
  'https://trek.nasa.gov/tiles/Moon/EQ/LRO_WAC_Mosaic_Global_303ppd_v02/1.0.0/default/default028mm/{TileMatrix}/{TileRow}/{TileCol}.jpg';
const URL_MARS_TREK =
  'https://trek.nasa.gov/tiles/Mars/EQ/Mars_MGS_MOLA_ClrShade_merge_global_463m/1.0.0/default/default028mm/{TileMatrix}/{TileRow}/{TileCol}.jpg';

export class GloboObjetivo {
  private contenedor: HTMLElement;
  private viewer: Cesium.Viewer | null = null;
  private cuerpoActual: string | null = null;

  constructor(contenedor: HTMLElement) {
    this.contenedor = contenedor;
  }

  mostrarSitio(sitio: Sitio): void {
    const cuerpo = sitio.cuerpo === 'luna' ? 'luna' : 'marte';
    if (!this.viewer || this.cuerpoActual !== cuerpo) {
      this.destruir();
      this.cuerpoActual = cuerpo;
      const elipsoide = cuerpo === 'luna' ? Cesium.Ellipsoid.MOON : Cesium.Ellipsoid.MARS;
      const url = cuerpo === 'luna' ? URL_MOON_TREK : URL_MARS_TREK;
      const credito =
        cuerpo === 'luna'
          ? 'NASA Moon Trek (LRO WAC Global 303ppd)'
          : 'NASA Mars Trek (MGS MOLA Shade 463m)';

      const proveedor = new Cesium.UrlTemplateImageryProvider({
        url,
        tilingScheme: new Cesium.GeographicTilingScheme({ ellipsoid: elipsoide }),
        maximumLevel: 7,
        credit: new Cesium.Credit(credito),
      });

      this.viewer = new Cesium.Viewer(this.contenedor, {
        globe: new Cesium.Globe(elipsoide),
        baseLayer: new Cesium.ImageryLayer(proveedor),
        baseLayerPicker: false,
        geocoder: false,
        homeButton: false,
        sceneModePicker: false,
        navigationHelpButton: false,
        animation: false,
        timeline: false,
        fullscreenButton: false,
        infoBox: false,
        selectionIndicator: false,
        requestRenderMode: true,
        maximumRenderTimeChange: Infinity,
      });
      this.viewer.scene.globe.showGroundAtmosphere = false;
      if (this.viewer.scene.skyAtmosphere) {
        this.viewer.scene.skyAtmosphere.show = false;
      }
    }

    this.viewer.entities.removeAll();
    const elipsoide = cuerpo === 'luna' ? Cesium.Ellipsoid.MOON : Cesium.Ellipsoid.MARS;
    const pos = Cesium.Cartesian3.fromDegrees(
      sitio.centro.lon,
      sitio.centro.lat,
      0,
      elipsoide,
    );
    this.viewer.entities.add({
      name: `${sitio.id} — ${sitio.nombre}`,
      position: pos,
      point: {
        pixelSize: 11,
        color: Cesium.Color.CYAN,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
      },
      label: {
        text: `${sitio.id} (${sitio.nombre})`,
        font: 'bold 12px sans-serif',
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new Cesium.Cartesian2(0, -16),
      },
    });

    const altura = cuerpo === 'luna' ? 180_000 : 350_000;
    this.viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(
        sitio.centro.lon,
        sitio.centro.lat,
        altura,
        elipsoide,
      ),
      duration: 1.0,
    });
    this.viewer.scene.requestRender();
  }

  destruir(): void {
    if (this.viewer) {
      this.viewer.destroy();
      this.viewer = null;
      this.cuerpoActual = null;
    }
  }
}
