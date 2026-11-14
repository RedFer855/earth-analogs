---
title: "I-31 — Cifras de referencia de la Luna, Marte y la Tierra"
type: investigacion
status: vigente
date: 2026-11-08
updated: 2026-11-08
summary: "Cifras de referencia verificadas: temperaturas y rango térmico del polo sur lunar y de sitios marcianos, ángulo del sol en los alunizajes Apollo, y gravedad, presión y dosis de radiación en superficie."
autor: fernando
tipo_investigacion: A
riesgo: critico
---

# I-31 — Cifras de referencia de la Luna, Marte y la Tierra

**Por qué.** Se recopilan y verifican contra fuentes primarias las temperaturas del polo sur lunar, los rangos térmicos diarios de la Luna y Marte, el ángulo del sol en los alunizajes Apollo, y los valores físicos de gravedad, presión y radiación en superficie ([[dimensiones-innegociables]]).

## Prompt

```
I-31 — Cifras de referencia de la Luna y Marte

OBJETIVO
¿Cuáles son los valores medidos de temperatura, rango térmico diario, gravedad, presión y radiación en superficie en sitios de la Luna y Marte, y el ángulo del sol en los alunizajes Apollo?

CONTEXTO (solo lo que cambia la respuesta)
- Luna: polo sur (regiones candidatas de Artemis III: Malapert Massif, Haworth, Nobile Rim, de Gerlache Rim, Mons Mouton).
- Marte: Jezero, Gale, Elysium Planitia (InSight), Utopia Planitia (Zhurong), Vastitas Borealis (Phoenix).

YA SABEMOS (no investigar ni repetir)
- Diviner mide la temperatura de superficie lunar; MEDA (Perseverance), REMS (Curiosity) y TWINS (InSight) miden en Marte.

PUNTOS A RESPONDER
1. Temperatura mínima y máxima de superficie medida por Diviner en el polo sur lunar: zonas iluminadas y zonas en sombra permanente.
2. Rango térmico diario (día menos noche) de la superficie lunar en latitudes medias y en el polo sur, según Diviner.
3. Temperatura del suelo mínima, máxima y rango diario medidos en Jezero (MEDA), Gale (REMS), Elysium (InSight) y Vastitas Borealis (Phoenix).
4. Ángulo de elevación del sol en el momento del alunizaje de cada misión Apollo con descenso tripulado (11, 12, 14, 15, 16, 17), según los informes de misión de NASA.
5. Gravedad en superficie de la Luna y Marte (m/s² y fracción de g).
6. Presión en superficie de Marte (rango estacional en Pa, con el sitio) y de la Luna (exosfera).
7. Dosis de radiación en superficie medida: Marte (RAD de Curiosity, mGy/día) y Luna (LND de Chang'e 4, µGy/h), comparadas con la Tierra a nivel del mar.

REGLAS
- Primero fuentes oficiales: nasa.gov, NSSDCA (nssdc.gsfc.nasa.gov), informes de misión Apollo (history.nasa.gov, hq.nasa.gov/alsj), PDS, y artículos revisados (Science, JGR Planets, Icarus).
- Si no encuentras un dato, escribe "No encontrado". No lo deduzcas.
```

## Resultado

**Cifras**

| Dato | Valor | Fuente |
| :-- | :-- | :-- |
| Gravedad, Luna | 1.62 m/s² = 0.165 g | NSSDCA, Moon Fact Sheet (2024-01-11) |
| Gravedad, Marte | 3.73 m/s² media = 0.380 g; 3.69 m/s² en el ecuador | NSSDCA, Mars Fact Sheet (2025-05-19) |
| Presión, Marte | 636 Pa en el radio medio; 400 a 870 Pa según la estación | NSSDCA, Mars Fact Sheet |
| Presión, Luna (noche) | 3 × 10⁻¹⁰ Pa (3 × 10⁻¹⁵ bar); el valor diurno no está fijado | NSSDCA, Moon Fact Sheet |
| Presión por sitio, Marte | Jezero 625–761 Pa; Gale ~700–925 Pa; InSight ~600–800 Pa; Zhurong 675–853 Pa; Phoenix ~700–900 Pa | MEDA, REMS, InSight, Zhurong, Phoenix |
| Sol al alunizar, Apollo | 11: 10.8°; 12: 5.1°; 14: 10.3°; 15: 12.2°; 16: 11.9°; 17: 13.0° | NASA SP-4029, tabla del módulo lunar |
| Polo sur lunar, zonas iluminadas | ~50 K a ~200 K en promedio sobre 85°S; más de 300 K en laderas al sol | Williams et al. 2017 y 2019 (Diviner) |
| Polo sur lunar, sombra permanente | ~18–20 K en invierno en el fondo de Haworth; 30–45 K en verano | Williams et al. 2019 |
| Rango térmico diario, Luna | ~298 K en el ecuador (94 a 392 K); ~150 K en el promedio polar sobre 85°S | Williams et al. 2017 y 2019 |
| Suelo, Jezero | 178 a 290 K; rango diario 55–105 K | MEDA (Munguira et al. 2023 y 2024) |
| Suelo, Gale | ~180 a ~290 K; rango diario ~90 K, ~35 K en la tormenta global de 2018 | REMS (Hamilton et al. 2014; Vasavada et al. 2017) |
| Suelo, Elysium (InSight) | Media anual 221.6 K; rango diario 90–118 K | HP³ (Spohn et al. 2024) |
| Suelo, Vastitas Borealis (Phoenix) | Mínima ~180 K medida; rango completo por modelo térmico | TECP (Zent et al. 2010) |
| Radiación, Marte (Gale) | 0.21 ± 0.04 mGy/día; 0.64 ± 0.12 mSv/día | RAD (Hassler et al. 2014) |
| Radiación, Luna (Von Kármán) | 13.2 ± 1.0 µGy/h en silicio; ~1.37 mSv/día | LND de Chang'e 4 (Zhang et al. 2020) |

- No hay cifras separadas de Diviner para Nobile Rim, de Gerlache Rim ni Mons Mouton; quedan dentro de los mapas
  polares.
- La resolución de Diviner (~240 m) promedia sombras pequeñas: hay microtrampas 10–15 K más frías que el píxel.
- Para Apollo 16, la cifra oficial del ángulo del sol al alunizar es 11.9° (https://apollojournals.org/alsj/alsj-sunangles.html); el ALSJ menciona un retraso de casi 6 h pero no da otro ángulo.
- RAD da la dosis en tejido y LND en silicio, por lo que las cifras de cada artículo no se comparan directamente (https://doi.org/10.1126/sciadv.aaz1334).
- Para Zhurong no hay medida directa de temperatura del suelo; las cifras vienen del modelo MCD y de OMEGA.

## Relaciones

- [[dimensiones-innegociables]] — contraste ambiental entre cuerpos
