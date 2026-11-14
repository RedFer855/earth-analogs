---
title: "I-06 — Datasets de la Tierra: cómo vienen y qué preprocesamiento piden"
type: investigacion
status: vigente
date: 2026-11-04
updated: 2026-11-04
summary: "Para los datasets terrestres de NASA que cubren las ocho dimensiones de analogía del enunciado, qué producto exacto usar, en qué formato, resolución y tamaño viene, si pide cuenta de Earthdata y qué hay que hacerle antes de compararlo."
autor: fernando
tipo_investigacion: A
riesgo: critico
---

# I-06 — Datasets de la Tierra: cómo vienen y qué preprocesamiento piden

Esta investigación busca el dataset terrestre para cada una de las ocho dimensiones del enunciado oficial ([[reto-oficial-y-calendario]]) y cómo viene.

## Prompt

```
I-06 — Datasets de la Tierra: formato y preprocesamiento

IMPORTANTE: Esta es una consulta de datos puntuales. No escribas una guía general, no repitas información de contexto y no hagas recomendaciones.

OBJETIVO
Para cada dataset terrestre de la lista, ¿en qué formato, resolución y tamaño viene el producto que se usaría, cómo se obtiene un recorte o una consulta por coordenadas y qué preprocesamiento exige antes de compararlo con datos de la Luna o Marte?

CONTEXTO (solo lo que cambia la respuesta)
- Reto de NASA Space Apps 2026: "Identify Earth Locations that Analog the Permanent Moon Base Locations and Mars" (lista oficial de recursos del reto con apertura el 13 de noviembre de 2026).
- Se requieren especificaciones tanto para muestreo global (1-5 km por píxel) como para zonas de detalle (10-30 m), usando datos y herramientas gratuitas compatibles con GDAL.

YA SABEMOS (no investigar ni repetir)
- NASA POWER da temperatura y viento por coordenada en JSON o CSV.
- Portales: NASA Earthdata Search, NASA Worldview, OpenTopography, Copernicus Data Space, USGS EarthExplorer.
- El video oficial del reto nombra NASA Earthdata y Worldview como fuentes de la Tierra; indicar qué capa de Worldview corresponde a cada dataset si existe.

DATASETS (por dimensión del reto)
Relieve: Copernicus DEM GLO-30 y GLO-90, NASADEM, SRTM, ETOPO 2022.
Geología y minerales: EMIT (minerales), ASTER (índices SWIR/TIR), mapas geológicos globales (GLiM, OneGeology).
Temperatura e iluminación: MODIS LST (MOD11), VIIRS LST, NASA POWER (radiación solar), ECOSTRESS.
Agua, hielo y permafrost: NSIDC permafrost (Circum-Arctic y global), SMAP humedad del suelo, GRACE, MODIS nieve.
Polvo y viento: MERRA-2 (aerosoles y viento), MODIS/MAIAC AOD, CALIPSO.
Biología: MODIS NDVI (MOD13), índice de aridez global.
Subsuelo: catálogos públicos de cuevas y tubos de lava, si existen en formato abierto.

PUNTOS A RESPONDER (por dataset)
1. Nombre exacto del producto (short name de Earthdata si aplica) y versión vigente.
2. Formato (GeoTIFF, COG, HDF4, HDF5, NetCDF, Zarr, API) y si GDAL lo abre directamente.
3. Resolución espacial y temporal, y cobertura (global o regional).
4. Tamaño aproximado de un archivo o tesela y si hay un producto global agregado más liviano.
5. Cómo se obtiene un recorte o una serie para una coordenada (Earthdata Search, AppEEARS, OPeNDAP, STAC, Harmony, API).
6. Si requiere cuenta de NASA Earthdata u otra, y límites de uso.
7. Preprocesamiento que indica la documentación: escala y offset, banderas de calidad (QA), máscara de nubes o agua, reproyección desde sinusoidal u otra.
8. Licencia o condición de uso y cómo se cita.

ENTREGA
- Tabla: # | Dimensión | Dataset | Producto y versión | Formato (¿GDAL?) | Resolución y cobertura | Tamaño | Recorte o consulta cómo | Cuenta | Preprocesamiento | Licencia | Fuente oficial (enlace) | Fecha de la fuente | Certeza
- Certeza solo puede ser: Confirmado / Probable / No encontrado.
- Debajo de la tabla, máximo 200 palabras con contradicciones entre fuentes o advertencias.
- Sin introducción, sin resumen ejecutivo, sin conclusiones.

REGLAS
- Usa primero la documentación oficial: earthdata.nasa.gov, lpdaac.usgs.gov, nsidc.org, gmao.gsfc.nasa.gov, power.larc.nasa.gov, appeears.earthdatacloud.nasa.gov, spacedata.copernicus.eu.
- Blogs y foros solo si no hay fuente oficial, con certeza Probable.
- Si no encuentras un dato, escribe "No encontrado". No lo deduzcas ni lo estimes.
- Tamaños en MB o GB.
```

## Resultado

Cubre los 24 datasets de las siete dimensiones con short name, versión, escala y offset, valores de relleno, banderas QA y producto global liviano, tomando las cifras de las fichas de Earthdata o de cada DAAC.

### Verificado en la fuente

| # | Dato verificado | Fuente `[O]` | Fecha |
| :-- | :-- | :-- | :-- |
| 1 | Copernicus DEM GLO-30/90 (release 2024_1, EGM2008, `RasterPixelIsPoint`): licencia libre mundial, pero GLO-30 Public omite teselas de algunos países (lista publicada en `.xlsx` por Copernicus). En AWS S3 se descarga sin cuenta (`--no-sign-request`, bucket del release 2021); CDSE requiere registro. | https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM · https://registry.opendata.aws/copernicus-dem/ | 2026-11-04 |
| 2 | Índice de aridez global: Figshare declara CC BY 4.0 mientras la descripción señala uso no comercial. Versión vigente 3.1 (2025-07-16); valores enteros ×10 000 (multiplicar por 0.0001). | https://figshare.com/articles/dataset/Global_Aridity_Index_and_Potential_Evapotranspiration_ET0_Climate_Database_v2/7504448 | 2026-11-04 |
| 3 | GLiM en PANGAEA (CC-BY-3.0, 37.8 kB): corresponde a la malla de 0.5°, no a los polígonos completos 1:3 750 000. | https://doi.pangaea.de/10.1594/PANGAEA.788537 | 2026-11-04 |
| 4 | Permafrost de Obu et al.: CC-BY-3.0, 1 km, EPSG:3995; GeoTIFF MAGTM, MAGTSTD y PERPROB; PERZONES en shapefile. Cubre hemisferio norte hasta 25° de latitud. | https://doi.pangaea.de/10.1594/PANGAEA.888600 | 2026-11-04 |
| 5 | NASA POWER no publica licencia expresa; solicita citar servicio, versión y fecha de acceso, además de notificar publicaciones y redistribución al correo institucional del proyecto. | https://power.larc.nasa.gov/docs/referencing/ | 2026-11-04 |
| 6 | Pyroduct Digital Catalog v3.0 (2026-10-18): CC BY 4.0, zip de 85.9 MB con `.dxf`, `.txt` e índice `.xlsx`; la cita recomendada emplea el DOI conceptual `10.5281/zenodo.14535885`. | https://zenodo.org/records/23456401 | 2026-11-04 |

Otros parámetros documentados por los DAAC: escalas de MODIS y VIIRS (LST × 0.02 K, NDVI × 0.0001, clases 200-255 de MOD10A1), CRS EASE-Grid 2.0 de SMAP, malla 0.625° × 0.5° de MERRA-2 y `scale_factor` de GRACE (verificables mediante `gdalinfo` en cada producto).

### Advertencias técnicas de los productos

- Copernicus DEM es un DSM (incluye vegetación y edificios); ETOPO 2022 es *bare-earth*. Para pendiente y rugosidad en zonas con bosque, la diferencia importa.
- Datum vertical: Copernicus y ETOPO usan EGM2008; NASADEM y SRTM, EGM96. No mezclarlos sin convertir.
- Copernicus usa `RasterPixelIsPoint`: medio píxel (~15 m) de desfase frente a rásters `PixelIsArea`.
- Los productos MODIS de 1 km y 500 m vienen en sinusoidal; los CMG de 0.05° ya vienen en lat/lon y permiten muestreo global a baja resolución (1-5 km).
- CALIPSO terminó en 2023 y da perfiles verticales sobre la traza, no un raster de cobertura global.
- Tres datasets piden uso no comercial o aviso a los autores (índice de aridez, Mars Climate Database, POWER): requieren citar la fuente según sus condiciones de uso.

### Pendientes de verificación en catálogo o descarga

- Lista de teselas GLO-30 no publicadas: revisar en qué regiones faltan.
- Descarga del GLiM vectorial (no está en el registro de PANGAEA citado).
- Identificador de capa de Worldview para cada dataset.

## Relaciones

- [[I-05-datasets-planetarios-formato-y-procesamiento]] — el lado de la Luna y Marte
- [[I-07-armonizar-tierra-luna-marte]] — cómo llevar ambos a una grilla común
