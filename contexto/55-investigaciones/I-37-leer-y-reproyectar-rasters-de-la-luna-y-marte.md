---
title: "I-37 — Errores conocidos al leer y reproyectar rasters de la Luna y Marte con GDAL"
type: investigacion
status: vigente
date: 2026-11-08
updated: 2026-11-08
summary: "Qué problemas documentados tiene leer con GDAL los productos estándar de la Luna (LOLA polar, Barker, Mazarico, Diviner) y Marte (HRSC-MOLA 200 m, TES de Putzig y Mellon, Montabone) y llevarlos a celdas de área igual: escala, radio, longitudes 0-360, polos y archivos grandes."
autor: fernando
tipo_investigacion: A
riesgo: critico
---

# I-37 — Leer y reproyectar rasters de la Luna y Marte

[[I-05-datasets-planetarios-formato-y-procesamiento]] documenta qué producto existe y en qué formato viene; [[I-07-armonizar-tierra-luna-marte]], cómo armonizar entre cuerpos. Esta investigación recopila
los tropiezos técnicos documentados al abrir y reproyectar esos archivos con GDAL/PROJ.

## Prompt

```
I-37 — Leer y reproyectar rasters planetarios con GDAL

Esta es una consulta de problemas concretos y sus arreglos, con fuentes. No se busca una introducción a la cartografía planetaria.

OBJETIVO
Saber qué errores documentados aparecen al abrir con GDAL estos productos de la Luna y Marte y al reproyectarlos a una cuadrícula de área igual (HEALPix), y cómo los resolvieron otros.

PRODUCTOS
Luna: LOLA LDEM_80S_20M FLOAT V2.1 (PDS3 .IMG + .LBL, estereográfica polar, 30 400 × 30 400, km sobre 1737,4 km); sitios de Barker et al. 2021 (GeoTIFF 5 m); Mazarico et al. 2011 AVGVISIB y LPSR (GeoTIFF, 60 y 120 m); Diviner CF de Lucey et al. 2021 (GeoTIFF, 32 ppd).
Marte: HRSC-MOLA Blended DEM Global 200 m v2 (GeoTIFF de 11,4 GB, simple cilíndrica); TES Putzig y Mellon 2007 (binario PDS, 20 ppd); climatología de polvo de Montabone v2 (netCDF).
Radios de referencia: Luna 1737,4 km; Marte 3396,19 km.

PUNTOS A RESPONDER
1. Qué códigos de sistema de referencia (IAU_2015, ESRI, proj4) usan otros para la Luna y Marte en GDAL/PROJ, y qué errores salen si GDAL toma el elipsoide de la Tierra por defecto.
2. Problemas conocidos del driver PDS de GDAL con LDEM_80S_20M FLOAT y con los mapas de TES (orden de bytes, offset de cabecera, unidades en km).
3. Cómo manejan las longitudes 0-360 frente a −180-180 y el meridiano de corte al reproyectar o al pasar a HEALPix.
4. Qué errores aparecen cerca de los polos al pasar de estereográfica polar a HEALPix, y qué método de remuestreo usan (promedio por área, cobertura fraccional de celda).
5. Cómo procesaron otros el DEM de Marte de 200 m (11 GB) por bloques sin cargarlo entero en memoria, y cuánto tardaron.
6. Cómo leer la climatología de Montabone (variables, dimensiones, años marcianos, longitud solar) y errores conocidos al promediarla.
7. Qué herramientas o código publicados ya llevan rasters planetarios a HEALPix (healpy, cdshealpix, HiPS, xdggs u otros) y con qué limitaciones.

ENTREGA
- Tabla: # | Punto | Respuesta | Fuente (enlace) | Fecha de la fuente | Certeza
- Certeza: Confirmado / Probable / No encontrado.

REGLAS
- Primero la documentación oficial: GDAL y PROJ, PDS Geosciences Node, USGS Astrogeology, LMD, PGDA, y artículos con DOI.
- Issues de GitHub de GDAL valen como práctica documentada si citan versión.
- Si no se encuentra un dato, escribir "No encontrado". No deducirlo.
```

## Resultado

### Hallazgos principales

1. **CRS del cuerpo:** la documentación de PROJ y de SpatialReference indica códigos IAU_2015 propios: IAU_2015:30100
   (Luna geográfica), IAU_2015:30135 (Luna polar sur) e IAU_2015:49900 (Marte). La variable `PROJ_IGNORE_CELESTIAL_BODY`
   desactiva la comprobación de cuerpo celeste en lugar de corregir el CRS. GDAL lee LOLA (esfera de 1 737 400 m,
   polar estereográfica) y HRSC-MOLA (`GCS_Mars_2000_Sphere`, 3 396 190 m, de −180 a 180).
2. **LOLA LDEM_80S_20M:** el producto se abre por la etiqueta `.lbl`; sus alturas vienen en km, tiene 30 400 × 30 400 px
   de 20 m y origen en −304 000 m (borde del píxel). En la proyección estereográfica polar el factor de escala es
   k = 2/(1+sen|φ|), que vale 1,0077 a 80° S.
3. **TES (Putzig y Mellon):** según la página del PSI, los `.bin` llevan una cabecera ASCII de 14 400 bytes en big-endian. La versión del PDS (`mgst_9001`) trae etiqueta `.lbl` aparte que GDAL abre directo (`global_ti_night_2007.lbl`, `global_ti_day_2007.lbl`) y que declara el orden de bytes. En estos mapas el valor 0 indica "sin dato", mientras que GDAL declara −32768 como valor nulo; la documentación del producto describe además una máscara `msk` de píxeles interpolados.
4. **HRSC-MOLA 200 m:** 106 694 × 53 347, Int16, sin dato −32768, en franjas de una fila y sin comprimir. La documentación de GDAL describe la lectura por ventanas y las opciones de creación `TILED`, `COMPRESS=DEFLATE`, `PREDICTOR` y `BIGTIFF` del driver GTiff.
5. **Montabone:** la documentación del LMD distingue la distribución "gridded" (observaciones con huecos) de la "kriged" (3° × 3°, interpolada completa). En MY34 gridded: malla 60 × 36 (6° × 5°), 668 soles, variables `cdodtot`, `cdod610`, `cdodrel`, `cdodnum`, `cdodtw` y
   `Ls`. La documentación describe `cdodtot` como opacidad total de polvo en columna, `cdod610` como la normalizada a 610 Pa y `cdodrel` como medida de confiabilidad relativa; los años MY25, MY28 y MY34 se documentan como años con tormenta global.
6. **HEALPix:** HEALPix trabaja sobre la esfera unidad, por lo que el radio del cuerpo solo interviene en el área de la celda. `cdshealpix` (PyPI) asocia coordenadas a celdas HEALPix. `reproject_to_healpix` interpola, según su documentación, y HipsGen está orientado a visualización.

### Riesgos técnicos documentados

| Riesgo | Qué indican las fuentes |
| :-- | :-- |
| Valor 0 de TES frente a −32768 declarado por GDAL | Descrito en la documentación del producto y del driver |
| Alturas de LOLA en km | Unidad indicada en la etiqueta del producto |
| HRSC-MOLA sin comprimir (≈ 11 GB) | Lectura por ventanas o GeoTIFF por bloques, según GDAL |
| Celdas poco confiables y años de tormenta global en Montabone | Variable `cdodrel` y años MY25, MY28 y MY34 documentados |
| EPSG:4326 en cuerpos no terrestres | Códigos IAU_2015 propios en PROJ |

### Preguntas abiertas

- Los tiempos de cómputo en escritorio para el DEM de Marte no aparecen en la literatura consultada.
- Un posible error de escala de PROJ en `+proj=healpix` (citado en una fuente secundaria) no está confirmado en fuente oficial.

### Bibliografía

- `[O]` GDAL, driver PDS — https://gdal.org/en/stable/drivers/raster/pds.html — consultado 2026-11-08.
- `[O]` IAU_2015:30135 — https://spatialreference.org/ref/iau_2015/30135/ — consultado 2026-11-08.
- `[O]` PSI, mapas de inercia térmica 2007 — https://se.psi.edu/inertia/2007/ — consultado 2026-11-08.
- `[O]` LMD, climatología de polvo — https://www-mars.lmd.jussieu.fr/mars/dust_climatology/ — consultado 2026-11-08.
- `[O]` cdshealpix en PyPI — https://pypi.org/project/cdshealpix/ — consultado 2026-11-08.
- `[P]` reproject_to_healpix — https://reproject.readthedocs.io/en/stable/api/reproject.reproject_to_healpix.html — consultado 2026-11-08.

## Relaciones

- [[I-05-datasets-planetarios-formato-y-procesamiento]] — formato de cada producto
- [[I-07-armonizar-tierra-luna-marte]] — la armonización entre cuerpos
- [[I-08-cuadriculas-de-area-igual]] — cuadrículas de área igual (HEALPix)
