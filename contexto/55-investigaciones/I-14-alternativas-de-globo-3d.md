---
title: "I-14 — Alternativas de globo 3D web: CesiumJS, deck.gl, MapLibre GL JS y Three.js"
type: investigacion
status: vigente
date: 2026-11-04
updated: 2026-11-04
summary: "Compara cuatro librerías de globo 3D para mostrar la Tierra, la Luna y Marte con decenas de miles de polígonos coloreados: terreno, cambio de cuerpo, rendimiento con polígonos, polos, licencia y dependencia de servicios con token."
autor: fernando
tipo_investigacion: B
riesgo: bajo
---

# I-14 — Alternativas de globo 3D web

Compara cuatro librerías web de globo 3D (CesiumJS, deck.gl, MapLibre GL JS y Three.js) para visualizar la Tierra, la Luna y Marte.

## Prompt

```
I-14 — Alternativas de globo 3D

IMPORTANTE: Esta es una comparación de opciones contra criterios definidos. No escribas guías, no repitas el contexto y no elijas una opción: solo compara.

OBJETIVO
Comparar librerías web de globo 3D para mostrar la Tierra, la Luna y Marte con decenas de miles de polígonos coloreados por atributos numéricos.

CONTEXTO (solo lo que cambia la comparación)
- Sitio web estático, sin servidor.
- Visualización de 10 000 a 200 000 polígonos en un globo web (incluido el polo sur lunar), actualizando colores dinámicamente a partir de un arreglo de valores.

YA SABEMOS (no investigar ni repetir)
- CesiumJS 1.147.0 (Apache-2.0) tiene Ellipsoid.MOON y Ellipsoid.MARS.

OPCIONES A COMPARAR
1. CesiumJS
2. deck.gl con GlobeView
3. MapLibre GL JS con proyección de globo
4. Three.js (con three-globe u otra capa de globo)

CRITERIOS
1. ¿Globo 3D con terreno (elevación)?
2. ¿Se puede usar otro cuerpo con otro radio (Luna 1737.4 km, Marte 3396.19 km)? Cómo.
3. Dibujo de decenas de miles de polígonos coloreados por atributo: método y cifra de rendimiento publicada.
4. ¿Se ve y se puede dibujar sobre el polo (90° S)?
5. Licencia, versión y fecha del último release.
6. ¿Depende de un servicio externo con token o clave (imágenes, terreno)?

ENTREGA
- Tabla comparativa: filas = opciones, columnas = criterios. Cada celda con el dato y la certeza entre paréntesis (C = confirmado, P = probable, N = no encontrado).
- Tabla de fuentes: Opción | Criterio | Fuente (enlace) | Fecha.
- Hasta 3 "hechos que cambiarían la comparación".
- Máximo 200 palabras fuera de las tablas. Sin recomendación final.

REGLAS
- Primero documentación oficial: cesium.com/learn, deck.gl/docs, maplibre.org/maplibre-gl-js/docs, threejs.org/docs, npmjs.com, github.com de cada proyecto.
- Blogs y foros solo si no hay fuente oficial, con certeza P.
- Si no encuentras un dato, escribe "No encontrado". No lo deduzcas.
```

## Resultado

Comparación de las cuatro opciones bajo los seis criterios; ninguna cuenta con benchmarks publicados para 10 000 a 200 000 polígonos en globos planetarios. El soporte de cambio de radio en deck.gl y MapLibre figura como "No encontrado" en su documentación oficial.

### Resumen

| Opción | Otro cuerpo | Polo sur (90° S) | Terreno | Token |
| :-- | :-- | :-- | :-- | :-- |
| CesiumJS 1.147.0 | Sí (`Ellipsoid.MOON`, `MARS` o semiejes propios) | Sí | Sí | No obligatorio |
| deck.gl 9.4.1 (GlobeView, experimental) | No encontrado: asume la Tierra | Sí | Experimental | No |
| MapLibre GL JS 6.16.0 | No encontrado | **No**: corta en ~85° por las teselas Web Mercator (fuente de 2024) | Sí | No |
| Three.js r187 (+ three-globe 2.45.6) | Three.js sí (radio propio); three-globe esfera fija | Sí | Three.js a mano; three-globe solo relieve simulado | No |

### Verificado en la fuente

| # | Dato verificado | Fuente `[O]` | Fecha |
| :-- | :-- | :-- | :-- |
| 1 | Versiones, fechas y licencias en npm: `cesium` 1.147.0 (2026-11-02, Apache-2.0); `deck.gl` 9.4.1 (2026-10-28, MIT); `maplibre-gl` 6.16.0 (2026-10-25, BSD-3-Clause); `three` 0.187.0 (2026-10-30, MIT); `three-globe` 2.45.6 (2026-10-14, MIT). | https://registry.npmjs.org/ | 2026-11-04 |
| 2 | `BufferPolygonCollection` en CesiumJS: API experimental documentada oficialmente. | https://cesium.com/learn/cesiumjs/ref-doc/BufferPolygonCollection.html | 2026-11-04 |

## Relaciones

- [[I-12-cesium-sin-ion-luna-y-marte]] — datos de imagen y terreno para CesiumJS
- [[I-13-rendimiento-de-poligonos-en-cesium]] — rendimiento de polígonos en CesiumJS
