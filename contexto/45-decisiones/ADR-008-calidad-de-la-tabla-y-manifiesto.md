---
title: "ADR-008 — Calidad de la tabla y manifiesto"
type: adr
status: vigente
estado: aceptado
date: 2026-11-14
updated: 2026-11-14
summary: "Cada paso del ETL se verifica de forma independiente antes del siguiente, y el manifiesto lleva los indicadores de calidad de cada columna."
autor: fernando
scope: [docs/etl-plan.md]
tablas: []
cu: []
supersedes: []
---

# ADR-008 — Calidad de la tabla y manifiesto

## 1. Contexto

Un ETL que termina no es un ETL correcto. Los errores típicos son silenciosos: una columna desalineada, un mes
duplicado, una fuente leída con el offset equivocado, un relleno tomado por dato. Las fuentes que describen cómo se
valida la tubería usan pruebas sintéticas con valores conocidos, conteo de celdas por nivel, unicidad del índice de
celda y contraste puntual contra recortes manuales
([[I-38-agregar-rasters-a-healpix-y-guardar-la-tabla]]).

HEALPix trabaja en una esfera. Pasar la latitud geodésica de la Tierra sin convertirla deforma el área de las celdas
hasta cerca de 0.9 % y las desplaza hasta unos 14 km respecto de la latitud autálica; en la Luna y Marte, tratados
como esferas, no hay diferencia ([[I-38-agregar-rasters-a-healpix-y-guardar-la-tabla]]).

## 2. Decisión

1. **Cada paso tiene una comprobación, y el siguiente no empieza hasta que pasa.** Un paso que falla en cualquier
   tesela termina con código 1.
2. **Comprobaciones de tabla:** cero infinitos, cada columna con el largo en bytes de la malla, los componentes de
   agua suman 1 y el `ipix` es ascendente y único.
3. **Comprobación por muestreo independiente:** para un conjunto aleatorio de celdas se vuelve a leer la fuente por
   otro camino y se compara.
4. **Comprobación por lugares conocidos:** el máximo de cada capa y puntos como Everest, Mar Muerto, Lut, Pilbara,
   Qaidam y Uyuni caen donde deben.
5. **El manifiesto lleva, por columna:** fuente, versión, URL, licencia, método, cobertura, advertencias y
   percentiles (p1, p50, p99, p99.9).
6. **Convención de latitud documentada:** el manifiesto declara si la malla se calculó con latitud autálica o
   geodésica.
7. Cada ejecución queda en el registro de auditoría con hora, integrante, agente, comando, salidas y resultado.

## 3. Diseño

- La verificación final (E-13) la hace un script distinto del que generó cada columna.
- Los indicadores de calidad incluyen la cobertura por columna y el acuerdo del motor con los análogos terrestres
  documentados, medido sobre esta tabla.
- Un indicador que no se pudo medir se escribe como "no medido", no se omite.

## 4. Alternativas descartadas

| Alternativa | Por qué no |
| :-- | :-- |
| Verificar solo al final | Un error temprano contamina todos los pasos siguientes |
| Que el mismo script verifique lo que calculó | Repite el mismo error y lo da por bueno |
| Un umbral único de calidad | Las columnas tienen coberturas y límites muy distintos |

## 5. Consecuencias

- Se pierde tiempo en cada paso, a cambio de no arrastrar un error hasta el final.
- El plan puede cortar capas: la verificación de cada una permite saber qué se puede entregar.
- Las cifras de calidad que se muestren salen de esta tabla y del registro de auditoría.

## 6. Decisiones pendientes

| ID | Decisión | Qué falta para cerrarla |
| :-- | :-- | :-- |
| Q-1 | Convención de latitud (autálica o geodésica) | Comprobar qué hace la librería de malla con la latitud |
| Q-2 | Tamaño de la muestra independiente | Medir el tiempo de relectura por columna |

## 7. Fuentes

- `[O]` I-38 de este repositorio, con las fuentes primarias citadas en la nota.
- `[P]` Grid4Earth, HEALPix esférico y elipsoidal — https://isprs-archives.copernicus.org/articles/L-4-W1-2026/189/2026/isprs-archives-L-4-W1-2026-189-2026.pdf — consultado 2026-11-08.

## Relaciones

- [plan del ETL](../../docs/etl-plan.md) — sección 6, verificación, y sección 7, auditoría
