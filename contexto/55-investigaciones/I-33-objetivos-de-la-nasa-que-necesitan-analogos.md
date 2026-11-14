---
title: "I-33 — Objetivos oficiales de la NASA para la Luna y Marte que necesitan análogos en la Tierra"
type: investigacion
status: vigente
date: 2026-11-08
updated: 2026-11-08
summary: "Qué objetivos de superficie fija la NASA en Moon to Mars (código y texto), cuáles prepara con análogos terrestres y en qué programas y sitios."
autor: fernando
tipo_investigacion: A
riesgo: critico
---

# I-33 — Objetivos oficiales de la NASA que necesitan análogos en la Tierra

**Por qué.** Identificar qué **objetivos oficiales de la NASA con su código literal** corresponden a operaciones y ciencia en la superficie de la Luna y Marte, y qué programas y sitios terrestres usa la NASA para probarlos.

## Prompt

```
I-33 — Objetivos de superficie de la NASA (Luna y Marte) y sus análogos terrestres

OBJETIVO
¿Qué objetivos oficiales de la NASA para la superficie de la Luna y de Marte existen (código y texto), y cuáles prepara la NASA con análogos en la Tierra, en qué programas y en qué sitios?

CONTEXTO (solo lo que cambia la respuesta)
- Se buscan lugares de la Tierra parecidos a la Luna (polo sur, regiones de Artemis) y a Marte para probar algo concreto: aterrizaje, movilidad, polvo, refugio en cuevas, hielo, recursos (ISRU), astrobiología, ciclos térmicos.
- Se necesita citar el objetivo oficial con su código, no una paráfrasis.

YA SABEMOS (no investigar ni repetir)
- Las 9 regiones candidatas de Artemis en el polo sur lunar (USGS, DOI 10.5066/P1MEQ6UK).
- Gravedad, presión y temperaturas de referencia de la Luna y Marte (NSSDCA).
- No existe una escala publicada de fidelidad de sitios análogos (catálogo CAFE de ESA, 2012).

PUNTOS A RESPONDER
1. Versión vigente del documento "Moon to Mars Objectives" de la NASA y del "Moon to Mars Architecture Definition Document" (ESDMD-001): fecha, revisión y URL oficial.
2. Lista de los objetivos de esos documentos que tratan de la superficie de la Luna o de Marte (ciencia lunar y planetaria, infraestructura, transporte y hábitat, operaciones, salud humana, ISRU): código exacto y texto literal corto de cada uno.
3. Cuáles de esos objetivos el propio documento u otro documento de la NASA dice que se preparan o prueban con análogos terrestres o simulantes. Código del objetivo y cita del documento.
4. Programas de análogos de la NASA activos entre 2023 y 2026 (por ejemplo, Desert RATS, JETT, HERA, CHAPEA, NEEMO u otros): nombre, sitio en la Tierra, qué prueban y a qué objetivo o misión atienden.
5. Sitios de la Tierra que la NASA usó entre 2020 y 2026 para pruebas de campo de Artemis o de Marte (trajes, rovers, geología de campo, ISRU, perforación): sitio, año, qué se probó, documento.
6. Necesidades de prueba que la NASA declara abiertas o sin análogo adecuado (gaps), si las publica: tema y documento.
7. Objetivos o requisitos de la NASA sobre el polvo lunar y marciano (mitigación, salud, equipos): código o número de requisito y documento.
8. Si la ESA o la Agencia Espacial Canadiense publicaron una lista equivalente de necesidades de análogos terrestres vigente (2020–2026): nombre, fecha y URL.

REGLAS
- Primero documentación oficial: nasa.gov (Moon to Mars, Artemis), ntrs.nasa.gov, esa.int, asc-csa.gc.ca.
- Cita el código del objetivo tal como aparece en el documento. Si no tiene código, dilo.
- Si no encuentras un dato, escribe "No encontrado". No lo deduzcas.
- No uses resúmenes generados por IA ni blogs como fuente.
```

## Resultado

### Hallazgos principales

Los objetivos vigentes son los 63 de *Moon to Mars Objectives* (NASA, septiembre de 2022; el PDF tiene ~72 códigos porque suma los principios recurrentes, RT), con la arquitectura en
ESDMD-001 Rev C (2025-12-12). **OP-1L es el único objetivo que pide literalmente pruebas "on the surface of Earth"**. Ningún documento de la NASA asigna sitios análogos fijos a cada objetivo; la traza entre
objetivo, brecha y sitio de prueba está en *Civil Space Shortfalls* (STMD, 2026), que pide sitios de prueba
(SF31/1585). Asimismo, "sobrevivir largos periodos de sombra lunar" figura entre las 5 brechas prioritarias de la arquitectura, y SF02 y SF06 corresponden a los shortfalls #1 y #5 de 2026.

### Objetivos Moon to Mars y brechas documentadas por ámbito operativo

| Ámbito operativo | Objetivos M2M | Brechas o requisitos documentados |
| :-- | :-- | :-- |
| Base lunar | TH-3L, LI-1L, LI-9L | Brecha prioritaria "sombra lunar extendida" |
| Aterrizaje | LI-5L, TH-2L, TH-6M | ESDMD #1101 (PSI y aterrizaje preciso en el polo sur), DN-002 L |
| Rover / movilidad | LI-6L, OP-5LM, TH-9L, TH-10M | SF16 (#2 en 2026, movilidad de superficie); SLOPE Lab de Glenn (VIPER en simulante) |
| Astrobiología / paleolagos | LPS-4M, SE-4LM | PSTAR (Haughton, Bishop Tuff); biblioteca de muestras ESA-NASA (Mars Sample Return) |
| Dunas / procesos activos | LPS-2LM ("active processes modify the surfaces"), AS-1LM | — |
| Agua / hielo / frío | LPS-3LM, AS-3LM, LI-7L, SE-3LM, MI-4M | DN-007 L (hielo somero para ISRU), ESDMD #0804; GIFT (radar de hielo en Islandia) |
| Polvo (material y mitigación) | AS-1LM, HS-3LM, OP-5LM, HBS-1LM | NASA-STD-1008; brechas de simulantes (aglutinados, plagioclasa sódica); ESDMD #0801, #0802, #0901, #0902; shortfall 1561; [V2 6053] y [V2 6253]; "Lunar Dust Tolerant Systems" (#1) |
| Refugio y subsuelo | TH-4LM, TH-7M, HBS-1LM | GIFT y TubeX midieron tubos de lava (Kīlauea, Skull Cave) |
| Ciclos térmicos | LI-1L, MI-1M | SF02 (#1) y SF06 (#5) de 2026; ESDMD #0301; brecha prioritaria "sombra lunar" |

### Sitios de campo documentados (2020–2026)

- Cráter Haughton (TRIDENT 2023), Kīlauea (GIFT 2022), Black Point Lava Flow (D-RATS), Lanzarote / cráter de Ries / cañón de Bletterbach (ESA PANGAEA), cráter Kamestastin (entrenamiento 2021), campo volcánico de San Francisco y SP Crater (JETT3 y JETT5, Arizona), Bishop Tuff y Long Valley (California), Valle de los Diez Mil Humos (Alaska), Vatnajökull y el suroeste de Islandia (Artemis II 2024, GIFT 2025) y Clachtoll (Escocia).

### Limitaciones y brechas abiertas

- Las brechas de datos del polo sur lunar (DN-001 L y DN-002 L: imágenes y relieve finos) permanecen abiertas en la arquitectura.
- Los simulantes y los suelos terrestres no reproducen aglutinados ni hierro de nanofase del regolito lunar.
- La versión vigente de ESDMD-001 es Rev C (2025-12-12).
- La fecha de cierre de la segunda misión CHAPEA (la página de la NASA confirma la misión y su año dentro del hábitat) y la reclasificación de HERA como análogo pasado no están verificadas.

### Datos y fuentes (consultado 2026-11-08)

| # | Dato | Fuente |
| :-- | :-- | :-- |
| 1 | Textos de OP-1L, AS-1LM, TH-3L, LI-7L, MI-4M y SE-7LM | [O] https://www.nasa.gov/wp-content/uploads/2022/09/m2m-objectives-exec-summary.pdf |
| 2 | ESDMD-001 Rev C, 2025-12-12 | [O] https://ntrs.nasa.gov/citations/20250010956 |
| 3 | Dust Mitigation Technology Roadmap, LSIC Spring 2026 (2026-04-28) | [O] https://ntrs.nasa.gov/citations/20260001844 |
| 4 | Lunar Regolith Simulant User's Guide Rev A (2024-10-01) | [O] https://ntrs.nasa.gov/citations/20240011783 |
| 5 | JETT3 en NTRS | [O] https://ntrs.nasa.gov/citations/20230000146 |
| 6 | 2026 Civil Space Shortfalls (PDF disponible) | [O] https://www.spacetechpriorities.org/wp-content/uploads/2026/01/2026-Civil-Space-Shortfalls.pdf |
| 7 | CHAPEA, segunda misión | [O] https://www.nasa.gov/missions/analog-field-testing/chapea/ |

### Bibliografía

- `[O]` NASA, *Moon to Mars Objectives* (2022-09) — consultado 2026-11-08.
- `[O]` NASA, ESDMD-001 Rev C (NASA/TP-20250010956, 2025-12-12) — consultado 2026-11-08.
- `[O]` NASA, *Dust Mitigation Technology Roadmap* (NTRS 20260001844) y *Lunar Regolith Simulant User's Guide Rev A*
  (NTRS 20240011783) — consultado 2026-11-08.
- `[O]` NASA STMD, *2026 Civil Space Shortfalls* — consultado 2026-11-08.
- `[O]` NASA-STD-1008 (2021), NASA-STD-3001 Vol. 2 Rev E, ACR 2025 Data Gaps
  (LPI), JETT5 (NTRS 20250000177), D-RATS 2022 (NTRS 20230017073), TRIDENT (NTRS 20240000585), páginas de GIFT,
  PSTAR, CHAPEA y analog-missions, ESA SciSpacE, LUNA Analog Facility y CSA Analogue Terrain.

## Relaciones

- [[I-34-recursos-y-riesgos-de-la-luna-y-marte-simulables-en-la-tierra]] — qué parte se puede simular en la Tierra
- [[I-30-como-se-describe-la-fidelidad-de-un-analogo]] — vocabulario de fidelidad
- [[dimensiones-innegociables]] — requisitos de comparación del reto
