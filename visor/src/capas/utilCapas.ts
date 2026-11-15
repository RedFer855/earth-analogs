import type * as Cesium from 'cesium';

/** Coordenada en grados (la misma forma que `Coordenada` del resto del visor). */
export interface GeoCoord {
  lat: number;
  lon: number;
}

/** Lo mínimo que necesitan las capas temáticas de una zona guardada. */
export interface ZonaCapas {
  id: string;
  name: string;
  coordinates: GeoCoord[];
}

/** Pasa las longitudes a una secuencia continua: una zona que cruza 180° no salta al otro lado del mapa. */
export function unwrapLongitudes(coords: GeoCoord[]): GeoCoord[] {
  if (coords.length === 0) return [];
  const out: GeoCoord[] = [{ ...coords[0] }];
  for (let i = 1; i < coords.length; i++) {
    let lon = coords[i].lon;
    const prev = out[i - 1].lon;
    while (lon - prev > 180) lon -= 360;
    while (lon - prev < -180) lon += 360;
    out.push({ lat: coords[i].lat, lon });
  }
  return out;
}

/** Pide renders seguidos un rato: el visor renderiza bajo demanda y una capa nueva tarda en llegar. */
export function requestRenderBurst(viewer: Cesium.Viewer, durationMs = 3000): void {
  const until = performance.now() + durationMs;
  const tick = (): void => {
    if (viewer.isDestroyed()) return;
    viewer.scene.requestRender();
    if (performance.now() < until) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/** Fecha reciente (AAAA-MM-DD) para GIBS, con unos días de retraso porque el producto del día aún no existe. */
export function getGibsRecentDateIso(nowMs: number = Date.now(), lagDays: number = 2): string {
  const safeLag = Math.max(0, Math.floor(lagDays));
  return new Date(nowMs - safeLag * 86_400_000).toISOString().slice(0, 10);
}
