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

### P-012 — Acuerdo con los análogos documentados sin medir

El manifiesto dice `no medido (requiere el motor)`. El motor ya corre sobre esta tabla (ADR-010), pero no hay en el
repo un catálogo público de análogos terrestres documentados con coordenadas: sin él, `analogos_conocidos` sale vacío
y no se puede contar cuántos aparecen en el ranking. Falta armar ese catálogo con fuente por sitio y pasarlo con
`--sitios`.

### P-013 — Permafrost sin dato en el hemisferio sur

Los mapas de Obu y Karjalainen no cubren el sur: las celdas de los Valles Secos de McMurdo quedan en `NaN` en
`permafrost_prob`, `magt_c` y `hielo_suelo_*`. No se rellenan con valores fijos (ADR-006): la ficha y el pitch lo
declaran. Falta buscar una fuente que cubra la Antártida.

### P-015 — El filtro de suelo desnudo deja pasar hielo

El motor busca celdas con `ndvi_max_clim` ≤ 0.20, y el hielo también tiene NDVI bajo. Con los 21 sitios, 256 de
4 200 candidatos caen al norte de 60° N entre 75° O y 10° O, sobre todo en la capa de hielo de Groenlandia, que no es
análoga de regolito ni de roca. Falta una columna de glaciares y capas de hielo en el ETL para excluirlos
(ADR-010, Q-3).

### P-016 — Calibraciones del puntaje que quedaron fuera

ADR-010 dejó pendientes dos mejoras de la fórmula: calibrar S por grados de libertad (solo importa cuando haya
perfiles con distinto número de variables) y transformar con logaritmo pendiente, rugosidad y relieve. Ninguna se
aplicó sin medir antes cuánto cambia el orden de los candidatos.

## Relaciones

- [[resuelta-2026]] — a donde pasan los ítems cerrados
