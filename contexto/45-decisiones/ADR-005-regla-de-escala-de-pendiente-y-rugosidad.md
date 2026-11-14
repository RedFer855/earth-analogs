---
title: "ADR-005 — Regla de escala de pendiente y rugosidad"
type: adr
status: vigente
estado: aceptado
date: 2026-11-14
updated: 2026-11-14
summary: "La pendiente se calcula en el DEM fino con halo y agua enmascarada, y solo después se agrega a la celda; la rugosidad y el relieve quedan para la ficha del sitio."
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

1. **Pendiente a 200 m, calculada en el DEM Copernicus GLO-90 y agregada después a la celda.** Nunca se calcula sobre
   un DEM ya promediado a la celda.
2. **La columna de comparación es `slope_mean_deg` junto con `slope_std_deg`.** La rugosidad y el relieve se calculan
   solo para la ficha del sitio y no puntúan la semejanza.
3. **Halo entre teselas:** cada ventana se lee con un borde de unos 0.02° tomado de las teselas vecinas, a través de
   un mosaico virtual (VRT), y se recorta después.
4. **Ancho de celda desde la geotransformada de cada tesela,** porque el ancho en longitud cambia con la latitud.
5. **Máscara de agua antes de la pendiente:** el mar se enmascara siempre. Lagos y ríos se enmascaran solo donde la
   ocurrencia de agua superficial es ≥ 50 %; los salares y lagos secos se conservan.
6. **Fuera de alcance:** los 2° alrededor de los polos (la Antártida queda fuera por el reto).

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
| Q-1 | Escala de comparación para la Luna y Marte | Medir la resolución efectiva de cada DEM planetario |
| Q-2 | Umbral de ocurrencia de agua (50 %) | Revisarlo con salares y lagos estacionales conocidos |

## 7. Fuentes

- `[O]` Copernicus DEM Product Handbook v6.1 — https://dataspace.copernicus.eu/sites/default/files/media/files/2026-10/geo1988-copernicusdem-spe-002_producthandbook_i6.1.pdf — consultado 2026-11-08.
- `[O]` Ho et al. 2025, GEDTM30 — https://doi.org/10.7717/peerj.19673 — consultado 2026-11-08.
- `[O]` Amatulli et al. 2020, Geomorpho90m — https://doi.org/10.1038/s41597-020-0479-6 — consultado 2026-11-08.
- `[P]` Gotway y Young 2002, cambio de soporte — https://doi.org/10.1198/016214502760047140 — consultado 2026-11-04.

## Relaciones

- [plan del ETL](../../docs/etl-plan.md) — paso E-03 y reglas por fuente
- [[ADR-006-valores-faltantes-y-cobertura]] — qué pasa con las celdas sin dato
