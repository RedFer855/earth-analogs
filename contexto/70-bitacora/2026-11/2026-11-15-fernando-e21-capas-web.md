---
title: "Sesión 2026-11-15 — E-21, capas ligeras para el visor a HEALPix nivel 7"
type: sesion
status: vigente
date: 2026-11-15
updated: 2026-11-15
summary: "E-21 agrega 12 columnas del ETL a HEALPix nivel 7 (64 211 celdas, 3.47 MB) para que el visor filtre zonas por varias condiciones sin cargar la tabla de 58.8 M celdas."
autor: fernando
agente: claude-code
modelo: claude-opus-5-5
rama: feat/etl-capas-web
scope: [etl/e21_capas_web.py, etl/test_e21_capas_web.py, etl/cola.py, docs/etl-plan.md]
symbols: [generar, agregar, metodo_de]
---

# Sesión 2026-11-15 — E-21, capas ligeras para el visor a HEALPix nivel 7

## Problema o motivo

El visor web necesita buscar zonas que cumplan varias condiciones a la vez. La tabla del ETL tiene 58.8 M celdas
de nivel 12 por columna (235 MB cada una) y ADR-001 solo permite servir derivados de pocos MB.

## Cambios

- `etl/e21_capas_web.py` (E-21) → agrega a nivel 7 nested (padre = `ipix >> 10`, 1024 hijas por padre):
  mediana de las hijas con dato para las variables continuas y mínimo para las distancias (`*_dist_km`,
  `dist_*_km`), así una celda no queda "lejos" de un cráter o un tubo que sí tiene dentro. Escribe
  `$RUN/web/capas7/`: `ipix.u32`, `n_hijas.u16`, una `<columna>.f32` por variable y `capas7.json` con unidad,
  fuente, url, licencia, método, cobertura y p1/p50/p99 del agregado.
- Las columnas de E-17 y E-18 se leen de una segunda corrida (`--puntos` o `$RUN_PUNTOS`); antes se comprueba
  que su `grid/ipix.u32` sea idéntico al de `$RUN`. Los metadatos salen del manifiesto o del JSON de la columna.
- Se niega a servir una columna `local_only` (ADR-007 regla 6) o sin unidad, fuente, url o licencia.
- Lee por bloques de ~4.2 M celdas con memmap; un grupo de hijas nunca se parte entre bloques.
- `etl/cola.py` → E-21 depende de E-13. `etl/test_cola.py` ajustado.
- `docs/etl-plan.md` → fila de E-21.

## Verificación

- `pixi run pruebas` en `etl/`: 118 pruebas OK. `test_e21_capas_web.py` cubre mediana par e impar, mínimo,
  grupos todo NaN, igualdad con `np.median`, bloques chicos que obligan a cortar o extender, orden de `ipix`,
  malla distinta, columna faltante, `local_only` y tamaños de archivo.
- Corrida real con `audit/audit.py correr --paso E-21` (112 s): 64 211 celdas de nivel 7; la suma de `n_hijas` da
  58 817 178, igual que la malla de nivel 12.
- Tamaño: 12 × 256 844 B (columnas) + 256 844 B (`ipix.u32`) + 128 422 B (`n_hijas.u16`) + 5.5 kB (JSON) =
  3 472 901 B (3.47 MB).
- Cobertura del agregado: terreno 99.2–99.3 %, aridez 90.7 %, NDVI 89.7 %, rango diurno 97.5 %, roca 98.0 %,
  distancias 100 %.

## Lo que no cambió

- `frac_tierra` no se pesa ni se exporta: `n_hijas` ya dice cuánta tierra tiene cada celda padre.
- La mediana del padre no es la de un sitio: a ~2600 km² por celda describe el entorno, no un punto.
- El visor y el motor no se tocan aquí.

## Pendientes

- Que el visor lea `capas7.json` y use `n_hijas` para atenuar celdas costeras con pocas hijas.

## Relaciones

- `[[ADR-001-preprocesar-offline-y-servir-ligero]]` — límite de tamaño de lo que sirve la web.
- `[[ADR-007-contrato-de-metrics-json]]` — nada `local_only` en la web.
- `[[ADR-009-capas-de-puntos-y-distancias]]` — origen de las distancias que se agregan con mínimo.
- `[[2026-11-15-fernando-crateres-playas-roca]]` — E-17 y E-18, de donde salen cuatro de las columnas.
