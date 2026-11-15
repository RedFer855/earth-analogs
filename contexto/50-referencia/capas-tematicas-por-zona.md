---
title: "Servicios abiertos de las capas temáticas por zona del visor"
type: referencia
status: vigente
date: 2026-11-15
updated: 2026-11-15
summary: "El botón Capas de una zona consulta en vivo cinco servicios abiertos (Macrostrat, SoilGrids, NASA POWER, JRC GSW con OSM, NASA GIBS); cada uno con su licencia o la mención de que no está verificada."
autor: fernando
consultado: 2026-11-15
vence: 2027-02-13
fuentes:
  - url: https://macrostrat.org/api
    nivel: O
    fecha: 2026-11-15
  - url: https://www.isric.org/explore/soilgrids
    nivel: O
    fecha: 2026-11-08
  - url: https://power.larc.nasa.gov/docs/referencing/
    nivel: O
    fecha: 2026-11-08
---

# Servicios abiertos de las capas temáticas por zona del visor

## El dato

El panel «Capas de la zona» recorta al polígono de una zona guardada datos de servicios abiertos. No entran al ETL
ni al motor y no cambian ningún puntaje: son contexto para leer una zona.

| Familia | Servicio | Licencia o condición |
| :-- | :-- | :-- |
| Geología | Macrostrat API v2 | CC BY 4.0; atribuir. Detalle en [[macrostrat-api]]. |
| Suelos | ISRIC SoilGrids 2.0 (WMS, 250 m) | CC BY 4.0 según [[sensores-tierra]]. Es un mapa estimado por modelo. |
| Polvo y vegetación | NASA GIBS (MODIS Terra, aerosol y NDVI de 8 días) | No verificado hoy; la nota [[capas-gibs-truecolor]] cubre solo el color verdadero. |
| Radiación | NASA POWER (climatología 1°) | No publica licencia: citar servicio y fecha de acceso ([[sensores-tierra]]). |
| Agua | JRC Global Surface Water (teselas de 30 m) | Régimen abierto de Copernicus: citar «EC JRC/Google» ([[sensores-tierra]]). |
| Salares | OpenStreetMap vía Overpass | No verificado hoy; la licencia de OpenStreetMap exige atribución. |

## Qué cambia para el proyecto

- Cada capa muestra su fuente y su unidad, y cada imagen lleva su crédito en el globo.
- En `localhost` el visor pide Macrostrat, POWER, SoilGrids y Overpass por rutas `/proxy/…` que define
  `visor/vite.config.ts`; fuera de `localhost` las pide directo y puede fallar si el servicio no permite CORS.
- Si un servicio no responde, la capa lo dice («sin dato disponible en vivo») y no inventa nada.

## Estado de verificación

Parcial. Macrostrat, SoilGrids y JRC se tomaron de las notas ya consultadas (fechas en cada una). NASA GIBS para
aerosol y NDVI y OpenStreetMap quedan como no verificados.

## Relaciones

- [[macrostrat-api]] — geología
- [[sensores-tierra]] — licencias de SoilGrids, POWER y JRC
- [[capas-gibs-truecolor]] — GIBS de color verdadero
