---
title: "I-25 — Aprender pesos y tolerancias con pocos análogos conocidos y sesgados"
type: investigacion
status: vigente
date: 2026-11-08
updated: 2026-11-08
summary: "Compara métodos publicados para aprender pesos y tolerancias por variable a partir de pocos análogos terrestres documentados en la literatura, sin ausencias confirmadas y sesgados por accesibilidad, con validación espacial y control de la deriva al reentrenar con predicciones propias."
autor: fernando
tipo_investigacion: B
riesgo: bajo
---

# I-25 — Aprender pesos y tolerancias con pocos análogos conocidos y sesgados

**Pregunta.** ¿Qué métodos publicados permiten estimar pesos y tolerancias por variable a partir de pocos análogos terrestres documentados en la literatura, con su objetivo planetario, sin ausencias confirmadas y sesgados por accesibilidad? ¿Cómo se evitan el sobreajuste y la deriva al reentrenar con predicciones propias? Combinar variables de resoluciones distintas **no** entra aquí: lo responde [[I-11-sesgo-por-escala-de-cada-variable]] (ponderar por la inversa de la varianza de error, Heuvelink 1998).

## Prompt

```
I-25 — Aprender pesos y tolerancias con pocos sitios conocidos

IMPORTANTE: Esta es una comparación de métodos contra criterios definidos. No escribas un tutorial de aprendizaje automático, no repitas el contexto y no elijas un método: solo compara.

OBJETIVO
Comparar métodos publicados para aprender, a partir de pocos sitios positivos conocidos y sin ausencias, cuánto pesa cada variable y qué margen de tolerancia tiene, en una búsqueda de lugares parecidos sobre toda la superficie terrestre.

CONTEXTO (solo lo que cambia la comparación)
- Búsqueda de lugares parecidos sobre toda la superficie terrestre con variables físicas continuas en unidades distintas.
- Los positivos son análogos terrestres documentados en la literatura, con su objetivo planetario (Luna o Marte). No hay ausencias confirmadas. Están sesgados: se eligieron por acceso y logística (Atacama, Islandia, Hawái), no por ser los más parecidos.
- Interesa una métrica interpretable con pesos por variable y una zona de tolerancia por variable.
- Interesa además cómo se controla la deriva al reutilizar predicciones para buscar sitios nuevos.

OPCIONES A COMPARAR
1. Aprendizaje de métrica con restricciones (aprender los pesos de una distancia de Mahalanobis por ranking: NCA, ITML, LMNN o aprendizaje de ranking con pocos positivos).
2. Modelos de distribución de especies con solo presencias (MaxEnt o maxnet) con fondo de grupo objetivo para corregir el sesgo de muestreo.
3. Aprendizaje positivo-no etiquetado (PU learning, Elkan y Noto 2008, y sucesores).
4. Envoltura ambiental o tipicidad de Mahalanobis respecto de la nube de positivos (BIOCLIM, distancia de Mahalanobis a las presencias), usando su dispersión como tolerancia.
5. Selección de variables por validación (búsqueda de subconjuntos con penalización).
6. Autoentrenamiento o aprendizaje activo con confirmación humana.

CRITERIOS
1. Número mínimo de positivos con el que el método está documentado funcionando (cifra y fuente).
2. Cómo trata el sesgo de muestreo de los positivos (por acceso o por esfuerzo de estudio).
3. Validación espacial que se usa con el método: bloques espaciales, exclusión por distancia, y cómo se elige el tamaño del bloque o el radio (por ejemplo, con el rango del semivariograma).
4. Si la salida se puede expresar como pesos por variable o como tolerancias por variable.
5. Riesgos documentados de sobreajuste con pocos positivos y de deriva al reentrenar con sus propias predicciones, y qué controles proponen los autores.
6. Costo de cómputo en una PC para un conjunto global de millones de celdas y varias variables, y librería libre en Python (nombre, licencia, última versión).
7. Ejemplo publicado fuera de la ecología: clima análogo, análogos planetarios o búsqueda de sitios parecidos.

ENTREGA
- Tabla comparativa: filas = opciones, columnas = criterios. Cada celda con el dato y, entre paréntesis, la certeza (C = confirmado, P = probable, N = no encontrado).
- Tabla de fuentes: Opción | Criterio | Fuente (enlace o DOI) | Fecha.
- Hasta 5 "hechos que cambiarían la comparación".
- Máximo 300 palabras fuera de las tablas.
- No incluyas recomendación final.

REGLAS
- Primero artículos revisados por pares (Ecography, Methods in Ecology and Evolution, Ecological Modelling, Global Change Biology, JMLR, NeurIPS, ICML) y la documentación oficial de las librerías (scikit-learn, metric-learn, elapid, maxnet, blockCV).
- Cita con DOI cuando exista. Blogs y foros solo si no hay fuente revisada, con certeza P.
- Si no encuentras un dato, escribe "No encontrado". No lo deduzcas ni lo estimes.
- Español claro.
```

## Resultado

Consulta del 2026-11-08. Los DOI citados existen en Crossref; los artículos no se leyeron completos.

**Hallazgos de las fuentes**

- **Ninguno de los seis métodos tiene un mínimo de positivos formal**, salvo la envoltura de Mahalanobis, por álgebra:
  N ≥ p + 1 (p + 1 positivos con p variables) para que la covarianza no sea singular; estable con 15 a 25 presencias según
  Farber y Kadmon 2003 y Hernandez et al. 2008.
- **Modelos de presencias (MaxEnt):** de 5 a 10 presencias en especies especialistas (Hernandez et al. 2006), de 13 a
  25 en generalistas (van Proosdij et al. 2016), y con menos de 30 el rendimiento cae (Wisz et al. 2008).
- **Solo la tipicidad de Mahalanobis (opción 4) da pesos y tolerancias por variable de forma directa.** Las demás dan
  coeficientes que no son pesos normalizados (MaxEnt), requieren pares disímiles (aprendizaje de métrica) o dependen de
  otro modelo (aprendizaje activo).
- **El sesgo por acceso no lo corrige ningún método por sí solo.** MaxEnt y PU lo corrigen solo con una capa de
  esfuerzo de muestreo o un fondo de grupo objetivo (Phillips et al. 2009).
- **Validación espacial:** bloques con franja de exclusión y tamaño del bloque según el alcance del semivariograma
  (Roberts et al. 2017; blockCV, Valavi et al. 2019). Vale para todos los métodos.
- **Contra la deriva al reentrenar con predicciones propias:** confirmación humana en cada ciclo (Settles 2009).
- **Librerías libres:** metric-learn 0.7.0 (MIT), elapid 1.0.3 (MIT), pulearn 0.2.0 (BSD-3), modAL-python 0.4.2.1
  (MIT), scipy y scikit-learn (BSD-3). Versiones según la documentación consultada.
- **Ejemplos fuera de la ecología:** análogos climáticos (Williams et al. 2007; Mahony et al. 2017), prospección
  mineral con MaxEnt (Liu et al. 2017; Zhu et al. 2026), FRB con PU (Sharma et al. 2024) y AEGIS en Opportunity y
  Curiosity (Estlin et al. 2012; Francis et al. 2017).

**Fuentes con URL (consultadas el 2026-11-08)**

| Dato | Fuente |
| :-- | :-- |
| Estimador de covarianza de Ledoit y Wolf (2004) | https://doi.org/10.1016/S0047-259X(03)00096-4 |
| Farber y Kadmon (2003), mínimo de presencias | https://doi.org/10.1016/S0304-3800(02)00327-7 |
| FRB con aprendizaje positivo-no etiquetado (Sharma, Rajpaul et al. 2024) | https://doi.org/10.1093/mnras/stae1972 |
| Wisz et al. (2008), tamaño de muestra y rendimiento | https://doi.org/10.1111/j.1472-4642.2008.00482.x |
| PU en química (fenoles), 30 a 43 positivos; no es un caso espacial | https://doi.org/10.1021/acsomega.5c05523 |

## Relaciones

- [[I-11-sesgo-por-escala-de-cada-variable]] — cómo combinar resoluciones distintas
- [[I-16-normalizacion-y-puntaje-con-unidades-distintas]] — normalización y valores faltantes
- [[I-09-metodos-de-busqueda-de-analogos]] — por qué el agrupamiento no sirve para buscar
