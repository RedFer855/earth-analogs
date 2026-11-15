---
title: "Sesión 2026-11-15 — Búsqueda multicondición y coroplético nivel 7 (Fase 4)"
type: sesion
status: vigente
date: 2026-11-15
updated: 2026-11-15
summary: "Fase 4 del visor: pestaña Buscar con deslizadores y presets (Como Jezero / Como Shackleton) sobre las 12 capas nivel 7 de E-21, mapa coroplético con p1-p99 y geometría HEALPix nested en TypeScript."
autor: fernando
agente: antigravity
modelo: Gemini 4 Hydrogen (Medium)
rama: feat/visor-busqueda
scope:
  - visor/src/datos/healpix.ts
  - visor/src/datos/capas7.ts
  - visor/src/capas/capas7.ts
  - visor/src/ui/busqueda.ts
  - visor/src/ui/panel.ts
  - visor/src/main.ts
  - scripts/visor/publicar-datos.mjs
symbols:
  - ipixACentro
  - ipixAVertices
  - cargarCapas7
  - evaluarCondiciones
  - CapaCapas7
  - PanelBusqueda
---

# Sesión 2026-11-15 — Búsqueda multicondición y coroplético nivel 7 (Fase 4)

## Problema o motivo

Con el paso E-21 ya integrado en `main`, faltaba exponer en el visor la búsqueda multicondición en el navegador sobre las capas agregadas a HEALPix nivel 7 (`capas7/`) y la visualización coroplética con percentiles `p1`-`p99`.

## Cambios

- `visor/src/datos/healpix.ts` → cálculo puro en TypeScript de centro y 4 vértices continuos (±180°) para celdas HEALPix `nested` (`nside = 128`).
- `visor/src/datos/capas7.ts` → cargadores binarios (`ipix.u32` y `<col>.f32` bajo demanda) y `evaluarCondiciones` sobre las 64 211 celdas.
- `visor/src/capas/capas7.ts` → `CapaCapas7` que pinta el mapa de calor de condiciones cumplidas o el coroplético por variable en un único `Cesium.Primitive`.
- `visor/src/ui/busqueda.ts` y `visor/src/ui/panel.ts` → pestaña `"Buscar"` con deslizadores, presets `"Como Jezero"` / `"Como Shackleton"`, selector coroplético y leyenda `p1` / `p50` / `p99`.
- `scripts/visor/publicar-datos.mjs` → soporte `--capas7 <dir>` para copiar `capas7.json`, `ipix.u32`, `n_hijas.u16` y los 12 `.f32` a `visor/public/datos/capas7/`.

## Verificación

- `npm --prefix visor run prueba` → pasa (`tsc --noEmit` + `OK contrato.prueba.ts` con pruebas de `ipixACentro`, `ipixAVertices` y `evaluarCondiciones`).
- `npm --prefix visor run build` → compila (`vite build`, 1644 módulos).
- `node scripts/visor/publicar-datos.mjs $RUN/salida --puntos $RUN_PUNTOS/export/puntos.geojson --capas7 $RUN/web/capas7` → publica 24 JSON + 15 capas nivel 7 (3386.1 KB).

## Relaciones

- [[ADR-011-visor-web-sobre-el-contrato]] — arquitectura del visor
- [[2026-11-15-fernando-e21-capas-web]] — generación de capas nivel 7 (E-21)
- [[2026-11-15-fernando-visor-pines]] — Fase 3 del visor
