---
title: "I-27 — Inercia térmica con unidades físicas en la Tierra, y los productos de la Luna y Marte"
type: investigacion
status: vigente
date: 2026-11-08
updated: 2026-11-08
summary: "Qué producto publicado o método reproducible da inercia térmica en J·m⁻²·K⁻¹·s⁻¹ᐟ² sobre la Tierra a ~1 km, qué pide exactamente el método de Earth and Space Science 2024, y dónde están en el PDS el parámetro H de Diviner y la inercia de THEMIS y TES."
autor: fernando
tipo_investigacion: A
riesgo: critico
---

# I-27 — Inercia térmica con unidades físicas en la Tierra, y los productos de la Luna y Marte

**Pregunta.** El índice clásico de inercia térmica aparente `(1 − albedo) / ΔT` no tiene unidades físicas. ¿Existe un producto o método publicado con unidades físicas reales (J·m⁻²·K⁻¹·s⁻¹ᐟ²) que permita comparar la Tierra con la Luna y Marte? El artículo doi:10.1029/2023EA003259 (Earth and Space Science, 2024-09) es un modelo termofísico validado con experimentos de campo en tefra basáltica de Arizona.

## Prompt

```
I-27 — Inercia térmica con unidades físicas

IMPORTANTE: Esta es una consulta de datos puntuales. No escribas una guía de teledetección térmica, no repitas el contexto y no hagas recomendaciones.

OBJETIVO
¿Existe un producto publicado o un método reproducible con datos satelitales abiertos que dé la inercia térmica de la superficie terrestre en J·m⁻²·K⁻¹·s⁻¹ᐟ² a ~1 km, comparable con THEMIS/TES (Marte) y Diviner (Luna)?

CONTEXTO (solo lo que cambia la respuesta)
- La variable solo sirve para comparar cuerpos si tiene la misma unidad física en la Tierra, la Luna y Marte.
- Datos abiertos considerados: MODIS, VIIRS, ECOSTRESS, ASTER, MERRA-2.
- La inercia térmica aparente ATI = (1 − albedo)/(T_día − T_noche) con MOD11A2 y MCD43A3 no tiene unidades físicas.
- El modelo de Presley y Christensen solo vale a la presión de Marte.

PUNTOS A RESPONDER
1. Productos publicados de inercia térmica de la Tierra en unidades físicas (global o regional): nombre, cobertura, resolución, años, formato, dónde se descarga y licencia.
2. Métodos publicados que convierten MODIS, VIIRS, ASTER o ECOSTRESS en inercia térmica con unidades físicas: qué datos de entrada piden además de temperatura y albedo (humedad, viento, radiación, hora de paso), y error reportado contra mediciones de campo.
3. Del artículo doi:10.1029/2023EA003259: qué datos de entrada exige el método, si se puede aplicar solo con datos satelitales o necesita sondas de campo, y si publica código.
4. Luna: ruta exacta en el PDS (Geosciences Node o LRO Diviner) del mapa del parámetro H o de la inercia térmica derivada de Diviner, con resolución y formato.
5. Marte: producto de inercia térmica de THEMIS (global o mosaico) y de TES: nombre exacto, resolución, ruta de descarga.
6. Rangos típicos publicados de inercia térmica en la Tierra para arena seca, roca desnuda y suelo húmedo, en la misma unidad, para poder comparar órdenes de magnitud con la Luna y Marte.

ENTREGA
- Una tabla con columnas: # | Punto | Respuesta | Fuente oficial (enlace o DOI) | Fecha de la fuente | Certeza
- Certeza: Confirmado / Probable / No encontrado.
- Debajo, máximo 150 palabras con contradicciones o advertencias.
- Sin introducción ni conclusiones.

REGLAS
- Primero fuentes oficiales y revisadas: PDS (pds-geosciences.wustl.edu, pds.nasa.gov), Earthdata, USGS Astrogeology, revistas AGU, Remote Sensing of Environment, Icarus, JGR Planets.
- Si no encuentras un dato, escribe "No encontrado". No lo deduzcas ni lo estimes.
```

## Resultado

Consulta del 2026-11-08. Los DOI citados existen en Crossref y las rutas de descarga respondieron; los artículos no se leyeron completos.

**Hallazgos de las fuentes**

- **Tierra, punto 1: no hay producto.** Ningún producto satelital global o regional da inercia térmica en
  J·m⁻²·K⁻¹·s⁻¹ᐟ². El único dato en unidades físicas es el local de Koeppel et al. 2024 (Woodhouse Mesa, Arizona;
  datos en Zenodo, doi:10.5281/zenodo.11553365).
- **Tierra, punto 2: los métodos con MODIS, ASTER o ECOSTRESS no dan un producto directo comparable.** Todos piden además temperatura del
  aire, humedad, viento o radiación de estaciones, y se validan contra humedad del suelo, no contra inercia térmica:
  Matsushima et al. 2018 (MODIS), Bhattacharya et al. 2022 (STIC-TI), Mi et al. 2015 (STI), Ramakrishnan et al. 2013
  (ASTER) y Jia et al. 2025 (ECOSTRESS, en J·m⁻²·K⁻¹, sin s⁻¹ᐟ²). Con ASTER sin corrección de flujos turbulentos, la
  roca da 3697–9065 frente a 1764–2272 en laboratorio.
- **Punto 3, Koeppel et al. 2024:** pide cámara térmica calibrada, radiómetro neto, anemómetro, termohigrómetro,
  barómetro y sondas de temperatura y humedad del suelo. Los autores indican que no se aplica en la Tierra solo con
  satélite. Error ≤ 8 % contra sondas. Código MATLAB con licencia MIT (doi:10.5281/zenodo.12193764; GitHub
  NAU-PIXEL/Thermal-Inertia-for-Mars-Analogs).
- **Luna, punto 4:** el bundle `lro_diviner_derived1` del PDS (doi:10.17189/wj0s-w188) no tiene mapa de H ni de
  inercia; tiene temperatura del regolito y abundancia de rocas (GHRM a 128 ppd, 70°S–70°N; GDR L3 a 32 ppd), según su
  readme (https://pds.nasa.gov/data/pds4/releases/geo/lro_diviner_derived1-20251218/readme.txt). Los
  mapas de H de Hayne et al. 2017 (128 ppd, 70°S–70°N) están en un Google Drive del autor, enlazado desde
  https://phayne.github.io/projects/5_lunar-regolith/, sin licencia declarada.
- **Marte, punto 5:** THEMIS, mosaico global de inercia térmica a 100 m (60°S–60°N, .cub de 32 bits, USGS
  Astrogeology; Fergason et al. 2006; https://astrogeology.usgs.gov/search/map/mars-themis-derived-global-thermal-inertia-mosaic). TES, MGS-M-TES-5-TIMAP-V1.0 a 20 ppd (PDS, `mgst_9001.zip`; Putzig y Mellon
  2007), y el mapa preliminar de Mellon et al. 2000 a 8 ppd.
- **Punto 6, rangos en la Tierra:** arena o suelo seco 285–695 (McMurdo, Levy 2026; tefra de Arizona 350–550), roca
  intacta 1764–2014 en laboratorio, suelo saturado hasta ~2000. Luna: regolito ~50; Marte: polvo < 100, arena 180–314,
  roca ~2500.
- **Los valores absolutos no se comparan directamente entre cuerpos.** La misma arena seca da 350–695 en la Tierra,
  180–314 en Marte y ~50 en la Luna, porque a 1 bar el aire entre granos domina la conducción: el número refleja la
  atmósfera además del material.

## Preguntas abiertas

- Los productos GHRM y los mapas de Hayne llegan a 70°S; los sitios lunares candidatos del polo sur están por encima de
  84°S. Los productos polares PCP y PRP de Diviner no se revisaron.
- La inercia a 10 ppd de Hayne no se verificó.

## Fuentes

- <https://pds.nasa.gov/data/pds4/releases/geo/lro_diviner_derived1-20251218/readme.txt>
- <https://phayne.github.io/projects/5_lunar-regolith/>
- <https://astrogeology.usgs.gov/search/map/mars-themis-derived-global-thermal-inertia-mosaic>
- <https://doi.org/10.1029/2023EA003259>

- <https://goo.gl/JhMGs5>
- <https://doi.org/10.5281/zenodo.11553365>
- <https://doi.org/10.5281/zenodo.12193764>
- <https://doi.org/10.17189/wj0s-w188>

## Relaciones

- [[sensores-luna]], [[sensores-marte]], [[sensores-tierra]] — productos de cada cuerpo
