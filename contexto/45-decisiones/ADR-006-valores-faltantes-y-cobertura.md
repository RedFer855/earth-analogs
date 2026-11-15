---
title: "ADR-006 — Valores faltantes y cobertura"
type: adr
status: vigente
estado: aceptado
date: 2026-11-14
updated: 2026-11-15
summary: "Un valor faltante es NaN y nunca se rellena; una celda sin dato en una columna sigue en la tabla, y la cobertura de cada columna se declara."
autor: fernando
scope: [docs/etl-plan.md]
tablas: []
cu: []
supersedes: []
---

# ADR-006 — Valores faltantes y cobertura

## 1. Contexto

Casi ninguna fuente cubre toda la tierra: el NDVI falta bajo nieve y nubes, el índice de aridez falla cerca del polo,
el permafrost solo está modelado en el hemisferio norte y la emisividad trae valores de relleno. Un 0 puesto en lugar
de un faltante se compara como si fuera una medida real.

Los trabajos que comparan lugares con unidades distintas y celdas sin dato necesitan una regla explícita de faltantes
([[I-16-normalizacion-y-puntaje-con-unidades-distintas]]). Al agregar rasters a celdas, un solo píxel válido puede
representar toda una celda costera, y no hay un umbral estándar de fracción válida
([[I-38-agregar-rasters-a-healpix-y-guardar-la-tabla]]).

## 2. Decisión

1. **Faltante = `NaN`, nunca 0.** Un 0 exacto solo se guarda cuando la fuente lo mide (por ejemplo, índice de aridez
   igual a 0).
2. **Una celda sin dato en una columna no sale de la tabla.** Solo esa columna queda en `NaN`.
3. **Si una columna entera no se puede leer, no existe.** El manifiesto explica el motivo.
4. **Cobertura por columna:** el manifiesto guarda el porcentaje de celdas con dato, junto con sus advertencias.
5. **Reglas de `NaN` por fuente,** ya fijadas en el plan:
   - índice de aridez desde 80° N;
   - emisividad fuera de 0.5–1, y los índices derivados la heredan;
   - clase "sin dato" de la litología;
   - permafrost fuera del hemisferio norte, declarado en el manifiesto.
6. **El NDVI faltante no excluye la celda en la tabla:** el NDVI no puntúa la semejanza (ver la decisión sobre variables por proceso físico). El motor sí puede usarlo como filtro de vegetación; una celda sin NDVI queda fuera de ese filtro, por eso la cobertura polar del NDVI importa (ver 7).
7. **Regla de NDVI (E-05).** Un periodo de MOD13C1 cuenta si la fiabilidad es 0 o 1 y "VI Quality" (bits 11-13) marca
   tierra (1) o costa y orilla (2); el agua (3 a 7) queda fuera. `ndvi_max_clim` es el máximo de la curva climatológica:
   para cada uno de los 23 periodos del año, la media de los años con dato, y luego el máximo entre periodos, con al
   menos 3 periodos con dato (basta la temporada sin nieve).

## 3. Diseño

- La comparación usa solo las dimensiones presentes en la celda y muestra cuántas fueron. Una semejanza basada en
  dos dimensiones no se presenta igual que una basada en seis.
- La fracción mínima de píxeles válidos por celda se mide en el ETL y se informa en el manifiesto; no se fija un
  umbral sin evidencia.
- Cada paso del ETL verifica que ninguna columna tenga infinitos y que el largo del archivo coincida con la malla.

## 4. Alternativas descartadas

| Alternativa | Por qué no |
| :-- | :-- |
| Rellenar con la media o con 0 | Inventa un dato justo donde no se midió |
| Eliminar toda celda con un faltante | Deja casi sin celdas: cada fuente falta en lugares distintos |
| Interpolar desde vecinas | Oculta zonas sin cobertura real, como el polo o las áreas nubosas |
| Usar un umbral fijo de píxeles válidos desde el inicio | No hay umbral estándar en la literatura consultada |

### Medición de la regla de NDVI (2026-11-15)

Aceptar solo el código 1 y pedir 3 periodos por año durante 5 años o más dejaba `ndvi_max_clim` en 80.7 % de las
celdas (de 60° a 70° N, 67.5 %; más allá de 70° N, 35.5 %). Se recalculó la columna con cada máscara y cada regla
sobre los 230 periodos. Sin máscara de agua la cobertura sería 88.7 %, así que la máscara de solo tierra quitaba 8
puntos, casi todos en costas y orillas de píxeles de 0.05°; aceptar también el código 2 los devuelve (87.7 % con la
regla por año). Cambiar la regla a «máximo de la curva climatológica» recupera medio punto más y llega a 88.15 % (de 60°
a 70° N, 93.3 %; más allá de 70° N, 61.7 %), y Isla Devon pasa de 16 424 a 24 972 celdas con NDVI. Las variantes con
agua somera (código 3) suman menos de 0.5 puntos y mezclan píxeles con agua, así que no se aceptan.

## 5. Consecuencias

- El resultado dice cuánta evidencia respalda cada semejanza.
- Las columnas con poca cobertura se ven en el manifiesto y no se esconden detrás de un promedio.
- El motor tiene que manejar celdas con dimensiones incompletas.

## 6. Decisiones pendientes

| ID | Decisión | Qué falta para cerrarla |
| :-- | :-- | :-- |
| Q-1 | Número mínimo de dimensiones para publicar una semejanza | Probarlo con los análogos documentados ([[I-03-analogos-terrestres-documentados]]) |
| Q-2 | Fracción mínima de píxeles válidos por celda | Medirla con el primer lote de columnas |

## 7. Fuentes

- `[O]` I-16 e I-38 de este repositorio, con las fuentes primarias citadas en cada nota.
- `[O]` LP DAAC, MOD13 User Guide V6.1 — https://lpdaac.usgs.gov/documents/621/MOD13_User_Guide_V61.pdf — consultado 2026-11-08.

## Relaciones

- [plan del ETL](../../docs/etl-plan.md) — reglas por fuente y verificación
- [[ADR-005-regla-de-escala-de-pendiente-y-rugosidad]] — cómo se calcula la pendiente
