---
title: "Capas True Color abiertas de NASA GIBS y comparación con EOX 2016"
type: referencia
status: vigente
date: 2026-11-11
updated: 2026-11-11
summary: "Catálogo WMTS de NASA GIBS en EPSG:3857: VIIRS NOAA-20 y MODIS Terra True Color llegan a nivel 9 (~250 m, diarios recientes), Blue Marble llega a nivel 8 (~500 m, sin nubes) y Landsat WELD llega a nivel 12 (~30 m, año 2000, océanos negros), frente a Sentinel-2 cloudless 2016 de EOX (~10 m, nivel 14, CC BY 4.0)."
autor: guillermo
consultado: 2026-11-11
vence: 2027-02-09
fuentes:
  - url: https://nasa-gibs.github.io/gibs-api-docs/
    nivel: O
    fecha: 2026-11-11
  - url: https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/1.0.0/WMTSCapabilities.xml
    nivel: O
    fecha: 2026-11-11
  - url: https://tiles.maps.eox.at/wmts/1.0.0/WMTSCapabilities.xml
    nivel: O
    fecha: 2026-11-11
---

# Capas True Color abiertas de NASA GIBS y comparación con EOX 2016

## El dato

Inspección del XML oficial `WMTSCapabilities.xml` de NASA GIBS (EPSG:3857) y respuestas HTTP de teselas y cabeceras CORS, consultadas el 2026-11-11:

| Capa | Nivel máx. (`TileMatrixSet`) | Resolución nominal | Fecha / cobertura | CORS | Observación |
| :-- | :-- | :-- | :-- | :-- | :-- |
| `EOX s2cloudless_3857` (2016) | Nivel 14 nativo (sirve hasta 16) | ~10 m | Mosaico 2016 sin nubes | Origen reflejado | CC BY 4.0 |
| `VIIRS_NOAA20_CorrectedReflectance_TrueColor` | Nivel 9 (`GoogleMapsCompatible_Level9`) | ~250 m | Diario (`2018-01-05` a `2026-11-12`) | `*` | Con fecha `UTC - 2 días` (`2026-11-10`) da teselas globales completas con nubes reales del día (tamaños de tesela de 6 a 12 KB); con `default` del día UTC recién iniciado devuelve marcador vacío (`1,665 B`) |
| `MODIS_Terra_CorrectedReflectance_TrueColor` | Nivel 9 (`GoogleMapsCompatible_Level9`) | ~250 m | Diario (`2000-02-24` a `2026-11-12`) | `*` | Paso matutino |
| `BlueMarble_NextGeneration` | Nivel 8 (`GoogleMapsCompatible_Level8`) | ~500 m | Mosaico compuesto sin nubes | `*` | Sin nubes; menor tráfico |
| `Landsat_WELD_CorrectedReflectance_TrueColor_Global_Annual` | Nivel 12 (`GoogleMapsCompatible_Level12`) | ~30 m | Solo `1983–2000` (`default: 2000-12-01`) | `*` | Más antiguo que EOX 2016 y océanos en negro opaco JPEG (teselas de ~2 KB) |
| `HLS_S30` / `HLS_L30_Nadir_BRDF_Adjusted_Reflectance` | Nivel 12 (`GoogleMapsCompatible_Level12`) | ~30 m | Diario parcial por órbita (`2026-11-05`) | `*` | PNG transparente fuera de las franjas del día (teselas vacías de pocos cientos de bytes); no es mosaico continuo global |

## Relaciones

- [[I-39-imagen-satelital-de-la-tierra-sin-clave]] — imagen satelital de la Tierra sin clave
