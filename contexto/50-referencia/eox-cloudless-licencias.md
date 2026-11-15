---
title: "Licencias de EOxCloudless (Sentinel-2 cloudless) por año"
type: referencia
status: vigente
date: 2026-11-15
updated: 2026-11-15
summary: "En el WMTS de EOX solo el mosaico 2016 (`s2cloudless_3857`) es CC BY 4.0; los mosaicos de 2017 y 2018 en adelante, hasta 2025, son CC BY-NC-SA 4.0 y el uso comercial necesita licencia propia de EOX."
autor: fernando
consultado: 2026-11-15
vence: 2027-02-13
fuentes:
  - url: https://tiles.maps.eox.at/wmts/1.0.0/WMTSCapabilities.xml
    nivel: O
    fecha: 2026-11-15
  - url: https://cloudless.eox.at/documentation/license
    nivel: O
    fecha: 2026-11-15
---

# Licencias de EOxCloudless (Sentinel-2 cloudless) por año

## El dato

El campo `Abstract` de cada capa en el `WMTSCapabilities.xml` de EOX, leído el 2026-11-15:

| Capa (EPSG:3857) | Datos | Licencia |
| :-- | :-- | :-- |
| `s2cloudless_3857` | 2016 | CC BY 4.0 |
| `s2cloudless-2018_3857` | 2017 y 2018 | CC BY-NC-SA 4.0 |
| `s2cloudless-2019_3857` a `s2cloudless-2025_3857` | un año cada una | CC BY-NC-SA 4.0 |

La página de licencias de EOX dice que el uso no comercial es libre si se conserva la atribución, y que el
comercial se rige por la "EOX Commercial Attribution-RestrictedUse 1.2 License". La atribución unificada es:
`EOxCloudless https://cloudless.eox.at by EOX IT Services GmbH (Contains modified Copernicus Sentinel data AAAA)`.
El servicio pide además atribución visible en el mapa (`AccessConstraints` del WMTS).

## Qué cambia para el proyecto

- El visor usa 2016 por defecto, como fija ADR-011, porque es la única capa sin la cláusula NC ni ShareAlike.
- Los años 2018 a 2025 solo se cargan si se piden con `?imagen=AAAA`, y el crédito muestra entonces
  CC BY-NC-SA 4.0. NASA Space Apps es uso no comercial, pero ShareAlike obliga a compartir lo derivado con la misma
  licencia; por eso no es el predeterminado.
- El crédito en `visor/src/globo.ts` usa el texto oficial y enlaza la licencia de cada año.

## Estado de verificación

Verificado — fernando, 2026-11-15, leyendo el XML de capacidades y la página de licencias de EOX.

## Relaciones

- [[capas-gibs-truecolor]] — comparación de EOX 2016 con las capas de NASA GIBS
- [[ADR-011-visor-web-sobre-el-contrato]] — fija EOX 2016 como imagen base
