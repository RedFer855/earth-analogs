import * as Cesium from 'cesium';
import type { ColumnaCapas7 } from '../datos/capas7';
import { ipixAVertices } from '../datos/healpix';
import { agruparBusqueda } from '../datos/regiones';

const MAX_INSTANCIAS = 12_000;
/** Máximo de zonas (regiones de ~400 km) que marca una búsqueda multicondición. */
export const MAX_PUNTOS_BUSQUEDA = 150;
/** Latitud máxima de un vértice de polígono: ~5 km antes del polo. */
const LAT_MAX_POLIGONO = 89.95;

function colorCalor(fraccion: number, todas: boolean): Cesium.Color {
  if (todas) {
    return Cesium.Color.fromBytes(34, 211, 238, 175);
  }
  const t = Math.max(0, Math.min(1, fraccion));
  const r = Math.round(251 - t * 120);
  const g = Math.round(146 + t * 70);
  const b = Math.round(60 + t * 80);
  return Cesium.Color.fromBytes(r, g, b, 95);
}

function colorCoropletico(valor: number, p1: number, p99: number): Cesium.Color {
  const rango = p99 - p1;
  const t = rango > 0 ? Math.max(0, Math.min(1, (valor - p1) / rango)) : 0.5;
  if (t <= 0.5) {
    const u = t * 2;
    return Cesium.Color.fromBytes(
      Math.round(30 + (20 - 30) * u),
      Math.round(58 + (184 - 58) * u),
      Math.round(138 + (166 - 138) * u),
      150,
    );
  }
  const u = (t - 0.5) * 2;
  return Cesium.Color.fromBytes(
    Math.round(20 + (245 - 20) * u),
    Math.round(184 + (158 - 184) * u),
    Math.round(166 + (11 - 166) * u),
    150,
  );
}

export class CapaCapas7 {
  private viewer: Cesium.Viewer;
  private primitiva: Cesium.Primitive | null = null;
  private puntosBusqueda: Cesium.PointPrimitiveCollection | null = null;
  private cachePoligonos = new Map<number, Cesium.PolygonHierarchy>();

  constructor(viewer: Cesium.Viewer) {
    this.viewer = viewer;
  }

  /** Instancia de la celda, o null si alguna esquina no es un número: con NaN Cesium detiene el render. */
  private instancia(ipix: number, nside: number, color: Cesium.Color): Cesium.GeometryInstance | null {
    const h = this.jerarquia(ipix, nside);
    if (!h) return null;
    return new Cesium.GeometryInstance({
      geometry: new Cesium.PolygonGeometry({ polygonHierarchy: h }),
      attributes: { color: Cesium.ColorGeometryInstanceAttribute.fromColor(color) },
    });
  }

  private jerarquia(ipix: number, nside: number): Cesium.PolygonHierarchy | null {
    const cached = this.cachePoligonos.get(ipix);
    if (cached) return cached;
    const v = ipixAVertices(ipix, nside);
    if (v.some(([lat, lon]) => !Number.isFinite(lat) || !Number.isFinite(lon))) return null;
    // Un vértice exactamente en el polo rompe la proyección estereográfica de
    // PolygonGeometry ("normalized result is not a number") y detiene el render.
    const lat = (x: number): number => Math.max(-LAT_MAX_POLIGONO, Math.min(LAT_MAX_POLIGONO, x));
    const posiciones = Cesium.Cartesian3.fromDegreesArray([
      v[0][1],
      lat(v[0][0]),
      v[1][1],
      lat(v[1][0]),
      v[2][1],
      lat(v[2][0]),
      v[3][1],
      lat(v[3][0]),
    ]);
    const h = new Cesium.PolygonHierarchy(posiciones);
    this.cachePoligonos.set(ipix, h);
    return h;
  }

  mostrarBusqueda(
    ipix: Uint32Array,
    nside: number,
    conteos: Uint8Array,
    totalCondiciones: number,
    soloTodas: boolean,
  ): number {
    this.limpiar(false);
    if (totalCondiciones === 0) {
      this.viewer.scene.requestRender();
      return 0;
    }

    // Se agrupan las celdas en regiones: un punto por zona, tamaño según cuántas celdas cumplen.
    const regiones = agruparBusqueda(ipix, nside, conteos, totalCondiciones, soloTodas).slice(0, MAX_PUNTOS_BUSQUEDA);
    const maxCeldas = regiones.reduce((m, r) => Math.max(m, r.celdas), 1);
    const puntos = new Cesium.PointPrimitiveCollection();
    for (const r of regiones) {
      puntos.add({
        position: Cesium.Cartesian3.fromDegrees(r.lon, r.lat),
        pixelSize: 8 + 12 * Math.sqrt(r.celdas / maxCeldas),
        color: (r.todas > 0 ? Cesium.Color.fromCssColorString('#e879f9') : Cesium.Color.fromCssColorString('#f59e0b')).withAlpha(0.9),
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 1.5,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      });
    }
    if (regiones.length > 0) {
      this.puntosBusqueda = puntos;
      this.viewer.scene.primitives.add(puntos);
    }
    this.viewer.scene.requestRender();
    return regiones.length;
  }

  mostrarCoropletico(
    ipix: Uint32Array,
    nside: number,
    valores: Float32Array,
    colMeta: ColumnaCapas7,
  ): number {
    this.limpiar(false);
    const validos: number[] = [];
    for (let i = 0; i < valores.length; i += 1) {
      if (Number.isFinite(valores[i])) validos.push(i);
    }

    const paso = validos.length > MAX_INSTANCIAS ? Math.ceil(validos.length / MAX_INSTANCIAS) : 1;
    const instancias: Cesium.GeometryInstance[] = [];
    for (let k = 0; k < validos.length; k += paso) {
      const idx = validos[k];
      const color = colorCoropletico(valores[idx], colMeta.p1, colMeta.p99);
      const inst = this.instancia(ipix[idx], nside, color);
      if (inst) instancias.push(inst);
    }

    if (instancias.length > 0) {
      this.primitiva = new Cesium.Primitive({
        geometryInstances: instancias,
        appearance: new Cesium.PerInstanceColorAppearance({
          flat: true,
          translucent: true,
        }),
        asynchronous: false,
      });
      this.viewer.scene.primitives.add(this.primitiva);
    }
    this.viewer.scene.requestRender();
    return instancias.length;
  }

  limpiar(render = true): void {
    if (this.primitiva) {
      this.viewer.scene.primitives.remove(this.primitiva);
      this.primitiva = null;
    }
    if (this.puntosBusqueda) {
      this.viewer.scene.primitives.remove(this.puntosBusqueda);
      this.puntosBusqueda = null;
    }
    if (render) {
      this.viewer.scene.requestRender();
    }
  }
}
