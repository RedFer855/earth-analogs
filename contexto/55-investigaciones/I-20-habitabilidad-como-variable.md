---
title: "I-20 — Habitabilidad como variable comparable entre la Tierra, la Luna y Marte"
type: investigacion
status: vigente
date: 2026-11-05
updated: 2026-11-05
summary: "Qué magnitudes medibles por celda representan la habitabilidad (o la esterilidad) en la Tierra, la Luna y Marte, con qué productos globales y cómo se han comparado entre cuerpos."
autor: fernando
tipo_investigacion: A
riesgo: critico
---

# I-20 — Habitabilidad como variable

La dimensión 6 del reto abarca biología y habitabilidad
([[dimensiones-innegociables]]). En la Luna y Marte no hay vida conocida, así que no se compara vida: se compara qué
tan habitable o qué tan estéril es un lugar.

## Prompt

```
I-20 — Habitabilidad como variable comparable

IMPORTANTE: Esta es una consulta de datos puntuales. No escribas una guía general, no repitas información de contexto y no hagas recomendaciones.

OBJETIVO
¿Qué magnitudes medibles por celda representan la habitabilidad o la esterilidad de un lugar, con qué productos globales de la Tierra, la Luna y Marte, y qué trabajos ya las compararon entre cuerpos?

CONTEXTO (solo lo que cambia la respuesta)
- Comparación por variable de condiciones superficiales de habitabilidad o esterilidad (agua disponible, radiación, temperatura, química) a escala compatible con cuadrículas globales de área igual.
- En la Luna y Marte no existe vida conocida, por lo que la comparación se centra en los parámetros físicos y químicos que condicionan la supervivencia microbiana o la esterilidad.

YA SABEMOS (no investigar ni repetir)
- Tierra: índice de aridez Global-AI_PET v3.1 (1 km, CC BY 4.0) y NDVI de MODIS MOD13Q1 V061 (250 m).
- Phoenix midió percloratos en el suelo de Marte; Atacama (Yungay) y los Valles Secos de la Antártida se usan como análogos de esterilidad.
- Méndez et al. 2021 (NASA NTRS 20210020800) proponen modelos de habitabilidad y el Earth Similarity Index.

PUNTOS A RESPONDER
1. Magnitudes que se usan para cuantificar la habitabilidad en superficie (por ejemplo, actividad del agua, humedad del suelo, dosis de radiación UV o ionizante, rango de temperatura, oxidantes como percloratos, biomasa microbiana) y su unidad.
2. Para cada magnitud: producto global de la Tierra (nombre corto, versión, resolución, cobertura, licencia, cuenta necesaria).
3. Para cada magnitud: producto o modelo equivalente en Marte y en la Luna (por ejemplo, dosis de radiación en superficie de MSL RAD o de modelos, humedad relativa de la Mars Climate Database, mapas de percloratos).
4. Índices compuestos de habitabilidad publicados que se hayan calculado para la Tierra y para Marte con la misma fórmula: nombre, variables, fórmula y datos.
5. Medidas de biomasa o de actividad microbiana en análogos terrestres de esterilidad (Atacama, Valles Secos, Dallol), con valores numéricos y fuente.
6. Si existe un mapa global de la Tierra del "límite seco de la vida" o de esterilidad microbiana.

ENTREGA
- Tabla: # | Punto | Magnitud | Unidad | Producto Tierra | Producto Marte | Producto Luna | Resolución | Licencia | Tipo de valor (medición / modelo / criterio) | Fuente (enlace) | Fecha | Certeza
- Certeza: Confirmado / Probable / No encontrado.
- Máximo 200 palabras fuera de la tabla. Sin recomendaciones.

REGLAS
- Primero documentación oficial y artículos revisados: earthdata.nasa.gov, lpdaac.usgs.gov, pds.nasa.gov, ADS (ui.adsabs.harvard.edu), Astrobiology, Icarus, JGR Planets, Nature Communications.
- Un umbral o criterio, o el rango de operación de un instrumento, NO es un valor medido: decláralo en la columna "Tipo de valor".
- Si un recurso "no está disponible", escribe la URL exacta que probaste y el error.
- Si no encuentras un dato, escribe "No encontrado". No lo deduzcas.
```

## Resultado

Evaluación de magnitudes medibles por celda, índices compuestos publicados y análogos terrestres de esterilidad.

### Magnitudes por celda (Tierra, Marte y Luna)

| Magnitud | Tierra | Marte | Luna | Comentario |
| :-- | :-- | :-- | :-- | :-- |
| Agua disponible | Índice de aridez Global-AI_PET (1 km; hiperárido si AI < 0.05); humedad del suelo SMAP `SPL4SMGP` V008 (NSIDC, cada 3 h a 9 km desde 2015-03-31) | Humedad relativa y vapor de la Mars Climate Database (modelo); REMS (in situ, punto) | Estabilidad del hielo de Diviner; OH/H₂O de M3 | El límite de vida por actividad del agua citado es $a_w \le 0.605$ |
| Radiación UV en superficie | OMI `OMUVBd` V3 (1° × 1°, diario desde 2004-10-01, GES DISC) | REMS UV (in situ, punto) y flujo UV de la MCD (modelo) | Sin atmósfera: flujo solar directo con el relieve de LOLA (modelo geométrico) | La resolución de 1° en la Tierra aporta contexto grueso ([[I-11-sesgo-por-escala-de-cada-variable]]) |
| Radiación ionizante | Modelos CARI-7 / EURADOS (sin producto global descargable verificado) | MSL RAD (in situ, ~210 µGy/día en Gale citados en literatura) y modelo HZETRN | CRaTER y Chang'e-4 LND (in situ, ~1369 µGy/día citados en literatura) | Dosis exactas pendientes de lectura directa en Hassler et al. (2014) y Zhang et al. (2020) |
| Rango térmico ($\Delta T = T_{\max} - T_{\min}$) | MODIS `MOD11A1` V061 (1 km, diario desde 2000-02-24, LP DAAC) | THEMIS día y noche, TES | Diviner | Se solapa con temperatura superficial de la dimensión 3 |
| Oxidantes (percloratos) | Sin producto orbital: datos puntuales del USGS | Phoenix (0.4-0.6 % en peso) y Curiosity SAM (0.05-1.05 %) | No detectable | Sin cobertura continua por celda en ningún cuerpo |

**Índices compuestos:** ESI, PHI, CDHS y BCI se calculan con propiedades de planeta entero (radio, densidad, velocidad de escape, temperatura media) y entregan un valor por cuerpo, no por celda local (valores numéricos pendientes de consulta directa en sus artículos originales):

| Índice | Tierra | Marte | Luna |
| :-- | :-- | :-- | :-- |
| ESI | 1.00 | 0.70 (Schulze-Makuch et al. 2011); 0.64 (Agrawal et al. 2018) | 0.56 |
| PHI | 0.96 | 0.59 | ≈ 0.00 |
| CDHS | 1.00 | 0.583 | 0.336 |
| SPH | 0.72-0.78 de media global | 0.00 | 0.00 |

El único índice definido por celda es el **SPH** (Méndez), que depende de la temperatura y la humedad relativa y resulta en 0.00 en toda la superficie marciana y lunar.

**Análogos de esterilidad con valores publicados**

- **Atacama** (Yungay, 24.1°S, 69.9°W): de 0 a 10 UFC/g; menos de 1.2 µg de ADN por gramo (Navarro-González et al. 2003, *Science*; Azua-Bustos et al. 2015).
- **University Valley**, Antártida (77.8°S, 160.7°E): ~10³ células/g, de 0 a 10 UFC/g y metabolismo nulo después de 550 días de incubación (Goordial et al. 2016, *ISME Journal*).
- **Dallol**, Etiopía (14.24°N, 40.30°E): 0 células/mL en salmueras hiperácidas con pH < 0 y alta concentración de Mg²⁺ (Belilla et al. 2019, *Nature Ecology & Evolution*).

**Límite seco y biomasa microbiana global:** no existe un mapa global continuo del límite seco de la vida ni de biomasa microbiana en malla; la compilación de ORNL (`Global_Microbial_Biomass_C_N_P_1264`, 1977–2012, ORNL DAAC 1264, verificada en CMR `collections.json`) es una recopilación de mediciones puntuales, no un mapa interpolado continuo. Como aproximaciones espaciales continuas se emplean el índice de aridez y el NDVI.

### Fuentes verificadas en CMR (`collections.json`)

- SMAP `SPL4SMGP` V008 (NSIDC), OMI `OMUVBd` V3 (GES DISC), MODIS `MOD11A1` V061 (LP DAAC) y ORNL DAAC `1264` (`https://cmr.earthdata.nasa.gov/search/collections.json`, consultado el 2026-11-05).

## Relaciones

- [[dimensiones-innegociables]] — la dimensión 6
- [[sensores-tierra]] — aridez y NDVI, según la fuente
