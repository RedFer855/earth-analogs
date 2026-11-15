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

### P-011 — Conectar la tabla con el motor de búsqueda

Falta decidir cómo el motor de búsqueda consume la tabla del ETL. Los nombres de columna del ETL son el contrato
(ADR-007 regla 8), así que la conexión no debe renombrar columnas que miden otra cosa: `arena_frac` es arena móvil y
semifija, y la búsqueda necesita solo la móvil. Los perfiles de búsqueda se calculan sobre la tabla actual.

### P-012 — Acuerdo con los análogos documentados sin medir

El manifiesto dice `no medido (requiere el motor)`. Hasta que la búsqueda corra sobre esta tabla, la calidad del ETL
se sostiene por cobertura por columna, relectura independiente y pruebas, no por encontrar a Devon, Atacama o
Islandia en el ranking.

### P-013 — Permafrost sin dato en el hemisferio sur

Los mapas de Obu y Karjalainen no cubren el sur: las celdas de los Valles Secos de McMurdo quedan en `NaN` en
`permafrost_prob`, `magt_c` y `hielo_suelo_*`. No se rellenan con valores fijos (ADR-006): la ficha y el pitch lo
declaran. Falta buscar una fuente que cubra la Antártida.

## Relaciones

- [[resuelta-2026]] — a donde pasan los ítems cerrados
