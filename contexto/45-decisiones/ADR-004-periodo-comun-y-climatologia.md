---
title: "ADR-004 — Periodo común y climatología"
type: adr
status: vigente
estado: aceptado
date: 2026-11-14
updated: 2026-11-14
summary: "Las variables que cambian con el tiempo se promedian en una climatología mensual de 2013 a 2022, con filtros de calidad explícitos y huecos como NaN."
autor: fernando
scope: [docs/etl-plan.md]
tablas: []
cu: []
supersedes: []
---

# ADR-004 — Periodo común y climatología

## 1. Contexto

La temperatura de superficie, el NDVI y el viento varían por año, por estación y por nubes. Comparar un año de una
fuente con otro año de otra mezcla señal con ruido. La Luna y Marte se miden con climatologías o productos de varios
años, así que la Tierra necesita un periodo común y una forma fija de promediar.

Según las fuentes consultadas, no hay climatología publicada de Aqua para 2013 a 2022
([[I-36-climatologias-multianuales-modis-y-merra2]]); las que existen usan Terra o periodos distintos. Hay que
calcularla.

## 2. Decisión

1. **Periodo común: 2013 a 2022**, 120 meses, para la temperatura de superficie (MYD11C3 V061) y el NDVI (MOD13C1
   V061).
2. **Climatología mensual** por celda: se promedian los años válidos de cada mes y luego se derivan las columnas
   (día, noche, rango diurno, amplitud anual).
3. **Filtros de calidad**, según la investigación:
   - MYD11C3: aceptar LST producida (`QC & 3 ≤ 1`) con error ≤ 3 K (`QC >> 6 ≤ 2`).
   - MOD13C1: aceptar fiabilidad ≤ 1 y descartar nieve (2), nubes (3) y estimado desde la climatología (4).
   - Un mes entra si tiene al menos 3 días despejados.
   - El NDVI máximo exige al menos 3 periodos válidos (ver [plan del ETL](../../docs/etl-plan.md)).
4. **Sin relleno:** una celda sin meses válidos queda en `NaN`. Un rango diurno negativo se conserva y se marca.
5. Las columnas de modelos (MERRA-2, Mars Climate Database) usan sus propios periodos, declarados en el manifiesto.

## 3. Diseño

- `Clear_sky_days` y `Clear_sky_nights` son campos de bits: el número de días sale de contar los bits en 1, no de
  leer el valor.
- El sesgo de cielo despejado hace la LST de día más cálida y la de noche más fría; agranda el rango diurno sobre
  todo en zonas nubosas. En desiertos es pequeño. Se declara como limitación y no se corrige.
- Zonas con noche polar pueden no tener meses válidos y quedan en `NaN`.

## 4. Alternativas descartadas

| Alternativa | Por qué no |
| :-- | :-- |
| Usar una climatología publicada | Las encontradas son de Terra o de otros periodos, y la licencia de OpenLandMap es CC BY-SA 4.0 |
| Un solo año | Un año atípico domina el resultado |
| Filtros más estrictos | Vacían las zonas nubosas |
| Rellenar huecos por interpolación | Inventa datos justo donde la fuente no midió |

## 5. Consecuencias

- Las columnas térmicas y de vegetación son comparables entre sí y reproducibles.
- Algunas celdas, sobre todo nubosas o polares, quedan sin dato y la cobertura lo muestra.
- Cambiar el periodo implica regenerar las columnas afectadas.

## 6. Decisiones pendientes

| ID | Decisión | Qué falta para cerrarla |
| :-- | :-- | :-- |
| Q-1 | Pasar el umbral de viento de iDust-ut a una velocidad de fricción | Relacionarlo con la rugosidad superficial |
| Q-2 | Cuánto pesa el sesgo de cielo despejado en el rango diurno | Medirlo contra puntos conocidos del plan |

## 7. Fuentes

- `[O]` LP DAAC, MOD11 User Guide V6.1 — https://lpdaac.usgs.gov/documents/715/MOD11_User_Guide_V61.pdf — consultado 2026-11-08.
- `[O]` LP DAAC, MOD13 User Guide V6.1 — https://lpdaac.usgs.gov/documents/621/MOD13_User_Guide_V61.pdf — consultado 2026-11-08.
- `[P]` Sismanidis et al. 2022 — https://doi.org/10.3390/rs14102318 — consultado 2026-11-08.
- `[P]` Ermida et al. 2019 — https://doi.org/10.1029/2018JD029354 — consultado 2026-11-08.

## Relaciones

- [plan del ETL](../../docs/etl-plan.md) — pasos E-04 y E-05
- [[ADR-003-variables-por-proceso-fisico]] — qué columnas son
