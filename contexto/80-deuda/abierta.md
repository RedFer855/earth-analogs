---
title: "Deuda abierta"
type: deuda
status: vigente
date: 2026-11-14
updated: 2026-11-14
summary: "Pendientes abiertos del proyecto, uno por ítem P-NNN."
autor: fernando
---

# Deuda abierta

Pendientes de la revisión externa del ETL del 2026-11-14 ([[2026-11-14-fernando-e03-por-celda-corregido]]). Cada
uno se verificó en el código y con datos antes de anotarse. Los cerrados están en [[resuelta-2026]].

### P-003 — Variables de Marte y la Luna que faltan

Marte no tiene temperatura, rango diurno ni amplitud anual (MCD 6.2, solo uso local) y de TES solo guarda 4 de 13
capas. La Luna no tiene iluminación (Mazarico) ni Mini-RF, y LOLA 20 m no filtra el sin dato.

### P-008 — Columnas que faltan y nombres del contrato con el motor

Hielo en el suelo (Karjalainen) y arcilla y limo por separado ya están en E-07 y E-09. Faltan las capas de 30 m
(ocurrencia de agua GSW, dunas GSDP30 y arena GSDS30) y `humedal_area_pct`. El manifiesto no trae `n_celdas` ni el
nivel de HEALPix. Falta fijar los nombres de columna con el motor antes de escribirlo.

### P-009 — `slope_mean_deg` con pendientes sobre bloques de agua aislados

`etl/e03_terreno.py` ya enmascara el centro de Horn, pero `slope_mean_deg` y `slope_std_deg` en `$RUN` salieron sin
esa máscara. La diferencia mediana es 0 y el máximo medido es 1.8° en celdas con lagunas chicas. Falta: rehacer
E-03 terreno cuando haya máquina libre (unos 50 min).

### P-010 — Comparar tablas por coordenada, no por `ipix`

La malla usa latitud autálica en la esfera. Otra tabla que ponga la latitud geodésica directo en la esfera numera las
celdas distinto: el mismo `ipix` queda a 10.7 km en la mediana y a 14.3 km como máximo (a 45°). Toda comparación con
otra tabla HEALPix tiene que cruzar por latitud y longitud.

## Relaciones

- [[resuelta-2026]] — a donde pasan los ítems cerrados
