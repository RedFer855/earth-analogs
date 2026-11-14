---
title: "I-12 — CesiumJS sin Cesium ion: imágenes y terreno de la Luna y Marte"
type: investigacion
status: vigente
date: 2026-11-04
updated: 2026-11-04
summary: "Qué deja de funcionar en CesiumJS sin token de Cesium ion, qué permite la cuenta gratuita y qué servicios abiertos de imagen y terreno de la Luna y Marte se cargan en CesiumJS, con licencia y cobertura del polo sur lunar."
autor: fernando
tipo_investigacion: A
riesgo: critico
---

# I-12 — CesiumJS sin Cesium ion: imágenes y terreno de la Luna y Marte

Documentación sobre soporte planetario en CesiumJS 1.147.0 (Apache-2.0, incluye `Ellipsoid.MOON` y `Ellipsoid.MARS`).

## Prompt

```
I-12 — CesiumJS sin Cesium ion para la Luna y Marte

IMPORTANTE: Esta es una consulta de datos puntuales. No escribas una guía general, no repitas el contexto y no recomiendes.

OBJETIVO
Saber con qué imágenes y terreno de la Luna y Marte puede funcionar una aplicación CesiumJS, con y sin cuenta de Cesium ion.

CONTEXTO (solo lo que cambia la respuesta)
- Visor web estático en CesiumJS 1.147.0 (con Ellipsoid.MOON y Ellipsoid.MARS), sin servidor propio.
- Cobertura requerida del polo sur lunar (latitudes de 85° S a 90° S).

YA SABEMOS (no investigar ni repetir)
- CesiumJS 1.147.0 tiene Ellipsoid.MOON y Ellipsoid.MARS y licencia Apache-2.0.

PUNTOS A RESPONDER
1. Sin token de Cesium ion, qué deja de funcionar en CesiumJS (imagen base por defecto, terreno, geocodificador) y cómo se configura para no pedirlo.
2. Cuenta gratuita de Cesium ion: límites de uso y si permite un proyecto público de hackathon.
3. Servicios de imagen de la Luna cargables en CesiumJS (por ejemplo Moon Trek): URL del servicio, protocolo (WMTS, TMS, XYZ), proyección, resolución y licencia.
4. Lo mismo para Marte (por ejemplo Mars Trek o USGS Astrogeology).
5. Terreno (elevación) de la Luna y Marte para CesiumJS: formato (quantized-mesh, heightmap, 3D Tiles), fuente y licencia; incluye lo que ofrezca Cesium ion.
6. ¿Esos servicios cubren el polo sur lunar sobre 85° S, o hay un hueco por la proyección?

ENTREGA
- Tabla: # | Punto | Respuesta | Fuente oficial (enlace) | Fecha de la fuente | Certeza
- Certeza: Confirmado / Probable / No encontrado.
- Responde los 6 puntos, aunque sea con "No encontrado".
- Máximo 150 palabras fuera de la tabla. Sin introducción ni conclusiones.

REGLAS
- Primero documentación oficial: cesium.com/learn, github.com/CesiumGS, trek.nasa.gov, astrogeology.usgs.gov, pds.nasa.gov.
- Foros (community.cesium.com) solo si no hay fuente oficial, con certeza Probable.
- Si no encuentras un dato, escribe "No encontrado". No lo deduzcas.
```

## Resultado

### Verificado en la fuente

| # | Dato verificado | Fuente `[O]` | Fecha |
| :-- | :-- | :-- | :-- |
| 1 | Moon Trek WMTS `LRO_WAC_Mosaic_Global_303ppd_v02` (~100 m/píxel), plantilla XYZ: `WMTSCapabilities.xml` y tesela `0/0/0.jpg` responden 200 con `Access-Control-Allow-Origin: *`, cargables desde un sitio estático sin token. | https://trek.nasa.gov/tiles/Moon/EQ/LRO_WAC_Mosaic_Global_303ppd_v02/1.0.0/WMTSCapabilities.xml | 2026-11-04 |
| 2 | Mars Trek WMTS: MOLA sombreado (463 m) y CTX (5 m); ambos `WMTSCapabilities.xml` responden 200. | https://trek.nasa.gov/tiles/Mars/EQ/Mars_MGS_MOLA_ClrShade_merge_global_463m/1.0.0/WMTSCapabilities.xml | 2026-11-04 |
| 3 | Cuenta Community de Cesium ion: gratuita, 10 GB de almacenamiento y 15 GB/mes de transferencia, restringida a "Personal and non-commercial use" (los términos no mencionan hackathones explícitamente). | https://cesium.com/platform/cesium-ion/pricing/ | 2026-11-04 |
| 4 | "Cesium Moon Terrain" en 3D Tiles (`asset 2684829`): usado por el ejemplo oficial de Sandcastle con `Ellipsoid.MOON`; requiere token de Cesium ion. | https://github.com/CesiumGS/cesium (`packages/sandcastle/gallery/moon/main.js`) | 2026-11-04 |
| 5 | Sin token de Cesium ion dejan de funcionar la imagen base por defecto, el terreno por defecto y el geocodificador; deben desactivarse en la configuración del `Viewer`. | https://cesium.com/learn/cesiumjs/ref-doc/Viewer.html | 2026-11-04 |
| 6 | Cobertura polar en CesiumJS: una capa equirectangular en `GeographicTilingScheme` cubre de −90° a 90° sin hueco geométrico, aunque la imagen se estira cerca del polo y pierde nitidez. Los mosaicos polares de Trek vienen en estereográfica polar y CesiumJS no los consume directamente sin reproyección previa. | — | 2026-11-04 |

## Relaciones

- [[I-14-alternativas-de-globo-3d]] — las alternativas a CesiumJS
