---
title: "I-09 — Comparación de métodos para buscar zonas análogas en toda la Tierra"
type: investigacion
status: vigente
date: 2026-11-04
updated: 2026-11-04
summary: "Compara cinco formas de buscar en toda la Tierra celdas parecidas a un sitio de la Luna o Marte (niveles con techo, recorrido completo a 1 km, vecino más parecido, agrupamiento no supervisado, idoneidad multicriterio) contra garantía de no perder zonas pequeñas, costo en una PC, explicabilidad, resoluciones mixtas y tiempo de implementación."
autor: fernando
tipo_investigacion: B
riesgo: critico
---

# I-09 — Comparación de métodos para buscar zonas análogas en toda la Tierra

Compara cinco enfoques para buscar en toda la Tierra celdas parecidas a un sitio de la Luna o Marte sin perder zonas pequeñas.

## Prompt

```
I-09 — Métodos para buscar zonas análogas en toda la Tierra

IMPORTANTE: Esta es una comparación de opciones contra criterios definidos. No escribas guías, no repitas el contexto y no elijas una opción: solo compara.

OBJETIVO
Comparar métodos para encontrar, en toda la tierra firme del planeta, las zonas de 1 a 100 km² más parecidas a un sitio de referencia de la Luna o Marte descrito por varias variables.

CONTEXTO (solo lo que cambia la comparación)
- Reto de NASA Space Apps 2026: búsqueda sobre una computadora personal estándar, sin servidor ni GPU dedicada garantizada.
- Varias variables por zona (pendiente, rugosidad, inercia térmica, temperatura, minerales, hielo, viento, aridez) con resoluciones de 30 m a 50 km.
- El resultado debe decir en qué variables coincide cada zona con el sitio de referencia y en cuáles difiere.
- Riesgo principal: perder una zona pequeña muy parecida rodeada de zonas distintas (por ejemplo, una isla).

YA SABEMOS (no investigar ni repetir)
- La tierra firme mide unos 149 millones de km².
- Un promedio o un percentil 95 por celda no detecta zonas que ocupan menos del 5 % de la celda.

OPCIONES A COMPARAR
1. Búsqueda jerárquica de grueso a fino con poda y cota superior por celda (branch and bound; por ejemplo Efficient Subwindow Search, Lampert et al. 2008, o pirámides que guardan máximos e histogramas).
2. Recorrido completo de todas las celdas a una resolución fija (1 km) y afinado posterior solo de los mejores candidatos a 30 m.
3. Búsqueda del vecino más parecido en un espacio de variables con índices de vectores (por ejemplo árboles k-d, HNSW, FAISS).
4. Agrupamiento no supervisado de celdas por similitud (k-means, mapas autoorganizados como en Stepinski y Bue 2006, u otros) y luego elegir el grupo más parecido al sitio.
5. Análisis de idoneidad multicriterio en SIG (combinación lineal ponderada, AHP o lógica difusa) sobre rasters.

CRITERIOS
1. ¿Garantiza no descartar una celda de 1 km² muy parecida rodeada de celdas distintas? Si no, en qué condiciones la pierde.
2. Costo estimado o medido en publicaciones para unas 150 millones de celdas con 10 variables: memoria y tiempo en una PC, con la fuente.
3. ¿Permite explicar por variable en qué coincide y en qué difiere cada resultado?
4. ¿Cómo maneja variables con resoluciones distintas (30 m a 50 km)?
5. ¿Cómo maneja variables de clase (mineral dominante) junto con variables numéricas?
6. Implementaciones abiertas disponibles, (paquete, versión, licencia).
7. Usos publicados en geociencias, búsqueda de análogos planetarios o selección de sitios, con autores y año.

ENTREGA
- Tabla comparativa: filas = opciones, columnas = criterios. Cada celda con el dato y la certeza entre paréntesis (C = confirmado, P = probable, N = no encontrado).
- Tabla de fuentes: Opción | Criterio | Fuente (enlace) | Fecha.
- Hasta 5 "hechos que cambiarían la comparación" (por ejemplo: "si las variables se reducen a 4, la opción 3 deja de necesitar índice").
- Máximo 300 palabras fuera de las tablas. Sin recomendación final.

REGLAS
- Primero artículos revisados y documentación: ADS (ui.adsabs.harvard.edu), CVPR e IEEE, Icarus, JGR Planets, Planetary and Space Science, Computers & Geosciences, International Journal of GIS, docs.rs.
- Blogs y foros solo si no hay otra fuente, con certeza P.
- Si no encuentras un dato, escribe "No encontrado". No lo deduzcas ni lo estimes.
```

## Resultado

Comparación de los cinco enfoques bajo siete criterios técnicos. Ningún estudio publicado reporta mediciones exactas para 150 millones de celdas con 10 variables.

### Hallazgos en la literatura

1. **Costo de recorrido completo en PC (Netzel y Ślopek 2021):** midieron álgebra de mapas sobre 120 millones de celdas de una escena Sentinel-2B (2 a 4 bandas) en una computadora personal: de 7.04 s (plMapcalc) a 21.87 s (GRASS) en cálculo simple, y de 113 s a 356.63 s en flujos multipaso.
2. **Con 10 variables, un árbol k-d no supera al recorrido lineal** (Weber, Schek y Blott 1998). Los índices aproximados (HNSW, FAISS IVFPQ) pueden omitir el vecino exacto; los índices vectoriales exactos pierden ventaja sobre unas ~8 dimensiones.
3. **Sensibilidad a los bordes en grillas fijas:** cuando una zona de ~1 km² queda dividida entre 2 a 4 celdas contiguas de una grilla fija, su firma se diluye en los métodos basados en grilla fija (opciones 2 a 5). Las ventanas deslizantes o subventanas con imágenes integrales (Lampert et al. 2008) evitan la dilución por borde.
4. **Compensación en sumas ponderadas:** en distancias euclidianas o sumas ponderadas, valores extremos favorables en múltiples variables pueden compensar una restricción crítica incumplida; en la literatura multicriterio, los umbrales físicos excluyentes suelen modelarse como filtros duros independientes del puntaje compuesto.
5. **Variables categóricas:** dos enfoques publicados: distancia de Gower (1971), que combina diferencias numéricas normalizadas por rango con coincidencia categórica, y composición de clases por celda comparada con divergencia de Jensen-Shannon (GeoPAT; Jasiewicz, Netzel y Stepinski 2015).
6. **Precedente metodológico:** Netzel y Stepinski (*Climate Similarity Search*, BAMS 2018, `doi:10.1175/bams-d-16-0334.1`) realizan búsqueda de similitud contra un sitio de referencia sobre una grilla global utilizando variables climáticas.
7. **Limitación del agrupamiento no supervisado:** métodos como k-means tienden a formar grupos de tamaño balanceado y emplean muestreo, lo que diluye celdas raras o minoritarias; resultan más adecuados para regionalización que para recuperar extremos locales.

### Verificado en la fuente

| # | Dato verificado | Fuente `[O]` | Fecha |
| :-- | :-- | :-- | :-- |
| 1 | Netzel y Ślopek (2021): 120 millones de celdas, 7.04 s a 21.87 s (simple) y 113 s frente a 356.63 s (multipaso) en 2–4 bandas de Sentinel-2B. | https://pawel.netzel.pl/pdf/cageo_2021_preprint.pdf | 2026-11-04 |
| 2 | Netzel y Stepinski, *Climate Similarity Search*, BAMS 2018 (`doi:10.1175/bams-d-16-0334.1`). | https://api.crossref.org/works?query.bibliographic=Climate+similarity+search+Netzel+Stepinski | 2026-11-04 |
| 3 | El DOI `10.2514/1.42002` corresponde a Cohanim y Collins (2009), *Landing Point Designation Algorithm for Lunar Landing*; el trabajo citado de Marcus, Zanetti y Setterfield (2024, JGCD) figura en la Universidad de Texas sin DOI verificado en Crossref. | https://api.crossref.org/works/10.2514/1.42002 | 2026-11-04 |
| 4 | Crates verificados en crates.io: `rstar` 0.14.0, `kiddo` 6.3.0, `hnsw_rs` 0.3.5, `usearch` 2.26.6. | https://crates.io/api/v1/crates/ | 2026-11-04 |
| 5 | `linfa-clustering` 0.8.1 publicado el 2025-12-23. | https://crates.io/api/v1/crates/linfa-clustering | 2026-11-04 |
| 6 | `kategorize` 0.3.0 publicado el 2025-09-16. | https://crates.io/api/v1/crates/kategorize | 2026-11-04 |
| 7 | `kmeans` 2.0.2 publicado el 2026-03-03. | https://crates.io/api/v1/crates/kmeans | 2026-11-04 |

Lampert et al. (2008) y Weber, Schek y Blott (1998) son referencias primarias clásicas citadas por la literatura técnica. La estimación de memoria y tiempo para HNSW sobre 100 millones de vectores (512 GB de RAM, 42 h) proviene de una fuente técnica no arbitrada.

## Relaciones

- [[I-02-indice-de-similitud-analoga]] — la fórmula del puntaje
- [[I-08-cuadriculas-de-area-igual]] — cuadrículas de área igual (HEALPix, S2, H3)
