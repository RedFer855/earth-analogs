import * as Cesium from 'cesium';
import type { Coordenada } from '../datos/coordenadas';
import {
  centroPoligono,
  crearZonaGuardada,
  exportarZonasAGeoJson,
  type ZonaGuardada,
} from '../datos/cruceZona';
import type { FormaDibujo } from '../herramientas/dibujo';

const CLAVE_ALMACEN = 'earth-analogs-zonas-v1';

export const PALETA_ZONAS = ['#f97316', '#38bdf8', '#10b981', '#eab308', '#a855f7', '#ec4899'];

export class CapaZonas {
  private zonas: ZonaGuardada[] = [];
  private entidades = new Map<string, Cesium.Entity>();
  private rellenoVisible = true;

  constructor(private readonly viewer: Cesium.Viewer) {
    this.cargar();
    this.renderizarTodas();
  }

  listar(): ZonaGuardada[] {
    return [...this.zonas];
  }

  tieneRelleno(): boolean {
    return this.rellenoVisible;
  }

  agregar(coords: Coordenada[], forma: FormaDibujo, nombre?: string, color?: string): ZonaGuardada {
    const colorElegido = color ?? PALETA_ZONAS[this.zonas.length % PALETA_ZONAS.length];
    const zona = crearZonaGuardada(
      coords,
      forma,
      nombre ?? `Zona #${this.zonas.length + 1}`,
      colorElegido,
    );
    this.zonas.unshift(zona);
    this.guardar();
    this.dibujarZona(zona);
    return zona;
  }

  eliminar(id: string): void {
    this.zonas = this.zonas.filter((z) => z.id !== id);
    this.guardar();
    const ent = this.entidades.get(id);
    if (ent && !this.viewer.isDestroyed()) {
      this.viewer.entities.remove(ent);
      this.viewer.scene.requestRender();
    }
    this.entidades.delete(id);
  }

  alternarRelleno(): boolean {
    this.rellenoVisible = !this.rellenoVisible;
    this.renderizarTodas();
    return this.rellenoVisible;
  }

  volarAZona(id: string): void {
    const zona = this.zonas.find((z) => z.id === id);
    if (!zona || this.viewer.isDestroyed()) return;
    const c = centroPoligono(zona.coords);
    const alturaM = Math.max(5_000, Math.min(400_000, Math.sqrt(Math.max(0.1, zona.areaKm2)) * 3500));
    this.viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(c.lon, c.lat, alturaM),
      duration: 1.0,
    });
    this.viewer.scene.requestRender();
  }

  exportarGeoJson(): string {
    return exportarZonasAGeoJson(this.zonas);
  }

  private renderizarTodas(): void {
    if (this.viewer.isDestroyed()) return;
    for (const ent of this.entidades.values()) {
      this.viewer.entities.remove(ent);
    }
    this.entidades.clear();
    for (const z of this.zonas) {
      this.dibujarZona(z);
    }
    this.viewer.scene.requestRender();
  }

  private dibujarZona(zona: ZonaGuardada): void {
    if (this.viewer.isDestroyed() || zona.coords.length < 3) return;
    const base = Cesium.Color.fromCssColorString(zona.color);
    const grados = zona.coords.flatMap((c) => [c.lon, c.lat]);
    const ent = this.viewer.entities.add({
      polygon: {
        hierarchy: Cesium.Cartesian3.fromDegreesArray(grados),
        material: this.rellenoVisible ? base.withAlpha(0.2) : Cesium.Color.TRANSPARENT,
        outline: true,
        outlineColor: base,
      },
    });
    this.entidades.set(zona.id, ent);
    this.viewer.scene.requestRender();
  }

  private cargar(): void {
    try {
      const raw = window.localStorage.getItem(CLAVE_ALMACEN);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        this.zonas = parsed.filter(
          (z): z is ZonaGuardada =>
            Boolean(z && typeof z.id === 'string' && Array.isArray(z.coords) && z.coords.length >= 3),
        );
      }
    } catch {
      this.zonas = [];
    }
  }

  private guardar(): void {
    try {
      window.localStorage.setItem(CLAVE_ALMACEN, JSON.stringify(this.zonas));
    } catch {
      // Ignorar si localStorage no está disponible
    }
  }
}
