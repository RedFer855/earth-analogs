---
title: "Sesión 2026-11-14 — Corridas finales del ETL con los métodos corregidos y tiempos por paso"
type: sesion
status: vigente
date: 2026-11-14
updated: 2026-11-14
summary: "E-03 por celda (retomado tras una pausa), E-04, E-07, E-08, E-09, E-11, E-12 y E-13 corrieron con los métodos corregidos, sin fallos y con la cadena de auditoría íntegra (79 líneas); se anotan tiempos y cobertura de cada paso."
autor: fernando
agente: claude-code
modelo: opus-5.5
rama: feat/etl-mejoras
scope: [etl/, audit/etl-log.jsonl, contexto/80-deuda/abierta.md]
symbols: [por_celda, manifiesto, objetivos_comun]
---

# Sesión 2026-11-14 — Corridas finales del ETL con los métodos corregidos y tiempos por paso

## Problema o motivo

[[2026-11-14-fernando-e03-por-celda-corregido]] dejó los métodos corregidos y la corrida pendiente. Esta sesión
repite los pasos afectados con el código nuevo, registra cada uno con `audit/audit.py` y deja el tiempo de cada paso
para planificar las próximas corridas.

## Cambios

- `etl/objetivos_comun.py` → parches de 1.6 km con mediana y MAD, compartidos por E-11 (Luna) y E-12 (Marte), como pide
  P-001. THEMIS en todo el círculo (P-002).
- `etl/e04_temperatura.py`, `e07_permafrost.py`, `e08_viento_polvo.py`, `e09_material.py` → los cambios de P-004 a
  P-007 (QA 3 y DOD > 0.5, máscaras de agua, 11 meses, rango diurno emparejado, hielo en el suelo).
- `etl/test_capas.py`, `test_e03_extras.py`, `test_objetivos.py` → pruebas de los métodos nuevos.
- E-03 se pausó a mano a las 18:10 con 19 962 de 25 755 teselas hechas y se retomó a las 18:56; salta las teselas con
  archivo válido, así que no repite trabajo.

## Verificación

Tiempos de la última corrida buena de cada paso (campo `duracion_s` del registro; el paso E-03 sumó 1351 s después de
la pausa, sin contar lo corrido antes):

| Paso | Qué hace | Duración | Resultado |
| :-- | :-- | --: | :-- |
| E-03 por celda | percentiles, rugosidad y relieve | 1351 s (retoma) | ok, 0 fallos |
| E-04 | temperatura de superficie | 1247 s | ok |
| E-07 | permafrost y hielo | 202 s | ok |
| E-08 | viento y polvo | 900 s | ok |
| E-09 | material (ASTER, EMIT) | 1277 s | ok |
| E-11 | Luna, parches de 1.6 km | 202 s | ok |
| E-12 | Marte, parches de 1.6 km | 114 s | ok |
| E-13 | manifiesto y relectura independiente | 705 s | ok |

- E-03: cobertura de 98.8 % en las columnas de pendiente y elevación y de 98.8 % en las de rugosidad;
  `frac_valida` al 100 %, mediana 0.998. Mediana de `slope_p90_deg` 1.94° y de `rug_rms_mean_m` 4.87 m.
- E-13: error mediano de la pendiente frente a la de GLO-90 recalculada a 200 m: 0.176° (p90 0.84°) en 40 celdas sin
  agua; `fallos: []`.
- Registro de auditoría: 79 líneas, cadena íntegra (`node audit/verificar.mjs`). Incluye las corridas que fallaron o se
  pausaron a mano (corte de luz, detención por el centro de Horn, pausa de las 18:10); no se editó.
- No se comparó contra otro ETL: esta nota no afirma que sea mejor, solo que corre sin fallos.

## Pendiente

- P-009: `slope_mean_deg` y `slope_std_deg` de E-03 terreno siguen sin la máscara del centro de Horn.
- Revisar a mano los chequeos de Everest y Mar Muerto en el log de E-03.
- P-003, P-008 y P-010 siguen abiertos en [[abierta]].

## Relaciones

- [[2026-11-14-fernando-e03-por-celda-corregido]] — los métodos que esta corrida aplica
- [[2026-11-14-fernando-etl-e01-a-e13]] — la sesión que escribió el ETL
- [[abierta]] — deuda abierta
