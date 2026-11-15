---
title: "Sesión 2026-11-15 — Fase A del visor: barra de navegación por coordenadas, zoom y vista 3D/2D"
type: sesion
status: vigente
date: 2026-11-15
updated: 2026-11-15
summary: "Agrega BarraNavegacion minimizable con salto a coordenadas Lat/Lon, marcador temporal, controles de zoom +/-, badge de altura sobre el suelo y alternancia 3D/2D en el visor."
autor: fernando
agente: antigravity
modelo: Gemini 4 Hydrogen (Medium)
rama: feat/visor-barra-navegacion
scope:
  - visor/src/datos/coordenadas.ts
  - visor/src/ui/barra.ts
  - visor/src/globo.ts
  - visor/src/main.ts
  - visor/src/style.css
  - visor/pruebas/contrato.prueba.ts
symbols:
  - BarraNavegacion
  - parsearCoordenadas
  - formatearAlturaM
  - alternarVista3D
  - ajustarZoom
---

# Sesión 2026-11-15 — Fase A del visor: barra de navegación por coordenadas, zoom y vista 3D/2D

## Qué se hizo

1. Se creó `visor/src/datos/coordenadas.ts` con `parsearCoordenadas` (admite formatos decimales tipo Google Maps y sufijos N/S/E/W) y `formatearAlturaM`.
2. Se añadieron `obtenerAlturaCamaraM`, `ajustarZoom` y `alternarVista3D` en `visor/src/globo.ts` respetando `requestRenderMode: true`.
3. Se creó `visor/src/ui/barra.ts` (`BarraNavegacion`) con entrada de coordenadas, marcador temporal en Cesium, zoom `+/-`, badge de altura en vivo, toggle `3D/2D` y botón de minimizar.
4. Se agregaron pruebas unitarias para `parsearCoordenadas` y `formatearAlturaM` en `visor/pruebas/contrato.prueba.ts`.

## Verificación

- `npm --prefix visor run prueba` → `OK contrato.prueba.ts`
- `npm --prefix visor run build` → `tsc && vite build` sin errores (`✓ built in 9.53s`)
