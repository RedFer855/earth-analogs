---
title: "I-07 — Cómo armonizar datos de la Tierra, la Luna y Marte para compararlos"
type: investigacion
status: vigente
date: 2026-11-04
updated: 2026-11-05
summary: "Qué pasos documentados se usan para llevar rasters de cuerpos distintos a métricas comparables: sistemas de referencia, reproyección a área igual, pendiente y rugosidad según resolución, normalización de temperatura y mineralogía, y qué herramientas gratuitas lo hacen."
autor: fernando
tipo_investigacion: A
riesgo: critico
---

# I-07 — Cómo armonizar datos de la Tierra, la Luna y Marte para compararlos

Documenta el procesamiento y armonización de los datos inventariados en [[I-05-datasets-planetarios-formato-y-procesamiento]] e [[I-06-datasets-terrestres-formato-y-procesamiento]]. La formulación de similitud se trata en [[I-02-indice-de-similitud-analoga]].

## Prompt

```
I-07 — Armonizar rasters de la Tierra, la Luna y Marte

IMPORTANTE: Esta es una consulta de datos puntuales. No escribas una guía general, no repitas información de contexto y no hagas recomendaciones.

OBJETIVO
¿Qué pasos y herramientas documentados se usan para convertir rasters de la Tierra, la Luna y Marte en métricas comparables entre sí (pendiente, rugosidad, temperatura, mineralogía)?

CONTEXTO (solo lo que cambia la respuesta)
- Reto de análogos terrestres de la Luna y Marte (NASA Space Apps 2026).
- Rasters de resoluciones muy distintas, tratados con herramientas gratuitas (GDAL/PROJ, bindings de GDAL o rasterio en Python).

YA SABEMOS (no investigar ni repetir)
- La métrica de similitud se define en otra investigación.

PUNTOS A RESPONDER
1. Sistemas de referencia que usan los productos de la Luna (IAU Moon, MOON_ME/PA) y Marte (IAU Mars 2000, planetocéntrico o planetográfico) y cómo se declaran en GDAL/PROJ (códigos IAU_2015 u otros).
2. Proyección de área o distancia conservada recomendada para comparar celdas entre cuerpos, y cómo reproyectar desde polar estereográfica o simple cilíndrica.
3. Cómo cambia la pendiente y la rugosidad calculadas con la resolución del DEM (efecto de escala) y qué métodos publicados la corrigen o la reportan a una escala fija (baseline).
4. Algoritmos estándar de pendiente y rugosidad (Horn, Zevenbergen-Thorne, RMS de desviación, TRI) y en qué herramienta gratuita están (gdaldem, WhiteboxTools, otras).
5. Cómo se comparan temperaturas de superficie entre cuerpos con rangos muy distintos (normalización por amplitud diurna, por percentiles, otra) en la literatura de análogos.
6. Cómo se comparan índices minerales de espectrómetros distintos (CRISM o M3 frente a EMIT o ASTER): bandas equivalentes o mapas de clases.
7. Soporte de CRS planetarios en GDAL/PROJ actual y en el crate gdal de Rust y en rasterio (versiones).
8. Artículos o herramientas publicadas que ya hagan comparaciones cuantitativas Tierra-Marte o Tierra-Luna de terreno, con su método.

ENTREGA
- Tabla: # | Punto | Respuesta | Fuente oficial o artículo (enlace) | Fecha de la fuente | Certeza
- Certeza solo puede ser: Confirmado / Probable / No encontrado.
- Debajo de la tabla, máximo 200 palabras con contradicciones entre fuentes o advertencias.
- Sin introducción, sin resumen ejecutivo, sin conclusiones.

REGLAS
- Usa primero documentación oficial y artículos revisados: gdal.org, proj.org, docs.rs/gdal, rasterio.readthedocs.io, astrogeology.usgs.gov, pds-geosciences.wustl.edu, ADS (ui.adsabs.harvard.edu), revistas como Icarus, JGR Planets, Planetary and Space Science.
- Blogs y foros solo si no hay fuente oficial, con certeza Probable.
- Si no encuentras un dato, escribe "No encontrado". No lo deduzcas.
```

## Resultado

Principio central identificado en la literatura: la temperatura superficial no se compara directamente en kelvin entre cuerpos planetarios, sino a través de la **inercia térmica**.

### Verificado en la fuente

| # | Dato verificado | Fuente `[O]` | Fecha |
| :-- | :-- | :-- | :-- |
| 1 | `IAU_2015:30100` (Luna esfera planetocéntrica), `IAU_2015:30130` (polar estereográfica norte) e `IAU_2015:30135` (polar estereográfica sur, correspondiente al polo sur lunar). | https://spatialreference.org/ref/iau_2015/30100/ · …/30130/ · …/30135/ | 2026-11-04 |
| 2 | `IAU_2015:49900` (Marte esfera planetocéntrica) e `IAU_2015:49920` (sinusoidal). | https://spatialreference.org/ref/iau_2015/49900/ · …/49920/ | 2026-11-04 |
| 3 | `IAU_2015:49905` devuelve 404 en spatialreference.org (código inexistente en el registro IAU 2015). | https://spatialreference.org/ref/iau_2015/49905/ | 2026-11-04 |
| 4 | `gdaldem TRI` usa la definición de Riley por defecto desde GDAL 3.3 (sin dividir por vecinos); Wilson es la alternativa disponible. | https://gdal.org/en/stable/programs/gdaldem.html | 2026-11-04 |
| 5 | GDAL 3.11 calcula la relación vertical/horizontal desde el CRS en `slope` y `hillshade` sin `-s`; advierte resultados distorsionados a latitud alta en CRS geográfico y `-s 111120` aplica únicamente a la Tierra. | Misma página | 2026-11-04 |
| 6 | Crate `gdal` 0.19.0 (2025-12-23): bindings para GDAL 3.4 a 3.11 (la documentación de 0.19.0 falla en docs.rs; la última compilada ahí es 0.18.0). | https://docs.rs/crate/gdal/latest · https://crates.io/api/v1/crates/gdal | 2026-11-04 |
| 7 | `rasterio` incluye `CRS.from_authority` desde la versión 1.1.7. | https://rasterio.readthedocs.io/en/stable/api/rasterio.crs.html | 2026-11-04 |
| 8 | Sanganeria (2026, NHSJS, 2026-04-21) existe, pero compara brillo de imágenes normalizado por min-max, no DEM ni variables físicas. | https://nhsjs.com/2026/finding-earths-best-testbeds-for-moon-and-mars-rovers-a-quantitative-terrain-comparison/ | 2026-11-04 |

La literatura también documenta el efecto de escala en morfometría (Shepard et al. 2001, Kreslavsky y Head 2000, Rosenburg et al. 2011), la clasificación mineral mediante Tetracorder o parámetros de CRISM, y trabajos de comparación geomorfológica (Luo 2024, Stepinski). Las cadenas PROJ de transformación entre latitud planetográfica y planetocéntrica reportadas en foros requieren comprobación directa antes de aplicarse.

### Lo que dicen las fuentes

1. **Pendiente y rugosidad:** la documentación de GDAL indica que `gdaldem` calcula pendiente y TRI (Riley por defecto desde GDAL 3.3) y advierte de resultados distorsionados en CRS geográfico a latitud alta; los productos del polo sur lunar usan proyecciones polares estereográficas (p. ej. `IAU_2015:30135`).
2. **Escala:** la literatura citada (Shepard et al. 2001, Kreslavsky y Head 2000, Rosenburg et al. 2011) documenta que pendiente y rugosidad dependen de la resolución y la línea base.
3. **Temperatura e inercia térmica:** Marte tiene THEMIS (100 m) y TES (~3 km); la Luna tiene el parámetro H de Diviner. La literatura trata la inercia térmica como magnitud comparable entre cuerpos, no la temperatura en kelvin ([[I-27-inercia-termica-con-unidades-fisicas]]).
4. **Mineralogía:** la literatura compara espectrómetros distintos mediante clases o parámetros resumen (p. ej. CRISM, M3, EMIT), no mediante bandas crudas.
5. **Versiones de herramientas:** el crate `gdal` 0.19.0 declara bindings para GDAL 3.4 a 3.11 (ver tabla).

## Relaciones

- [[I-05-datasets-planetarios-formato-y-procesamiento]] — datasets de la Luna y Marte
- [[I-06-datasets-terrestres-formato-y-procesamiento]] — datasets de la Tierra
- [[I-11-sesgo-por-escala-de-cada-variable]] — sesgo por escala al agregar variables
- [[I-27-inercia-termica-con-unidades-fisicas]] — inercia térmica aparente en la Tierra
