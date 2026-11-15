import * as Cesium from 'cesium';

const PROBE_TIMEOUT_MS = 4000;
const EOX_PRIMER_ANIO = 2016;
const EOX_ULTIMO_ANIO = 2025;

export type TipoMapaBase = 'sentinel2-eox' | 'gibs-bluemarble' | 'naturalearth';

function anioEoxSolicitado(): number {
  const raw = new URLSearchParams(window.location.search).get('imagen');
  const anio = raw === null ? EOX_ULTIMO_ANIO : Number(raw);
  return Number.isInteger(anio) && anio >= EOX_PRIMER_ANIO && anio <= EOX_ULTIMO_ANIO
    ? anio
    : EOX_ULTIMO_ANIO;
}

function plantillaEox(anio: number): string {
  const capa = anio === EOX_PRIMER_ANIO ? 's2cloudless' : `s2cloudless-${anio}`;
  return `https://tiles.maps.eox.at/wmts/1.0.0/${capa}_3857/default/g/{z}/{y}/{x}.jpg`;
}

function creditoEox(anio: number): string {
  const datos = anio === EOX_PRIMER_ANIO ? '2016 &amp; 2017' : String(anio);
  return (
    '<a href="https://s2maps.eu" target="_blank" rel="noopener">Sentinel-2 cloudless - https://s2maps.eu</a> ' +
    'by <a href="https://eox.at" target="_blank" rel="noopener">EOX IT Services GmbH</a> ' +
    `(Contains modified Copernicus Sentinel data ${datos})`
  );
}

const GIBS_BLUEMARBLE_TEMPLATE =
  'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_NextGeneration/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg';
const GIBS_CREDIT =
  'Imagery provided by services from NASA\'s <a href="https://nasa-gibs.github.io/gibs-api-docs/" target="_blank" rel="noopener">Global Imagery Browse Services (GIBS)</a>, part of NASA\'s ESDIS';

interface PhotonFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    name?: string;
    city?: string;
    state?: string;
    country?: string;
    extent?: [number, number, number, number];
  };
}

async function sondearUrl(url: string, timeoutMs = PROBE_TIMEOUT_MS): Promise<boolean> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, cache: 'no-store' });
    return res.ok;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timer);
  }
}

async function intentarEox(): Promise<Cesium.ImageryProvider | null> {
  const anios = [anioEoxSolicitado(), EOX_PRIMER_ANIO].filter(
    (y, i, all) => all.indexOf(y) === i,
  );
  for (const anio of anios) {
    const plantilla = plantillaEox(anio);
    const probe = plantilla.replace('{z}', '0').replace('{y}', '0').replace('{x}', '0');
    if (await sondearUrl(probe)) {
      return new Cesium.UrlTemplateImageryProvider({
        url: plantilla,
        tilingScheme: new Cesium.WebMercatorTilingScheme(),
        maximumLevel: 14,
        credit: new Cesium.Credit(creditoEox(anio), true),
      });
    }
  }
  return null;
}

export async function construirImagenBase(tipo: TipoMapaBase): Promise<Cesium.ImageryProvider> {
  if (tipo === 'sentinel2-eox') {
    const eox = await intentarEox();
    if (eox) return eox;
  }

  if (tipo === 'gibs-bluemarble' || tipo === 'sentinel2-eox') {
    const gibsProbe = GIBS_BLUEMARBLE_TEMPLATE.replace('{z}', '1').replace('{y}', '0').replace('{x}', '0');
    if (await sondearUrl(gibsProbe)) {
      return new Cesium.UrlTemplateImageryProvider({
        url: GIBS_BLUEMARBLE_TEMPLATE,
        tilingScheme: new Cesium.WebMercatorTilingScheme(),
        maximumLevel: 8,
        credit: new Cesium.Credit(GIBS_CREDIT, true),
      });
    }
  }

  return Cesium.TileMapServiceImageryProvider.fromUrl(
    Cesium.buildModuleUrl('Assets/Textures/NaturalEarthII'),
  );
}

async function elegirImagenBase(): Promise<Cesium.ImageryProvider> {
  return construirImagenBase('sentinel2-eox');
}

export async function cambiarMapaBase(viewer: Cesium.Viewer, tipo: TipoMapaBase): Promise<void> {
  const proveedor = await construirImagenBase(tipo);
  if (viewer.isDestroyed()) return;
  viewer.imageryLayers.removeAll(true);
  viewer.imageryLayers.addImageryProvider(proveedor);
  viewer.scene.requestRender();
}

function parsearPhotonFeature(feature: PhotonFeature): Cesium.GeocoderService.Result | null {
  const coords = feature.geometry?.coordinates;
  const p = feature.properties;
  if (!p || !Array.isArray(coords) || coords.length < 2) return null;

  const lon = Number(coords[0]);
  const lat = Number(coords[1]);
  if (!Number.isFinite(lon) || !Number.isFinite(lat) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return null;
  }

  const partes = [p.name, p.city, p.state, p.country].filter(
    (parte, idx, arr): parte is string => Boolean(parte) && arr.indexOf(parte) === idx,
  );
  const displayName = partes.join(', ') || `${lat.toFixed(4)}, ${lon.toFixed(4)}`;

  if (Array.isArray(p.extent) && p.extent.length === 4 && p.extent.every(Number.isFinite)) {
    const west = Math.max(-180, Math.min(p.extent[0], p.extent[2]));
    const east = Math.min(180, Math.max(p.extent[0], p.extent[2]));
    const south = Math.max(-89.9, Math.min(p.extent[1], p.extent[3]));
    const north = Math.min(89.9, Math.max(p.extent[1], p.extent[3]));
    if (east - west >= 0.002 && north - south >= 0.002) {
      return { displayName, destination: Cesium.Rectangle.fromDegrees(west, south, east, north) };
    }
  }

  return { displayName, destination: Cesium.Cartesian3.fromDegrees(lon, lat, 15_000) };
}

function crearGeocoderPhoton(): Cesium.GeocoderService {
  return {
    credit: new Cesium.Credit(
      'Búsqueda: <a href="https://photon.komoot.io" target="_blank" rel="noopener">Photon</a> · © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
      false,
    ),
    async geocode(query: string): Promise<Cesium.GeocoderService.Result[]> {
      const limpia = query.trim();
      if (limpia.length < 2) return [];
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 5000);
      try {
        const res = await fetch(
          `https://photon.komoot.io/api/?q=${encodeURIComponent(limpia)}&limit=6`,
          { signal: controller.signal },
        );
        if (!res.ok) return [];
        const data = (await res.json()) as { features?: PhotonFeature[] };
        const resultados: Cesium.GeocoderService.Result[] = [];
        for (const f of data.features ?? []) {
          const parsed = parsearPhotonFeature(f);
          if (parsed) resultados.push(parsed);
        }
        return resultados;
      } catch {
        return [];
      } finally {
        window.clearTimeout(timer);
      }
    },
  };
}

async function configurarTerreno(viewer: Cesium.Viewer): Promise<void> {
  const token = (import.meta.env.VITE_CESIUM_ION_TOKEN as string | undefined)?.trim() ?? '';
  if (token) {
    try {
      Cesium.Ion.defaultAccessToken = token;
      viewer.terrainProvider = await Cesium.CesiumTerrainProvider.fromIonAssetId(1, {
        requestWaterMask: false,
      });
      return;
    } catch (err) {
      console.warn('No se pudo cargar Cesium World Terrain; se usará el elipsoide:', err);
    }
  }
  viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider();
}

export async function crearGlobo(id: string): Promise<Cesium.Viewer> {
  const viewer = new Cesium.Viewer(id, {
    baseLayer: false,
    animation: false,
    timeline: false,
    fullscreenButton: false,
    vrButton: false,
    infoBox: false,
    selectionIndicator: false,
    baseLayerPicker: false,
    navigationHelpButton: false,
    requestRenderMode: true,
    maximumRenderTimeChange: Infinity,
    geocoder: [new Cesium.CartographicGeocoderService(), crearGeocoderPhoton()],
  });

  const inputGeocoder = viewer.geocoder?.container.querySelector(
    '.cesium-geocoder-input',
  ) as HTMLInputElement | null;
  if (inputGeocoder) {
    inputGeocoder.placeholder = 'Buscar lugar o coordenadas...';
  }
  viewer.geocoder?.viewModel.complete.addEventListener(() => {
    viewer.scene.requestRender();
  });

  window.addEventListener('resize', () => {
    if (!viewer.isDestroyed()) {
      viewer.resize();
      viewer.scene.requestRender();
    }
  });

  const [imagen] = await Promise.all([elegirImagenBase(), configurarTerreno(viewer)]);
  viewer.imageryLayers.addImageryProvider(imagen);

  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(0, 15, 22_000_000),
  });
  viewer.scene.requestRender();

  return viewer;
}

const ALTURA_MIN_M = 200;
const ALTURA_MAX_M = 30_000_000;

/** Altura aproximada de la cámara sobre el suelo o elipsoide en metros. */
export function obtenerAlturaCamaraM(viewer: Cesium.Viewer): number {
  if (viewer.isDestroyed()) return 0;
  const carto = viewer.camera.positionCartographic;
  if (!carto) return 0;
  const elevTerreno = viewer.scene.globe.getHeight(carto);
  const base = Number.isFinite(elevTerreno) ? elevTerreno! : 0;
  return Math.max(0, Math.round(carto.height - base));
}

/** Acerca (factor < 1) o aleja (factor > 1) la cámara respetando cotas seguras. */
export function ajustarZoom(viewer: Cesium.Viewer, factor: number): void {
  if (viewer.isDestroyed() || !Number.isFinite(factor) || factor <= 0) return;
  const altura = Math.max(ALTURA_MIN_M, viewer.camera.positionCartographic.height);
  const objetivo = Math.min(ALTURA_MAX_M, Math.max(ALTURA_MIN_M, altura * factor));
  const delta = objetivo - altura;
  if (delta < 0) {
    viewer.camera.zoomIn(Math.abs(delta));
  } else if (delta > 0) {
    viewer.camera.zoomOut(delta);
  }
  viewer.scene.requestRender();
}

/**
 * Alterna entre vista cenital 2D (-90°) y vista inclinada 3D (-35°).
 * Devuelve `true` si queda en modo 3D inclinado, `false` si queda en 2D cenital.
 */
export function alternarVista3D(viewer: Cesium.Viewer): boolean {
  if (viewer.isDestroyed()) return false;
  const estaEn3D = viewer.camera.pitch > -1.1;
  const nuevoPitch = estaEn3D ? -Cesium.Math.PI_OVER_TWO : -Cesium.Math.toRadians(35);

  const canvas = viewer.scene.canvas;
  const centroPantalla = new Cesium.Cartesian2(canvas.clientWidth / 2, canvas.clientHeight / 2);
  const rayo = viewer.camera.getPickRay(centroPantalla);
  const puntoSuelo = rayo ? viewer.scene.globe.pick(rayo, viewer.scene) : undefined;

  if (puntoSuelo) {
    const rango = Cesium.Cartesian3.distance(viewer.camera.positionWC, puntoSuelo);
    viewer.camera.flyToBoundingSphere(new Cesium.BoundingSphere(puntoSuelo, 0), {
      offset: new Cesium.HeadingPitchRange(0, nuevoPitch, Math.max(ALTURA_MIN_M, rango)),
      duration: 0.6,
    });
  } else {
    const carto = viewer.camera.positionCartographic;
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromRadians(carto.longitude, carto.latitude, carto.height),
      orientation: { heading: 0, pitch: nuevoPitch, roll: 0 },
      duration: 0.6,
    });
  }

  viewer.scene.requestRender();
  return !estaEn3D;
}
