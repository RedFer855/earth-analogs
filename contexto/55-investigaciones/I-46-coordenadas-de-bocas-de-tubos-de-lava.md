---
title: "I-46 — Segunda fuente para coordenadas de bocas de tubos de lava del catálogo Pyroduct v3.0"
type: investigacion
status: vigente
date: 2026-11-13
updated: 2026-11-15
summary: "Qué segunda fuente independiente existe para las coordenadas de bocas de tubos de lava del Pyroduct Digital Catalog v3.0 (Zenodo, doi 10.5281/zenodo.14535885) y cómo se contrastan."
autor: fernando
tipo_investigacion: A
riesgo: bajo
---

# I-46 — Segunda fuente para coordenadas de bocas de tubos de lava del catálogo Pyroduct v3.0

Contraste de coordenadas de bocas de tubos de lava del Pyroduct Digital Catalog v3.0 (Zenodo, doi 10.5281/zenodo.14535885) con una segunda fuente independiente.

## Prompt

```
I-46 — Segunda fuente para coordenadas de cuevas volcánicas

IMPORTANTE: Esta es una consulta de datos puntuales. No escribas una guía general, no repitas información de contexto y no hagas recomendaciones.

OBJETIVO
Para tubos de lava del catálogo, encontrar una fuente independiente (distinta de la URL indicada) con la coordenada de su boca, y decir a cuántos metros queda la coordenada del catálogo.

CONTEXTO (solo lo que cambia la respuesta)
- Lista procedente del Pyroduct Digital Catalog v3.0 (Zenodo, doi 10.5281/zenodo.14535885), coordenadas en WGS84.
- Basta un punto a menos de ~200 m de la boca. Un punto de "zona" o de pueblo no sirve como segunda fuente.

PUNTOS A RESPONDER
1. Qué fuentes independientes (catastros espeleológicos, servicios de parques, artículos con tabla de coordenadas, Wikidata) publican la coordenada de la boca de tubos de lava incluidos en el catálogo, y a cuántos metros queda la coordenada del catálogo.

ENTREGA
- Tabla: Tubo de lava | Fuente independiente (enlace) | Lat, lon de la fuente | Distancia a la del catálogo (m) | Fecha de la fuente | Certeza
- Certeza: Confirmado / Probable / No encontrado.
- Máximo 150 palabras fuera de la tabla. Sin introducción ni conclusiones.

REGLAS
- Primero fuentes oficiales: catastros espeleológicos (Catasto Grotte Sicilia, GESPEA/Montanheiros en Azores, Cabildos de Canarias), servicios de parques (NPS), artículos con tabla de coordenadas, Wikidata.
- Una fuente que copia la del catálogo (mismo punto con los mismos decimales y sin otra cita) no cuenta.
- Si no encuentras una coordenada, escribe "No encontrado". No la deduzcas de un mapa ni de un pueblo.
- Distancias con la fórmula del haversine en WGS84.
```

## Resultado

El archivo `Pyroduct_Digital_Catalog_v3.0.zip` contiene 119 tubos de lava (más una fila final `NOTES:` y dos filas de actualización futura en China), **sin coordenadas geográficas** en su índice `.xlsx` ni en los primeros archivos `.txt` de levantamiento inspeccionados. Por ello, las coordenadas de `etl/sitios/cuevas-pyroduct-coordenadas.json` se curaron y contrastaron con fuentes abiertas compatibles comercialmente (`ODbL 1.0`, `CC0 1.0`, `CC BY 4.0`):

- **Resultado global:** **57 filas verificadas** (**55 sistemas únicos** en IT, ES, US, JO, JP, AU, PT e IC); **62 filas en `null`** (2 protegidas: `US.NMX.01` Cave 29 en El Malpais y `ES.LNZ.04` Montaña Rajada en Timanfaya; 2 futuras en China; y 58 sin boca pública verificable o solo con centroides de parroquia/municipio). En Azores, los conjuntos GBIF `10.15468/dpvue3` y `10.15468/f4xjdb` repiten centroides de freguesia entre parroquias vecinas (`37.81388, -25.69292`), por lo que solo se retuvieron cuevas con nodo explícito `natural=cave_entrance` en OpenStreetMap.

Contraste entre pares independientes (haversine sobre esfera R = 6371.0072 km):

| Tubo de lava | Fuente primaria curada | Segunda fuente independiente | Distancia (m) | Certeza |
| :-- | :-- | :-- | --: | :-- |
| `IT.SIC.10` Grotta Micio Conti | OSM `node/701646611` | GBIF `10.15468/f4xjdb` | 2.2 | Confirmado |
| `ES.EHR.04` Sima de las Palomas | GBIF `10.15468/eugwe2` | iBOL `10.15468/inygc6` | 3.4 | Confirmado |
| `ES.EHR.00` Cueva de la Curva | GBIF `10.15468/eugwe2` | GBIF `10.15468/f4xjdb` | 10.2 | Confirmado |
| `IT.SIC.00` Grotta Catanese I | OSM `node/459810840` | GBIF `10.15468/f4xjdb` | 20.3 | Confirmado |
| `ES.LPA.00` Cueva de Barros | García et al. 2021 (`10.3897/subtbiol.38.61733`) | GBIF `10.15468/eugwe2` | 26.1 | Confirmado |
| `IC.HLM.00` Víðgelmir | OSM `node/291607233` | Wikidata `Q626642` | 33.7 | Confirmado |
| `ES.LPA.04` Virgen de Fátima | GBIF `10.15468/eugwe2` | GBIF `10.15468/f4xjdb` | 35.4 | Confirmado |
| `IC.LTR.00` Búri | OSM `node/280034975` | Wikidata `Q15109960` | 36.8 | Confirmado |
| `US. CAL.00` Ship Cave | OSM `node/4915732667` (USGS topo) | Centroide traza Bell et al. 2022 (`10.13016/ovqx-j09w`) | 49.6 | Confirmado |
| `ES.LNZ.00` La Corona (Verdes) | OSM `node/12329752473` | Wikidata `Q899513` | 77.2 | Confirmado |
| `ES.LPA.05` Cueva de los Palmeros | OSM `node/12666700783` | GBIF `10.15468/f4xjdb` | 77.3 | Confirmado |
| `ES.EHR.03` Cueva del Mocán | OSM `node/4474188242` | GBIF `10.15468/eugwe2` | 215.9 | Probable |

## Relaciones

- [[licencias-coordenadas-de-cuevas]] — licencias de las fuentes
- [[2026-11-15-fernando-e16-cuevas]] — paso E-16 y columnas `cueva_n_tubos` y `cueva_dist_km`
