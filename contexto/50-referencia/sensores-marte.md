---
title: "Sensores y datasets de Marte"
type: referencia
status: vigente
date: 2026-11-03
updated: 2026-11-13
summary: "Producto, formato, proyección, resolución, escala y licencia de los datasets marcianos."
autor: fernando
consultado: 2026-11-13
vence: 2027-02-01
fuentes:
  - url: http://tes.asu.edu/products/index.html
  - url: https://astrogeology.usgs.gov/search/map/mars_mgs_mola_mex_hrsc_blended_dem_global_200m
    nivel: O
    fecha: 2026-11-04
  - url: https://stac.astrogeology.usgs.gov/docs/data/mars/ctxdtms/
    nivel: O
    fecha: 2026-11-04
  - url: https://astrogeology.usgs.gov/search/map/mars-themis-derived-global-thermal-inertia-mosaic
    nivel: O
    fecha: 2026-11-04
  - url: https://pds-geosciences.wustl.edu/missions/mro/crism.htm
    nivel: O
    fecha: 2026-11-04
  - url: https://swim.psi.edu/SWIM2Products.php
    nivel: O
    fecha: 2026-11-04
  - url: https://www-mars.lmd.jussieu.fr/mars/access.html
    nivel: O
    fecha: 2026-11-08
  - url: http://www-mars.lmd.jussieu.fr/MCD_pro/mcd_pro.html
    nivel: O
    fecha: 2026-11-08
  - url: https://www-mars.lmd.jussieu.fr/mars/dust_climatology/
    nivel: O
    fecha: 2026-11-08
  - url: https://pds.nasa.gov/ds-view/pds/viewBundle.jsp?identifier=urn%3Anasa%3Apds%3Amars_mro.odyssey_multi_cavecatalog_cushing_2016&version=1.0
    nivel: O
    fecha: 2026-11-13
  - url: https://astrogeology.usgs.gov/search/map/mars_global_cave_candidate_catalog_v1_cushing
    nivel: O
    fecha: 2026-11-13
---

# Sensores y datasets de Marte

Compendio de lo investigado en [[I-05-datasets-planetarios-formato-y-procesamiento]]. Sistema de referencia común:
latitud planetocéntrica, longitud positiva al este, esfera de **3396.19 km** (`IAU_2015:49900`).

## El dato

| Variable | Producto | Formato | Proyección y resolución | Escala, NoData y preprocesamiento |
| :-- | :-- | :-- | :-- | :-- |
| Relieve global | MOLA MEGDR (128 ppd, ~463 m; global 2 GB) | PDS4 y GeoTIFF en USGS | Simple cilíndrica | Metros sobre el areoide. Las brechas entre trazas pueden ocultar depresiones. |
| Relieve global fino | HRSC-MOLA blended DEM v2 (200 m; global 11 GB) | GeoTIFF 16 bits | Simple cilíndrica | Producto provisional: donde no hay HRSC, los 200 m son MOLA interpolado. |
| Relieve local | HiRISE DTM (1 m) y CTX DTM (20 m), colecciones USGS STAC | COG (GDAL directo; VRT sobre S3) | Equirectangular entre 65°S y 65°N; polar fuera | CTX trae `qa_metrics` e `IntersectionErr`. Unir DTM vecinos sin co-registro produce escalones falsos. |
| Inercia térmica fina | THEMIS Global Thermal Inertia Mosaic, cuadrángulos Quantitative (32 bits): 24 cuadros de 30° × 60° entre 60° S y 60° N, nombrados por la esquina suroeste (`30S060E` = 30° S a 0°, 60° E a 120° E) | ISIS `.cub` o GeoTIFF Float32 sin comprimir (35 566 × 17 782 px, ~2.5 GB) en el bucket público `asc-astropedia` de S3: `Mars/Odyssey/THEMIS-Global-Thermal-Inertia-Mosaic/Quantitative-32-Bit/ancillary/THEMIS_TI_Mosaic_Quant_<cuadro>_100mpp.tif` (listado 2026-11-10) | Simple cilíndrica, planetocéntrica, longitud este (−180 a 180), 100 m/px | J m⁻² K⁻¹ s⁻½ (modelo KRC). Existe también la versión Qualitative (8 bits). No cubre Phoenix (68° N). |
| Inercia térmica global | TES Putzig y Mellon 2007 (noche y día) | PDS binario (66 MB zip) o TIFF en ASU | 20 ppd (~3 km) | La máscara `msk` marca píxeles interpolados. |
| Minerales, mapa global | TES Mineral Maps de Bandfield 2002: 13 capas en un archivo (cuarzo, feldespato potásico, plagioclasa, anfíbol, piroxeno bajo en Ca, piroxeno alto en Ca, olivino, hematita, sulfatos, carbonatos, silicatos en lámina y vidrio alto en Si, polvo superficial, error RMS) | ENVI `float32` big-endian, BSQ, 1440 × 720 (54 MB), con `.hdr` | Cilíndrica simple, 4 ppd (~16 km); longitud de −180° a 180° E, latitud de 90° a −90° | **El `.hdr` no trae georreferencia** (declara píxel de 1 m): la georreferencia debe asignarse al leer. Sin dato = −1. Abundancia como fracción. El orden de las capas sale de la lista de la página de ASU, no de una etiqueta del archivo. No es % de SiO₂ ([[I-22-indice-de-silice-comparable-entre-cuerpos]]). |
| Mineralogía | CRISM MTRDR (`MROCR_4001`, escenas de 2006 a 2012) | `.IMG` + `.hdr` ENVI | Equirectangular; ~18-36 m/px | NoData = 65535 en cualquier banda. Ya trae corrección fotométrica y atmosférica. |
| Hielo subterráneo | SWIM 2.0, mapas de consistencia de hielo (-1 a +1) por profundidad | GeoTIFF, TIFF y PNG | Simple cilíndrica, ~3 km/px (20 ppd), 60°S-60°N (probable, sin confirmar) | Productos del 2021-02-24. NoData no documentado. No publica licencia: se cita Morgan et al. 2021. |
| Clima (temperatura, presión, viento) | Mars Climate Database 6.2 | Web (uso moderado) o versión completa netCDF + Fortran con registro | Malla GCM 5.625° × 3.75°; `hireskey=1` interpola sobre MOLA | Promedia: subestima extremos y rangos diurnos. Sesgo cálido diurno de ~4 K frente a TES. |
| Polvo en el aire | Climatología de profundidad óptica de Montabone (MY24–MY36, `dustscenario_MYxx_v2-x.nc`) | NetCDF | Mapas diarios por año marciano | Infrarrojo de 9.3 µm; ×2.6 para pasar al visible ([[I-29-albedo-y-polvo-comparables-entre-cuerpos]]). |
| Cuevas | Mars Global Cave Candidate Catalog (`MGC³`, PDS4 `urn:nasa:pds:mars_mro.odyssey_multi_cavecatalog_cushing_2016::1.0`, DOI `10.17189/1519222`) | ZIP (`mars_cave_catalog.zip`, `1 770 313` B): `data/Mars_Cave_Catalog.csv` (`1 064` líneas = `1 063` entradas + cabecera) y PDF (`1 712 926` B) | Tabla puntual (`0–360° E`, planetocéntrica) basada en CTX, HiRISE y THEMIS | **Candidatos orbitales sin verificación in situ** (pueden ser depresiones o sombras). Dominio público EE. UU. / acceso abierto NASA PDS (USGS Astrogeology, MDAP): citar `G. E. Cushing, 2015, doi:10.17189/1519222` y no usar logo USGS como aval. |

Licencias: dominio público de NASA y USGS (incluido `MGC³`, según PDS y USGS Astrogeology, consultados el `2026-11-13`), salvo estas tres:

- **MCD** (consultada el 2026-11-08, [access.html](https://www-mars.lmd.jussieu.fr/mars/access.html)):
  - Uso científico libre si se cita el origen y se informa a los autores.
  - Uso comercial prohibido sin autorización.
  - La interfaz web no pide registro, pero es "for moderate use only".
  - La versión completa (netCDF) se baja gratis con un formulario ([MCD_pro](http://www-mars.lmd.jussieu.fr/MCD_pro/mcd_pro.html)). Ahí se acepta **no transmitir la MCD a terceros, ni en parte ni completa**, y no hacer negocio con ella.
  - Nada sobre hackathons ni proyectos de estudiantes.
  - **Duda abierta:** si publicar valores derivados cuenta como transmitir "una parte"; el contacto de los autores está en access.html.
- **Climatología de polvo de Montabone** (consultada el 2026-11-08, [dust_climatology](https://www-mars.lmd.jussieu.fr/mars/dust_climatology/)):
  - **CC BY-SA 3.0**, uso comercial incluido. Lo derivado se publica con la misma licencia.
  - Registro opcional.
  - Citar Montabone et al. 2015 (doi:10.1016/j.icarus.2014.12.034) y 2020 (doi:10.1029/2019JE006111).
- **SWIM:** sin licencia publicada.

## Relaciones

- [[sensores-tierra]] — equivalentes terrestres
- [[I-05-datasets-planetarios-formato-y-procesamiento]] — fuentes de cada dato
- [[I-07-armonizar-tierra-luna-marte]] — variables térmicas y de otro tipo entre cuerpos
