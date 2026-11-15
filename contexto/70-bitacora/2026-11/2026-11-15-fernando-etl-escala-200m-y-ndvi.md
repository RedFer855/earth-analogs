---
title: "Sesión 2026-11-15 — Terreno a 200 m en Tierra, Luna y Marte"
type: sesion
status: vigente
date: 2026-11-15
updated: 2026-11-15
summary: "El terreno se calcula igual en los tres cuerpos (bloques cuadrados de 200 m, ventana de 1 km); el error de pendiente contra la relectura independiente de E-13 baja de 0.176° a 0.050°."
autor: fernando
agente: claude-code
modelo: sonnet-5.5
rama: feat/etl-escala-200m
scope: [etl/, contexto/45-decisiones/]
symbols: []
---

# Sesión 2026-11-15 — Terreno a 200 m en Tierra, Luna y Marte

## Problema o motivo

La relectura independiente de E-13 y la revisión de la escala mostraron que la escala de la pendiente cambiaba con
la latitud en la Tierra (bloques de grados) y no coincidía con la de la Luna y Marte.

## Cambios

- `etl/e03_extras.py`, `etl/e03_terreno.py` → una sola pasada para todas las columnas de terreno, en bloques
  cuadrados de 200 m en LAEA local con ventana de 1 km (bloque válido si su validez es ≥ 0.999).
- `etl/e12_marte.py` → Marte con el mismo bloque de 200 m. La Luna ya usaba 10×10 de 20 m.
- ADR-005 actualizado con su medición.

## Resultados medidos

| Qué | Antes | Después |
| :-- | :-- | :-- |
| Error mediano de `slope_mean_deg` contra la relectura de E-13 | 0.176° (p90 0.84°) | 0.050° (p90 0.30°) |

E-03 completo a 200 m: 118 min, cobertura 98.7 %. Corrió en un RUN aparte y luego se copió al compartido; las
columnas anteriores se reemplazaron. E-13 se corrió después con `audit/audit.py`.

## Pendiente

- P-011: conectar la tabla con el motor de búsqueda; P-012: acuerdo con los análogos documentados, sin medir; P-013: permafrost al sur con NaN (ver `contexto/80-deuda/abierta.md`).
- La pasada única de E-03 no se justifica por el tiempo (118 min en la corrida completa) sino por el método.
