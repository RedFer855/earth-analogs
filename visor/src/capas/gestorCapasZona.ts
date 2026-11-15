import * as Cesium from 'cesium';
import { requestRenderBurst, type ZonaCapas } from './utilCapas';
import type { ZoneLayerResult, ZoneSubLayerId } from '../types/capasZona';
import { loadGeologyLithologyLayer } from './proveedores/geologia';
import { loadHydrologyLayer, loadNdviLayer } from './proveedores/hidrologiaNdvi';
import { loadRadiationPowerLayer } from './proveedores/radiacion';
import { loadDustGibsLayer, loadSoilGridsLayer } from './proveedores/suelosPolvo';

export class ZoneLayerManager {
  private readonly viewer: Cesium.Viewer;
  private activeLayer: Cesium.ImageryLayer | null = null;
  private activeAlpha = 0.78;
  private activeRequestController: AbortController | null = null;
  private readonly resultCache = new Map<string, ZoneLayerResult>();

  constructor(viewer: Cesium.Viewer) {
    this.viewer = viewer;
  }

  public getAlpha(): number {
    return this.activeAlpha;
  }

  public setAlpha(alpha: number): void {
    this.activeAlpha = Math.max(0, Math.min(1, alpha));
    if (this.activeLayer) {
      this.activeLayer.alpha = this.activeAlpha;
      this.viewer.scene.requestRender();
      requestRenderBurst(this.viewer, 800);
    }
  }

  public clearOverlay(): void {
    if (this.activeRequestController) {
      this.activeRequestController.abort();
      this.activeRequestController = null;
    }
    if (this.activeLayer) {
      this.viewer.imageryLayers.remove(this.activeLayer, true);
      this.activeLayer = null;
      this.viewer.scene.requestRender();
      requestRenderBurst(this.viewer, 800);
    }
  }

  public async activateLayer(
    zone: ZonaCapas,
    subLayerId: ZoneSubLayerId
  ): Promise<ZoneLayerResult | null> {
    if (this.activeRequestController) {
      this.activeRequestController.abort();
    }
    const controller = new AbortController();
    this.activeRequestController = controller;

    const cacheKey = `${zone.id}|${subLayerId}|${zone.coordinates.length}`;
    let result = this.resultCache.get(cacheKey);

    if (!result) {
      try {
        result = await this.fetchSubLayer(zone, subLayerId, controller.signal);
        if (controller.signal.aborted) return null;
        if (result.available) {
          this.resultCache.set(cacheKey, result);
        }
      } catch (err) {
        if (controller.signal.aborted) return null;
        throw err;
      }
    }

    if (controller.signal.aborted) return null;

    // Reemplaza la capa anterior en el globo manteniendo intacto el mapa base
    if (this.activeLayer) {
      this.viewer.imageryLayers.remove(this.activeLayer, true);
      this.activeLayer = null;
    }

    if (result.available && result.canvas) {
      const dataUrl = result.canvas.toDataURL('image/png');
      const rectangle = Cesium.Rectangle.fromDegrees(
        result.bounds.west,
        result.bounds.south,
        result.bounds.east,
        result.bounds.north
      );
      const provider = await Cesium.SingleTileImageryProvider.fromUrl(dataUrl, {
        rectangle,
        credit: result.creditText ? new Cesium.Credit(result.creditText, false) : undefined,
      });

      if (controller.signal.aborted) return null;

      this.activeLayer = this.viewer.imageryLayers.addImageryProvider(provider);
      this.activeLayer.alpha = this.activeAlpha;
      requestRenderBurst(this.viewer, 2500);
    }

    this.viewer.scene.requestRender();
    return result;
  }

  private async fetchSubLayer(
    zone: ZonaCapas,
    subLayerId: ZoneSubLayerId,
    signal: AbortSignal
  ): Promise<ZoneLayerResult> {
    switch (subLayerId) {
      case 'geology-lithology':
        return loadGeologyLithologyLayer(zone, signal);
      case 'soil-texture':
      case 'soil-sand':
      case 'soil-clay':
        return loadSoilGridsLayer(zone, subLayerId, signal);
      case 'soil-dust-gibs':
        return loadDustGibsLayer(zone, signal);
      case 'radiation-solar':
      case 'radiation-uv':
        return loadRadiationPowerLayer(zone, subLayerId, signal);
      case 'hydrology-surface':
      case 'hydrology-seasonality':
        return loadHydrologyLayer(zone, subLayerId, signal);
      case 'ndvi-modis':
        return loadNdviLayer(zone, signal);
    }
  }
}
