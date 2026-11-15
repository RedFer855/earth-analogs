---
title: "Sesión 2026-11-15 — Segundo globo Luna/Marte, estabilidad y FPS en el visor (Fase 5)"
type: sesion
status: vigente
date: 2026-11-15
updated: 2026-11-15
summary: "Fase 5 del visor: segundo globo Luna/Marte con Moon Trek / Mars Trek WMTS sin token, lectura opcional de estabilidad.json en la ficha del candidato y medidor de FPS en vivo."
autor: fernando
agente: antigravity
modelo: Gemini 4 Hydrogen (Medium)
rama: feat/visor-pulido
scope:
  - visor/src/globo-objetivo.ts
  - visor/src/datos/contrato.ts
  - visor/src/main.ts
  - visor/src/style.css
symbols:
  - GloboObjetivo
  - cargarEstabilidad
---

# Sesión 2026-11-15 — Segundo globo Luna/Marte, estabilidad y FPS en el visor (Fase 5)

## Problema o motivo

Para cerrar el visor (Fase 5 del plan), faltaba comparar lado a lado el análogo terrestre con el sitio objetivo en la Luna o Marte usando teselas abiertas sin token, mostrar la estabilidad entre escenarios cuando exista `estabilidad.json` y exponer un medidor de FPS en vivo.

## Cambios

- `visor/src/globo-objetivo.ts` → `GloboObjetivo` sobre `Ellipsoid.MOON` (Moon Trek `LRO_WAC_Mosaic_Global_303ppd_v02`) y `Ellipsoid.MARS` (Mars Trek `Mars_MGS_MOLA_ClrShade_merge_global_463m`) sin token, con marcador en las coordenadas del sitio objetivo.
- `visor/src/datos/contrato.ts` y `visor/src/ui/ficha.ts` → `cargarEstabilidad` opcional y bloque `"Estabilidad entre escenarios"` en la ficha del candidato.
- `visor/src/main.ts` y `visor/src/style.css` → barra superior con medidor de FPS (`requestAnimationFrame`) y botón `"Ver objetivo (Luna/Marte)"` para abrir/cerrar el segundo globo.
- `visor/pruebas/contrato.prueba.ts` → pruebas unitarias de `cargarEstabilidad` (válido y 404).

## Verificación

- `npm --prefix visor run prueba` → pasa (`tsc --noEmit` + `OK contrato.prueba.ts`).
- `npm --prefix visor run build` → compila (`vite build`).
- `node scripts/contexto/verificar.js` → 0 errores.

## Relaciones

- [[ADR-011-visor-web-sobre-el-contrato]] — arquitectura del visor
- [[I-12-cesium-sin-ion-luna-y-marte]] — URLs WMTS abiertas de Moon Trek y Mars Trek
- [[2026-11-15-fernando-visor-busqueda]] — Fase 4 del visor
