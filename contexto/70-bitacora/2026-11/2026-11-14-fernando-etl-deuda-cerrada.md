---
title: "Sesión 2026-11-14 — Deuda del ETL cerrada: P-003, P-008, P-009 y P-010"
type: sesion
status: vigente
date: 2026-11-14
updated: 2026-11-14
summary: "E-03 terreno se rehízo solo en las teselas afectadas (índice validado bit a bit), E-11 suma iluminación y Mini-RF, E-12 suma el clima de la MCD 6.2 (local, presión corregida por altura), E-05 usa máscara de tierra, E-15 agrega cinco capas de 30 m y el manifiesto lista n_celdas, nivel y local_only."
autor: fernando
agente: claude-code
modelo: opus-5.5
rama: feat/etl-mejoras
scope: [etl/, audit/etl-log.jsonl, contexto/80-deuda/, contexto/45-decisiones/ADR-007-contrato-de-metrics-json.md]
symbols: [motivo, cruzar, es_tierra_vi_quality, validar_resultados]
---

# Sesión 2026-11-14 — Deuda del ETL cerrada: P-003, P-008, P-009 y P-010

## Problema o motivo

Quedaban cuatro ítems abiertos en [[abierta]] después de [[2026-11-14-fernando-etl-corridas-finales]]. fernando
decidió: la Mars Climate Database se usa solo en local, los nombres de columna del ETL son el contrato con el motor y
las capas de 30 m van para todo el mundo. El código de E-11, E-05, E-12 (MCD), E-15 y `cruce.py` lo escribió
Antigravity (Gemini) con briefs y revisión de Claude; el resto, Claude.

## Cambios

- `etl/e03_indice_afectadas.py` → índice de las teselas de E-03 terreno que cambian con la máscara del centro de Horn
  (agua o sin dato en la propia tesela, o antimeridiano). Pruebas en `etl/test_e03_indice.py`.
- `etl/e11_luna.py` → iluminación y sombra permanente de Mazarico, CPR de Mini-RF, por región.
- `etl/e12_marte.py` → clima de superficie de la MCD 6.2 por sitio, presión corregida por altura, todo `local_only`.
- `etl/e05_ndvi.py` → solo periodos con tierra en "VI Quality" (bits 11-13 == 1).
- `etl/e15_capas_30m.py` → paso nuevo: GSW, GSDP30, GSDS30 y GLWD `area_pct` por celda.
- `etl/cruce.py` → cruce de otra tabla por coordenada (P-010).
- `etl/e13_manifiesto.py` → `nivel_healpix`, `n_celdas`, `arbol_limpio` y `local_only`; la relectura del NDVI aplica
  la misma máscara que E-05.
- [[ADR-007-contrato-de-metrics-json]] → regla 8: los nombres de columna del ETL son el contrato.

## Verificación

Corridas de esta sesión (registro de auditoría, 101 líneas, cadena íntegra):

| Paso | Duración | Resultado |
| :-- | --: | :-- |
| E-03 terreno, solo teselas afectadas (12 992 de 25 755) | 2119 s | ok |
| E-05 NDVI con máscara de tierra | 696 s | ok |
| E-11 Luna | 56 s | ok |
| E-12 Marte con MCD y presión corregida | 80 s | ok |
| E-15 capas de 30 m (1151 teselas) | 5432 s + 35 s de unión | ok tras cambiar dos chequeos (ver abajo) |
| E-13 manifiesto | 537 s | ok |

- **Índice de P-009:** 18 172 teselas afectadas y 7 583 sanas. De las sanas que la corrida completa alcanzó a
  recalcular antes de detenerla, 891 de 891 dieron sumas idénticas bit a bit a las viejas.
- **P-009:** los puntos de control no cambian (Everest 43.24°, Erg Chech 1.32°); la cobertura de `slope_mean_deg`
  pasa de 98.829 % a 98.827 % y la mediana de 1.1554° a 1.1555°.
- **E-05:** la cobertura de `ndvi_max` baja de 89.0 % a 83.8 % y la de `ndvi_max_clim` de 88.7 % a 80.7 %.
- **E-15:** cobertura 90.1 % en GSW y GSDS30, 90.6 % en GLWD y 29.7 % en GSDP30 (solo cubre zonas arenosas). Media
  regional del Gran Erg Oriental: `dunas_frac` 0.74 y `arena_frac` 0.85; del delta del Okavango:
  `agua_humedal_area_pct` 27.0.
- **E-12:** con la corrección, Gale (742 Pa) supera a Jezero (697 Pa), como corresponde a su menor elevación. La
  corrección más grande es la de Noctis Landing (4.3 km entre el sitio y la orografía del modelo).
- `pixi run pruebas`: 76 pruebas, todas pasan.

## Lo que falló y cómo se resolvió

- **E-15, primera corrida:** fallaron los chequeos de un punto del Gran Erg Oriental (dunas 0, arena 0.27) y del
  delta del Okavango (10.6 %). Un recálculo independiente de esas celdas, con todos sus píxeles leídos del raster
  original, dio el mismo valor que la columna (Okavango 10.58, Pantanal 49.67, arena del erg 1010 de 3803 píxeles).
  El punto del erg cae en su borde (GSDP30 clase 9 en toda la celda) y el del Okavango en una zona con islas secas.
  Los dos chequeos pasaron a medias regionales; el cambio se hizo después de ver el resultado y así queda anotado en
  el código y en el registro.
- **E-13:** la relectura independiente del NDVI encontró 1 celda con un periodo mayor que el máximo porque aplicaba
  la regla vieja de E-05. Se le agregó la misma máscara de tierra; comparó 184 celdas, 0 fallos.
- **E-03:** la corrida completa se detuvo a mano tras 6 132 teselas para usar el índice (queda como `fallo` /
  `detenido` en el registro).

## Pendiente

- Decidir si una celda sin NDVI (costa, orilla, agua interior) debe quedar fuera del filtro de vegetación del motor.
- Viento de Marte (MCD tiene `u` y `v` por nivel) sigue en `ausentes`.
- Mejoras de tiempo propuestas, sin hacer: huella por tesela, E-13 incremental por sha256 de columna, cola de
  corridas con dependencias, más procesos en E-15 y capas de 30 m fuera de los ZIP.

## Relaciones

- [[2026-11-14-fernando-etl-corridas-finales]] — la sesión anterior
- [[abierta]] · [[resuelta-2026]] — deuda
- [[ADR-006-valores-faltantes-y-cobertura]] · [[ADR-007-contrato-de-metrics-json]]
