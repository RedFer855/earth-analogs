---
title: "Sesión 2026-11-15 — Fase B del visor: dibujo geodésico y Medir Pin"
type: sesion
status: vigente
date: 2026-11-15
updated: 2026-11-15
summary: "Agrega utilidades de geometría esférica (área, perímetro, auto-destorcer, punto en polígono), DibujoTerritorio sobre Cesium y controles de cuadro/círculo/polígono y Medir Pin en BarraNavegacion."
autor: fernando
agente: antigravity
modelo: Gemini 4 Hydrogen (Medium)
rama: feat/visor-dibujo-medicion
scope:
  - visor/src/datos/geometria.ts
  - visor/src/herramientas/dibujo.ts
  - visor/src/ui/barra.ts
  - visor/src/style.css
  - visor/pruebas/contrato.prueba.ts
symbols:
  - DibujoTerritorio
  - areaEsfericaM2
  - perimetroEsfericoM
  - destorcerPoligono
  - puntoEnPoligono
  - construirCuadroPorPerimetro
  - construirCirculoPorPerimetro
---

# Sesión 2026-11-15 — Fase B del visor: dibujo geodésico y Medir Pin

## Qué se hizo

1. Se creó `visor/src/datos/geometria.ts` con funciones puras de cálculo geodésico (`distanciaGeodesicaM`, `perimetroEsfericoM`, `areaEsfericaM2`, `hayAutoInterseccion`, `destorcerPoligono`, `construirCuadroPorPerimetro`, `construirCirculoPorPerimetro` y `puntoEnPoligono`).
2. Se creó `visor/src/herramientas/dibujo.ts` (`DibujoTerritorio`) para trazar cuadro, círculo o polígono sobre el globo con vista previa en tiempo real, deshacer punto y cancelar (`Esc` / `Backspace`).
3. Se integraron los modos de dibujo, el resumen de área/perímetro y la herramienta **Medir Pin** en `visor/src/ui/barra.ts`.
4. Se añadieron pruebas unitarias de geometría esférica y destorcido de polígonos en `visor/pruebas/contrato.prueba.ts`.

## Verificación

- `npm --prefix visor run prueba` → `OK contrato.prueba.ts`
- `npm --prefix visor run build` → `tsc && vite build` sin errores
