---
title: "Portales de descarga de datos de la Luna, Marte y la Tierra"
type: referencia
status: vigente
date: 2026-11-03
updated: 2026-11-13
summary: "Dónde y cómo se baja un recorte de cada cuerpo (Moon Trek, Mars Trek, PDS, USGS STAC, AWS, AppEEARS, OPeNDAP, JAXA, PANGAEA) y qué cuenta pide cada portal."
autor: fernando
consultado: 2026-11-13
vence: 2027-02-01
fuentes:
  - url: https://trek.nasa.gov/moon/
    nivel: O
    fecha: 2026-11-04
  - url: https://trek.nasa.gov/mars/
    nivel: O
    fecha: 2026-11-04
  - url: https://stac.astrogeology.usgs.gov/docs/data/mars/ctxdtms/
    nivel: O
    fecha: 2026-11-04
  - url: https://registry.opendata.aws/copernicus-dem/
    nivel: O
    fecha: 2026-11-04
  - url: https://www.spaceappschallenge.org/2026/challenges/permanent-moon-base-locations-and-mars/?tab=resources
    nivel: O
    fecha: 2026-11-13
  - url: https://www.gportal.jaxa.jp/
    nivel: O
    fecha: 2026-11-13
  - url: https://www.eorc.jaxa.jp/ALOS/en/dataset/fnf_e.htm
    nivel: O
    fecha: 2026-11-13
  - url: https://doi.org/10.1038/s41597-022-01189-6
    nivel: O
    fecha: 2026-11-13
  - url: https://researchdata.tuwien.ac.at/records/n2d1v-gqb91
    nivel: O
    fecha: 2026-11-13
---

# Portales de descarga de datos de la Luna, Marte y la Tierra

## El dato

| Portal | Cuerpo | Cómo se recorta | Cuenta |
| :-- | :-- | :-- | :-- |
| [NASA Moon Trek](https://trek.nasa.gov/moon/) y [Mars Trek](https://trek.nasa.gov/mars/) | Luna, Marte | Teselas WMTS de cada capa; mallas STL/OBJ para impresión 3D; perfiles en CSV | Recorte a NetCDF con cuenta y malla de 400 × 400 px reportado (sin verificar en la documentación) |
| PDS Geosciences Node e `imbrium.mit.edu` | Luna, Marte | Teselas por latitud (LOLA 15° × 30°), ODE por búsqueda espacial | Sin cuenta |
| [PGDA de GSFC](https://pgda.gsfc.nasa.gov/products/78) | Luna | Sitios del polo sur ya recortados (5 m) y COG de iluminación por HTTP Range | Sin cuenta |
| [USGS Astrogeology STAC](https://stac.astrogeology.usgs.gov/api) | Marte, Luna | Consulta por *bbox*; COG de HiRISE y CTX, VRT de GDAL sobre S3 | Sin cuenta |
| AWS S3 `copernicus-dem-30m` / `-90m` | Tierra | COG con `/vsicurl/` o `aws s3 --no-sign-request` | Sin cuenta |
| Copernicus Data Space | Tierra | Copernicus DEM y Sentinel-2 (JRC GSW se baja de `global-surface-water.appspot.com`, FTP o CloudFerro como producto de EC JRC, no de ESA) | Registro gratuito |
| [JAXA G-Portal](https://www.gportal.jaxa.jp/) y [ALOS@EORC](https://www.eorc.jaxa.jp/ALOS/en/dataset/fnf_e.htm) | Tierra | *G-Portal*: `GCOM-C`, `GCOM-W`, `GSMaP` y `ALOS` (no redistribuye MODIS). *ALOS@EORC*: mosaico global PALSAR-2/PALSAR `25 m` | Registro gratuito; EORC prohíbe redistribuir los archivos tal cual |
| [OpenTopography](https://opentopography.org) | Tierra | API de recorte, hasta 5000 km² por trabajo | API key gratuita |
| AppEEARS y Earthdata Search | Tierra | Recorte reproyectado a GeoTIFF/NetCDF o serie por coordenada | Earthdata Login |
| OPeNDAP de GES DISC | Tierra | Variables, fechas y área de MERRA-2 en el servidor | Earthdata Login + autorizar GES DISC |
| Harmony | Tierra | SMAP por *bbox* o shapefile a NetCDF4 | Earthdata Login |
| NASA POWER API | Tierra | Serie por coordenada (JSON, CSV, NetCDF) | Sin cuenta |
| PANGAEA, Figshare, Zenodo, NSIDC FTP, TU Wien | Tierra | Archivo completo y recorte local con GDAL (incluye *S1GBM* en TU Wien y coherencia *Sentinel-1* de Kellndorfer en AWS/ASF) | Sin cuenta |
| Pestaña *Resources* de Space Apps | Todos | 11 enlaces curados a portales generales (5 NASA, 3 CSA, 2 ESA, 1 JAXA); sin dataset pre-armado ni lista cerrada de sitios | Publicada el 2026-11-13; acceso público |

## Relaciones

- [[sensores-luna]], [[sensores-marte]], [[sensores-tierra]] — portales por cuerpo
