---
title: "I-15 — Cómo medir de forma automática el rendimiento de una página WebGL en Windows"
type: investigacion
status: vigente
date: 2026-11-04
updated: 2026-11-04
summary: "Cómo medir tiempo por cuadro, cuadros por segundo y memoria de una página WebGL desde Playwright o Puppeteer en Windows, si Chrome sin interfaz usa la GPU real y cómo simular un equipo más débil."
autor: fernando
tipo_investigacion: A
riesgo: bajo
---

# I-15 — Cómo medir de forma automática el rendimiento de una página WebGL en Windows

Documenta cómo medir tiempos por cuadro, uso de GPU real y memoria en Chrome/Playwright/Puppeteer sobre Windows.

## Prompt

```
I-15 — Medir rendimiento WebGL de forma automática

IMPORTANTE: Esta es una consulta de datos puntuales. No escribas una guía general, no repitas el contexto y no recomiendes.

OBJETIVO
Saber cómo medir, con un script que se repite, el rendimiento de una página WebGL (un globo 3D) en una PC con Windows.

CONTEXTO (solo lo que cambia la respuesta)
- Equipos con Windows 11 y GPU integrada o dedicada ejecutando una aplicación WebGL (CesiumJS o Three.js).
- Métricas de interés: tiempo por cuadro (p50 y p95), cuadros por segundo, tiempo de carga y consumo de memoria.

YA SABEMOS (no investigar ni repetir)
- Existen Playwright y Puppeteer para automatizar Chrome.

PUNTOS A RESPONDER
1. Cómo medir tiempo por cuadro y cuadros por segundo de una página WebGL desde Playwright o Puppeteer: API y ejemplo documentado.
2. ¿Chrome sin interfaz (headless) en Windows usa la GPU real o un renderizador por software (SwiftShader)? Flags para forzar la GPU y cómo comprobar cuál usa (chrome://gpu, WEBGL_debug_renderer_info).
3. Métricas de memoria accesibles desde la página o el protocolo DevTools (performance.memory, measureUserAgentSpecificMemory, Tracing) y si incluyen memoria de GPU.
4. Cuánto calentamiento y cuánto tiempo de medición usan benchmarks publicados de WebGL o de globos 3D, con fuente.
5. Cómo simular un equipo más débil: limitación de CPU de DevTools y si existe algo equivalente para la GPU.

ENTREGA
- Tabla: # | Punto | Respuesta | Fuente oficial (enlace) | Fecha de la fuente | Certeza
- Certeza: Confirmado / Probable / No encontrado.
- Responde los 5 puntos, aunque sea con "No encontrado".
- Máximo 150 palabras fuera de la tabla. Sin introducción ni conclusiones.

REGLAS
- Primero documentación oficial: playwright.dev, pptr.dev, chromedevtools.github.io, developer.chrome.com, chromium.org, developer.mozilla.org.
- Blogs solo si no hay fuente oficial, con certeza Probable.
- Si no encuentras un dato, escribe "No encontrado". No lo deduzcas.
```

## Resultado

Respuesta a los cinco puntos con documentación oficial de Chrome, Puppeteer, MDN, Chromium, WebKit y Cesium:

### Hallazgos

1. **Tiempo por cuadro:** bucle con `requestAnimationFrame` y `performance.now()` dentro de `page.evaluate`; ordenar los intervalos para obtener p50 y p95.
2. **GPU real en modo headless:** el `--headless` moderno de Chrome usa la GPU si hay controladores disponibles. Se verifica mediante `WEBGL_debug_renderer_info` ("ANGLE (Direct3D11 …)" indica GPU real; "Google SwiftShader" indica renderizado por software).
3. **Memoria:** `performance.memory` y `measureUserAgentSpecificMemory()` miden únicamente JavaScript, DOM y WebAssembly; el uso de memoria de GPU requiere trazas `memory-infra` del protocolo DevTools.
4. **Calentamiento en benchmarks:** MotionMark emplea ~2 s de calentamiento y 30–60 s de medición. `FrameRateMonitor` de CesiumJS usa 2 s de reposo, 5 s de calentamiento y 5 s de muestreo.
5. **Simulación de hardware limitado:** la CPU puede limitarse con `Emulation.setCPUThrottlingRate` (factores 4 o 6); no existe limitación equivalente de GPU en Chromium (issue 41144556).

### Verificado en la fuente

| # | Dato verificado | Fuente `[O]` | Fecha |
| :-- | :-- | :-- | :-- |
| 1 | `FrameRateMonitor`: `quietPeriod` 2, `warmupPeriod` 5, `samplingWindow` 5, `minimumFrameRateDuringWarmup` 4. | https://cesium.com/learn/cesiumjs/ref-doc/FrameRateMonitor.html | 2026-11-04 |

## Relaciones

- [[I-13-rendimiento-de-poligonos-en-cesium]] — métodos de renderizado de polígonos en CesiumJS
- [[I-14-alternativas-de-globo-3d]] — librerías WebGL evaluadas
