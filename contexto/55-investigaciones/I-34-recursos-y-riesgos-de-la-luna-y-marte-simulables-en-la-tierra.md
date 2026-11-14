---
title: "I-34 — Recursos y riesgos de la superficie de la Luna y de Marte, y qué parte se puede simular en la Tierra"
type: investigacion
status: vigente
date: 2026-11-08
updated: 2026-11-08
summary: "Por cuerpo: recursos aprovechables (ISRU) con cifras y estado de demostración, riesgos de superficie con cifras medidas, y para cada uno si la NASA lo prueba en un análogo o simulante terrestre y qué no se puede reproducir."
autor: fernando
tipo_investigacion: A
riesgo: critico
---

# I-34 — Recursos y riesgos de la Luna y Marte simulables en la Tierra

**Por qué.** Cada cuerpo tiene ventajas y desventajas distintas para una presencia humana (Marte tiene atmósfera de CO₂ para extraer oxígeno; la Luna carece de aire pero tiene hielo en el polo sur y oxígeno ligado en óxidos). Se documenta qué recursos y riesgos medidos presenta cada superficie y **qué parte se puede simular en la Tierra y qué no**.

## Prompt

```
I-34 — Recursos y riesgos de superficie en la Luna y Marte, y su simulación en la Tierra

OBJETIVO
¿Qué recursos aprovechables y qué riesgos de superficie tienen la Luna (polo sur) y Marte, con cifras medidas, y cuáles de ellos prueba la NASA en análogos o simulantes de la Tierra?

CONTEXTO (solo lo que cambia la respuesta)
- Se busca separar lo que un lugar de la Tierra puede simular (terreno, polvo, frío, material) de lo que no (gravedad, vacío, radiación).
- Luna: interesa el polo sur (regiones de Artemis, sobre 84° S).

YA SABEMOS (no investigar ni repetir)
- Gravedad: Luna 1.62 m/s², Marte 3.71 m/s². Presión de superficie y temperaturas de referencia (NSSDCA).
- Polvo marciano: 1–3 µm, basáltico, 0.4–1.0 wt.% de percloratos; límite de exposición NASA 0.1 mg/m³ (NASA/SP-20260005907).
- MOXIE, en el rover Perseverance, produjo oxígeno a partir del CO₂ de Marte.

PUNTOS A RESPONDER
1. Luna, recursos: hielo de agua en sombra permanente (concentración en wt.%, profundidad, misión que lo midió, por ejemplo LCROSS o LRO), oxígeno en el regolito (wt.% en los óxidos) y otros recursos que la NASA considere para ISRU; estado de las demostraciones (PRIME-1, VIPER u otras) a 2026.
2. Marte, recursos: resultados de MOXIE (producción en g/h, pureza, número de corridas, fecha final), hielo de agua cercano a la superficie (profundidad y latitudes, por ejemplo SWIM o SHARAD), y agua en minerales hidratados.
3. Luna, riesgos de superficie con cifras: dosis de radiación en la superficie (por ejemplo, Chang'e 4 LND en µSv/día), polvo (abrasión, carga electrostática, efectos medidos en Apollo), temperaturas extremas en el polo sur, iluminación y noches largas, micrometeoritos.
4. Marte, riesgos de superficie con cifras: dosis de radiación (Curiosity RAD en mSv/día), tormentas de polvo y su efecto en la energía solar, frío, presión baja, percloratos en el agua y los cultivos.
5. Para cada recurso y riesgo de los puntos 1 a 4: si la NASA lo prueba en un análogo terrestre o con un simulante, dónde (sitio o laboratorio) y con qué documento. Si un riesgo no se puede reproducir en la Tierra, decirlo.
6. Simulantes oficiales o de referencia de regolito lunar y marciano (por ejemplo, LHS-1, LMS-1, JSC-1A, MGS-1, JSC Mars-1): de qué sitio o roca de la Tierra sale cada uno y qué propiedad imita.
7. Pruebas de ISRU en campo hechas en la Tierra (por ejemplo, Mauna Kea 2008 y 2010): sitio, año, tecnología y resultado.
8. Comparaciones publicadas por la NASA o en artículos revisados de ventajas y desventajas de la Luna frente a Marte para una presencia humana sostenida (recursos, energía, distancia y comunicaciones, riesgos): documento y fecha.

REGLAS
- Primero documentación oficial (nasa.gov, ntrs.nasa.gov, pds.nasa.gov, nssdc.gsfc.nasa.gov, esa.int) y artículos revisados (Science, Nature, JGR Planets, Icarus, Planetary and Space Science, Acta Astronautica).
- Si no encuentras un dato, escribe "No encontrado". No lo deduzcas.
- No uses resúmenes generados por IA ni blogs como fuente.
```

## Resultado

### Síntesis comparativa

La diferencia de fondo entre los dos cuerpos, con cifras:

| | Luna (polo sur) | Marte |
| :-- | :-- | :-- |
| Agua | Hielo en trampas frías < 110 K: 5.6 ± 2.9 wt.% en la pluma de LCROSS (Cabeus); ≤ 2 wt.% en las zonas de Artemis III | Hielo casi puro a 1–2 m en latitudes medias; 2–22 wt.% en minerales hidratados |
| Oxígeno | > 40 wt.% del regolito, ligado en óxidos; se saca con calor (1–20 % según el método) | Del aire: MOXIE hizo 122 g en 16 corridas (2021–2023), hasta 12 g/h, ≥ 98 % de pureza |
| Radiación en la superficie | 1.37 mSv/día (Chang'e 4) | 0.64 mSv/día (Curiosity RAD); el aire la reduce 2.5 veces |
| Energía solar | Sol completo, 77–88 % del tiempo en las crestas del polo sur; noches de 14 días fuera de ellas | ≤ 45 % del sol de la Tierra, −0.2 %/sol por polvo; Opportunity murió con τ = 10.8 (2018) |
| Polvo | Abrasivo, en vacío, con carga eléctrica (Apollo 12: fugas en los trajes) | Fino, con percloratos tóxicos para el agua y los cultivos |
| Distancia | ~385 000 km, con relevo continuo | Ventanas cada ~2.1 años, 6–21 min de retardo |

**Lo que ninguna parte de la Tierra reproduce:** radiación de rayos cósmicos (la magnetosfera la frena; solo se
simula en el acelerador NSRL), gravedad parcial, ultravacío, temperaturas de 26–110 K, noches de 14 días,
micrometeoritos, tormentas de polvo globales, el aire de CO₂ a 6–7 mbar, y el polvo lunar en sí (sin humedad, con
hierro de nanofase y levitación electrostática).

### Simulantes oficiales y sus lugares de origen en la Tierra

La NASA selecciona lugares terrestres específicos como materia prima de sus simulantes de regolito:

| Simulante | Imita | Roca y lugar de origen |
| :-- | :-- | :-- |
| JSC-1A | Mar lunar de bajo titanio | Ceniza basáltica del cráter Merriam, campo volcánico de San Francisco (Arizona) |
| LHS-1 | Tierras altas lunares (polo sur) | 74 % anortosita de Kangerlussuaq (Groenlandia) + basalto de Merriam |
| LMS-1 | Mar lunar | Basalto de Merriam + anortosita de Kangerlussuaq + olivino e ilmenita |
| NU-LHT | Tierras altas con aglutinados sintéticos | Complejo de Stillwater (Montana) y dunita de Three Sisters (Washington) |
| JSC Mars-1 | Regiones brillantes de Marte | Tefra palagonitizada del cono Pu'u Nene (Mauna Kea, Hawái) |
| MMS | Suelo basáltico marciano | Basalto Saddleback, desierto de Mojave (California) |
| MGS-1 | Suelo global de Marte (Rocknest) | Mezcla de minerales de varios lugares; no es un sitio único |

Las pruebas de ISRU en campo documentadas usaron **Mauna Kea** (2008, 2010 "Dust to Thrust" con 28 g de oxígeno y 17 encendidos de un motor, 2012) y **cráter Haughton** y la Antártida para hielo.

### Límites de simulación en análogos terrestres

- **Ciclos térmicos extremos:** los 26–110 K y las noches de 14 días solo se reproducen en cámaras, no en campo.
- **Tormentas de polvo:** las tormentas globales de Marte no se reproducen en la Tierra; las locales sí.
- **Refugio en cuevas:** la protección frente a radiación solo es relevante en la Luna y Marte, mientras en la Tierra pueden evaluarse acceso, mapeo y estabilidad térmica.
- **Radiación UV marciana:** sin capa de ozono, la radiación UV superficial de Marte no se reproduce en la Tierra.

### Matices de interpretación

- Hielo lunar: se citan cifras de 34 a 300 millones de t; un meta-análisis de 2022 baja a ~34 millones en los 8 cráteres principales.
- Radiación lunar: la medida de Chang'e 4 es 1.37 mSv/día; la cifra de ~0.9 mSv/día: no encontrada en las fuentes consultadas.
- Comparar dosis diarias sin el contexto de duración de misión subestima la dosis acumulada hacia Marte.

### Datos y fuentes (consultado 2026-11-08)

| # | Dato | Fuente |
| :-- | :-- | :-- |
| 1 | MOXIE: 122 g, 16 corridas, 12 g/h, ≥ 98 %, 9.8 g el 7 de agosto (2023) | [O] https://www.nasa.gov/missions/mars-2020-perseverance/perseverance-rover/nasas-oxygen-generating-experiment-moxie-completes-mars-mission/ |
| 2 | VIPER con Blue Origin, Blue Moon MK1, finales de 2027 | [O] https://www.nasa.gov/news-release/nasa-selects-blue-origin-to-deliver-viper-rover-to-moons-south-pole/ |
| 3 | LCROSS, *Detection of Water in the LCROSS Ejecta Plume* (2010-10-22) | [P] doi:10.1126/science.1186986 |
| 4 | Chang'e 4, *First measurements of the radiation dose on the lunar surface* (2020-09-25) | [P] doi:10.1126/sciadv.aaz1334 |
| 5 | Curiosity RAD, superficie de Marte (2014-01-24) | [P] doi:10.1126/science.1244797 |
| 6 | MGS-1, estándar basado en Rocknest (2019-01) | [P] doi:10.1016/j.icarus.2018.08.019 |

### Bibliografía

- `[O]` NASA, cierre de MOXIE (2023-09-06) y orden de VIPER (2025-09-19) — consultado 2026-11-08.
- `[P]` Colaprete et al. 2010; Zhang et al. 2020; Hassler et al. 2014; Cannon et al. 2019 — DOI comprobados en
  Crossref el 2026-11-08.
- `[O]` Sanders (ISRU de la NASA, NTRS 20220008799 y 20250003730), MSolo y PRIME-1
  (NTRS 20260003150), guía de simulantes Rev A (NTRS 20240011783), Gaier 2005 (polvo de Apollo), Mazarico et al. 2011
  (iluminación polar), informes de campo de Mauna Kea (NTRS 20100021362 y 20120006109), Simonsen (radiación, NTRS
  20240009831).

## Relaciones

- [[I-33-objetivos-de-la-nasa-que-necesitan-analogos]] — objetivos oficiales de la NASA
- [[I-31-cifras-de-referencia]] — gravedad, presión y temperaturas verificadas
- [[I-32-tormentas-de-polvo-en-marte-y-analogos-terrestres]] — polvo marciano y toxicidad
- [[I-21-analogos-terrestres-del-hielo-en-sombra-permanente]] — hielo lunar
