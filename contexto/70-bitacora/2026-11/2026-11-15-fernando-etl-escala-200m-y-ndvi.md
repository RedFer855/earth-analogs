---
title: "Sesión 2026-11-15 — Terreno a 200 m en Tierra, Luna y Marte, NDVI con máscara de costa y E-13 incremental"
type: sesion
status: vigente
date: 2026-11-15
updated: 2026-11-15
summary: "El terreno se calcula igual en los tres cuerpos (bloques cuadrados de 200 m, ventana de 1 km); el NDVI recupera costas y latitudes altas; E-13 baja de unos 12 minutos a menos de 3; el error de pendiente contra la relectura independiente baja de 0.176° a 0.050°."
autor: fernando
agente: claude-code
modelo: sonnet-5.5
rama: feat/etl-escala-200m
scope: [etl/, contexto/45-decisiones/, contexto/80-deuda/]
symbols: []
---

# Sesión 2026-11-15 — Terreno a 200 m, NDVI y E-13 incremental

## Problema o motivo

La relectura independiente de E-13 y la revisión de la escala mostraron tres cosas: la escala de la pendiente cambiaba con
la latitud en la Tierra (bloques de grados) y no coincidía con la de la Luna y Marte; el NDVI perdía cobertura en
costas y en latitudes altas; y E-13 tardaba unos 12 minutos casi por completo en releer fuentes.

## Cambios

- `etl/e03_extras.py`, `etl/e03_terreno.py` → una sola pasada para todas las columnas de terreno, en bloques
  cuadrados de 200 m en LAEA local con ventana de 1 km (bloque válido si su validez es ≥ 0.999).
- `etl/e12_marte.py` → Marte con el mismo bloque de 200 m. La Luna ya usaba 10×10 de 20 m.
- `etl/e05_ndvi.py` → la máscara de VI Quality acepta tierra y costa (códigos 1 y 2); `ndvi_max_clim` es el máximo de
  la curva climatológica (media por período del año entre años, mínimo 3 períodos).
- `etl/e13_manifiesto.py` → caché por columna (clave: tamaño y fecha) y cada fuente se abre una sola vez al releer.
- `etl/cola.py` → cola de pasos con plan, fuerza y límite de procesos.
- ADR-005 (escala) y ADR-006 (NDVI) actualizados con su medición; P-014 pasó a resuelta.

## Resultados medidos

| Qué | Antes | Después |
| :-- | :-- | :-- |
| Error mediano de `slope_mean_deg` contra la relectura de E-13 | 0.176° (p90 0.84°) | 0.050° (p90 0.30°) |
| Cobertura de `ndvi_max_clim` | 80.7 % | 88.15 % |
| NDVI 60–70° N / >70° N | 67.5 % / 35.5 % | 93.3 % / 61.7 % |
| E-13, relectura de aridez (60 celdas) | 191 s | 5 s (resultado idéntico) |
| E-13, relectura de NDVI (60 celdas) | 18.3 s | 2.2 s (resultado idéntico) |
| E-13 completo (300 celdas) | unos 12 min | 2 min 40 s en frío |

E-03 completo a 200 m: 118 min, cobertura 98.7 %. Corrió en un RUN aparte y luego se copió al compartido; las
columnas anteriores se reemplazaron. E-13 se corrió después con `audit/audit.py`.

## Pendiente

- P-011: conectar la tabla con el motor de búsqueda; P-012: acuerdo con los análogos documentados, sin medir; P-013: permafrost
  al sur con NaN (ver `contexto/80-deuda/abierta.md`).
- La pasada única de E-03 no se justifica por el tiempo (118 min en la corrida completa) sino por el método.
