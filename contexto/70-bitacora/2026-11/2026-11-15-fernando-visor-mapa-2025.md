---
title: "Sesión 2026-11-15 — Mosaico EOX Sentinel-2 cloudless 2025 y selector de mapa base"
type: sesion
status: vigente
date: 2026-11-15
updated: 2026-11-15
summary: "Actualiza globo.ts para usar EOX Sentinel-2 cloudless 2025 por defecto (con respaldo a 2016, NASA GIBS Blue Marble y NaturalEarthII) y agrega selector de mapa base en la barra superior."
autor: fernando
agente: antigravity
modelo: Gemini 4 Hydrogen (Medium)
rama: fix/visor-mapa-2025
scope:
  - visor/src/globo.ts
  - visor/src/main.ts
  - visor/src/style.css
symbols:
  - construirImagenBase
  - cambiarMapaBase
---

# Sesión 2026-11-15 — Mosaico EOX Sentinel-2 cloudless 2025 y selector de mapa base

## Problema o motivo

`globo.ts` apuntaba al mosaico de 2016 (`s2cloudless_3857`) sin selector de mapa base. Se alineó con la configuración de EOX 2025 (`s2cloudless-2025_3857`, ~10 m) y respaldo automático a 2016 → GIBS Blue Marble → NaturalEarthII.

## Cambios

- `visor/src/globo.ts` → `plantillaEox` con soporte de año (`?imagen=2016..2025`, por defecto 2025), cadena de respaldo y `cambiarMapaBase`.
- `visor/src/main.ts` y `visor/src/style.css` → selector de mapa base (`EOX 2025 · 10 m`, `GIBS Marble · 500 m`, `NaturalEarth · Offline`) en la barra superior.

## Verificación

- `npm --prefix visor run prueba` → pasa (`tsc --noEmit` + `OK contrato.prueba.ts`).
- `npm --prefix visor run build` → compila (`vite build`).
- `node scripts/contexto/verificar.js` → 0 errores.

## Relaciones

- [[ADR-011-visor-web-sobre-el-contrato]] — arquitectura del visor
- [[I-39-imagen-satelital-de-la-tierra-sin-clave]] — mosaicos abiertos sin clave
- [[2026-11-15-fernando-visor-pulido]] — Fase 5 del visor
