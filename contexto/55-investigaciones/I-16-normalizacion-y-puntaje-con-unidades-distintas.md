---
title: "I-16 — Precedentes de normalización y puntaje con variables de unidades distintas y datos faltantes"
type: investigacion
status: vigente
date: 2026-11-04
updated: 2026-11-05
summary: "Quién ya comparó lugares con varias variables de unidades distintas, entre cuerpos o regiones con rangos muy diferentes y con celdas sin dato: qué normalización, qué métrica y qué regla de faltantes usaron y cómo la validaron."
autor: fernando
tipo_investigacion: B
riesgo: critico
---

# I-16 — Normalización y puntaje con unidades distintas y faltantes

Busca precedentes publicados sobre cómo normalizar, combinar variables de unidades distintas y tratar datos faltantes. Complementa a [[I-02-indice-de-similitud-analoga]].

## Prompt

```
I-16 — Precedentes de normalización y puntaje multivariable

IMPORTANTE: Busco trabajos publicados que ya hayan resuelto esto. No diseñes una fórmula nueva, no escribas una guía general y no recomiendes una opción.

OBJETIVO
¿Qué normalización, qué métrica de parecido y qué regla para datos faltantes usaron los trabajos publicados que comparan lugares con varias variables físicas de unidades distintas, y cómo comprobaron que el resultado era correcto?

CONTEXTO (solo lo que cambia la respuesta)
- Comparación de lugares descritos por variables físicas de unidades distintas: pendiente (grados), rugosidad (m), inercia térmica (J m⁻² K⁻¹ s⁻½), albedo (0-1), temperatura de superficie (K), viento (m/s), probabilidad de permafrost o hielo (0-1), mineralogía (clases o proporciones).
- Los rangos cambian mucho entre cuerpos: la temperatura lunar va de ~40 K a ~390 K; la terrestre de ~200 K a ~340 K.
- Algunas celdas carecen de una variable (nubes, sin cobertura del sensor).

YA SABEMOS (no investigar ni repetir)
- La suma ponderada compensa entre variables: los límites físicos van como filtros aparte ([[I-09-metodos-de-busqueda-de-analogos]]).
- Netzel y Stepinski, Climate Similarity Search, BAMS 2018 (doi:10.1175/bams-d-16-0334.1), busca similitud climática contra un sitio de referencia en una grilla global ([[I-09-metodos-de-busqueda-de-analogos]]).
- La distancia de Gower (1971) y la divergencia de Jensen-Shannon sobre proporciones de clase (GeoPAT) son opciones publicadas para variables de clase ([[I-09-metodos-de-busqueda-de-analogos]]).
- La normalización 0-1 con pesos es habitual en análisis multicriterio con SIG (Malczewski 2006) ([[I-11-sesgo-por-escala-de-cada-variable]]).

PUNTOS A RESPONDER
1. El mismo problema en cualquier campo, no solo análogos planetarios: comparar elementos descritos por varias variables de unidades distintas contra uno de referencia, cuando hay faltantes y los rangos cambian entre grupos. Campos donde buscar: ecología (MESS de Elith et al. 2010, Mahalanobis en modelos de nicho, ecorregiones), clima análogo, prospección minera y geoquímica, selección de sitios con SIG, fusión de datos de sensores, búsqueda de vecinos en datos mixtos (minería de datos), registros clínicos con faltantes, ciencia de materiales. Para cada trabajo: qué variables, qué normalización y qué métrica.
2. Trabajos que comparan sitios de la Tierra con la Luna o Marte con dos o más variables físicas a la vez (no por imagen), si existen: qué normalización y qué métrica.
3. Cuando los datos vienen de dominios con rangos muy distintos (dos cuerpos, dos climas): ¿normalizan cada dominio por separado o todo junto? Casos publicados de cada uno y qué problema reportan.
4. Normalizaciones resistentes a valores extremos usadas en estos trabajos (por rango con percentiles, z-score con mediana y MAD, por rangos o cuantiles): cuál, con qué percentiles de corte.
5. Qué hacen con una celda a la que le falta una variable: la descartan, reparten el peso entre las variables que sí tiene (como Gower), imputan, o penalizan. Cita del trabajo que lo hace.
6. Cómo comprobaron que el puntaje encuentra lo correcto: análogos conocidos, sitios sembrados, comparación con expertos, sensibilidad a los pesos.
7. Implementaciones abiertas de estos métodos (repositorio, paquete de R o Python u otro lenguaje) con su licencia.

ENTREGA
- Tabla 1 (puntos 1-2): # | Campo | Trabajo (autor, año, revista) | Variables | Normalización | Métrica | Regla de faltantes | Validación | DOI o enlace | Certeza
- Tabla 2 (puntos 3-7): # | Punto | Respuesta | Fuente (enlace) | Fecha de la fuente | Certeza
- Certeza: Confirmado (leído en el artículo) / Probable (citado por otro) / No encontrado.
- Máximo 250 palabras fuera de las tablas. Sin introducción ni recomendación.

REGLAS
- No hace falta que el trabajo sea del mismo reto ni de la misma aplicación: basta con que resuelva el mismo problema (unidades distintas, rangos distintos entre grupos, faltantes, parecido contra una referencia). Priorizar los campos donde el método está más probado.
- Primero artículos revisados y revisiones sistemáticas: ADS (ui.adsabs.harvard.edu), Icarus, JGR Planets, Ecography, Global Ecology and Biogeography, Methods in Ecology and Evolution, Computers & Geosciences, International Journal of GIS, Pattern Recognition, Data Mining and Knowledge Discovery, Journal of Statistical Software.
- Cada fila con DOI o enlace al artículo. Nada de Scribd, slideserve ni blogs salvo que no haya otra fuente, marcado Probable.
- Si un trabajo no dice cómo trató los faltantes, escribe "No lo dice". No lo deduzcas.
- Si no encuentras un dato, escribe "No encontrado".
```

## Resultado

### Hallazgos

1. **Datos faltantes: cuatro tratamientos documentados en la literatura.**
   - **Gower (1971):** la variable faltante se excluye de la comparación de ese par y el peso se redistribuye entre las variables presentes, manteniendo la métrica en `[0, 1]` sin imputar ceros y permitiendo registrar cuántas variables intervienen.
   - **HEOM (Wilson y Martinez 1997):** la variable faltante asigna diferencia máxima (1), penalizando los registros incompletos.
   - **Descarte de la celda incompleta:** empleado en estudios de clima análogo (Williams et al. 2007; Netzel y Stepinski 2018).
   - **Imputación previa:** empleada en geoquímica multivariante (Filzmoser et al. 2005; Templ et al. 2011).
2. **Normalizar con la escala del dominio de referencia.**
   - Williams et al. (2007) dividen por la desviación del clima de referencia; Mesgaran et al. (2014) utilizan el rango y la matriz de covarianza de la población de referencia. (El análisis de Mesgaran et al. se circunscribe a nichos ecológicos de un mismo planeta y no evalúa comparaciones entre cuerpos planetarios.)
   - Normalizar cada cuerpo a `[0, 1]` por separado y comparar esos valores directamente corresponde a medir "qué tan inusual es un sitio en su propio cuerpo" más que igualdad en magnitud física, criterio distinto al descrito en [[I-02-indice-de-similitud-analoga]].
3. **Normalización resistente a extremos en geoquímica:** mediana y MAD con acotamiento en ±2 MAD, y distancia de Mahalanobis robusta mediante MCD (Filzmoser et al. 2005).
4. **Detección de extrapolación:** MESS (Elith et al. 2010) y ExDet (Mesgaran et al. 2014) miden cuánto se aleja un sitio fuera del rango de las condiciones de referencia.
5. **Índices y precedentes planetarios publicados:** el Earth Similarity Index (ESI, Schulze-Makuch et al. 2011) compara cuerpos planetarios completos (radio, densidad, velocidad de escape, temperatura) mediante una media geométrica ponderada. En comparación de terrenos Tierra-Luna-Marte, Sanganeria (2026) compara brillo de imágenes normalizado por min-max, no múltiples variables geofísicas ([[I-07-armonizar-tierra-luna-marte]]); no se identificaron trabajos publicados que comparen terreno terrestre con la Luna o Marte combinando varias variables físicas simultáneas.
6. **Validación en la literatura:** sitios conocidos, anomalías sintéticas sembradas, comparación con esquemas expertos y análisis de sensibilidad a los pesos (p. ej., índices de Sobol' en Ligmann-Zielinska y Jankowski 2012).

### Fuentes verificadas y bibliografía

- Netzel y Stepinski (2018), *Climate Similarity Search*, *BAMS* — https://doi.org/10.1175/BAMS-D-16-0334.1 (consultado 2026-11-04; [[I-09-metodos-de-busqueda-de-analogos]])
- Gower (1971), *Biometrics* — https://doi.org/10.2307/2528823
- Wilson y Martinez (1997), *JAIR* — https://doi.org/10.1613/jair.373
- Williams, Jackson y Kutzbach (2007), *PNAS* — https://doi.org/10.1073/pnas.0606292104
- Elith, Kearney y Phillips (2010), *Methods Ecol. Evol.* — https://doi.org/10.1111/j.2041-210X.2010.00036.x
- Mesgaran, Cousens y Webber (2014), *Divers. Distrib.* — https://doi.org/10.1111/ddi.12209
- Filzmoser, Garrett y Reimann (2005), *Comput. Geosci.* — https://doi.org/10.1016/j.cageo.2004.11.013
- Schulze-Makuch et al. (2011), *Astrobiology* — https://doi.org/10.1089/ast.2011.0736
- Ligmann-Zielinska y Jankowski (2012), *IJGIS* — https://doi.org/10.1080/13658816.2011.556118

## Relaciones

- [[I-02-indice-de-similitud-analoga]] — formulación de similitud y normalización
- [[I-09-metodos-de-busqueda-de-analogos]] — métricas y variables de clase según la fuente
- [[I-11-sesgo-por-escala-de-cada-variable]] — la estadística de cada variable antes de normalizar
