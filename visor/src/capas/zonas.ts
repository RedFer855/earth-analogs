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
  private readonly sinRelleno = new Set<string>();
  private readonly oyentes = new Set<() => void>();

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

  /** Avisa cuando la lista o los datos de una zona cambian (para que el catálogo se repinte). */
  alCambiar(cb: () => void): void {
    this.oyentes.add(cb);
  }

  private notificar(): void {
    for (const cb of this.oyentes) cb();
  }

  obtener(id: string): ZonaGuardada | undefined {
    return this.zonas.find((z) => z.id === id);
  }

  rellenoDeZona(id: string): boolean {
    return this.rellenoVisible && !this.sinRelleno.has(id);
  }

  alternarRellenoZona(id: string): void {
    if (this.sinRelleno.has(id)) this.sinRelleno.delete(id);
    else this.sinRelleno.add(id);
    this.redibujar(id);
    this.notificar();
  }

  actualizar(
    id: string,
    cambios: Partial<Pick<ZonaGuardada, 'nombre' | 'color' | 'cuerpo' | 'objetivo' | 'objetivoNombre' | 'notas'>>,
  ): void {
    const zona = this.obtener(id);
    if (!zona) return;
    for (const [k, v] of Object.entries(cambios)) {
      if (v === undefined) delete (zona as unknown as Record<string, unknown>)[k];
      else (zona as unknown as Record<string, unknown>)[k] = v;
    }
    this.guardar();
    if (cambios.color !== undefined) this.redibujar(id);
    this.notificar();
  }

  /** Suma zonas ya creadas (por ejemplo, importadas) al principio de la lista. */
  agregarVarias(zonas: ZonaGuardada[]): void {
    if (zonas.length === 0) return;
    this.zonas.unshift(...zonas);
    this.guardar();
    for (const z of zonas) this.dibujarZona(z);
    this.notificar();
  }

  exportarUna(id: string): string | null {
    const zona = this.obtener(id);
    return zona ? exportarZonasAGeoJson([zona]) : null;
  }

  private redibujar(id: string): void {
    const zona = this.obtener(id);
    const previa = this.entidades.get(id);
    if (previa && !this.viewer.isDestroyed()) this.viewer.entities.remove(previa);
    this.entidades.delete(id);
    if (zona) this.dibujarZona(zona);
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
    this.notificar();
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
    this.sinRelleno.delete(id);
    this.notificar();
  }

  alternarRelleno(): boolean {
    this.rellenoVisible = !this.rellenoVisible;
    this.renderizarTodas();
    this.notificar();
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
        material: this.rellenoDeZona(zona.id) ? base.withAlpha(0.2) : Cesium.Color.TRANSPARENT,
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
