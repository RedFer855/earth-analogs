---
title: "Sesión 2026-11-15 — Iconos SVG para cueva, cráter y salar con filtro rápido"
type: sesion
status: vigente
date: 2026-11-15
updated: 2026-11-15
summary: "Reemplaza los puntos planos de CapaPines por billboards SVG (cueva/tubo de lava, cráter de impacto y salar) y agrega los mismos iconos y botones Todos/Ninguno en el filtro del panel."
autor: fernando
agente: antigravity
modelo: Gemini 4 Hydrogen (Medium)
rama: feat/visor-iconos-pines
scope:
  - visor/src/capas/pines.ts
  - visor/src/style.css
symbols:
  - svgIconoTipo
  - CapaPines
---

# Sesión 2026-11-15 — Iconos SVG para cueva, cráter y salar con filtro rápido

## Problema o motivo

Los marcadores de referencia en el globo eran puntos de color genéricos; se pidieron iconos SVG distintivos (cueva, cráter y salar) y controles en la interfaz para mostrar u ocultar cada categoría.

## Cambios

- `visor/src/capas/pines.ts` → `svgIconoTipo` y `dataUrlIconoTipo` con iconos SVG de tubo de lava (arco de cueva), cráter de impacto y salar, renderizados como `BillboardGraphics` en CesiumJS.
- `visor/src/ui/panel.ts` y `visor/src/style.css` → muestra cada icono SVG junto a su casilla en `Pines de referencia` y agrega botones `Todos` / `Ninguno`.

## Verificación

- `npm --prefix visor run prueba` → pasa (`tsc --noEmit` + `OK contrato.prueba.ts`).
- `npm --prefix visor run build` → compila (`vite build`).
- `node scripts/contexto/verificar.js` → 0 errores.

## Relaciones

- [[2026-11-15-fernando-visor-pines]] — Fase 3 (capa de pines)
- [[ADR-011-visor-web-sobre-el-contrato]] — arquitectura del visor
