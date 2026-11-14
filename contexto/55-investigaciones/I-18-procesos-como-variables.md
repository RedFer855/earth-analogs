---
title: "I-18 — Procesos como variables: medir erosión, polvo, volcanismo, hielo y alteración por agua en los tres cuerpos"
type: investigacion
status: vigente
date: 2026-11-05
updated: 2026-11-05
summary: "Qué productos globales permiten medir procesos (no solo estados) en la Tierra, la Luna y Marte —sedimentación, tormentas de polvo, volcanismo, erosión, dinámica del hielo, alteración por agua— y cómo se han comparado entre cuerpos en trabajos publicados."
autor: fernando
tipo_investigacion: B
riesgo: critico
---

# I-18 — Procesos como variables

Explora qué productos globales permiten medir procesos superficiales (principio 2 del reto en [[dimensiones-innegociables]]), más allá del estado estático.

## Prompt

```
I-18 — Procesos como variables comparables entre la Tierra, la Luna y Marte

IMPORTANTE: Busco productos de datos y trabajos publicados. No diseñes un método nuevo, no escribas una guía general y no recomiendes una opción.

OBJETIVO
¿Qué productos de datos globales permiten medir procesos superficiales (no solo el estado de la superficie) en la Tierra, la Luna y Marte, y qué trabajos publicados ya compararon esos procesos entre cuerpos?

CONTEXTO (solo lo que cambia la respuesta)
- Reto de NASA Space Apps 2026: identificar análogos considerando procesos superficiales (sedimentación, tormentas de polvo, actividad volcánica, erosión, dinámica del hielo y alteración provocada por el agua, actual o pasada).
- Evaluación de magnitudes calculables a escala de cuadrículas de área igual (~0.6 a 2.5 km²) y su comparabilidad entre la Tierra, la Luna y Marte.

YA SABEMOS (no investigar ni repetir)
- Viento y polvo en la Tierra: MERRA-2 (M2T1NXSLV, M2T1NXAER); aerosoles: MODIS MAIAC (MCD19A2).
- El umbral de arrastre de arena se compara entre cuerpos con el número de Shields (Kok et al. 2012).
- Minerales en la Tierra: EMIT, ASTER; en Marte: CRISM; en la Luna: Diviner, M3.
- Permafrost en la Tierra: Obu et al. 2018.

PUNTOS A RESPONDER
1. Por cada proceso (sedimentación, tormentas de polvo, actividad volcánica, erosión, dinámica del hielo, alteración por agua): qué magnitud medible lo representa (por ejemplo, frecuencia de eventos de polvo, tasa de erosión, edad o actividad volcánica, presencia de arcillas o sulfatos).
2. Para cada magnitud del punto 1: producto global de la Tierra (nombre corto, versión, resolución, cobertura, licencia, cuenta necesaria).
3. Para cada magnitud del punto 1: producto o catálogo equivalente en Marte y en la Luna, si existe (por ejemplo, catálogos de tormentas de polvo de Marte, mapas de minerales hidratados de CRISM, catálogos de volcanes o flujos de lava, mapas de glaciares cubiertos de Marte).
4. Para procesos del pasado (por ejemplo, alteración por agua antigua en Marte): qué evidencia mineral o morfológica se usa y si hay mapas globales.
5. Trabajos publicados que comparan un proceso entre la Tierra y Marte o la Luna con datos cuantitativos (no solo descripciones): qué proceso, qué magnitud, qué datos.
6. Catálogos globales de la Tierra útiles como capas de procesos: volcanes (por ejemplo, Smithsonian Global Volcanism Program), cráteres de impacto (por ejemplo, Earth Impact Database), salares y lagos secos, glaciares (por ejemplo, RGI): versión, licencia y formato.
7. Qué procesos no tienen ningún producto global medible en alguno de los tres cuerpos (escribe "No encontrado" para ese cuerpo).

ENTREGA
- Tabla 1 (puntos 1-4, 7): # | Proceso | Magnitud | Producto Tierra | Producto Marte | Producto Luna | Resolución | Licencia | Enlace | Certeza
- Tabla 2 (puntos 5-6): # | Punto | Respuesta | Fuente (enlace) | Fecha de la fuente | Certeza
- Certeza: Confirmado / Probable / No encontrado.
- Máximo 250 palabras fuera de las tablas. Sin introducción ni recomendación.

REGLAS
- Primero documentación oficial y artículos revisados: earthdata.nasa.gov, lpdaac.usgs.gov, pds.nasa.gov, volcano.si.edu, ADS (ui.adsabs.harvard.edu), Icarus, JGR Planets, Planetary and Space Science, Geomorphology, Earth-Science Reviews.
- Cada fila con enlace a la fuente. Blogs o wikis solo si no hay otra fuente, marcado Probable.
- Si no encuentras un dato, escribe "No encontrado". No lo deduzcas.
```

## Resultado

Catálogo de magnitudes, productos globales y comparaciones cuantitativas entre cuerpos. En Marte y la Luna la mayor parte de los inventarios publicados corresponde a catálogos discretos de rasgos (puntos o polígonos) en lugar de mallas continuas por celda.

### Productos y comparaciones documentadas

- **Productos terrestres en malla agregables por celda:** espesor de sedimento de Pelletier (1 km), velocidad de glaciares de ITS_LIVE (120 m), cambio de elevación glaciar de Hugonnet, agua superficial de JRC GSW v1.4 (30 m), lagos salinos de GLWD v2 y anomalías térmicas de MODVOLC y MIROVA.
- **Equivalentes en Marte:**
  - Polvo: MDAD v1.1 (Battalio et al.; Zenodo `10.5281/zenodo.7480334`, 2022-12-24, CC BY 4.0), con contornos de tormentas de los años marcianos 28 a 32 en NetCDF y CSV.
  - Dunas: MGD3 (USGS).
  - Valles: Alemanno et al. (2018).
  - Glaciares cubiertos: Levy et al. (2014) y Souness et al. (2012).
  - Minerales (PSA de la ESA, `cosmos.esa.int/web/psa/mars-maps`): el mapa de minerales hidratados OMEGA/CRISM de Carter et al. (2013) en CSV y shapefile corresponde a sitios puntuales de detección, no a abundancia por píxel; los mapas por píxel a 1.48 km corresponden a minerales anhidros (Ody et al. 2012: piroxeno, olivino, Fe³⁺).
- **Equivalentes en la Luna:** desprendimientos de rocas (Bickel et al. 2020, 136 610 casos en celdas de 2°), flujos granulares, mares basálticos (Nelson et al. 2014) y depósitos piroclásticos.
- **Comparaciones cuantitativas publicadas entre cuerpos:**
  - Flujo de arena en dunas (Bridges et al. 2012): Marte, 1 a 15 m³/m/año, del mismo orden que Victoria Valley y White Sands.
  - Efusión de lava (Glaze et al. 2009); en fuentes secundarias los valores terrestres de Fernandina figuran tanto puntual (6 m³/s) como en rango (6 a 500 m³/s).
  - Erosión en el Amazónico frente al Noeico (Golombek et al. 2006): orden de magnitud reportado entre 1000 y 10 000 nm/año (0.001 a 0.01 mm/año; fuentes secundarias han citado cifras en mm/año discrepantes con la gráfica original).
  - Difusión de cráteres en la Luna (Fassett y Thomson 2014): 6 a 8 m²/Myr.
  - Glaciares cubiertos de Marte frente a Islandia, y polígonos periglaciales de Mongolia frente a Marte.
- **Vacíos físicos documentados:**
  - La Luna carece de procesos eólicos, hidrológicos y glaciares actuales.
  - Marte carece de volcanismo activo detectado y agua líquida superficial actual.
  - La Tierra carece de mallas globales continuas de desprendimientos rocosos o de flujo de arena en dunas.

### Notas de cobertura y licencias verificadas

- **GloSEM (ESDAC, `esdac.jrc.ec.europa.eu/content/glosem`):** cubre únicamente tierras de cultivo a 100 m (Borrelli et al. 2022), exige registro con declaración de propósito y prohíbe transferir datos a terceros; no cubre desiertos ni zonas polares.
- **Earth Impact Database y GVP VOTW (`volcano.si.edu`):** requieren verificación directa en navegador de versión vigente y términos de redistribución antes de incorporarlos.
- **Escala de productos gruesos:** SIM 3292 (1:20 000 000) y SWIM (~3 km) exceden el tamaño de las celdas de cuadrículas de 0.6 a 2.5 km² y operan como contexto con incertidumbre asociada ([[I-11-sesgo-por-escala-de-cada-variable]]).
- **Alcance metodológico:** un proceso puede representarse globalmente mediante presencia o distancia al rasgo más cercano (dunas, glaciar, volcán holoceno, salar, minerales hidratados) a partir de catálogos globales, mientras que las tasas cuantitativas (m³/m/año, nm/año) solo existen en sitios puntuales estudiados (p. ej., Nili Patera frente a Victoria Valley). Las licencias de los catálogos terrestres (GVP, RGI 7.0, GLWD v2, JRC GSW, GLiM) se recopilan en [[sensores-tierra]].

## Fuentes

- <https://cosmos.esa.int/web/psa/mars-maps>
- <https://esdac.jrc.ec.europa.eu/content/glosem>
- <https://doi.org/10.5281/zenodo.7480334>

## Relaciones

- [[dimensiones-innegociables]] — el principio 2 y la dimensión 5
- [[sensores-tierra]] — los datasets terrestres
- [[I-11-sesgo-por-escala-de-cada-variable]] — sesgo por escala e incertidumbre de capas gruesas
