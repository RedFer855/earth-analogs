---
title: "Seis referentes externos de análogos planetarios"
type: referencia
status: vigente
date: 2026-11-14
updated: 2026-11-14
summary: "Revisión de seis referentes externos de análogos planetarios (USGS TADP y Known Terrestrial Analog Sites, MMGIS, NASA Analog Explorer, ESA PANGAEA, Planetary Analogue Catalogue y PTAL) y verificación de licencias y disponibilidad del catálogo de USGS."
autor: fernando
consultado: 2026-11-14
vence: 2027-02-12
fuentes:
  - url: https://tadp.astrogeology.usgs.gov/
    nivel: O
    fecha: 2026-11-14
  - url: https://doi.org/10.5066/P9J72921
    nivel: O
    fecha: 2026-11-14
  - url: https://api.datacite.org/dois/10.5066/P9J72921
    nivel: O
    fecha: 2026-11-14
  - url: https://data.usgs.gov/datacatalog/data/USGS:5f88940b82cebb8c13d912ee
    nivel: O
    fecha: 2026-11-14
  - url: https://science.nasa.gov/solar-system/analog-explorer/
    nivel: O
    fecha: 2026-11-13
  - url: https://nasa-ammos.github.io/MMGIS/tools/measure
    nivel: O
    fecha: 2026-11-13
  - url: https://www.esa.int/articles/what-is-pangaea
    nivel: O
    fecha: 2026-11-13
  - url: https://github.com/rachellelecussan/planetary-analogue-catalogue
    nivel: P
    fecha: 2026-11-13
  - url: https://cordis.europa.eu/project/id/687302/reporting
    nivel: O
    fecha: 2026-11-13
---

# Seis referentes externos de análogos planetarios

Revisión de seis referentes externos de análogos planetarios (fuentes consultadas el 2026-11-13 y verificadas el 2026-11-14).

## El dato

| Referente | Qué es |
| :-- | :-- |
| **USGS TADP** y **Known Terrestrial Analog Sites** | Portal de datos de campo financiados por NASA, sobre ScienceBase, con filtro por tipo de análogo (eólico, impacto, volcánico, periglacial, marino, lacustre…). El catálogo es una capa de puntos de sitios útiles como análogos (Hunter, M. A., 2020, USGS, DOI `10.5066/P9J72921`). |
| **NASA/JPL MMGIS** | Visor con estado de mapa compartible y perfiles de elevación exportables. |
| **NASA Planetary Analog Explorer** | Pares Tierra–planeta con interés científico y advertencias de escala. |
| **ESA PANGAEA** | Entrenamiento geológico de astronautas en campo. |
| **Planetary Analogue Catalogue** | Catálogo en GeoJSON con referencias, precisión de coordenadas y estado de revisión. Su validador avisa si falta una referencia. Licencias declaradas: MIT para el código y CC BY 4.0 para los datos (pendiente de verificación directa). |
| **PTAL** | Biblioteca de espectros de rocas (NIR, Raman, LIBS, DRX). El proyecto terminó en 2021; no es un raster mundial y no se confirmó si la descarga sigue activa. |

### Lo que se comprobó del catálogo de USGS

- **USGS Science Data Catalog (2026-11-14):** título *Known Terrestrial Analog Sites for Planetary Science*, autor
  Marc A. Hunter (ORCID 0000-0002-6999-3245), publicado por el U.S. Geological Survey. Cobertura mundial
  (−90 a 90, −180 a 180). Licencia declarada: `http://www.usa.gov/publicdomain/label/1.0/`, la etiqueta de **dominio
  público de EE. UU.** Se puede usar libremente; se cita autor, año y DOI.
- **DataCite (2026-11-14):** mismo título y autor, año 2020. Es un *Dataset* de puntos ("impact craters, dunes,
  volcanoes, and other processes"). Su campo `rightsList` viene vacío.
- **Página de USGS** (`usgs.gov/data/known-terrestrial-analog-sites-planetary-science`): respondió 504 el 2026-11-13 y
  el 2026-11-14. **ScienceBase**, el destino del DOI, pide una verificación anti-bots y no se pudo leer.
- **TADP** responde (HTTP 200) e incluye análogos **marinos y lacustres**.
- Algunas referencias secundarias mencionan "CC0 1.0 Universal", frase que no se observó directamente en las fuentes consultadas (en la práctica, tanto CC0 como dominio público de EE. UU. permiten el uso libre).
- **No se sabe todavía:** cuántos sitios tiene, en qué formato viene y con qué precisión están las coordenadas.

## Estado de verificación

- Catálogo de USGS: existencia, autor, año y licencia (dominio público de EE. UU.) verificados en el USGS Science Data Catalog y en DataCite (2026-11-14). Contenido del archivo no revisado.
- TADP: verificado el 2026-11-14, página en línea con tipos de análogo.
- MMGIS, Analog Explorer, PANGAEA, Planetary Analogue Catalogue y PTAL: consultados el 2026-11-13 (verificación directa pendiente en los enlaces correspondientes).

## Relaciones

- [[I-01-proyectos-previos-de-analogos-en-github]] — proyectos públicos revisados e ideas de método anotadas
- [[I-03-analogos-terrestres-documentados]] — catálogo de análogos terrestres documentados en la literatura
