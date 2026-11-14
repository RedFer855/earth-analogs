---
title: "ADR-003 — Variables por proceso físico"
type: adr
status: vigente
estado: aceptado
date: 2026-11-14
updated: 2026-11-14
summary: "Las columnas de la tabla describen procesos físicos agrupados en seis dimensiones; cada una exige un equivalente medible en la Luna o en Marte."
autor: fernando
scope: [docs/etl-plan.md]
tablas: []
cu: []
supersedes: []
---

# ADR-003 — Variables por proceso físico

## 1. Contexto

El reto pide zonas de la Tierra que se parezcan a las regiones candidatas de la Luna y a sitios de Marte. Parecerse en
imagen no basta: un desierto y un campo de lava pueden verse iguales y comportarse distinto. Los trabajos publicados
que comparan cuerpos distintos miden procesos (sedimentación, polvo, hielo, alteración por agua) y no solo estados
([[I-18-procesos-como-variables]]).

Además, varias variables tienen sentido en un cuerpo y no en otro. La Luna no tiene hoy procesos eólicos, hidrológicos
ni glaciares, y Marte no tiene agua líquida superficial detectada ([[I-18-procesos-como-variables]]). Comparar con un
valor que no existe produce un número inventado.

## 2. Decisión

1. Cada columna describe un proceso físico o una propiedad que lo controla, no una apariencia.
2. Las columnas se agrupan en **seis dimensiones**:

| Dimensión | Columnas del ETL | Paso |
| :-- | :-- | :-- |
| Relieve | `slope_mean_deg`, `slope_std_deg` | E-03 |
| Térmica | temperatura día, noche, rango diurno, amplitud anual | E-04 |
| Agua y aridez | índice de aridez, ET0, agua superficial | E-06, E-10 |
| Hielo en el suelo | temperatura media anual del suelo (permafrost) | E-07 |
| Viento y polvo | perfil de polvo operativo, viento | E-08 |
| Material | emisividad, sílice y litología (perfil de polvo de material) | E-09 |

3. Una dimensión solo entra a la comparación de un cuerpo si tiene un equivalente medido en ese cuerpo. Si no lo
   tiene, se declara ausente; no se rellena.
4. El NDVI es una columna de contexto de la Tierra (E-05). No tiene equivalente en la Luna ni en Marte y no puntúa la
   semejanza.

## 3. Diseño

- Rugosidad y relieve se calculan con una regla de escala común y se usan en la ficha del sitio; la comparación usa
  pendiente media y desviación de la pendiente ([[I-11-sesgo-por-escala-de-cada-variable]]).
- Las dimensiones de agua y de viento tienen contraparte limitada en la Luna; el motor las marca como no comparables
  y no como cero.
- Cada columna declara en el manifiesto de qué dimensión es ([plan del ETL](../../docs/etl-plan.md)).

## 4. Alternativas descartadas

| Alternativa | Por qué no |
| :-- | :-- |
| Comparar por parecido visual o por clase de terreno | No distingue procesos; las clases no existen igual en los tres cuerpos |
| Usar todas las variables disponibles | Más columnas sin equivalente solo agregan ruido y huecos |
| Una sola temperatura media | Pierde el rango diurno y la amplitud anual, que son los que cambian entre cuerpos |

## 5. Consecuencias

- La semejanza se explica por dimensión: en qué coincide y en qué difiere.
- Faltan dimensiones en algunas comparaciones; el resultado lo dice en vez de ocultarlo.

## 6. Decisiones pendientes

| ID | Decisión | Qué falta para cerrarla |
| :-- | :-- | :-- |
| Q-1 | Si el NDVI puede servir de filtro en la Tierra | Decidir si entra a la búsqueda o solo a la descripción |
| Q-2 | Peso relativo de cada dimensión | Probar contra análogos documentados ([[I-03-analogos-terrestres-documentados]]) |

## 7. Fuentes

- `[O]` I-18, I-11 e I-03 de este repositorio, con las fuentes primarias citadas en cada nota.

## Relaciones

- [plan del ETL](../../docs/etl-plan.md) — pasos E-03 a E-10
- [[ADR-004-periodo-comun-y-climatologia]] — qué años y cómo se promedian
