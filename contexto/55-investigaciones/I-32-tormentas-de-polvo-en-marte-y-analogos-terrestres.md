---
title: "I-32 — Tormentas de polvo en Marte y lugares de la Tierra con polvo fino que el viento levanta"
type: investigacion
status: vigente
date: 2026-11-08
updated: 2026-11-08
summary: "Cómo se forman y se reparten las tormentas de polvo en Marte (tamaño del grano, cómo se levanta, temporadas) y qué lugares de la Tierra tienen polvo igual de fino, de preferencia basáltico, que el viento levanta con frecuencia, con qué datasets globales se encuentran. Separa dos usos del análogo: material (mismo polvo) y operación (mismo ambiente polvoriento para entrenar y probar equipos)."
autor: fernando
tipo_investigacion: A
riesgo: critico
---

# I-32 — Tormentas de polvo en Marte y lugares de la Tierra con polvo fino que el viento levanta

**Por qué.** El polvo de Marte es mucho más fino que la arena (100 a 200 µm) y no se levanta igual. Se investiga qué lugares de la Tierra simulan, sin replicar, esa condición: polvo igual de fino, de basalto con olivino, que el viento levante con frecuencia ([[I-29-albedo-y-polvo-comparables-entre-cuerpos]]).

## Prompt

```
I-32 — Polvo fino en Marte y análogos en la Tierra

OBJETIVO
¿Cómo se forman y dónde ocurren las tormentas de polvo en Marte, y qué lugares de la Tierra tienen polvo de tamaño y composición parecidos que el viento levanta con frecuencia, medibles con datasets globales?

CONTEXTO (solo lo que cambia la respuesta)
- Interesa el proceso (grano fino, composición basáltica y levantamiento por viento), no su réplica exacta.

YA SABEMOS (no investigar ni repetir)
- Umbral de arrastre para arena de 100-200 µm en la Tierra y Marte (Shao y Lu 2000; Kok 2010).
- La MCD subestima unas 16 veces las superaciones del umbral frente a lo observado (Bickel et al. 2025).
- Profundidad óptica del polvo en Marte: Montabone et al. 2020; factor ×2.6 de 9.3 µm al visible.

PUNTOS A RESPONDER
1. Tamaño del polvo marciano en suspensión y en el suelo (radio efectivo o diámetro, en µm) y su mineralogía (basalto, olivino, óxidos de hierro, percloratos), con la misión o instrumento que lo midió.
2. Cómo se levanta ese polvo en Marte: viento directo, impacto de arena en saltación (sandblasting) o remolinos (dust devils); qué fracción explica cada mecanismo según la literatura.
3. Tipos de tormenta (local, regional, global): tamaño, duración, época del año en longitud solar (Ls) y regiones de Marte donde empiezan con más frecuencia.
4. Mapa o catálogo descargable de tormentas de polvo en Marte (por ejemplo, MDAD de Battalio y Wang): versión, resolución, cobertura temporal y licencia.
5. Lugares de la Tierra con polvo volcánico basáltico que el viento levanta con frecuencia (por ejemplo, Islandia: Mýrdalssandur, Dyngjusandur, Vikursandur; Hawái): tamaño de grano medido, frecuencia de eventos de polvo y fuente.
6. Para los candidatos de Bodélé (Chad), el lecho seco del mar de Aral y Sistán (Irán): tamaño de grano, mineralogía, viento umbral de emisión y frecuencia de tormentas, con fuente. Si alguna cifra de esta lista no se confirma, decirlo.
7. Datasets globales de la Tierra para buscar estos lugares: fracción fina del suelo (por ejemplo, SoilGrids arcilla y limo), mapas de fuentes de polvo (por ejemplo, Ginoux et al. 2012 con MODIS Deep Blue) y emisión de polvo de MERRA-2 (nombre exacto de la variable y colección). Resolución, versión y licencia de cada uno.
8. Toxicidad del polvo marciano para humanos (tamaño respirable, percloratos, metales) frente al polvo de los lugares terrestres de los puntos 5 y 6, según NASA u OMS.

REGLAS
- Primero documentación oficial (NASA, ESA, GMAO, ISRIC, OMS) y artículos revisados (JGR Planets, Icarus, Aeolian Research, Geophysical Research Letters, Atmospheric Chemistry and Physics).
- Si no encuentras un dato, escribe "No encontrado". No lo deduzcas.
- No uses resúmenes generados por IA ni blogs como fuente.
```

## Resultado

### Hallazgos principales

El polvo marciano en suspensión mide **1–3 µm** de diámetro (radio efectivo ~1.5 µm en Viking, Pathfinder, MER y
Curiosity), es basáltico (plagioclasa, piroxeno, olivino y ~30–45 % de material amorfo rico en hierro) y casi **no hay
granos sueltos menores de 4 µm en el suelo** (< 1 % en volumen, Phoenix). Por eso se levanta sobre todo por
**impacto de arena en saltación** y por remolinos (~50 % cada uno fuera de las tormentas globales). Un análogo completo necesita arena que salte y polvo fino juntos.

En la Tierra, **Islandia** es el único candidato que reúne basalto (vidrio basáltico 68–90 %), arena en saltación y
tormentas frecuentes (> 34 días de polvo al año). **Dyngjusandur**, junto a Vikursandur, emite polvo de ~12
µm de diámetro mediano: unas 4 veces más grueso que el marciano. **Bodélé** tiene el tamaño más parecido (moda de 2 µm)
y el proceso (autoabrasión en saltación con chorro de bajo nivel), pero es diatomita y cuarzo, no basalto. Aral y
Sistán son cuarzo, calcita y sales: sirven solo como contraste.

### Dos usos distintos del análogo de polvo

Un lugar puede parecerse a Marte por **lo que es el polvo** o por **lo que hace el polvo**. Son dos enfoques distintos con variables distintas:

| Uso | Pregunta | Qué tiene que coincidir | Para qué sirve | Ejemplo |
| :-- | :-- | :-- | :-- | :-- |
| **Material** | ¿El polvo es parecido? | Mineralogía (basalto, olivino, vidrio basáltico, hierro) y tamaño de grano | Estudiar el material: química, toxicidad, adhesión e ISRU | Islandia (Dyngjusandur) |
| **Operación** | ¿El ambiente polvoriento es parecido? | Tamaño de grano fino (1–20 µm), frecuencia y duración de las tormentas, profundidad óptica, carga electrostática; el material puede ser otro | Entrenar y probar equipos (filtros, trajes, paneles solares, electrónica) en polvo extremo | Bodélé (diatomita, polvo con moda de 2 µm, ~100 días de tormenta al año) |

- **Tener el material no implica tener las tormentas**, y al revés. Islandia cumple las dos en parte (basalto y > 34
  días de polvo al año, pero polvo ~4 veces más grueso y con nubes). Bodélé cumple la operación pero no el material.
- **Riesgos locales:** cada lugar terrestre agrega riesgos ausentes en Marte (cuarzo y silicosis en Aral y Sistán, pesticidas en Aral).

### Datasets y fuentes adicionales

- **Sesgo de los mapas de fuentes de polvo:** los mayores focos que ven MODIS Deep Blue y MERRA-2 son lagos secos (Bodélé,
  Aral, Sistán), no basálticos, y las nubes ocultan más de dos tercios de las emisiones de Islandia a los sensores ópticos.
- **Tres datasets globales verificados:** SoilGrids 2.0 (arcilla < 2 µm y limo 2–50 µm, 250 m, CC BY 4.0), `MODFDS_MON_GLB_L3` (frecuencia mensual de tormentas de polvo, 0.1°, 2000–2022,
  dominio público) y MERRA-2 `M2T1NXADG` (`DUEM001`–`DUEM005`, emisión de polvo en 5 tamaños, horario). Los bins
  `DUEM001` y `DUEM002` (diámetro 0.2–3.6 µm) cubren el tamaño del polvo marciano.
- **MDAD v1.1** (Battalio y Wang, Zenodo 10.5281/zenodo.7480334, CC BY 4.0): 228 secuencias de tormentas con polígonos
  diarios a 0.1°, de MY 28 a MY 32. Las secuencias del sur
  empiezan en Aonia–Solis–Valles Marineris y en Hellas; las del norte en Acidalia, Utopia y Arcadia.
- **Toxicidad (NASA/SP-20260005907, 2026-07):** el límite para la tripulación es < 0.1 mg/m³ de partículas < 10 µm en 24
  h. Con ese límite, cromo, manganeso y perclorato inhalados son de bajo riesgo; el perclorato importa más por los
  cultivos y el agua. El polvo marciano casi no tiene cuarzo (0.8 %), al revés que Aral y Sistán (30–40 %): la
  silicosis aplica a esos desiertos, no a Marte.

### Limitaciones e incógnitas abiertas

- La nubosidad oculta a Islandia en los mapas satelitales de polvo; conviene contrastar con estaciones sinópticas (días de polvo).
- El polvo basáltico terrestre de Islandia (~12 µm) es ~4 veces más grueso que el marciano (1–3 µm).
- Las cifras de Bodélé, Aral y Sistán vienen de campañas con métodos distintos y no son directamente comparables como serie homogénea.
- Preguntas abiertas con fuente primaria por localizar: cómo una tormenta regional crece a global y por qué termina; regiones de inicio (Hellas Planitia, Arabia Terra); carga electrostática del polvo en tormentas y remolinos de Marte y de la Tierra; metales por nombre (cromo, arsénico); efecto de la gravedad de 0.38 g en la suspensión del polvo; Mariner 9 (1971) durante la tormenta global; tubos de lava como refugio frente al polvo.

### Datos y fuentes (consultado 2026-11-08)

| # | Dato | Fuente |
| :-- | :-- | :-- |
| 1 | MDAD v1.1, CC BY 4.0, 2022-12-24 | [O] https://zenodo.org/api/records/7480334 |
| 2 | `M2T1NXADG` V5.12.4, 0.625° × 0.5°, horario | [O] https://cmr.earthdata.nasa.gov (short_name M2T1NXADG) |
| 3 | `MODFDS_MON_GLB_L3` v1, MOD04_L2 C6.1, 0.1°, 2000–2022 | [O] https://cmr.earthdata.nasa.gov (short_name MODFDS_MON_GLB_L3) |
| 4 | Límite de 0.1 mg/m³ (< 10 µm, 24 h), Cr⁶⁺, Mn y perclorato de bajo riesgo inhalado | [O] https://www.nasa.gov/wp-content/uploads/2026/07/martian-dust-exposure-limits-sp-20260005907.pdf |
| 5 | Variables `DUEM001`–`DUEM005` y sus bins (fuente por abrir) | Collow et al., GMAO, https://gmao.gsfc.nasa.gov/pubs/docs/Collow1489.pdf |
| 6 | SoilGrids 2.0, CC BY 4.0 (fuente por abrir) | doi:10.5194/soil-7-217-2021 |

### Bibliografía

- `[O]` NASA/SP-20260005907, *Martian Dust Exposure Limits* (2026-07) — consultado 2026-11-08.
- `[O]` Battalio y Wang, MDAD v1.1, doi:10.5281/zenodo.7480334 — consultado 2026-11-08.
- `[O]` GES DISC: `M2T1NXADG` (doi:10.5067/HM00OHQBHKTP) y `MODFDS_MON_GLB_L3` (doi:10.5067/PMBREH7Q9P50) — consultado
  2026-11-08.
- `[P]` Pollack et al. 1995; Lemmon et al. 2004, 2019; Pike et al. 2011; Bish et al. 2013; Hecht et al. 2009; Whelley
  y Greeley 2008; Ginoux et al. 2012 (doi:10.1029/2012RG000388); Poggio et al. 2021; Baddock et al. 2024
  (doi:10.5194/acp-24-6883-2024); Washington et al. y Bristow et al. 2010 (Bodélé); Rashki et al. 2013 (Sistán);
  Indoitu et al. 2015 (Aral).

## Relaciones

- [[I-29-albedo-y-polvo-comparables-entre-cuerpos]] — polvo en el aire y profundidades ópticas
