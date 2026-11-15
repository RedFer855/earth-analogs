import * as Cesium from 'cesium';

const PROBE_TIMEOUT_MS = 4000;

const EOX_2016_TEMPLATE =
  'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/{z}/{y}/{x}.jpg';
const EOX_2016_CREDIT =
  '<a href="https://s2maps.eu" target="_blank" rel="noopener">Sentinel-2 cloudless - https://s2maps.eu</a> ' +
  'by <a href="https://eox.at" target="_blank" rel="noopener">EOX IT Services GmbH</a> ' +
  '(Contains modified Copernicus Sentinel data 2016 &amp; 2017 · CC BY 4.0)';

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

async function elegirImagenBase(): Promise<Cesium.ImageryProvider> {
  const eoxProbe = EOX_2016_TEMPLATE.replace('{z}', '0').replace('{y}', '0').replace('{x}', '0');
  if (await sondearUrl(eoxProbe)) {
    return new Cesium.UrlTemplateImageryProvider({
      url: EOX_2016_TEMPLATE,
      tilingScheme: new Cesium.WebMercatorTilingScheme(),
      maximumLevel: 14,
      credit: new Cesium.Credit(EOX_2016_CREDIT, true),
    });
  }

  const gibsProbe = GIBS_BLUEMARBLE_TEMPLATE.replace('{z}', '1').replace('{y}', '0').replace('{x}', '0');
  if (await sondearUrl(gibsProbe)) {
    return new Cesium.UrlTemplateImageryProvider({
      url: GIBS_BLUEMARBLE_TEMPLATE,
      tilingScheme: new Cesium.WebMercatorTilingScheme(),
      maximumLevel: 8,
      credit: new Cesium.Credit(GIBS_CREDIT, true),
    });
  }

  return Cesium.TileMapServiceImageryProvider.fromUrl(
    Cesium.buildModuleUrl('Assets/Textures/NaturalEarthII'),
  );
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
