---
title: "ADR-005 — Regla de escala de pendiente y rugosidad"
type: adr
status: vigente
estado: aceptado
date: 2026-11-14
updated: 2026-11-15
summary: "La pendiente, la rugosidad y el relieve se calculan en bloques cuadrados de 200 m (LAEA local) con ventana de 1 km, igual en la Tierra, la Luna y Marte, y solo después se agregan a la celda."
autor: fernando
scope: [docs/etl-plan.md]
tablas: []
cu: []
supersedes: []
---

# ADR-005 — Regla de escala de pendiente y rugosidad

## 1. Contexto

La pendiente y la rugosidad dependen de la escala a la que se miden. Al engrosar el DEM, la pendiente baja y pierde
los extremos, y la rugosidad no es monótona: sube hasta el tamaño de la geoforma dominante y luego baja, de modo que
el orden entre zonas puede invertirse ([[I-11-sesgo-por-escala-de-cada-variable]]). La literatura calcula en el DEM
fino y agrega después.

Las fuentes que procesan un DEM global por teselas documentan tres riesgos: discontinuidades en los bordes de tesela
sin halo, pendientes falsas sobre lagos y rugosidad falsa donde el DEM incluye bosque o edificios
([[I-35-procesar-un-dem-global-por-teselas]]). Ninguna máscara de agua usa la elevación, así que excluir el océano no
quita las depresiones secas como el Valle de la Muerte ([[I-10-mascaras-de-agua]]).

## 2. Decisión

1. **Pendiente en bloques cuadrados de 200 m, calculada en el DEM Copernicus GLO-90 y agregada después a la celda.**
   Cada tesela se reproyecta a una proyección azimutal de áreas iguales de Lambert (LAEA) centrada en ella, con píxeles
   de 200 m (promedio de área; un bloque es válido si su validez es ≥ 0.999). Nunca se calcula sobre un DEM ya promediado
   a la celda. La Luna (LOLA, bloques de 10 × 10 píxeles de 20 m) y Marte (HRSC-MOLA, reproyectado a LAEA local) usan
   la misma regla, así que los tres cuerpos se miden a la misma escala.
2. **Columnas de comparación y de ficha.** `slope_mean_deg` y `slope_std_deg` comparan. La rugosidad RMS y el relieve
   se calculan en una ventana de 5 × 5 bloques (1 km, al menos 19 válidos) con el mismo estimador en los tres cuerpos.
   Qué variables puntúan en el motor es decisión del equipo, no de este ADR.
3. **Halo entre teselas:** cada ventana se lee con un borde de unos 0.02° tomado de las teselas vecinas, a través de
   un mosaico virtual (VRT), y se recorta después.
4. **Ancho de celda desde la geotransformada de cada tesela,** porque el ancho en longitud cambia con la latitud.
5. **Máscara de agua antes de la pendiente:** el mar se enmascara siempre. Lagos y ríos se enmascaran solo donde la
   ocurrencia de agua superficial es ≥ 50 %; los salares y lagos secos se conservan.
6. **Fuera de alcance:** los 2° alrededor de los polos, por el límite del DEM y de la proyección. El reto no excluye la
   Antártida ni las regiones polares: pide explorar la Tierra entera (`10-reto/dimensiones-innegociables`). Los Valles
   Secos de McMurdo (a unos 77.5° S) sí entran en la malla; lo que les falta son capas de permafrost (ver E-07).
7. **Una sola pasada.** `e03_extras.py` calcula todas las columnas de terreno leyendo el DEM una vez (antes, `e03_terreno.py`
   y `e03_extras.py` lo leían dos veces).

### Medición del cambio (2026-11-15)

Antes: bloques de 2 × 2 píxeles GLO-90 (~185 m de N a S y ~131 m de E a O a 45° de latitud) y ventana de ~900 m,
que no es la escala de la Luna ni de Marte. En Marte, con bloques de `200·cos(lat)` m de E a O, la misma superficie daba
un relieve de 91 m a 0° y 53 m a 60° de latitud; con bloques cuadrados la diferencia es menor que 3 %
(`etl/test_e12_bloques.py`). En la Tierra, una prueba con una superficie sintética (`etl/test_e03_escala.py`) da una
pendiente de 10° ± 0.2° a 0°, 45° y 70° de latitud y, medida con el estimador de los objetivos, la misma pendiente y
el mismo relieve (±2 %). Contra la relectura independiente de E-13 (GLO-90 a UTM de 200 m y `gdaldem slope`), el error
mediano de `slope_mean_deg` (40 celdas sin agua) pasó de 0.176° (p90 0.84°) antes del cambio a 0.050° (p90 0.30°)
después, medido el 2026-11-15 con la corrida completa de E-03 a 200 m (E-13, 300 celdas de muestra).

Coherencia entre cuerpos (`etl/medir_coherencia_escala.py`, 2026-11-15): se toma el percentil que ocupa la mediana de
pendiente, rugosidad y relieve de cada uno de los 21 sitios (9 regiones lunares y 12 sitios marcianos) dentro de la
distribución terrestre. Con una escala común los tres percentiles de un sitio coinciden. Con los bloques de 200 m la
dispersión (máximo menos mínimo) es de 0.91 puntos como máximo y 0.45 de media; con el método anterior era de 3.37
y 1.97.

## 3. Diseño

- El mar es exactamente 0 m en el DEM: se enmascara antes de derivar, para no crear pendientes en la costa.
- La reproyección local por tesela evita la distorsión este-oeste; junto al antimeridiano el halo toma las vecinas del
  otro lado.
- El DEM es un modelo de superficie (incluye vegetación y edificios): la rugosidad en zonas forestales o urbanas se
  marca como poco fiable en la ficha.
- La comprobación de E-03 usa puntos conocidos (Everest, Mar Muerto, Uyuni, Lut) y confirma que lagos planos y mar son
  `NaN`.

## 4. Alternativas descartadas

| Alternativa | Por qué no |
| :-- | :-- |
| Promediar el DEM a la celda y luego derivar | Baja la pendiente y borra los extremos; cambia el orden entre zonas |
| Usar la pendiente publicada de GEDTM30 (240 m) | Es un modelo sin bosques ni edificios, calculado con otro método; mezclaría dos DEM |
| Una sola máscara de agua con un umbral cualquiera | Quita salares reales o deja lagos que contaminan la pendiente |
| Calcular por tesela sin halo | Deja discontinuidades en los bordes |

## 5. Consecuencias

- La pendiente de la Tierra es comparable con la de los DEM de la Luna y Marte solo a escalas declaradas.
- Procesar con halo cuesta más memoria y tiempo; el paso E-03 se corre con un máximo de procesos declarado.
- La rugosidad no aporta a la comparación, pero sí informa al lector de la ficha.

## 6. Decisiones pendientes

| ID | Decisión | Qué falta para cerrarla |
| :-- | :-- | :-- |
| Q-1 | Escala de comparación para la Luna y Marte | **Cerrada el 2026-11-15:** 200 m cuadrados y ventana de 1 km en los tres cuerpos (decisión 1). Queda medir la resolución efectiva del DEM de cada cuerpo |
| Q-2 | Umbral de ocurrencia de agua (50 %) | Revisarlo con salares y lagos estacionales conocidos |

## 7. Fuentes

- `[O]` Copernicus DEM Product Handbook v6.1 — https://dataspace.copernicus.eu/sites/default/files/media/files/2026-10/geo1988-copernicusdem-spe-002_producthandbook_i6.1.pdf — consultado 2026-11-08.
- `[O]` Ho et al. 2025, GEDTM30 — https://doi.org/10.7717/peerj.19673 — consultado 2026-11-08.
- `[O]` Amatulli et al. 2020, Geomorpho90m — https://doi.org/10.1038/s41597-020-0479-6 — consultado 2026-11-08.
- `[P]` Gotway y Young 2002, cambio de soporte — https://doi.org/10.1198/016214502760047140 — consultado 2026-11-04.

## Relaciones

- [plan del ETL](../../docs/etl-plan.md) — paso E-03 y reglas por fuente
- [[ADR-006-valores-faltantes-y-cobertura]] — qué pasa con las celdas sin dato
