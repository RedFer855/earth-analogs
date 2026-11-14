---
title: "I-11 — Qué variables se sesgan al cambiar de escala y cómo agregarlas sin perder información"
type: investigacion
status: vigente
date: 2026-11-04
updated: 2026-11-05
summary: "Para cada variable física (pendiente, rugosidad, inercia térmica, temperatura, minerales, hielo, clima), cuánto cambia su valor y su ranking al agregarla de resolución fina a gruesa, qué estadística de agregación la conserva y cómo se mide ese sesgo (problema de la unidad de área modificable)."
autor: fernando
tipo_investigacion: A
riesgo: critico
---

# I-11 — Qué variables se sesgan al cambiar de escala y cómo agregarlas sin perder información

Define, variable por variable, qué sesgos introduce la agregación de celdas finas a gruesas según la literatura y qué estadística de agregación conserva mejor la señal.

## Prompt

```
I-11 — Sesgo por escala de cada variable

IMPORTANTE: Esta es una consulta de datos puntuales. No escribas una guía general, no repitas información de contexto y no hagas recomendaciones.

OBJETIVO
Para cada variable de la lista, ¿cómo cambia su valor y su orden entre zonas cuando se agrega de una resolución fina a una gruesa, qué estadística de agregación la conserva mejor y qué métodos publicados miden ese sesgo?

CONTEXTO (solo lo que cambia la respuesta)
- Análisis de variables ambientales y geomorfológicas cuyas resoluciones de origen van de 1 m a 50 km.
- Evaluación del efecto de agregar celdas finas en unidades gruesas y de asignar promedios de área gruesa sobre resoluciones finas.

YA SABEMOS (no investigar ni repetir)
- La pendiente baja al engrosar la resolución del modelo de elevación (efecto de escala; Shepard et al. 2001, Kreslavsky y Head 2000).
- La inercia térmica se compara en lugar de la temperatura en kelvin.

VARIABLES
Pendiente, rugosidad, inercia térmica, temperatura superficial, abundancia o clase de mineral, hielo subterráneo o permafrost, viento y polvo, aridez.

PUNTOS A RESPONDER
1. Qué es el problema de la unidad de área modificable (MAUP) y sus dos efectos (escala y zonificación), con la referencia original (Openshaw 1984 u otra).
2. Por variable: ¿su valor agregado depende de la escala? Dirección del cambio (sube, baja, se suaviza) y la fuente que lo documenta.
3. Por variable: estadística de agregación que la literatura usa o recomienda (media, mediana, máximo, percentiles, fracción de área que cumple un umbral, moda para clases).
4. Por variable: si hay una escala característica por debajo o por encima de la cual deja de tener sentido físico (por ejemplo, la inercia térmica a más de 3 km de píxel).
5. Para variables de clase (mineral dominante, tipo de permafrost): cómo se agregan sin perder clases minoritarias.
6. Métodos para medir el sesgo por escala de una variable: correlación de rangos (Spearman) entre escalas, semivariograma, varianza local en función del tamaño de ventana, u otros.
7. Cómo se combinan en un mismo puntaje variables de resoluciones distintas (ponderar por resolución o por incertidumbre), con fuente.

ENTREGA
- Tabla: # | Punto | Variable (si aplica) | Respuesta | Fuente (artículo o documentación, con enlace) | Fecha de la fuente | Certeza
- Certeza: Confirmado (la fuente lo dice textualmente) / Probable / No encontrado.
- Máximo 200 palabras fuera de la tabla con contradicciones o advertencias. Sin introducción ni conclusiones.

REGLAS
- Primero artículos revisados: ADS (ui.adsabs.harvard.edu), JGR Planets, Icarus, Remote Sensing of Environment, International Journal of GIS, Geomorphology.
- Blogs y foros solo si no hay otra fuente, con certeza Probable.
- Si no encuentras un dato, escribe "No encontrado". No lo deduzcas.
```

## Resultado

Revisión de la literatura sobre los siete puntos para las ocho variables. Según Gotway y Young (2002), asignar un promedio de área gruesa como valor puntual en celdas finas constituye un problema de cambio de soporte que oculta la variabilidad interna.

### Lo que dice la literatura, por variable

| Variable | Al engrosar | Agregación que usa la literatura | Escala con sentido físico |
| :-- | :-- | :-- | :-- |
| Pendiente | Baja y pierde los extremos; el orden entre zonas cambia | Calcular en el DEM fino y después agregar; fracción de área sobre un umbral y percentil 99 (sitios de aterrizaje en Marte) | Ligada al instrumento: 3-5 m, 100 m, 1 km |
| Rugosidad | No monótona: sube hasta el tamaño de la geoforma dominante y luego baja; el orden se invierte entre escalas | Mediana de la desviación RMS; fracción de área sobre un umbral | Hasta el tamaño de la geoforma |
| Inercia térmica | Se suaviza hacia una mezcla no lineal: roca más polvo da un valor aparente bajo | Mediana y desviación por unidad; no promediar linealmente mezclas | Sobre pocos metros es "inercia aparente" |
| Temperatura | Pierde extremos; sesgo no lineal (la radiancia va con T⁴) | Agregar radiancia y después convertir a temperatura | Sobre la faceta homogénea es temperatura aparente |
| Minerales | La abundancia aparente baja; con moda, las clases raras desaparecen | Fracción de área por clase, no la moda | Lo que resuelve cada sensor |
| Hielo y permafrost | Se diluye con el terreno seco de alrededor | Fracción de área (PZI de Gruber 2012) | Huella del sensor: ~10 km (LEND), ~550 km (MONS) |
| Viento y polvo | El promedio borra las ráfagas; la emisión de polvo cae a cero | Fracción de tiempo o área sobre el umbral, no la media | Mesoescala (1-10 km) |
| Aridez | Se suaviza la textura; dirección neta no encontrada | Media; fracción por clase de UNEP | Promedio de 30 años |

**Para medir el sesgo entre escalas:** correlación de rangos de Spearman de la misma variable entre escalas; semivariograma (al engrosar baja la meseta y sube el rango, Woodcock, Strahler y Jupp 1988); varianza local en función del tamaño de ventana.

**Para combinar resoluciones distintas:** ponderar cada capa por la inversa de su varianza de error (Heuvelink 1998), o normalizar a 0-1 y combinar con pesos (Malczewski 2006). SWIM (Morgan et al. 2021) lleva todo a una grilla común de ~3 km.

### Verificado en la fuente

| # | Dato verificado | Fuente `[O]` | Fecha |
| :-- | :-- | :-- | :-- |
| 1 | Gotway y Young (2002), cambio de soporte, JASA 97, 632-648 (`doi:10.1198/016214502760047140`). | https://api.crossref.org/works?query.bibliographic=Gotway+Young+Combining+incompatible+spatial+data | 2026-11-04 |
| 2 | Gruber (2012), índice de zonificación de permafrost, *The Cryosphere* 6, 221-233 (`doi:10.5194/tc-6-221-2012`). | https://api.crossref.org/works?query.bibliographic=Gruber+global+permafrost+zonation+Cryosphere | 2026-11-04 |
| 3 | Grohmann (2015), pendiente calculada en fino y luego agregada (preprint `doi:10.31223/osf.io/6xc29` en Crossref). | Crossref | 2026-11-04 |

Openshaw (1984), Woodcock y Strahler (1987, 1988), Kirk et al. (2003), Golombek et al. (2003) y Fergason et al. (2006) corresponden a referencias clásicas citadas por artículos revisados. Quedan sin verificación directa en fuente primaria el ejemplo de mezcla 75 % polvo y 25 % costra (187 TIU) y el umbral de 111 km para viento.

## Relaciones

- [[I-07-armonizar-tierra-luna-marte]] — el efecto de escala ya verificado en pendiente y rugosidad
- [[I-02-indice-de-similitud-analoga]] — formulación de puntaje y agregación
- [[I-09-metodos-de-busqueda-de-analogos]] — métodos de comparación de clases y búsqueda global
