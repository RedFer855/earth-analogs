---
title: "I-05 — Datasets de la Luna y Marte: cómo vienen y qué preprocesamiento piden"
type: investigacion
status: vigente
date: 2026-11-04
updated: 2026-11-04
summary: "Para los datasets lunares y marcianos que NASA probablemente recomiende, qué producto exacto usar, en qué formato, proyección, resolución y tamaño vienen, cómo se baja un recorte y qué hay que hacerles antes de calcular métricas."
autor: fernando
tipo_investigacion: A
riesgo: critico
---

# I-05 — Datasets de la Luna y Marte: cómo vienen y qué preprocesamiento piden

Pregunta: en qué formato, proyección, resolución y tamaño vienen los datasets lunares y marcianos de la lista de
recursos del reto (la pestaña *Resources* abre el 2026-11-13), y qué preprocesamiento piden. Ver también
[[I-06-datasets-terrestres-formato-y-procesamiento]].

## Prompt

```
I-05 — Datasets de la Luna y Marte: formato y preprocesamiento

IMPORTANTE: Esta es una consulta de datos puntuales. No escribas una guía general, no repitas información de contexto y no hagas recomendaciones.

OBJETIVO
Para cada dataset lunar y marciano de la lista, ¿en qué formato, proyección, resolución y tamaño viene el producto que se usaría, cómo se descarga un recorte y qué preprocesamiento exige antes de calcular pendiente, rugosidad u otras métricas?

CONTEXTO (solo lo que cambia la respuesta)
- Reto de NASA Space Apps 2026: "Identify Earth Locations that Analog the Permanent Moon Base Locations and Mars" (lista oficial de recursos del reto con apertura el 13 de noviembre de 2026).
- Solo herramientas y datos gratuitos compatibles con procesamiento raster estándar (p. ej. GDAL).

YA SABEMOS (no investigar ni repetir)
- Portales: NASA Moon Trek, NASA Mars Trek, USGS Astrogeology STAC, PDS Geosciences Node.
- El video oficial del reto nombra el Planetary Data System (PDS) y el Lunar Reconnaissance Orbiter (LRO) como fuentes de la Luna y Marte.
- Qué mide cada instrumento en general (LOLA, Diviner, LROC, M3, MOLA, HiRISE, CTX, THEMIS, TES, CRISM).

DATASETS
Luna: LOLA DEM (incluido el polo sur, 5 m y 20 m si existen), LOLA pendiente, Diviner temperatura e inercia térmica, LROC WAC/NAC, M3, mapa de iluminación del polo sur y PSR.
Marte: MOLA MEGDR, HRSC-MOLA blended DEM, HiRISE DTM, CTX DTM, THEMIS inercia térmica, TES, CRISM (mapas de minerales MTRDR), SWIM (hielo subterráneo), Mars Climate Database.

PUNTOS A RESPONDER (por dataset)
1. Nombre exacto del producto recomendado y versión vigente.
2. Formato de archivo (PDS3 IMG, PDS4, GeoTIFF, COG, NetCDF, otro) y si GDAL lo abre directamente.
3. Sistema de referencia y proyección (por ejemplo, IAU Moon 2015, Mars 2000, polar estereográfica), y radio de referencia que usa.
4. Resolución espacial y tamaño aproximado del archivo global y de un recorte de 10 km².
5. Cómo se descarga solo un recorte (bounding box en Trek, STAC, HTTP Range Requests, otro).
6. Unidades y valores especiales: escala y offset, valor NoData, si la elevación es relativa a un datum o al radio.
7. Preprocesamiento que la documentación del producto indica antes de usarlo (reproyección, calibración, máscaras, corrección de bandas).
8. Licencia o condición de uso y cómo se cita.

ENTREGA
- Tabla: # | Dataset | Producto y versión | Formato (¿GDAL?) | Referencia y proyección | Resolución | Tamaño global / recorte | Recorte cómo | Unidades y NoData | Preprocesamiento | Licencia | Fuente oficial (enlace) | Fecha de la fuente | Certeza
- Certeza solo puede ser: Confirmado (la fuente oficial lo dice textualmente) / Probable (fuente secundaria o inferencia directa) / No encontrado.
- Debajo de la tabla, máximo 200 palabras con contradicciones entre fuentes o advertencias.
- Una lista aparte con los datasets planetarios que Space Apps incluyó en la pestaña Resources de retos parecidos de 2023, 2024 y 2025 (selección de sitios lunares, mapas de Marte), con el enlace al reto.
- Sin introducción, sin resumen ejecutivo, sin conclusiones.

REGLAS
- Usa primero la documentación oficial: pds-geosciences.wustl.edu, pds.nasa.gov, astrogeology.usgs.gov, trek.nasa.gov, lroc.asu.edu (o lroc.im-ldi.com), diviner.ucla.edu, swim.psi.edu, spaceappschallenge.org.
- Blogs y foros solo si no hay fuente oficial, con certeza Probable.
- Si no encuentras un dato, escribe "No encontrado". No lo deduzcas ni lo estimes.
- Tamaños en MB o GB, indicando si es el global o un recorte.
```

## Resultado

Cubre los 17 datasets pedidos con producto, proyección, resolución, recorte y preprocesamiento. Varios parámetros clave se verificaron directamente en la documentación oficial de cada producto:

### Verificado en la fuente

| # | Dato verificado | Fuente `[O]` | Fecha |
| :-- | :-- | :-- | :-- |
| 1 | LOLA `LDEM_128.LBL` (V3.0) y `LDEM_80S_20M.LBL` (V2.0): entero de 16 bits, Altura = `DN × 0.5` m relativa a `OFFSET` 1737400 m (radio oficial 1737.4 km; no aparece la esfera media de 1738.0908 km en las etiquetas). Sin `MISSING_CONSTANT` en la etiqueta. | https://imbrium.mit.edu/DATA/LOLA_GDR/CYLINDRICAL/IMG/LDEM_128.LBL · https://imbrium.mit.edu/DATA/LOLA_GDR/POLAR/IMG/LDEM_80S_20M.LBL | 2026-11-04 |
| 2 | Proyecciones LOLA: `SIMPLE CYLINDRICAL` (128 ppd = 236.901 m/px) y `POLAR STEREOGRAPHIC` (20 m/px), latitud planetocéntrica. | Mismas etiquetas | 2026-11-04 |
| 3 | `LDEM_80S_20M_FLOAT` está disponible en el PDS Geosciences Node: V2.1, `PC_REAL` 32 bits, kilómetros sobre 1737.4 km, 30 400 × 30 400 px (no en `imbrium`). | https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/float_img/ldem_80s_20m_float.lbl | 2026-11-04 |
| 4 | GDAL abre PDS3 `.IMG`, PDS4 `.xml` e ISIS `.cub` mediante los drivers `PDS` (abrir `.lbl`), `PDS4` e `ISIS3`. En PDS3 la escala no se aplica sola (`gdal_translate -ot Float32 -unscale`). PDS4 e ISIS3 marcan NoData y saturación con banda de máscara. Los drivers leen georreferencia y CRS de la etiqueta; el riesgo ocurre en GeoTIFF sin CRS planetario o al reproyectar sin indicarlo. | https://gdal.org/en/stable/drivers/raster/pds.html · …/pds4.html · …/isis3.html | 2026-11-04 |
| 5 | Mars Climate Database 6.2: uso científico libre citando origen e informando a los autores; uso comercial prohibido. Versión completa (netCDF y Fortran) con registro; la web es solo para uso moderado. Promedia condiciones y subestima extremos y rangos diurnos. | https://www-mars.lmd.jussieu.fr/mars/access.html | 2026-11-04 |
| 6 | SWIM 2.0 se descarga en GeoTIFF, TIFF y PNG (~3 km/px, 20 ppd, proyección simple cilíndrica, actualizado el 2021-02-24; valor NoData legible vía `gdalinfo`). No publica licencia en el portal. Existe esfuerzo posterior SWIM4MIM sin fecha pública. | https://swim.psi.edu/SWIM2Products.php | 2026-11-04 |
| 7 | Pestaña *Resources* de Space Apps 2026 (reto de análogos y retos hermanos): figura cerrada con apertura anunciada para el 2026-11-13. | https://www.spaceappschallenge.org/2026/challenges/permanent-moon-base-locations-and-mars/?tab=resources | 2026-11-04 |
| 8 | M3 Nivel 2: resolución confirmada de 140 m/px Global (binning 2 × 2) y 70 m/px Target; el detalle del número de bandas (85 y 260) corresponde al SIS del producto (`DPSIS.PDF`). | https://ode.rsl.wustl.edu/moon/pagehelp/Content/Missions_Instruments/ISRO_Chandrayaan-1/M3/Intro.htm | 2026-11-04 |
| 9 | Diviner GDR (`lro_diviner_derived1`, datos 2009-07 a 2016-10): `.IMG` `LSB_INTEGER` 16 bits con `.LBL`, `MISSING_CONSTANT = -32768`, escala y offset por capa (aplicar `-unscale`). Proyección simple cilíndrica 128 ppd y polar estereográfica a 240 m/px de 75° al polo, radio 1737.4 km. El parámetro H de Hayne et al. (2017), sustituto de la inercia térmica lunar, no aparece en `data_derived_gdr_l2/`. | https://pds-geosciences.wustl.edu/lro/urn-nasa-pds-lro_diviner_derived1/data_derived_gdr_l2/ | 2026-11-04 |
| 10 | NASA Moon Trek y Mars Trek: su portal describe descargas de impresión 3D, perfiles en CSV y teselas WMTS (para datos brutos científicos corresponden PDS, PGDA y STAC). | https://trek.nasa.gov/ | 2026-11-04 |

Otros parámetros reportados de la literatura y documentación: THEMIS inercia térmica a 100 m/px (en J m⁻² K⁻¹ s⁻½), TES de Putzig y Mellon a 20 ppd, MOLA MEGDR a 463 m (~2 GB), HRSC-MOLA a 200 m (~11 GB), CRISM MTRDR con NoData 65535 y offset de puntería de Diviner en 2016.

### Advertencias técnicas de los productos

- LOLA polar: usar los mapas de conteo y de error para no medir rugosidad sobre zonas interpoladas.
- Diviner no publica inercia térmica directa en la Luna: el producto es el parámetro H (cm), que es su inverso.
- Mosaicos NAC polares (~189 GB) sin co-registro entre imágenes: no sirven para métricas.
- No unir DTM de HiRISE o CTX vecinos sin co-registro: crean escalones falsos.
- COG: no calcular métricas leyendo overviews.

## Relaciones

- [[I-07-armonizar-tierra-luna-marte]] — cómo poner estos datos en la misma grilla que los terrestres
