---
title: "ADR-002 — Malla primero y una columna por capa"
type: adr
status: vigente
estado: aceptado
date: 2026-11-14
updated: 2026-11-14
summary: "El ETL construye primero una malla HEALPix de área igual, y cada capa escribe su propia columna alineada a ella; el manifiesto describe cada columna."
autor: fernando
scope: [docs/etl-plan.md]
tablas: []
cu: []
supersedes: []
---

# ADR-002 — Malla primero y una columna por capa

## 1. Contexto

Comparar la Tierra con la Luna y Marte exige medir todas las variables sobre las mismas celdas. Una malla de latitud y
longitud sobrerrepresenta los polos; hace falta una malla de área igual y con subdivisión exacta
([[I-08-cuadriculas-de-area-igual]]). Entre las seis mallas comparadas, HEALPix cumple las dos condiciones y tiene
implementación abierta en Rust (`cdshealpix`, Apache-2.0 o MIT).

Agregar rasters de resoluciones distintas a celdas, con estadísticas y faltantes explícitos, tiene método publicado
([[I-38-agregar-rasters-a-healpix-y-guardar-la-tabla]]).

## 2. Decisión

1. **E-01 construye la malla antes que cualquier capa:** HEALPix nivel 12, solo celdas de tierra, `ipix` ascendente.
2. **Cada capa escribe una columna** `columns/<nombre>.f32`, alineada a la malla (mismo largo, mismo orden).
3. **No hay tabla unida.** El manifiesto lista, por columna, fuente, versión, URL, licencia, método, cobertura,
   advertencias y percentiles (p1, p50, p99, p99.9).
4. **Un valor faltante es `NaN`, nunca `0`.** Si una fuente no se puede leer, la columna no existe y el manifiesto
   dice por qué.
5. Las columnas de modelos con licencia restringida llevan la marca `local_only` y no salen en archivos públicos.

## 3. Diseño

- Nivel 12 da celdas de unos 2.5 km² en la Tierra (4πR² / (12·4¹²), con R = 6371.0072 km).
- Las capas no dependen entre sí: pueden correr en paralelo o saltarse sin romper las demás.
- Los percentiles del manifiesto alimentan la comparación "hasta dónde llega la Tierra" frente a los valores de la
  Luna y Marte.

## 4. Alternativas descartadas

| Alternativa | Por qué no |
| :-- | :-- |
| Malla de latitud y longitud | Celdas de área desigual; sesga los polos |
| H3 o S2 | Área no exactamente igual entre celdas del mismo nivel |
| Una tabla única unida | Una capa que falla bloquea todas; difícil de verificar por columna |
| Rellenar faltantes con 0 | Un cero inventado se compara como si fuera un dato |

## 5. Consecuencias

- Cada capa se verifica sola y se puede cortar si falta tiempo (fases A, B y C del plan).
- Hay más archivos, pero cada uno tiene una sola responsabilidad.
- El manifiesto es el contrato: lo que no está en él no existe para el motor.

## 6. Decisiones pendientes

| ID | Decisión | Qué falta para cerrarla |
| :-- | :-- | :-- |
| Q-1 | Nivel de la malla para Luna y Marte | Comparar el tamaño de celda con la resolución de cada fuente planetaria |

## 7. Fuentes

- `[O]` Górski et al. 2005, HEALPix — consultado 2026-11-04 en [[I-08-cuadriculas-de-area-igual]].
- `[O]` `cdshealpix` 0.10.1 — https://crates.io/api/v1/crates/cdshealpix — consultado 2026-11-04.

## Relaciones

- [plan del ETL](../../docs/etl-plan.md) — pasos E-01 a E-13
- [[ADR-001-preprocesar-offline-y-servir-ligero]] — por qué se procesa en la PC
