---
title: "Sesión 2026-11-14 — E-03 por celda corregido tras la revisión externa del ETL"
type: sesion
status: vigente
date: 2026-11-14
updated: 2026-11-14
summary: "Una revisión externa del ETL se verificó punto por punto; E-03 por celda se corrigió (centro de Horn, cuantiles lineales, rugosidad y relieve en 5x5, fracción válida exacta, halo en el antimeridiano) y el resto quedó como deuda P-001 a P-010."
autor: fernando
agente: claude-code
modelo: opus-5.5
rama: feat/etl-mejoras
scope: [etl/e03_terreno.py, etl/e03_extras.py, etl/test_e03_extras.py, contexto/80-deuda/abierta.md]
symbols: [horn, ventana, cuantil, por_celda]
---

# Sesión 2026-11-14 — E-03 por celda corregido tras la revisión externa del ETL

## Problema o motivo

Una revisión externa del ETL encontró errores de método. Cada punto se comprobó en el código y con datos antes de
aceptarlo. El más urgente estaba en E-03 por celda, que se estaba corriendo: Horn solo mira los 8 vecinos, así que
un bloque de agua rodeado de tierra recibía pendiente, y su elevación `NaN` anulaba la elevación y el relieve de toda
la celda. En una muestra de 400 teselas eran el 1.04 % de las celdas. La corrida se detuvo a mano y quedó como
`fallo` en el registro de auditoría.

## Cambios

- `etl/e03_terreno.py` → `horn()` compartida que pone `NaN` cuando el bloque central no tiene dato; el halo toma las
  teselas del otro lado del antimeridiano (VRT corrido ±360°), como pide [[ADR-005-regla-de-escala-de-pendiente-y-rugosidad]].
- `etl/e03_extras.py` → un bloque entra si tiene pendiente y elevación propia; percentiles lineales (tipo 7) en vez de
  tomar el índice por piso; rugosidad (desviación RMS respecto de la media) y relieve (máximo - mínimo) en una ventana
  de 5x5 bloques con al menos 19 válidos, con media y p90 por celda; `frac_valida` = bloques válidos / bloques que
  caben en la celda. Ninguna celda se anula por cobertura, como dice [[ADR-006-valores-faltantes-y-cobertura]]: la
  fracción queda en su columna y su distribución en `e03_extras.json`. Las teselas van a `$RUN/terreno/celdas/`.
- `etl/test_e03_extras.py` → Horn con centro de agua y plano a 45°, ventana contra fuerza bruta, cuantiles contra
  `np.quantile`, agregación por celda con `NaN`.
- `contexto/80-deuda/abierta.md` → P-001 a P-010 con lo que la revisión encontró y no se arregló hoy.

## Verificación

- `pixi run pruebas`: 18 pruebas, todas pasan.
- Cinco teselas de muestra (lagos de Finlandia, Everest, Erg Chech y las dos del antimeridiano en Chukotka): cero
  celdas con pendiente y sin elevación (antes 74 de 2092 en Finlandia); la pendiente media coincide con
  `slope_mean_deg` en la mediana (diferencia máxima 1.8°, en celdas con lagunas); el p90 sube entre 0.03° y 0.15° en
  la mediana por la interpolación; al este de 180° la ventana tiene dato en el 100 % de los píxeles.
- La corrida completa va con `audit/audit.py correr`; su comprobación final repite la de la pendiente media y agrega
  que ninguna celda tenga pendiente sin elevación y que la rugosidad del Everest supere 10 veces la de Uyuni.

## Lo que la revisión exageró

- Celdas al sur de 88° S en la malla: 61 600, no unas 507 000.
- Celdas con `frac_oceano` ≥ 0.5: 34 061, no 127 725.
- Anular celdas con menos de 50 % de bloques válidos contradice ADR-006 (no se fija un umbral sin medirlo); en su
  lugar se guarda `frac_valida`.

## Pendiente

- Rehacer E-03 terreno con la máscara del centro (P-009) y E-13 con las columnas nuevas.
- P-001 a P-008: objetivos de la Luna y Marte a la escala de la celda, THEMIS, MCD, polvo con QA 3, máscaras de
  agua, temperatura, `e14_extras.py` y contrato de columnas con el motor.

## Relaciones

- [[2026-11-14-fernando-etl-e01-a-e13]] — la sesión que escribió el ETL
- [[abierta]] — P-001 a P-010
- [[ADR-005-regla-de-escala-de-pendiente-y-rugosidad]] · [[ADR-006-valores-faltantes-y-cobertura]]
