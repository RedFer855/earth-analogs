---
title: "Sesión 2026-11-15 — Visor web base sobre el contrato del motor (Fases 1 y 2)"
type: sesion
status: vigente
date: 2026-11-15
updated: 2026-11-15
summary: "Visor web ligero (CesiumJS + Vite + TypeScript) que lee metrics.json y resultados/terreno/<sitio>.json, pinta 200 candidatos en un Primitive coloreado por nota y muestra la ficha de coincidencias, diferencias, temperatura y contexto planetario."
autor: fernando
agente: antigravity
modelo: Gemini 4 Hydrogen (Medium)
rama: feat/visor-base
scope:
  - visor/
  - scripts/visor/publicar-datos.mjs
  - .github/workflows/ci.yml
  - contexto/45-decisiones/ADR-011-visor-web-sobre-el-contrato.md
symbols:
  - cargarIndice
  - cargarResultado
  - CapaCandidatos
  - PanelLateral
  - FichaCandidato
---

# Sesión 2026-11-15 — Visor web base sobre el contrato del motor (Fases 1 y 2)

## Problema o motivo

El repositorio público ya contaba con la salida real del motor (`metrics.json` y `resultados/terreno/<sitio>.json` para los 21 sitios de la Luna y Marte), pero no tenía un visor web conectado a ese contrato. Se implementaron las Fases 1 y 2 del plan del visor en `visor/` sin servidor puente ni dependencias fuera de spec.

## Cambios

- `visor/src/datos/contrato.ts` → tipos del contrato (`Indice`, `ResultadoJson`, `Celda`, etc.) y cargadores `cargarIndice` / `cargarResultado` con validación de `version_contrato`.
- `visor/src/globo.ts` y `visor/src/capas/candidatos.ts` → globo CesiumJS con capas base abiertas (EOX Sentinel-2 cloudless) y `CapaCandidatos` que renderiza los 200 polígonos HEALPix en un único `Cesium.Primitive` coloreado por `nota`, con selección por clic y espera segura a `primitivaRelleno.ready` antes de resaltar.
- `visor/src/ui/panel.ts` y `visor/src/ui/ficha.ts` → panel izquierdo (Luna 9 / Marte 12 y primeros 50 candidatos) y ficha derecha con tabla por variable (`coincide`/`difiere`/`sin_dato`), cobertura, diagnóstico térmico informativo, contexto planetario (`cuerpos`), aviso de hielo en Groenlandia y fuentes con licencia.
- `visor/src/main.ts` → estado por URL (`?sitio=JZ&candidato=1`) y enlace entre globo, panel y ficha.
- `scripts/visor/publicar-datos.mjs` → copia minificada desde `$RUN/salida` hacia `visor/public/datos/`, abortando si detecta `local_only` o `es_ejemplo: true`.
- `.github/workflows/ci.yml` → job `visor` (`npm ci`, `npm run prueba`, `npm run build`) conectado a `ci-completo`.
- `contexto/45-decisiones/ADR-011-visor-web-sobre-el-contrato.md` → contrato y alcance del visor.

## Verificación

- `npm --prefix visor run prueba` → pasa (`tsc --noEmit` + `OK contrato.prueba.ts`).
- `npm --prefix visor run build` → compila (`vite build`, 1640 módulos).
- `node scripts/visor/publicar-datos.mjs $RUN/salida` → 22 archivos (3344.2 KB) publicados en `visor/public/datos/`.
- Verificación en navegador sobre `http://localhost:5173/?sitio=JZ&candidato=1`: carga directa sin errores de consola ni de red, 12 sitios de Marte, lista de 50 candidatos, vuelo al candidato #1 (31.120, 2.461) sobre Sentinel-2 cloudless y ficha completa con 4/4 variables, diagnóstico térmico, contexto planetario y fuentes.

## Relaciones

- [[ADR-011-visor-web-sobre-el-contrato]] — arquitectura del visor sobre el contrato del motor
- [[ADR-007-contrato-de-metrics-json]] — formato de `metrics.json` y `resultados/`
- [[ADR-009-capas-de-puntos-y-distancias]] — extensión `cerca_de` prevista para la Fase 3
