---
title: "Deuda abierta"
type: deuda
status: vigente
date: 2026-11-14
updated: 2026-11-15
summary: "Pendientes abiertos del proyecto, uno por ítem P-NNN."
autor: fernando
---

# Deuda abierta

Pendientes de la revisión externa del ETL del 2026-11-14 ([[2026-11-14-fernando-e03-por-celda-corregido]]). Cada
uno se verificó en el código y con datos antes de anotarse. Los cerrados están en [[resuelta-2026]].

### P-011 — Conectar la tabla con el motor

El motor lee una carpeta plana con `manifest.json` que trae `healpix.nivel` y los nombres de columna del contrato; el
ETL escribe `grid/` y `columns/` con el manifiesto en otra forma. Falta un adaptador que no renombre columnas que miden
otra cosa (`arena_frac` es arena móvil y semifija, y el motor espera solo la móvil; los nombres del ETL son el contrato, ADR-007 regla 8) y recalcular los perfiles de
búsqueda sobre la tabla actual: el motor se niega a correr si el número de celdas de los perfiles no coincide con el de
la tabla.

### P-012 — Acuerdo con los análogos documentados sin medir

El manifiesto dice `no medido (requiere el motor)`. Hasta que el motor corra sobre esta tabla, la calidad del ETL se
sostiene por cobertura por columna, relectura independiente y pruebas, no por encontrar a Devon, Atacama o Islandia en
el ranking.

### P-013 — Permafrost sin dato en el hemisferio sur

Los mapas de Obu y Karjalainen no cubren el sur: las celdas de los Valles Secos de McMurdo quedan en `NaN` en
`permafrost_prob`, `magt_c` y `hielo_suelo_*`. No se rellenan con valores fijos (ADR-006): la ficha y el pitch lo
declaran. Falta buscar una fuente que cubra la Antártida.

## Relaciones

- [[resuelta-2026]] — a donde pasan los ítems cerrados
