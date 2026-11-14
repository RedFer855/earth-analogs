---
title: "ADR-007 — Contrato de metrics.json"
type: adr
status: vigente
estado: aceptado
date: 2026-11-14
updated: 2026-11-14
summary: "La web solo lee un archivo derivado, metrics.json, con versión, origen de cada número y, por dimensión, en qué coincide y en qué difiere cada análogo."
autor: fernando
scope: [docs/etl-plan.md]
tablas: []
cu: []
supersedes: []
---

# ADR-007 — Contrato de metrics.json

## 1. Contexto

La web no lee la tabla del ETL (cientos de MB por columna); lee un archivo derivado de pocos MB. Ese archivo es el
único punto de contacto entre el ETL y la interfaz, así que su forma tiene que fijarse antes de escribir la
interfaz y antes de calcular nada.

La NASA, la ESA y la literatura describen la fidelidad de un análogo por dimensión: qué se parece, cuánto y qué no se
parece (gravedad, atmósfera, presión y escala incluidas) ([[I-30-como-se-describe-la-fidelidad-de-un-analogo]]). El
reto pide justamente "en qué coinciden y en qué difieren".

## 2. Decisión

1. `metrics.json` es el **único** archivo de resultados que la web lee. Mide pocos MB.
2. Lleva una **versión del contrato** y, para cada número, el **origen**: columna del manifiesto, fuente y versión.
3. Para cada sitio objetivo de la Luna o de Marte y para cada análogo propuesto, guarda **por dimensión**: el valor
   del objetivo, el valor del análogo, la diferencia y una etiqueta (coincide, difiere o sin dato).
4. Guarda también la **cobertura**: cuántas dimensiones se pudieron comparar y cuáles faltan.
5. Declara las **diferencias físicas** que ninguna columna captura: gravedad, atmósfera, presión y escala.
6. **Nada `local_only` entra.** Las columnas con licencia restringida no salen en ningún archivo público.
7. Un valor faltante se escribe como `null`, nunca como 0.

## 3. Diseño

Estructura de alto nivel, a detallar en el esquema:

| Bloque | Contenido |
| :-- | :-- |
| `contract` | versión, fecha de generación, nivel de malla, huella del manifiesto |
| `dimensions` | lista de dimensiones con unidad y descripción |
| `targets` | sitios de la Luna y Marte con sus valores por dimensión |
| `analogs` | por objetivo, celdas propuestas con valor, diferencia y etiqueta por dimensión |
| `limits` | diferencias físicas no capturadas y avisos de cobertura |

- Los percentiles del manifiesto alimentan la comparación "hasta dónde llega la Tierra" sin cargar la tabla.
- La web valida la versión del contrato al abrir y avisa si no coincide.

## 4. Alternativas descartadas

| Alternativa | Por qué no |
| :-- | :-- |
| Que la web lea la tabla completa | Pesa cientos de MB y expone columnas restringidas |
| Un puntaje único sin desglose | No dice en qué coincide ni en qué difiere, que es lo que pide el reto |
| Un archivo por sitio | Más peticiones y más versiones que sincronizar |

## 5. Consecuencias

- ETL e interfaz pueden avanzar a la vez contra el mismo esquema.
- Cambiar el contrato exige subir la versión y regenerar el archivo.
- Cada número de la pantalla se puede rastrear hasta su columna y su fuente.

## 6. Decisiones pendientes

| ID | Decisión | Qué falta para cerrarla |
| :-- | :-- | :-- |
| Q-1 | Esquema JSON exacto y validador | Escribir el esquema con el primer lote de columnas |
| Q-2 | Tamaño máximo de `metrics.json` | Medirlo con celdas reales |

## 7. Fuentes

- `[O]` I-30 de este repositorio, con los marcos de la NASA y la ESA citados en la nota.

## Relaciones

- [plan del ETL](../../docs/etl-plan.md) — manifiesto y pasos E-11 a E-13
