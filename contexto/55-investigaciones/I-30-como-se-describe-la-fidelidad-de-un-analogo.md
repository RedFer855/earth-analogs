---
title: "I-30 — Cómo se describe y se califica la fidelidad de un análogo"
type: investigacion
status: vigente
date: 2026-11-08
updated: 2026-11-08
summary: "Qué marcos publicados usan NASA, ESA y la literatura para decir en qué y cuánto se parece un análogo terrestre a la Luna o Marte (fidelidad por dimensión, análogos funcionales)."
autor: fernando
tipo_investigacion: B
riesgo: bajo
---

# I-30 — Cómo se describe y se califica la fidelidad de un análogo

**Pregunta.** El reto pide explicar para cada análogo qué se parece, dónde falla y para qué sirve ([[dimensiones-innegociables]]). ¿Existe un vocabulario o una escala de fidelidad estándar en NASA, ESA o la literatura publicada?

## Prompt

```
I-30 — Marcos para describir la fidelidad de un análogo planetario

IMPORTANTE: Esta es una comparación de marcos publicados contra criterios definidos. No escribas una historia de los análogos, no repitas el contexto y no elijas un marco: solo compara.

OBJETIVO
Comparar los marcos publicados que describen o califican cuánto y en qué se parece un sitio terrestre a la Luna o Marte.

CONTEXTO (solo lo que cambia la comparación)
- Comparación cuantitativa de celdas terrestres con sitios lunares o marcianos mediante variables físicas.
- Para cada lugar interesa explicar qué se parece, cuánto, dónde falla y para qué sirve (pruebas de rover, base, astrobiología, entrenamiento).
- La gravedad, la atmósfera y la radiación nunca se reproducen en la Tierra.

OPCIONES A COMPARAR
1. "Functional analogues" (Foucher et al. 2021, Planetary and Space Science u otra fuente que use el término).
2. Escalas de fidelidad de análogos de misión de NASA (analog missions, HRP, Desert RATS, NEEMO) o de ESA (analogue site evaluation).
3. Clasificaciones de análogos por tipo (geológico, astrobiológico, operacional, de ingeniería) en revisiones publicadas (por ejemplo, Preston y Dartnell 2014).
4. Índices o puntajes numéricos de parecido entre sitios terrestres y planetarios publicados en artículos.
5. Cualquier otro marco que encuentres en fuentes revisadas.

CRITERIOS
1. Qué dimensiones o propiedades evalúa (geología, terreno, clima, química, operaciones).
2. Si da una escala (números, niveles, colores) o solo categorías.
3. Si separa explícitamente "en qué se parece" de "en qué falla".
4. Si liga el análogo a un uso (para qué sirve).
5. Si se ha aplicado a sitios concretos (cuáles).
6. Fuente revisada y año.

ENTREGA
- Tabla comparativa: filas = marcos, columnas = criterios. Cada celda con el dato y, entre paréntesis, la certeza (C = confirmado, P = probable, N = no encontrado).
- Tabla de fuentes: Marco | Criterio | Fuente (enlace o DOI) | Fecha.
- Hasta 5 "hechos que cambiarían la comparación".
- Máximo 300 palabras fuera de las tablas.
- No incluyas recomendación final.

REGLAS
- Primero artículos revisados (Planetary and Space Science, Astrobiology, Acta Astronautica, Space Science Reviews) y páginas oficiales de NASA y ESA.
- Si no encuentras un dato, escribe "No encontrado".
- Si una opción no existe como marco publicado, dilo en una línea.
```

## Resultado

Consulta del 2026-11-08. Los DOI citados existen en Crossref; los artículos no se leyeron completos salvo donde se indica.

**Hallazgos de las fuentes**

- **No existe un índice numérico publicado que califique la fidelidad de un sitio análogo completo.** Los marcos son
  categorías o descripciones en prosa.
- **Análogos funcionales** (Foucher et al. 2021, *Planetary and Space Science*): un análogo lo es para un uso o una
  prueba concreta, no en general.
- **Preston y Dartnell 2014** (*International Journal of Astrobiology*, https://doi.org/10.1017/S1473550413000396): revisan 33 sitios; el valor de un análogo
  depende de su parecido mineralógico, geoquímico o de condiciones ambientales con el objetivo.
- **Catálogo de ESA (CAFE TN2, "The Catalogue of Planetary Analogues"**, Preston, Grady y Barber, 2012-12-05, 171
  páginas; http://esamultimedia.esa.int/docs/gsp/The_Catalogue_of_Planetary_Analogues.pdf): cada sitio con descripción y una sección "Relevance" en prosa. No tiene puntajes, escalas ni matrices.
- **Factores humanos:** escalas de fidelidad para misiones tripuladas simuladas (Schlosser, Cinelli et al. 2025,
  *Frontiers in Space Technology*). Tratan de operaciones y conducta, no de terreno.
- **Único antecedente con puntaje:** Meng et al. (arXiv:2501.08584, https://arxiv.org/abs/2501.08584), aprendizaje profundo para elegir análogos de
  sitios de aterrizaje de Marte en la cuenca de Qaidam. Da un solo puntaje de parecido de imagen, sin desglose. Es un
  preprint sin revisión por pares.
- **Otras fuentes consultadas:** NTRS 20110005522 (informe anual 2010 del Human Research Program) y NTRS 20140003177
  ("Manufacture of Lunar Regolith Simulants", Rickman, Wilson y Stoeser, 2013); ninguna califica sitios.

## Preguntas abiertas

- Número de clases funcionales en Foucher et al. 2021, órdenes en Preston y Dartnell 2014 y los niveles de fidelidad de
  2025 (Low, Mid, High, Peak): no se leyeron los artículos.
- Existencia de la herramienta de NASA de Keeton et al. (TP-2011-216146): no localizada.

## Síntesis

- La literatura revisada muestra que no existe un estándar numérico único para calificar la fidelidad física de un análogo completo; predominan categorías funcionales ("análogo funcional", Foucher 2021) y secciones de "relevancia" en prosa (catálogo CAFE de ESA).

## Fuentes

- <https://doi.org/10.1017/S1473550413000396>
- <http://esamultimedia.esa.int/docs/gsp/The_Catalogue_of_Planetary_Analogues.pdf>
- <https://arxiv.org/abs/2501.08584>
- <https://ntrs.nasa.gov/citations/20110005522>
- <https://ntrs.nasa.gov/citations/20140003177>
- <https://science.nasa.gov/solar-system/planetary-analogs>

## Relaciones

- [[dimensiones-innegociables]] — requisitos de explicación por dimensión
- [[I-03-analogos-terrestres-documentados]] — los análogos documentados
