---
title: "Sensores y datasets de la Tierra (análogos)"
type: referencia
status: vigente
date: 2026-11-03
updated: 2026-11-13
summary: "Producto exacto (short name), formato, resolución, cuenta, escala y licencia de cada dataset terrestre por dimensión del reto."
autor: fernando
consultado: 2026-11-13
vence: 2027-02-01
fuentes:
  - url: https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM
    nivel: O
    fecha: 2026-11-04
  - url: https://registry.opendata.aws/copernicus-dem/
    nivel: O
    fecha: 2026-11-04
  - url: https://power.larc.nasa.gov/docs/referencing/
    nivel: O
    fecha: 2026-11-04
  - url: https://figshare.com/articles/dataset/Global_Aridity_Index_and_Potential_Evapotranspiration_ET0_Climate_Database_v2/7504448
    nivel: O
    fecha: 2026-11-04
  - url: https://doi.pangaea.de/10.1594/PANGAEA.888600
    nivel: O
    fecha: 2026-11-04
  - url: https://doi.pangaea.de/10.1594/PANGAEA.788537
    nivel: O
    fecha: 2026-11-04
  - url: https://zenodo.org/records/23456401
    nivel: O
    fecha: 2026-11-04
  - url: https://api.figshare.com/v2/articles/7504448
    nivel: O
    fecha: 2026-11-08
  - url: https://www.isric.org/explore/soilgrids
    nivel: O
    fecha: 2026-11-08
  - url: https://global-surface-water.appspot.com/download
    nivel: O
    fecha: 2026-11-08
  - url: https://www.hydrosheds.org/products/glwd
    nivel: O
    fecha: 2026-11-08
  - url: https://zenodo.org/api/records/10441041
    nivel: O
    fecha: 2026-11-08
  - url: https://zenodo.org/api/records/13907012
    nivel: O
    fecha: 2026-11-08
  - url: https://doi.org/10.1038/s41597-022-01189-6
    nivel: O
    fecha: 2026-11-13
  - url: https://researchdata.tuwien.ac.at/records/n2d1v-gqb91
    nivel: O
    fecha: 2026-11-13
  - url: https://www.eorc.jaxa.jp/ALOS/en/dataset/fnf_e.htm
    nivel: O
    fecha: 2026-11-13
---

# Sensores y datasets de la Tierra (análogos)

Compendio de lo investigado en [[I-06-datasets-terrestres-formato-y-procesamiento]]. Se listan productos globales de menor peso ("Global liviano") y productos de mayor resolución espacial ("Fino").

## El dato

| Dimensión | Fino | Global liviano | Formato y cuenta | Escala y preprocesamiento |
| :-- | :-- | :-- | :-- | :-- |
| Relieve | Copernicus DEM GLO-30 (release 2024_1) | GLO-90 o ETOPO 2022 (30" y 60") | COG; sin cuenta en AWS S3 (`--no-sign-request`) | DSM con vegetación y edificios; EGM2008; `RasterPixelIsPoint`. **GLO-30 Public tiene teselas sin publicar en algunos países.** |
| Máscara de agua | Copernicus DEM WBM (misma tesela que GLO-30 y GLO-90, archivo `AUXFILES/<tesela>_WBM.tif` dentro de la carpeta de la tesela; `QUALITY/` da 404, consultado el 2026-11-07) | MOD44W V061 (250 m, `Seven_class`) | GeoTIFF uint8; misma descarga que el DEM (no viene en la versión DTED) | Clases: 1 océano, 2 lago, 3 río. No usa la altura: no borra depresiones. Bandera de agua estacional con JRC GSW v1.5 (30 m, sin cuenta). [[I-10-mascaras-de-agua]] |
| Relieve (alternativa) | NASADEM_HGT o SRTMGL1 (30 m, 60°N-56°S) | SRTMGL30 (1 km, 285 MB global) | HGT; Earthdata Login | EGM96: no mezclar con Copernicus sin convertir el datum. |
| Minerales | EMITL2BMIN V002 (60 m, zonas áridas 54°N-54°S) | EMITL3ASA V002 (0.5°, 19.6 MB) | netCDF-4; Earthdata Login | Ortorrectificar con `glt_x`/`glt_y`; Fill −9999; calidad en `band_depth_unc` y `fit`. |
| Emisividad y SWIR | AST_07XT y AST_05 V004 (15-90 m) | ASTER GED AG1km V003 (1 km) | COG o HDF5; Earthdata Login | Multiplicar por 0.001; usar AST_07XT (corrige *crosstalk*). |
| Litología | GLiM v1.0 polígonos (1:3 750 000) | GLiM malla 0.5° (CC-BY-3.0, 37.8 kB) | Shapefile; sin cuenta | El vectorial no está en el registro de PANGAEA citado. |
| Temperatura superficial | MOD11A1 V061 (1 km) | MYD11C3 V061 (Aqua, 0.05°, mensual) o MOD11C3 (Terra) | HDF4; Earthdata Login | LST × 0.02 = K; filtrar con `QC_Day`/`QC_Night`; reproyectar desde sinusoidal (los CMG ya vienen en lat/lon). |
| Temperatura (alternativa) | VNP21A1D/N V002 (1 km) o ECOSTRESS ECO_L2T_LSTE V002 (70 m) | VNP21C3 V002 (0.05°) | HDF5 o COG; Earthdata Login | Misma escala 0.02. ECOSTRESS viene en UTM y tuvo ruido del 2025-05-15 al 2025-07-01. |
| Radiación solar | NASA POWER `ALLSKY_SFC_SW_DWN` (1°) | Igual | API REST sin cuenta | Hora en UTC. **No publica licencia**: citar servicio, versión y fecha de acceso. |
| Permafrost | Obu et al. 2018 (1 km, hemisferio norte; CC-BY-3.0) | NSIDC GGD318 v2 (0.5°, 12.5 y 25 km) | GeoTIFF o binario; sin cuenta | Obu viene en EPSG:3995. GGD318 codifica clases en 1 byte. |
| Hielo del suelo | Karjalainen et al. 2022, contenido de hielo del suelo en el primer metro, v1.1 (1 km, hemisferio norte; CC BY 4.0; DOI 10.5281/zenodo.7009875) | Igual | GeoTIFF en Zenodo; sin cuenta | Fracción de hielo por volumen: comparable con el hielo mezclado con regolito de la Luna ([[I-21-analogos-terrestres-del-hielo-en-sombra-permanente]]). |
| Humedad del suelo | SPL4SMGP V008 (9 km, 3 h) | SPL3SMP V009 (36 km) | HDF5; Earthdata Login | EASE-Grid 2.0 (EPSG:6933); filtrar `retrieval_qual_flag` en L3. |
| Agua subterránea | GRACE JPL Mascon CRI RL06.3 (0.5°, mensual, un archivo) | Igual | netCDF-4; Earthdata Login | `lwe_thickness` en cm de anomalía; aplicar `scale_factor` y `land_mask`; no leer píxeles aislados. |
| Nieve | MOD10A1 V061 (500 m) | MOD10CM V061 (0.05°, mensual) | HDF4; Earthdata Login | Valores 0-100 válidos; 200-255 son clases a enmascarar. |
| Viento y polvo | MERRA-2 M2T1NXSLV, M2T1NXFLX y M2T1NXAER (0.625° × 0.5°, horario) | M2TMNXSLV, M2TMNXFLX y M2TMNXAER (mensual) | netCDF-4; Earthdata Login con GES DISC autorizado | Viento medio = √(U² + V²) de SLV. Parámetros para número de Shields: `USTAR`, `TAUX`, `TAUY`, `RHOA` y `SPEEDMAX` de FLX ([[I-28-viento-como-numero-de-shields]]). Polvo en `DUEXTTAU`. Recortar por OPeNDAP. |
| Aerosoles | MCD19A2 V061 (1 km, diario) | Sin global liviano en MAIAC | HDF4; Earthdata Login | Promediar órbitas; Fill −28672; filtrar `AOD_QA`. |
| Vegetación | MOD13Q1 V061 (250 m) | MOD13C1 V061 (0.05°, 95 MB) | HDF4; Earthdata Login | NDVI × 0.0001; Fill −3000. |
| Aridez | Global-AI_PET v3.1 (1 km, 2025-07-16) | Igual (anual, 761 MB) | GeoTIFF zip; sin cuenta | Valor × 0.0001. Según la API de Figshare (2026-11-08) (artículo 7504448, versión 7, 2025-07-17): el campo de licencia dice **CC BY 4.0**, pero la descripción dice "provided for non-commercial use" (sin confirmar con los autores; cita: Zomer et al. 2022, Scientific Data 9, 409). Archivo anual: 646 MB. |
| Fracción fina del suelo | SoilGrids 2.0 (250 m; arcilla y limo, 6 profundidades) | Igual | VRT/GeoTIFF en `files.isric.org/soilgrids/latest/data/` (`clay/`, `silt/`); sin cuenta | **CC BY 4.0**, consultado el 2026-11-08 en isric.org/explore/soilgrids. Es un mapa estimado por modelo, no medido celda por celda. Unos 5 GB por mapa; la propiedad completa (6 profundidades × 4 cuantiles) pesa unos 120 GB. |
| Agua y salares | JRC GSW v1.5 (30 m, 1984–2024) | GLWD v2 (15″, ~500 m; 33 clases de agua y humedal, con fracción por clase) | GSW: teselas, FTP o bucket de CloudFerro, sin cuenta mencionada. GLWD: Figshare | GSW: **régimen abierto de Copernicus** ("free of charge, without restriction of use"), citar Pekel et al. 2016 y poner "Source: EC JRC/Google". GLWD v2: **CC BY 4.0** (página de HydroSHEDS). Consultado el 2026-11-08. Si GLWD trae una clase de salar, y cómo se llama, **no está confirmado**: la página de clases dio 404. |
| Dunas | GSDS30 (30 m, 2017; arena móvil frente a fija o semifija; Zenodo 10441041, 1.07 GB) | GSDP30 (30 m; 11 tipos de duna; Zenodo 13907012, 115 MB) | GeoTIFF por teselas; sin cuenta | **CC BY 4.0** las dos, según la API de Zenodo (2026-11-08) (Zheng et al., Fuzhou y Pekín). GSDS30 separa la arena que se mueve frente a arena fija o semifija. Cobertura y exactitud: ver el artículo. |
| Subsuelo (tubos de lava) | Pyroduct Digital Catalog v3.0 (115 tubos, CC BY 4.0, 86 MB) | WOKAM (karst, 1:40 000 000) | `.xlsx`, `.dxf`; sin cuenta | Citar el DOI concepto `10.5281/zenodo.14535885`. |

**CALIPSO** terminó en 2023 y da perfiles verticales, no un raster.

Limitaciones físicas de **radar SAR** frente a *Mini-RF* lunar (*RADARSAT-1*, *RCM*, *Copernicus/Sentinel-1* y *G-Portal*, consultados el 2026-11-13): existen mosaicos SAR globales
abiertos en la Tierra —*Global Seasonal Sentinel-1 Interferometric Coherence and Backscatter* (Kellndorfer et al. 2022,
`doi:10.1038/s41597-022-01189-6`, en AWS sin cuenta y ASF; cobertura `2019-12-01` a `2020-11-30`, latitud `82° N–78° S`
según la ficha de ASF o `82° N–79° S` según *Scientific Data* y el manifiesto YAML de AWS, licencia **CC BY 4.0**),
*S1GBM v1.0* de TU Wien (banda C `VV/VH` a `10 m`, `doi:10.48436/n2d1v-gqb91`, **CC BY 4.0**, `2 832 787 240 488` B más
extensión polar de `142 766 906 041` B) y *ALOS/ALOS-2 PALSAR Global 25m Mosaic* en **JAXA EORC** (banda L `HH/HV`,
con registro y prohibición de redistribuir los archivos tal cual; no viene en G-Portal)—, pero presentan incompatibilidades físicas y de observación: *Mini-RF* opera en banda S (`12,6 cm`) con polarización circular híbrida y mide **CPR**, mientras
Sentinel-1 (`5,6 cm`), RADARSAT-1 (`HH`) y PALSAR (`HH/HV`) son lineales y no calculan CPR (solo *RCM* tiene modo
compacto equivalente, sin mosaico global). Además, en la Tierra el agua líquida (`εr ≈ 80`), la vegetación y la
pendiente local dominan `σ⁰` y la coherencia frente a la Luna seca (`εr ≈ 3`), y el mosaico de Kellndorfer cubre un solo año (`2019–2020`).

## Limitaciones de cobertura frente a otros cuerpos

- **No hay producto global precalculado de inercia térmica de la Tierra**: debe estimarse como inercia térmica aparente a partir de MOD11 de día y noche y albedo ([[I-27-inercia-termica-con-unidades-fisicas]]).
- La mineralogía terrestre de EMIT L2B está en clases minerales y cobertura limitada a zonas áridas (54° N–54° S), frente a bandas de emisividad o parámetros espectrales en otros sensores ([[I-07-armonizar-tierra-luna-marte]]).

## Relaciones

- [[sensores-luna]], [[sensores-marte]] — equivalentes en los otros cuerpos
- [[portales-de-descarga]] — portales de descarga
- [[I-06-datasets-terrestres-formato-y-procesamiento]] — fuentes de cada dato
