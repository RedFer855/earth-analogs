---
title: "ADR-010 — Motor de búsqueda sobre la tabla del ETL"
type: adr
status: vigente
estado: aceptado
date: 2026-11-15
updated: 2026-11-15
summary: "El motor en Rust lee $RUN tal como lo deja el ETL, puntúa con Mahalanobis contraída por cuerpo, tolerancia pseudo-Huber y regla de Gower, deja la temperatura como diagnóstico y escribe metrics.json acumulable con el origen de cada número."
autor: fernando
scope: [motor/, etl/e20_perfiles.py, analisis/referencia_motor.py]
tablas: []
cu: []
supersedes: []
---

# ADR-010 — Motor de búsqueda sobre la tabla del ETL

## 1. Contexto

El ETL (E-01 a E-19) deja en `$RUN` una tabla de una columna `f32` por variable sobre la malla HEALPix de nivel 12,
un manifiesto (E-13) y los objetivos de la Luna y Marte (E-11 y E-12). Faltaba la pieza que compara cada celda de la
Tierra con cada sitio objetivo y escribe `metrics.json` (ADR-007).

Una revisión de la fórmula de búsqueda, hecha hoy con la literatura de distancias y datos faltantes, señaló cinco
problemas que
cambian el orden de los candidatos: la tolerancia como zona muerta crea mesetas de S = 1 y anula los términos
cruzados de la correlación; una sola contracción λ = 0.10 impone la correlación de la Tierra a la Luna y Marte;
descartar toda celda incompleta deja fuera análogos polares; el rango térmico diario de la Luna y Marte no existe en la
Tierra y aplasta el puntaje; y en la Luna no tienen sentido variables de atmósfera, agua o vegetación.

Al conectar el motor con la tabla se midió otro problema: E-01 guarda la latitud **geodésica** WGS84 en
`grid/lat.f32`, mientras que HEALPix trabaja en la esfera con latitud **autálica**. Sin convertir, el centro de una
celda sale corrido hasta 0.128° (unos 14 km) en latitud.

## 2. Decisión

1. **El motor lee `$RUN` tal cual.** Manifiesto, `grid/` y `columns/` con los nombres del ETL (ADR-007, regla 8). No
   hay adaptador que copie ni renombre columnas.
2. **Los perfiles los escribe el ETL** en un paso nuevo, E-20 (`$RUN/perfiles.json`): objetivo = mediana de los
   parches del sitio, tolerancia = MAD de esos parches, escala = max(1.4826 MAD, (P90 - P10) / 2.56, 0.01) en la
   Tierra elegible, correlación de Pearson en una muestra fija de 2 millones de celdas (semilla en `etl/e20_perfiles.py`).
3. **Puntúan solo las cuatro variables de terreno** (`slope_mean_deg`, `slope_std_deg`, `rug_rms_mean_m`,
   `relieve_mean_m`), medidas igual en los tres cuerpos (ADR-005). En la Luna el motor rechaza cualquier variable que
   no sea de forma del terreno.
4. **La temperatura es diagnóstico, no puntaje.** `rango_diurno_k` (y `amp_anual_k` en Marte) se escriben junto a
   cada candidato con el valor del objetivo y la diferencia, para decir en qué difiere.
5. **Fórmula** (núcleo, `motor/nucleo/src/perfil.rs`), para las variables presentes de la celda:
   - `z = (x - y) / s`; con tolerancia, `u = z / (1 + (z / t)^2)^(1/4)` con `t = tau / s` (pseudo-Huber: atenúa sin
     anular, así no hay mesetas y la correlación sigue contando);
   - `R_s = (1 - λ) R + λ I`, con **λ = 0.85 en la Luna y 0.50 en Marte**, fijado por perfil;
   - `D2 = u' W^(1/2) R_s^(-1) W^(1/2) u`, pesos repartidos entre las presentes; `S = exp(-0.5 D2)`.
6. **Regla de Gower para celdas incompletas:** entran si tienen todas las obligatorias y al menos el 70 % de las
   variables; su S se multiplica por la fracción presente (ADR-006).
7. **Suelo desnudo:** solo se buscan celdas con `ndvi_max_clim` con dato y ≤ 0.20.
8. **Un candidato por región de nivel 6** (unos 100 km de lado), los 200 mejores, con separación opcional en km.
9. **Coordenadas en WGS84.** Todo centro, vértice o área que entra o sale del motor pasa entre latitud autálica y
   geodésica con las fórmulas de Snyder (1987) que usa `etl/comun.py`.
10. **Salida:** `metrics.json` es el índice que la web abre primero; el detalle de cada sitio va en
    `resultados/<perfil>/<sitio>.json` y se pide al elegir el sitio. Esto precisa ADR-007 §2.1: medido hoy con los 21
    sitios, el índice pesa 13 KB y el detalle 6.4 MB (unos 300 KB por sitio).
11. **`metrics.json` acumula:** cada corrida reemplaza solo su perfil y su sitio; si cambia la tabla (fecha o commit
    de E-13) o la versión del contrato, empieza de cero.
12. **Origen de cada número desde el manifiesto:** fuente, URL, licencia y unidad de cada columna, más la fecha y el
    commit de la tabla en `contrato.tabla`. Nada de fuentes escritas en el código.

## 3. Diseño

| Pieza | Qué hace |
| :-- | :-- |
| `etl/e20_perfiles.py` | Escribe `$RUN/perfiles.json`; corre después de E-13 en la cola |
| `motor/nucleo` | Fórmula pura, sin E/S; precalcula las matrices de cada combinación de variables presentes |
| `motor/pipeline` | Abre la tabla con mmap, barre en paralelo (rayon), elige candidatos y escribe la salida |
| `analisis/referencia_motor.py` | Implementa la fórmula con numpy por separado; la prueba `referencia_numpy` compara a 1e-12 |

Por candidato y variable la salida trae `valor`, `diferencia` (contra el valor real del objetivo), `nota` y
`etiqueta` (`coincide`, `difiere` o `sin_dato`), más `cobertura` con las variables que faltan.

## 4. Alternativas descartadas

| Alternativa | Por qué no |
| :-- | :-- |
| Un adaptador que copie la tabla a otra carpeta y renombre columnas | Duplica GB y rompe ADR-007 regla 8; el motor puede leer `$RUN` directo |
| Tolerancia como zona muerta | Medido hoy con JZ: 4 077 regiones empatadas en S = 1, el orden entre ellas no dice nada |
| Una sola λ = 0.10 para todo | Impone la correlación de la Tierra a cuerpos sin agua ni vegetación |
| Puntuar el rango térmico diario | La Tierra no llega a los valores de la Luna ni de Marte: el puntaje solo premiaría el desierto más caliente |
| Descartar toda celda con un faltante | Deja fuera análogos polares (ADR-006) |
| Todos los candidatos dentro de `metrics.json` | 6.4 MB para 21 sitios; la web solo necesita el sitio elegido |

## 5. Consecuencias

- El ETL y el motor comparten nombres y coordenadas: correr E-20 y el motor sobre `$RUN` basta.
- Cada número del resultado se rastrea hasta su columna, su fuente y la corrida de la tabla.
- El valor de λ por cuerpo y el umbral de NDVI son una elección de hoy y no están calibrados contra análogos conocidos.
- El filtro de NDVI deja pasar hielo: medido hoy, 256 de 4 200 candidatos de los 21 sitios caen al norte de 60° N
  entre 75° O y 10° O, sobre todo en Groenlandia ([[abierta]], P-015).

## 6. Decisiones pendientes

| ID | Decisión | Qué falta para cerrarla |
| :-- | :-- | :-- |
| Q-1 | Calibrar S por grados de libertad (chi cuadrado) para comparar perfiles con distinto número de variables | Hoy todos los perfiles tienen 4 variables; hace falta cuando haya perfiles más largos (P-016) |
| Q-2 | Transformación logarítmica de pendiente, rugosidad y relieve | Medir cuánto cambia el orden con y sin ella (P-016) |
| Q-3 | Excluir hielo permanente | Una columna de glaciares y capas de hielo en el ETL (P-015) |

## 7. Fuentes

- `[P]` Snyder, J. P. (1987). *Map Projections: A Working Manual*, USGS Professional Paper 1395, ec. 3-11, 3-12 y
  3-18 — https://doi.org/10.3133/pp1395 — consultado 2026-11-15.
- `[P]` Gower, J. C. (1971). A general coefficient of similarity and some of its properties. *Biometrics* 27(4),
  857-871 — https://doi.org/10.2307/2528823 — consultado 2026-11-15.
- `[P]` Huber, P. J. (1964). Robust estimation of a location parameter. *Ann. Math. Statist.* 35(1), 73-101 —
  https://doi.org/10.1214/aoms/1177703732 — consultado 2026-11-15.

## Relaciones

- [[ADR-007-contrato-de-metrics-json]] — contrato que este motor escribe; §2.1 se precisa en la decisión 10
- [[ADR-006-valores-faltantes-y-cobertura]] — regla de Gower y faltantes como `NaN`
- [[ADR-005-regla-de-escala-de-pendiente-y-rugosidad]] — por qué el terreno se compara a 200 m
- [[ADR-003-variables-por-proceso-fisico]] — por qué cada cuerpo tiene sus variables
