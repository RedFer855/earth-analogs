---
title: "Fuentes de cráteres, salares, roca, glaciares y accesibilidad: licencia y peso"
type: referencia
status: vigente
date: 2026-11-15
updated: 2026-11-15
summary: "Licencia, peso y estado de las fuentes de E-16 y E-17: Wikidata (cráteres), Natural Earth (playas), GLiM, RGI 7.0 y Weiss 2018."
autor: fernando
consultado: 2026-11-15
vence: 2027-02-13
fuentes:
  - url: https://query.wikidata.org/
    nivel: O
    fecha: 2026-11-15
  - url: https://www.naturalearthdata.com/about/terms-of-use/
    nivel: O
    fecha: 2026-11-15
  - url: https://doi.pangaea.de/10.1594/PANGAEA.788537
    nivel: O
    fecha: 2026-11-15
  - url: https://rgidata.org/user_guide/03_data_decription.html
    nivel: O
    fecha: 2026-11-15
  - url: https://zenodo.org/records/14535885
    nivel: O
    fecha: 2026-11-15
---

# Fuentes de cráteres, salares, roca, glaciares y accesibilidad: licencia y peso

## El dato

| Capa | Fuente | Licencia | Peso | Estado |
| :-- | :-- | :-- | :-- | :-- |
| Cráteres de impacto | Wikidata, SPARQL (P31/P279* Q55818, globo Q2) | CC0 1.0 | 63 kB (202 entradas, 65 con diámetro) | En uso (E-17) |
| Tubos de lava | Pyroduct Digital Catalog v3.0 (Romio et al. 2026) | CC BY 4.0 | 86 MB zip | En uso (E-16): 57 bocas verificadas de 119 |
| Playas y salares | Natural Earth 1:10m Playas | Dominio público | 100 kB (73 polígonos) | En uso (E-17) |
| Roca volcánica y evaporitas | GLiM v1.0, malla 0.5° | CC BY 3.0 | 38 kB zip | En uso (E-18) |
| Roca, versión vectorial | GLiM v1.0, 1.2 millones de polígonos | no verificado | no verificado | Pendiente de licencia |
| Glaciares | RGI 7.0 (NSIDC-0770) | CC BY 4.0 según la guía de RGI | no verificado | Pendiente: requiere cuenta Earthdata |
| Accesibilidad | Weiss et al. 2018 (Malaria Atlas Project) | CC BY 4.0 según Google Earth Engine; no verificado en MAP | ~1 km de resolución | Pendiente |

Descartadas:

- **Earth Impact Database (PASSC):** el dominio passc.net está aparcado (2026-11-15) y nunca declaró licencia.
- **Impact Earth (Osinski et al. 2022):** el artículo es CC BY-NC-ND; la licencia de la tabla no está declarada.

El DOI de Pyroduct aparece de dos formas en Zenodo: el registro dice `10.5281/zenodo.23456401` y la cita
recomendada usa `10.5281/zenodo.14535885`. No verificado cuál corresponde a la v3.0.

## Relaciones

- [[ADR-009-capas-de-puntos-y-distancias]] — cómo se usan
- [[licencias-coordenadas-de-cuevas]] — licencias de cuevas y OSM
- [[sensores-tierra]] — resto de sensores terrestres
