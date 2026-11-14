---
title: "I-13 — Rendimiento de CesiumJS con decenas de miles de polígonos que cambian de color"
type: investigacion
status: vigente
date: 2026-11-04
updated: 2026-11-04
summary: "Formas de dibujar muchos polígonos en CesiumJS, cifras de rendimiento publicadas, cómo recolorearlos sin recrearlos y herramientas internas para medir cuadros por segundo."
autor: fernando
tipo_investigacion: A
riesgo: bajo
---

# I-13 — Rendimiento de CesiumJS con decenas de miles de polígonos que cambian de color

Evalúa cómo dibujar y recolorear entre 10 000 y 200 000 polígonos sobre un globo CesiumJS según documentación oficial e issues.

## Prompt

```
I-13 — Rendimiento de polígonos en CesiumJS

IMPORTANTE: Esta es una consulta de datos puntuales. No escribas una guía general, no repitas el contexto y no recomiendes.

OBJETIVO
Saber cómo dibujar y recolorear entre 10 000 y 200 000 polígonos sobre un globo CesiumJS y qué rendimiento está documentado.

CONTEXTO (solo lo que cambia la respuesta)
- Página web estática en CesiumJS 1.147.0 para dibujar polígonos de una cuadrícula global de área igual (cuadriláteros de 4 vértices, incluido el polo sur lunar) y actualizar sus colores en lote de forma dinámica.

YA SABEMOS (no investigar ni repetir)
- CesiumJS tiene Entity y Primitive.

PUNTOS A RESPONDER
1. Formas de dibujar muchos polígonos (Entity, Primitive con GeometryInstance, GroundPrimitive, GeoJsonDataSource, 3D Tiles) y diferencias de rendimiento documentadas.
2. Cifras publicadas: cuántos polígonos, cuadros por segundo, tiempo de carga o memoria, con versión de CesiumJS y hardware.
3. Cómo cambiar el color de miles de polígonos sin recrearlos (getGeometryInstanceAttributes, ColorGeometryInstanceAttribute, estilos o CustomShader de 3D Tiles) y su costo.
4. Problemas conocidos con polígonos sobre los polos o que cruzan el antimeridiano.
5. Herramientas internas de medición: scene.debugShowFramesPerSecond, eventos postRender, requestRenderMode.

ENTREGA
- Tabla: # | Punto | Respuesta | Fuente oficial (enlace) | Fecha de la fuente | Certeza
- Certeza: Confirmado / Probable / No encontrado.
- Responde los 5 puntos, aunque sea con "No encontrado".
- Máximo 150 palabras fuera de la tabla. Sin introducción ni conclusiones.

REGLAS
- Primero documentación oficial: cesium.com/learn (ref-doc y blog), sandcastle.cesium.com, issues de github.com/CesiumGS/cesium.
- Foros (community.cesium.com) solo si no hay fuente oficial, con certeza Probable.
- Si no encuentras un dato, escribe "No encontrado". No lo deduzcas ni lo estimes.
```

## Resultado

Respuesta a los cinco puntos según documentación oficial e issues de CesiumJS; no hay benchmarks oficiales publicados para el rango de 10 000 a 200 000 polígonos.

### Hallazgos

- **`Entity` y `GeoJsonDataSource`:** en reportes de comunidad sobre versiones previas se describen caídas a 10–15 FPS con 10 000 polígonos y fallos de navegador cerca de 50 000.
- **`Primitive` con `GeometryInstance`:** agrupa múltiples geometrías en un solo búfer y una sola llamada de dibujo. Permite actualizar colores sin recrear la geometría mediante `getGeometryInstanceAttributes(id)` y `ColorGeometryInstanceAttribute.toValue` (recorrer 200 000 instancias en JavaScript implica un bloqueo breve del hilo principal).
- **`GroundPrimitive`:** realiza pasadas extra de profundidad y presenta reportes de caída a 9–24 FPS con cámara inclinada (issue #8484).
- **Polos:** polígonos con líneas loxodrómicas sobre el polo generan errores de triangulación (issue #8032, abierto); GeoJSON sobre el polo sur tuvo errores corregidos en el issue #12251.
- **Medición de rendimiento:** `scene.debugShowFramesPerSecond`, `scene.postRender` y `scene.requestRenderMode`.

### Verificado en la fuente

| # | Dato verificado | Fuente `[O]` | Fecha |
| :-- | :-- | :-- | :-- |
| 1 | Issues documentados de polígonos y polos: #8484, #8032 (abierto), #12251 y #4871. | https://api.github.com/repos/CesiumGS/cesium/issues/8032 | 2026-11-04 |
| 2 | `BufferPolygonCollection` (API experimental introducida entre 1.145 y 1.147): almacena polígonos en `ArrayBuffer` para reducir uso de memoria y mejorar rendimiento, actualizando material al recorrer la colección (también tratada en [[I-14-alternativas-de-globo-3d]]). | https://cesium.com/learn/cesiumjs/ref-doc/BufferPolygonCollection.html · https://github.com/CesiumGS/cesium/blob/main/CHANGES.md | 2026-11-04 |

## Relaciones

- [[I-08-cuadriculas-de-area-igual]] — cuadrículas de área igual
- [[I-14-alternativas-de-globo-3d]] — comparativa de librerías de globo 3D
