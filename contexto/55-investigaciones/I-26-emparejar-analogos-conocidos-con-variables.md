---
title: "I-26 — Emparejar análogos terrestres documentados con su objetivo planetario y sus variables físicas"
type: investigacion
status: vigente
date: 2026-11-08
updated: 2026-11-08
summary: "Para análogos terrestres documentados en la literatura, qué sitio o tipo de terreno de la Luna o Marte imita cada uno, para qué uso, en qué variables físicas se apoya la analogía y en qué falla, con fuente."
autor: fernando
tipo_investigacion: A
riesgo: critico
---

# I-26 — Emparejar análogos terrestres documentados con su objetivo planetario y sus variables físicas

**Pregunta.** Los análogos terrestres documentados por NASA y por la literatura se emparejan con un sitio o terreno planetario específico, un uso funcional y variables físicas concretas. Se busca, para cada análogo, qué publicaciones revisadas sustentan ese emparejamiento y en qué variables se apoya.

## Prompt

```
I-26 — Emparejar análogos terrestres documentados con su objetivo planetario

IMPORTANTE: Esta es una consulta de datos puntuales sobre sitios concretos. No escribas una guía general de análogos, no repitas el contexto y no hagas recomendaciones.

OBJETIVO
Para cada sitio terrestre de la lista, ¿contra qué sitio o tipo de terreno de la Luna o Marte se ha usado como análogo, para qué uso, y en qué propiedades físicas medibles se apoya y falla la analogía, según publicaciones?

CONTEXTO (solo lo que cambia la respuesta)
- Usos posibles (elegir uno o más): base lunar permanente, aterrizaje, rover o movilidad, astrobiología, procesos activos (dunas y polvo), agua o frío extremo.
- Variables físicas: las propiedades físicas medibles en que la fuente apoye la analogía. Si se basa en otra cosa (química, microbiología, percloratos, hielo), escríbelo en la columna "Otra base".
- Objetivos de referencia. Luna, polo sur: sitios candidatos a base permanente (por ejemplo Haworth, Malapert Massif, Mons Mouton, Nobile Rim, de Gerlache Rim, Slater Plain). Marte: sitios de aterrizaje y de misiones (por ejemplo Jezero, Gale, Mawrth Vallis, Deuteronilus Mensae, Noctis Landing, Acheron Fossae, Erebus Montes, Arcadia Planitia, Phlegra Montes, Elysium Planitia, Utopia Planitia, Vastitas Borealis). Si el análogo apunta a otro lugar o a un tipo de terreno general, dilo tal cual.

SITIOS
Análogos terrestres documentados por NASA Planetary Analogs y por la literatura (por ejemplo: cráter Haughton, Expedition Fiord, Kilauea, Mauna Kea, Craters of the Moon, Death Valley, Mojave, Atacama, valles secos de McMurdo, caldera de Askja, cráter de Ries, Río Tinto, depresión de Danakil, volcanes de Nicaragua y Costa Rica, cuenca de Qaidam, Lava Beds National Monument, cráter Kamestastin).

ENTREGA
- Una tabla, una fila por sitio y por objetivo (si un sitio imita dos lugares, dos filas): Sitio | Cuerpo | Sitio o terreno objetivo | Uso | Variables físicas en que coincide | En qué variable física difiere | Otra base | Fuente (DOI o enlace) | Año | Certeza
- Certeza: Confirmado (la fuente lo dice) / Probable (inferencia directa de la fuente) / No encontrado.
- Si la fuente no nombra una variable física, escribe "No encontrado" en esa columna; no la deduzcas del tipo de terreno.
- Máximo 150 palabras fuera de la tabla. Sin introducción ni conclusiones.

REGLAS
- Primero artículos revisados por pares y páginas oficiales de NASA, ESA, CSA y JAXA (science.nasa.gov/solar-system/planetary-analogs, sitios de las misiones de campo).
- Blogs y prensa solo si no hay otra fuente, con certeza Probable.
- Si no encuentras un dato, escribe "No encontrado".
```

## Resultado

Consulta del 2026-11-08. Los DOI citados existen en Crossref; no todos los artículos se leyeron completos.

**Hallazgos de las fuentes**

- **Ningún análogo documentado apunta a un sitio concreto del polo sur lunar.** Las filas de la Luna nombran terrenos
  generales (tierras altas, basaltos, fosas, tubos de lava) o Shackleton, sombras permanentes y la región de Artemis III.
  Coincide con [[I-21-analogos-terrestres-del-hielo-en-sombra-permanente]].
- **Solo 4 filas asocian un sitio concreto de Marte con una variable física con evidencia:**

| Sitio | Objetivo | Variable | Evidencia | Fuente |
| :-- | :-- | :-- | :-- | :-- |
| Death Valley | Gale | pendiente | Mencionada | Baldridge et al. 2004, doi:10.1029/2004JE002315 |
| Askja | Gale (Formación Stimson) | viento | Mencionada | Hudziak et al. 2025, doi:10.1144/jgs2024-173 |
| Makgadikgadi | Remolinos de polvo (MEDA-RDS en Jezero) | viento | Medida | Toledo et al. 2023, doi:10.3389/fspas.2023.1221726 |
| Qaidam | Gale | viento | Mencionada | Xiao et al. 2017, doi:10.1016/j.earscirev.2016.11.003 |

- **La mayoría de los análogos son de astrobiología, química o entrenamiento** (Río Tinto, Poás, Salda,
  PANGAEA, pruebas de rovers). Sus razones están en "Otra base", fuera de las variables físicas evaluadas.
- **Notas de las fuentes:** el artículo doi:10.1016/j.pss.2009.10.004 (cráter Haughton) es de Osinski, Lee et al. 2010.
  Para el Mojave (Cima), la rugosidad está respaldada por Farr 1992; la velocidad de 3.5 a 9 m/s citada para Amboy proviene de un
  túnel de viento con modelo a escala (https://www.lpi.usra.edu/meetings/lpsc2013/pdf/1670.pdf), no del sitio. Las cifras de viento de Makgadikgadi salen
  del resumen del artículo. Cerro Negro, Momotombo y Telica se tratan en McCollom, Hynek y Marcucci 2013 (JGR Planets,
  doi:10.1002/jgre.20140).

**Tabla resumida**

Objetivo: "—" = ninguno de los sitios candidatos. Variables entre paréntesis con su evidencia: M = medida, Me = mencionada.

| Sitio | Cuerpo | Objetivo o terreno | Uso | Variables | Certeza | Fuente principal |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| Cráter Haughton | Marte | Cráteres y laderas con RSL | astrobiología, frío | pendiente (M) | C | doi:10.1017/S1473550418000526 |
| Cráter Haughton | Luna | — (Shackleton, cráteres) | base, rover, frío | — | P | doi:10.1016/j.pss.2009.10.004 |
| Expedition Fiord | Marte | Permafrost con manantiales | astrobiología, frío | — | C | PMC5744183 |
| Kilauea | Marte | Basaltos alterados, sílice | astrobiología, rover | — | C | doi:10.1089/ast.2018.1847 |
| Kilauea | Luna | — (basaltos, Apollo 15) | base, rover | — | P | NASA Analog Explorer |
| Mauna Kea | Luna | — (ISRU, RESOLVE) | aterrizaje, rover, frío | — | C | NASA NP-2011-06-395 |
| Craters of the Moon | Marte | Basaltos del Amazónico | astrobiología, rover | — | C | doi:10.1089/ast.2018.1847 |
| Craters of the Moon | Luna | — (fosas y tubos de lava) | rover, base | relieve relativo (M) | C | ti.arc.nasa.gov/dataset/caves |
| Black Point Lava Flow | Luna | — (basaltos, Desert RATS) | rover, base | relieve relativo (M), pendiente (M) | C | LPSC 2009 (Garry) |
| Death Valley | Marte | Gale | aterrizaje, rover | pendiente (Me) | C | doi:10.1029/2004JE002315 |
| Death Valley | Marte | Utopia Planitia y Jezero | aterrizaje, rover | — | P | NASA Analog Explorer |
| Mojave (Amboy) | Marte | Cráteres pequeños con colas de viento | procesos activos | viento (M, túnel de viento), relieve relativo (M), rugosidad (M) | C | LPSC 2013 #1670; LPSC 2004 #1736 |
| Mojave (Cima) | Marte | Coladas de lava | aterrizaje, procesos | rugosidad (Me) | C | doi:10.1029/92JB01592 |
| Mojave (Silver Lake) | Marte | Paleolagos, operación de rovers | rover, astrobiología | — | C | doi:10.1029/1999JE001178 |
| Mojave (Little Red Hill) | Marte | Carbonatos (Nili Fossae) | astrobiología | — | C | doi:10.1017/S1473550411000206 |
| Playa evaporítica en Utah | Marte | Vastitas Borealis (Phoenix) | astrobiología, frío | — | C | Lynch et al. 2019, Astrobiology |
| Verde Valley | Marte | Gale y Jezero | astrobiología | — | P | LPI-001912 |
| Mina de carbón Fieg | Luna | — (fosas de fundido) | rover | — | C | ti.arc.nasa.gov/dataset/caves |
| Mina Sheepridge | Luna | — (fosa de Lacus Mortis) | rover | pendiente, rugosidad, relieve (Me) | C | ti.arc.nasa.gov/dataset/caves |
| Atacama | Marte | Jezero y Gale | astrobiología, rover | — | C | doi:10.3389/fspas.2021.810426 |
| Valles secos de McMurdo | Marte | Vastitas Borealis (Phoenix) y Gale | frío, astrobiología | — | C | Tamppari et al. 2009 |
| Caldera de Askja | Luna | — (sombras permanentes) | frío, base | difiere en iluminación (Me) | P | NASA Analog Explorer |
| Caldera de Askja | Marte | Gale (Stimson) | procesos activos | viento (Me) | C | doi:10.1144/jgs2024-173 |
| Vikursandur | Marte | TARs y megaripples | procesos activos | viento (Me) | P | NASA Analog Explorer |
| Lago Salda | Marte | Jezero | astrobiología | — | C | doi:10.1016/j.icarus.2019.113526 |
| Lanzarote | Luna y Marte | — (PANGAEA, volcánico) | rover, astrobiología | — | C | doi:10.1016/j.actaastro.2022.12.034 |
| Caldera de Gairia | Marte | Volcánico alterado (CRISM) | astrobiología | — | C | LPSC 2017 #2773 |
| Cráter de Ries | Luna y Marte | — (cráteres complejos) | base, rover | — | C | doi:10.1016/j.actaastro.2022.12.034 |
| Cañón de Bletterbach | Marte | Secuencias sedimentarias | astrobiología, rover | — | C | doi:10.1016/j.actaastro.2022.12.034 |
| Lofoten | Luna | — (tierras altas) | base, rover | — | C | doi:10.1016/j.actaastro.2022.12.034 |
| Río Tinto | Marte | Meridiani Planum | astrobiología, rover | — | C | mdpi.com/2075-1729/4/3/511 |
| Salares de Makgadikgadi | Marte | Remolinos de polvo (Jezero) | procesos activos | viento (M) | P | doi:10.3389/fspas.2023.1221726 |
| Depresión de Danakil | Marte | Arabia Terra (Firsoff) | astrobiología | relieve relativo (M) | C | doi:10.1089/ast.2018.1926 |
| Andes argentinos | Marte | Paleolagos tipo playa | astrobiología, frío | — | C | PMC6509559 |
| Izu Oshima | Luna y Marte | — (mares, volcánico) | rover, base | pendiente (Me) | C | doi:10.1080/01691864.2021.1959396 |
| Dunas de Tottori | Luna | — (Lunar Terrace) | rover, base, aterrizaje | — | C | ISTS 2017 (Uno) |
| Dunas de Tottori | Marte | Dunas transversales | procesos, rover | pendiente (Me) | C | MISASA-IX 2024 |
| Volcán Bockfjord | Marte | Carbonatos (ALH84001); pruebas MSL y ExoMars | astrobiología, frío, rover | — | C | NTRS 20140008913 |
| Volcán Poás | Marte | Hidrotermal ácido (Home Plate) | astrobiología | — | C | doi:10.1089/ast.2017.1719 |
| Rincón de la Vieja | Marte | Gale y Gusev | astrobiología | — | C | LPSC 2025 #1592 |
| Cerro Negro | Marte | Hidrotermal ácido, Meridiani, Gale | astrobiología | — | C | doi:10.1002/jgre.20114 |
| Volcán Momotombo | Marte | Hidrotermal ácido (Valles Marineris) | astrobiología | — | C | doi:10.1002/jgre.20140 |
| Volcán Telica | Marte | Hidrotermal ácido | astrobiología | — | C | doi:10.1002/jgre.20159 |
| Little Ambergris Cay | Marte | Carbonatos (Jezero, citado) | astrobiología | — | P | doi:10.3389/feart.2020.576712 |
| Pigeon Cay | Marte | Carbonatos (Jezero, citado) | astrobiología | — | P | doi:10.1111/gbi.12196 |
| Lago Alchichica | Marte | Jezero | astrobiología | — | C | doi:10.1038/s41561-026-02052-8 |
| Laguna Bacalar | Marte | Paleolagos carbonatados | astrobiología, rover | — | C | doi:10.1007/978-3-030-46087-7 |
| Kangerlussuaq | Marte | Depósitos polares con hielo | frío, astrobiología | — | C | Annals of Glaciology 2014 (Mouginot) |
| Kangerlussuaq | Luna y Marte | — (simulante GreenSpar) | base | — | P | MDPI Lubricants 11(8):334 |
| Lava Beds National Monument | Marte y Luna | — (tubos de lava) | astrobiología, rover, base | — | C | NASA BRAILLE |
| Cuenca de Qaidam | Marte | Gale | astrobiología, procesos | viento (Me) | C | doi:10.1016/j.earscirev.2016.11.003 |
| Moses Lake Sand Dunes | Luna | — (regolito, ATHLETE y K10) | rover, base | — | C | NTRS 20090026331 |
| Moses Lake Sand Dunes | Marte | Dunas basálticas, Ares Vallis | procesos, rover | — | C | LPSC 2016 #2321 |
| Cráter Kamestastin | Luna | — (Artemis III, tierras altas) | base, rover, aterrizaje | relieve relativo (Me) | C | doi:10.1111/maps.13173 |

## Relaciones

- [[I-03-analogos-terrestres-documentados]] — análogos terrestres documentados
- [[I-25-aprender-pesos-con-pocos-analogos-conocidos]] — métodos que parten de análogos conocidos
- [[I-17-sitios-objetivo-luna-y-marte]] — sitios objetivo de la Luna y Marte
