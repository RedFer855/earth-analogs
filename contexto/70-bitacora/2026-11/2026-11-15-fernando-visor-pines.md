---
title: "Sesión 2026-11-15 — Pines de referencia, cerca_de y correlación en el visor (Fase 3)"
type: sesion
status: vigente
date: 2026-11-15
updated: 2026-11-15
summary: "Fase 3 del visor: capa de 332 pines agrupables (tubos de lava, cráteres, salares) con ficha de fuente y atribución, bloque cerca_de en la ficha del candidato y panel de correlación de entornos."
autor: fernando
agente: antigravity
modelo: Gemini 4 Hydrogen (Medium)
rama: feat/visor-pines
scope:
  - visor/src/capas/pines.ts
  - visor/src/datos/contrato.ts
  - visor/src/main.ts
  - scripts/visor/publicar-datos.mjs
symbols:
  - CapaPines
  - cargarPuntos
  - cargarCorrelacion
  - FichaCandidato.mostrarPin
---

# Sesión 2026-11-15 — Pines de referencia, cerca_de y correlación en el visor (Fase 3)

## Problema o motivo

Con `cerca_de` ya implementado en el motor y `puntos.geojson` + `point-correlation.json` generados por el ETL y análisis, faltaba mostrar los 332 pines de referencia sobre el globo, la distancia al entorno cercano en la ficha de cada candidato y el resumen estadístico de Cliff δ en el visor.

## Cambios

- `visor/src/datos/contrato.ts` → agrega `CercaDe` en `Celda`, tipos `PuntosGeoJson` y `CorrelacionJson`, y cargadores opcionales `cargarPuntos` / `cargarCorrelacion`.
- `visor/src/capas/pines.ts` → `CapaPines` con tres `CustomDataSource` agrupables (`clustering` habilitado), colores por tipo y selección por clic.
- `visor/src/ui/ficha.ts` → bloque `"Entorno cercano (no puntúa)"` leyendo `candidato.cerca_de` y método `mostrarPin` para ver nombre, tipo, diámetro, fuente, enlace, licencia y atribución de cualquier pin.
- `visor/src/ui/panel.ts` → interruptores por tipo de pin (`tubo_lava`, `crater_impacto`, `playa_salar`) y desplegable con `point-correlation.json` (mediana sitio vs control y Cliff δ).
- `scripts/visor/publicar-datos.mjs` → soporta `--puntos <geojson>` y copia `docs/analisis/point-correlation.json` si existe.

## Verificación

- `npm --prefix visor run prueba` → pasa (`tsc --noEmit` + `OK contrato.prueba.ts` con pruebas de `cargarPuntos` y `cargarCorrelacion`).
- `npm --prefix visor run build` → compila (`vite build`, 1641 módulos).
- `node scripts/visor/publicar-datos.mjs $RUN/salida --puntos $RUN_PUNTOS/export/puntos.geojson` → 24 archivos (3764.7 KB) publicados en `visor/public/datos/`.

## Relaciones

- [[ADR-011-visor-web-sobre-el-contrato]] — arquitectura del visor
- [[ADR-009-capas-de-puntos-y-distancias]] — pines y `cerca_de` sin puntuar
- [[2026-11-15-fernando-visor-base]] — Fases 1 y 2 del visor
