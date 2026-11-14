---
title: "I-38 — Agregar rasters a celdas HEALPix y guardar la tabla por celda"
type: investigacion
status: vigente
date: 2026-11-08
updated: 2026-11-08
summary: "Cómo agregan otros rasters de distinta resolución a celdas HEALPix (cobertura fraccional, estadísticas por celda, faltantes), qué librerías de Python y Rust lo hacen y a qué velocidad, en qué formato guardan la tabla resultante y cómo comprueban que la tubería no metió errores."
autor: fernando
tipo_investigacion: B
riesgo: critico
---

# I-38 — Agregar rasters a celdas HEALPix y guardar la tabla

Investiga métodos, librerías y formatos para agregar rasters geoespaciales de resoluciones dispares a celdas HEALPix y validar la integridad del resultado (complementa [[I-08-cuadriculas-de-area-igual]]).

## Prompt

```
I-38 — Agregar rasters a HEALPix y guardar la tabla

Esta es una consulta sobre cómo lo hicieron otros proyectos, con fuentes y cifras. No se busca una introducción a HEALPix.

OBJETIVO
Saber con qué método y qué librerías se agregan rasters de distinta resolución a celdas HEALPix con estadísticas por celda, en qué formato se guarda la tabla y cómo se comprueba que no hubo errores, según proyectos publicados.

ALCANCE
- Entradas: GeoTIFF, HDF4, HDF5 y netCDF de resoluciones dispares.
- Estadísticas por celda y variable (por ejemplo media, desviación, percentiles y fracciones), y tratamiento de "sin dato".
- Implementaciones en Python o Rust.

PUNTOS A RESPONDER
1. Qué métodos usan para pasar un raster a HEALPix: centro del píxel, cobertura fraccional (exactextract), remuestreo previo a la resolución de la celda. Qué error deja cada uno cuando el píxel es más grande que la celda o al revés.
2. Qué librerías lo hacen (healpy, cdshealpix, hpgeom, xdggs, healpix-alchemy, otras) y qué velocidad reportan para millones de celdas.
3. Cómo calculan percentiles y fracciones por celda sin guardar todos los píxeles (en una sola pasada o con histogramas).
4. Qué formato usan para la tabla por celda (Parquet, GeoParquet, Zarr, Arrow, Feather) y cuánto pesa por millón de celdas y por variable.
5. Cómo comprueban la tubería: pruebas de unidades, rangos válidos, conteo de celdas, comparación con un recorte hecho a mano, sumas de verificación.
6. Herramientas para repetir una tubería entera paso a paso y retomarla si se corta (Snakemake, DVC, make, scripts propios) en proyectos geoespaciales parecidos.
7. Errores típicos reportados al agregar a cuadrículas globales: celdas en el borde de la costa, celdas de los polos, píxeles contados dos veces.

ENTREGA
- Tabla: # | Punto | Respuesta | Fuente (enlace) | Fecha de la fuente | Certeza
- Certeza: Confirmado / Probable / No encontrado.

REGLAS
- Primero la documentación oficial de cada librería y artículos con DOI; repositorios con código y cifras.
- Toda cifra de velocidad con el hardware y el tamaño de la prueba.
- Si no se encuentra un dato, escribir "No encontrado". No deducirlo.
```

## Resultado

### Hallazgos principales

1. **Dos modos según la resolución de la capa:**
   - **Capa más fina que la celda:** según la fuente consultada, con muchos píxeles por celda la diferencia entre asignar por centro y la cobertura fraccional exacta se reduce.
   - **Capa igual o más gruesa que la celda** (por ejemplo ~5.6 km o ~55 km frente a celdas de ~1 km):
     las fuentes indican que asignar por centro del píxel puede dejar celdas vacías o producir errores de hasta 100 %.
2. **Percentiles exactos:** con decenas a miles de píxeles por celda, ordenar por bloque permite percentiles exactos sin aproximaciones tipo t-digest; media y desviación admiten Welford incremental.
3. **Fracción válida:** las fuentes señalan el riesgo de que un único píxel válido represente toda una celda costera o de nivel jerárquico superior; no se encontró un umbral estándar.
4. **Latitud en la Tierra:** HEALPix trabaja en una esfera. Pasar latitud geodésica WGS84 directamente deforma el área de las celdas hasta ~0.9 % y las desplaza hasta ~14 km respecto de la latitud autálica; las fuentes recomiendan documentar la convención de latitud usada (en la Luna y Marte esféricos no hay diferencia).
5. **Librerías documentadas:** `cdshealpix` (BSD-3, 0.9.0, con ruedas para Windows, disponible en Python y Rust) y `raster2dggs` (LGPL-3.0, 0.19.1, soporta HEALPix y `exactextract`).
6. **Formato de tabla:** Parquet sin geometría, indexado por `healpix_id` (`uint64`, esquema nested), `float32` y compresión `zstd` (~4 MB sin comprimir por millón de celdas y por variable, según la fuente).
7. **Número de celdas:** a `nside 8192` (~0.8 km), HEALPix tiene unos 805 millones de celdas en toda la esfera (12·nside²); el tamaño de la tabla depende del número de columnas y del tipo de dato.
8. **Validación descrita en las fuentes:** pruebas sintéticas con valores conocidos, conteo de celdas por nivel, verificación de unicidad de `healpix_id` y contraste puntual contra recortes manuales.

### Limitaciones y preguntas abiertas

- Muchas cifras de rendimiento citadas provienen de repositorios o blogs de 2026 con pocas estrellas (`healpix-resample`, `healpyxel`, `zagg`, `rayzon`, `NumPack`): valen como orden de magnitud, no como benchmark definitivo.
- Métodos orientados a GPU/HPC (`ESMF`, `t-digest`) no aplican a volúmenes locales estándar.
- Queda abierta la convención de latitud (autálica vs. geodésica) en las librerías consultadas.

### Bibliografía

- `[O]` cdshealpix en PyPI (0.9.0, BSD-3) — https://pypi.org/project/cdshealpix/ — consultado 2026-11-08.
- `[O]` raster2dggs en PyPI (0.19.1, LGPL-3.0) — https://pypi.org/project/raster2dggs/ — consultado 2026-11-08.
- `[P]` Centroide frente a cobertura fraccional — https://doi.org/10.3390/ijgi15060244 — consultado 2026-11-08.
- `[P]` DKRZ Waterpark, decisiones técnicas — https://waterpark.dkrz.de/technical-decisions/ — consultado 2026-11-08.
- `[P]` Benchmark de cdshealpix, healpy, hpgeom y astropy-healpix — https://github.com/astronomy-commons/hats/issues/53 — consultado 2026-11-08.
- `[P]` Grid4Earth, HEALPix esférico y elipsoidal — https://isprs-archives.copernicus.org/articles/L-4-W1-2026/189/2026/isprs-archives-L-4-W1-2026-189-2026.pdf — consultado 2026-11-08.
- `[B]` TechnicalGIS, estadísticas zonales — https://www.technicalgis.com/code/zonal-statistics-python/ — consultado 2026-11-08.

## Relaciones

- [[I-08-cuadriculas-de-area-igual]] — cuadrículas de área igual (HEALPix)
