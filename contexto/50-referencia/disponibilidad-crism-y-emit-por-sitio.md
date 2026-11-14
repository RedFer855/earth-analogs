---
title: "CRISM (Marte) y EMIT (Tierra): qué son y cómo se consultan sus catálogos"
type: referencia
status: vigente
date: 2026-11-13
updated: 2026-11-13
summary: "Qué son CRISM (Marte, producto MTRDR) y EMIT (Tierra, producto L2B MIN) y por dónde se consultan sus catálogos públicos (API ODE de WUSTL y CMR de Earthdata). Nota mínima: sin resultados de consultas."
autor: fernando
consultado: 2026-11-13
vence: 2027-02-11
fuentes:
  - url: https://oderest.rsl.wustl.edu/live2/
    nivel: O
    fecha: 2026-11-13
  - url: https://cmr.earthdata.nasa.gov/search/granules.json
    nivel: O
    fecha: 2026-11-13
---

# CRISM (Marte) y EMIT (Tierra): qué son y cómo se consultan sus catálogos

Nota mínima de referencia. Fuentes consultadas el 2026-11-13; los catálogos suman escenas nuevas con el tiempo.

## Qué son

- **CRISM MTRDR:** producto de mineralogía del espectrómetro CRISM de la sonda MRO, en Marte (`MROCR_4001`, escenas de 2006 a 2012; ver [[sensores-marte]]). Se consulta en la API ODE de WUSTL: https://oderest.rsl.wustl.edu/live2/ (consultado 2026-11-13).
- **EMIT L2B MIN:** producto de mineralogía del espectrómetro EMIT, en la Tierra (`EMITL2BMIN`; ver [[sensores-tierra]]). Se consulta en el catálogo CMR de Earthdata: https://cmr.earthdata.nasa.gov/search/granules.json (consultado 2026-11-13).

## Cobertura

- EMIT observa la Tierra entre 54° N y 54° S, de modo que no cubre el Ártico ni latitudes más altas (no verificado en la documentación oficial).
- CRISM no cubre todo Marte: sus escenas son puntuales.

## Preguntas abiertas

- Cobertura exacta de cada producto según su documentación oficial (por verificar en la fuente).

## Relaciones

- [[I-24-equivalencias-de-clases-minerales]] — equivalencias entre clases de EMIT y parámetros de CRISM
- [[sensores-marte]] — CRISM, TES y SWIM
- [[sensores-tierra]] — EMIT, ASTER y el resto de datasets terrestres
