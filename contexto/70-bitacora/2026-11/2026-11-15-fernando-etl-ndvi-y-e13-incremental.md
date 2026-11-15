---
title: "Sesión 2026-11-15 — NDVI con máscara de costa y E-13 incremental"
type: sesion
status: vigente
date: 2026-11-15
updated: 2026-11-15
summary: "El NDVI recupera costas y latitudes altas (cobertura de 80.7 % a 88.15 %) y E-13 relee solo lo que cambió y abre cada fuente una sola vez (unos 10 minutos a menos de 3)."
autor: fernando
agente: claude-code
modelo: sonnet-5.5
rama: feat/etl-e13-incremental
scope: [etl/, contexto/45-decisiones/, contexto/80-deuda/]
symbols: []
---

# Sesión 2026-11-15 — NDVI con máscara de costa y E-13 incremental

## Problema o motivo

El NDVI perdía cobertura en costas y en latitudes altas, y E-13 tardaba unos 10 minutos casi por completo en releer
fuentes.

## Cambios

- `etl/e05_ndvi.py` → la máscara de VI Quality acepta tierra y costa (códigos 1 y 2); `ndvi_max_clim` es el máximo de
  la curva climatológica (media por período del año entre años, mínimo 3 períodos).
- `etl/e13_manifiesto.py` → caché por columna (clave: tamaño y fecha) y cada fuente se abre una sola vez al releer.
- ADR-006 registra la regla de NDVI y su medición; P-014 pasó a resuelta.

## Resultados medidos

| Qué | Antes | Después |
| :-- | :-- | :-- |
| Cobertura de `ndvi_max_clim` | 80.7 % | 88.15 % |
| NDVI 60–70° N / >70° N | 67.5 % / 35.5 % | 93.3 % / 61.7 % |
| E-13, relectura de aridez (60 celdas) | 191 s | 5 s (resultado idéntico) |
| E-13, relectura de NDVI (60 celdas) | 18.3 s | 2.2 s (resultado idéntico) |
| E-13 completo (300 celdas) | unos 10 min | 2 min 40 s (primera corrida, sin caché); 78 s en la corrida registrada |
