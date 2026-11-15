import {
  Cartesian2,
  Cartesian3,
  Color,
  Entity,
  ImageryLayer,
  LabelStyle,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  TileMapServiceImageryProvider,
  VerticalOrigin,
  Viewer,
  buildModuleUrl,
  defined,
} from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import type { CopilotEventBus } from '../bridge/copilotEventBus.ts';
import { VISOR_FOCUS_SITES, VISOR_SELECT_CELL, VISOR_TOUR_STEP } from '../bridge/copilotEventBus.ts';
import type { EtlCandidateCell, EtlResultFile, OperationalStatus, PinFeature, TestSiteMatch } from '../types/copilot.types.ts';

const STATUS_COLOR: Record<OperationalStatus, string> = { green: '#7fb69a', yellow: '#e3a63b', red: '#e5553b' };
const PIN_COLOR = { tubo_lava: '#c98b6b', crater_impacto: '#b8c7d6', playa_salar: '#e4dfd6' } as const;
const CELL_COLOR = '#9a9388';
const FOCUS_HEIGHT_M = 2_600_000;
const TOUR_HEIGHT_M = 900_000;

interface CellRef {
  readonly cell: EtlCandidateCell;
  readonly file: EtlResultFile;
}

/**
 * Minimal CesiumJS globe. Offline: Cesium's bundled NaturalEarthII tiles, no ion token, no network imagery.
 * Pins from `puntos.geojson` stay on the globe; matches #1..#5 are drawn on top in traffic-light colours.
 */
export class AnalogGlobe {
  private readonly viewer: Viewer;
  private readonly bus: CopilotEventBus;
  private readonly handler: ScreenSpaceEventHandler;
  private readonly cellRefs = new Map<string, CellRef>();
  private cellEntities: Entity[] = [];
  private highlightEntities: Entity[] = [];
  private readonly offBus: Array<() => void> = [];

  constructor(container: HTMLElement, bus: CopilotEventBus, pins: readonly PinFeature[]) {
    this.bus = bus;
    this.viewer = new Viewer(container, {
      baseLayer: ImageryLayer.fromProviderAsync(
        TileMapServiceImageryProvider.fromUrl(buildModuleUrl('Assets/Textures/NaturalEarthII')),
      ),
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
    });
    this.viewer.scene.globe.baseColor = Color.fromCssColorString('#1c1a18');
    this.viewer.scene.canvas.addEventListener('webglcontextlost', () => {
      console.warn('CesiumJS lost its WebGL context.');
    });

    for (const p of pins) {
      const [lon, lat] = p.geometry.coordinates;
      this.viewer.entities.add({
        position: Cartesian3.fromDegrees(lon, lat),
        point: { pixelSize: 7, color: Color.fromCssColorString(PIN_COLOR[p.properties.tipo]), outlineColor: Color.BLACK, outlineWidth: 1 },
        name: p.properties.nombre,
      });
    }

    this.handler = new ScreenSpaceEventHandler(this.viewer.scene.canvas);
    this.handler.setInputAction((click: { position: Cartesian2 }) => {
      const picked: unknown = this.viewer.scene.pick(click.position);
      if (!defined(picked)) return;
      const id = (picked as { id?: unknown }).id;
      if (!(id instanceof Entity)) return;
      const ref = this.cellRefs.get(id.id);
      if (ref === undefined) return;
      this.bus.emit(VISOR_SELECT_CELL, {
        cell: ref.cell,
        targetBody: ref.file.objetivo.cuerpo,
        targetSiteName: ref.file.objetivo.nombre,
        targetSiteCode: ref.file.objetivo.codigo,
      });
    }, ScreenSpaceEventType.LEFT_CLICK);

    this.offBus.push(
      bus.on(VISOR_FOCUS_SITES, (d) => this.focus(d.matches, d.flyToBest)),
      bus.on(VISOR_TOUR_STEP, (d) => this.flyTo(d.match, TOUR_HEIGHT_M)),
    );
  }

  /** Draws every candidate cell of the searched files as a small clickable dot. */
  showCells(files: readonly EtlResultFile[]): void {
    for (const e of this.cellEntities) this.viewer.entities.remove(e);
    this.cellEntities = [];
    this.cellRefs.clear();
    for (const file of files) {
      for (const cell of file.celdas) {
        const entity = this.viewer.entities.add({
          position: Cartesian3.fromDegrees(cell.lon, cell.lat),
          point: { pixelSize: 5, color: Color.fromCssColorString(CELL_COLOR).withAlpha(0.8) },
          name: `${file.objetivo.codigo} ipix ${cell.ipix}`,
        });
        this.cellRefs.set(entity.id, { cell, file });
        this.cellEntities.push(entity);
      }
    }
  }

  private focus(matches: readonly TestSiteMatch[], flyToBest: boolean): void {
    for (const e of this.highlightEntities) this.viewer.entities.remove(e);
    this.highlightEntities = matches.map((m) =>
      this.viewer.entities.add({
        position: Cartesian3.fromDegrees(m.lon, m.lat),
        point: {
          pixelSize: 14,
          color: Color.fromCssColorString(STATUS_COLOR[m.readiness.status]),
          outlineColor: Color.fromCssColorString('#131211'),
          outlineWidth: 2,
        },
        label: {
          text: `#${m.rank}`,
          font: '600 13px "B612 Mono", ui-monospace, monospace',
          fillColor: Color.fromCssColorString('#e4dfd6'),
          outlineColor: Color.fromCssColorString('#131211'),
          outlineWidth: 3,
          style: LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: VerticalOrigin.BOTTOM,
          pixelOffset: new Cartesian2(0, -12),
        },
      }),
    );
    const best = matches[0];
    if (flyToBest && best !== undefined) this.flyTo(best, FOCUS_HEIGHT_M);
  }

  private flyTo(m: TestSiteMatch, height: number): void {
    this.viewer.camera.flyTo({ destination: Cartesian3.fromDegrees(m.lon, m.lat, height), duration: 1.4 });
  }

  destroy(): void {
    for (const off of this.offBus) off();
    this.handler.destroy();
    this.viewer.destroy();
  }
}
