---
title: "Sesión 2026-11-15 — Fase D del visor: overlays temáticos opcionales por zona (GIBS y Macrostrat)"
type: sesion
status: vigente
date: 2026-11-15
updated: 2026-11-15
summary: "Agrega CapaOverlaysZona para mostrar capas opcionales de NASA GIBS (polvo AOD, temperatura superficial diurna) y Macrostrat (litología) acotadas a la zona seleccionada, con respaldo limpio sin conexión."
autor: fernando
agente: antigravity
modelo: Gemini 4 Hydrogen (Medium)
rama: feat/visor-overlays-zona
scope:
  - visor/src/capas/overlaysZona.ts
  - visor/src/ui/panelZona.ts
  - visor/src/main.ts
  - visor/pruebas/contrato.prueba.ts
symbols:
  - CapaOverlaysZona
  - calcularBboxZona
  - parsearUnidadesMacrostrat
---

# Sesión 2026-11-15 — Fase D del visor: overlays temáticos opcionales por zona (GIBS y Macrostrat)

## Qué se hizo

1. Se creó `visor/src/capas/overlaysZona.ts` (`CapaOverlaysZona`, `calcularBboxZona`, `parsearUnidadesMacrostrat`) con overlays opcionales de NASA GIBS (AOD y temperatura superficial diurna) acotados al rectángulo de la zona y consulta Macrostrat v2 con timeout de 4 s y degradación limpia sin red.
2. Se integró el selector de capa temática opcional en `visor/src/ui/panelZona.ts` y `visor/src/main.ts`.
3. Se agregaron pruebas unitarias de `calcularBboxZona` y `parsearUnidadesMacrostrat` en `visor/pruebas/contrato.prueba.ts`.

## Verificación

- `npm --prefix visor run prueba` → `OK contrato.prueba.ts`
- `npm --prefix visor run build` → `tsc && vite build` sin errores
