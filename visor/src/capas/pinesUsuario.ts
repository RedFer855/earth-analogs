import * as Cesium from 'cesium';
import {
  coordenadaValida,
  crearPin,
  esCategoriaPin,
  limpiarTexto,
  pinAFeature,
  type CategoriaPin,
  type PinGuardado,
} from '../datos/catalogo';
import type { Coordenada } from '../datos/coordenadas';

const CLAVE_ALMACEN = 'earth-analogs-pines-v1';
const ALTURA_VUELO_M = 60_000;

export const COLOR_PIN: Record<CategoriaPin, string> = {
  tierra: '#34d399',
  marte: '#f97316',
  luna: '#38bdf8',
};

/** Pines que el usuario guarda desde la barra (distintos de los puntos de referencia del ETL). */
export class CapaPinesUsuario {
  private pines: PinGuardado[] = [];
  private readonly entidades = new Map<string, Cesium.Entity>();
  private readonly oyentes = new Set<() => void>();

  constructor(private readonly viewer: Cesium.Viewer) {
    this.cargar();
    for (const p of this.pines) this.dibujar(p);
  }

  listar(): PinGuardado[] {
    return [...this.pines];
  }

  obtener(id: string): PinGuardado | undefined {
    return this.pines.find((p) => p.id === id);
  }

  alCambiar(cb: () => void): void {
    this.oyentes.add(cb);
  }

  agregar(coord: Coordenada, nombre?: string, categoria: CategoriaPin = 'tierra'): PinGuardado {
    const pin = crearPin(coord, nombre ?? `Pin #${this.pines.length + 1}`, categoria);
    this.pines.unshift(pin);
    this.guardar();
    this.dibujar(pin);
    this.notificar();
    return pin;
  }

  agregarVarios(pines: PinGuardado[]): void {
    if (pines.length === 0) return;
    this.pines.unshift(...pines);
    this.guardar();
    for (const p of pines) this.dibujar(p);
    this.notificar();
  }

  actualizar(id: string, cambios: Partial<Pick<PinGuardado, 'nombre' | 'categoria' | 'notas'>>): void {
    const pin = this.obtener(id);
    if (!pin) return;
    if (cambios.nombre !== undefined) pin.nombre = limpiarTexto(cambios.nombre, 80) || pin.nombre;
    if (cambios.categoria !== undefined && esCategoriaPin(cambios.categoria)) pin.categoria = cambios.categoria;
    if (cambios.notas !== undefined) pin.notas = limpiarTexto(cambios.notas, 400);
    this.guardar();
    this.redibujar(pin);
    this.notificar();
  }

  eliminar(id: string): void {
    this.pines = this.pines.filter((p) => p.id !== id);
    this.guardar();
    const ent = this.entidades.get(id);
    if (ent && !this.viewer.isDestroyed()) {
      this.viewer.entities.remove(ent);
      this.viewer.scene.requestRender();
    }
    this.entidades.delete(id);
    this.notificar();
  }

  volarA(id: string): void {
    const pin = this.obtener(id);
    if (!pin || this.viewer.isDestroyed()) return;
    this.viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(pin.lon, pin.lat, ALTURA_VUELO_M),
      duration: 1.0,
    });
    this.viewer.scene.requestRender();
  }

  exportarUno(id: string): string | null {
    const pin = this.obtener(id);
    return pin
      ? JSON.stringify({ type: 'FeatureCollection', features: [pinAFeature(pin)] }, null, 2)
      : null;
  }

  private notificar(): void {
    for (const cb of this.oyentes) cb();
  }

  private redibujar(pin: PinGuardado): void {
    const previa = this.entidades.get(pin.id);
    if (previa && !this.viewer.isDestroyed()) this.viewer.entities.remove(previa);
    this.entidades.delete(pin.id);
    this.dibujar(pin);
  }

  private dibujar(pin: PinGuardado): void {
    if (this.viewer.isDestroyed()) return;
    const color = Cesium.Color.fromCssColorString(COLOR_PIN[pin.categoria]);
    const ent = this.viewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(pin.lon, pin.lat),
      point: {
        pixelSize: 11,
        color,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      label: {
        text: pin.nombre,
        font: '11px system-ui, sans-serif',
        fillColor: Cesium.Color.WHITE,
        showBackground: true,
        backgroundColor: Cesium.Color.fromCssColorString('rgba(15, 23, 42, 0.85)'),
        pixelOffset: new Cesium.Cartesian2(0, -16),
        distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 4_000_000),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });
    this.entidades.set(pin.id, ent);
    this.viewer.scene.requestRender();
  }

  private cargar(): void {
    try {
      const raw = window.localStorage.getItem(CLAVE_ALMACEN);
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      this.pines = parsed.filter(
        (p): p is PinGuardado =>
          Boolean(
            p &&
              typeof p.id === 'string' &&
              typeof p.nombre === 'string' &&
              esCategoriaPin(p.categoria) &&
              coordenadaValida(p.lat, p.lon),
          ),
      );
    } catch {
      this.pines = [];
    }
  }

  private guardar(): void {
    try {
      window.localStorage.setItem(CLAVE_ALMACEN, JSON.stringify(this.pines));
    } catch {
      // Sin localStorage los pines viven solo mientras la página siga abierta.
    }
  }
}
