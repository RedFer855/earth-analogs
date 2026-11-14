---
title: "I-24 — Equivalencias de clases minerales entre los espectrómetros de la Tierra, la Luna y Marte"
type: investigacion
status: vigente
date: 2026-11-05
updated: 2026-11-05
summary: "Qué grupos minerales (sulfatos, arcillas, carbonatos, óxidos de hierro, olivino, piroxeno, sílice hidratada) detecta cada espectrómetro orbital del visible e infrarrojo cercano en la Tierra (EMIT, ASTER, EnMAP, PRISMA), Marte (CRISM, OMEGA) y la Luna (M3), con qué bandas y parámetros."
autor: fernando
tipo_investigacion: A
riesgo: critico
---

# I-24 — Equivalencias de clases minerales

La mineralogía se puede comparar por clases y no por bandas crudas ([[I-07-armonizar-tierra-luna-marte]]). La pregunta
es qué clase de cada espectrómetro corresponde a la misma de otro. Los sulfatos son el caso más usado en los análogos
(Río Tinto, Cerro Negro, Poás, Danakil, Gale, Jezero). [[I-22-indice-de-silice-comparable-entre-cuerpos]] cubre el
infrarrojo térmico; esta investigación cubre el visible y el infrarrojo cercano.

## Pregunta de investigación

¿Qué grupos minerales detecta cada espectrómetro orbital del visible e infrarrojo cercano (0.4 a 2.6 µm) en la Tierra,
Marte y la Luna, con qué bandas de absorción y qué producto o parámetro, de modo que se pueda decir que una clase de un
lado es la misma que la del otro?

Datos externos de partida:

- Tierra: EMIT EMITL2BMIN V002 (60 m, zonas áridas entre 54°N y 54°S, identificación con Tetracorder); ASTER L1T y
  AST_07XT (bandas SWIR hasta 2008).
- Marte: CRISM MTRDR (MROCR_4001) y sus parámetros resumen (Viviano-Beck et al. 2014); mapa de sitios hidratados
  OMEGA/CRISM (Carter et al. 2013).
- Luna: M3 nivel 2 (reflectancia).

Puntos a responder:

1. Bandas de absorción diagnósticas en µm de cada grupo mineral (sulfatos, filosilicatos de Fe/Mg y de Al, carbonatos,
   óxidos de hierro, olivino, piroxeno de bajo y alto calcio, sílice hidratada, cloruros, plagioclasa).
2. Clases de EMIT L2B que corresponden a cada grupo.
3. Parámetros resumen de CRISM que detectan cada grupo, con su fórmula o banda.
4. Grupos que detecta M3 en la Luna y los índices publicados.
5. Productos de minerales de ASTER (SWIR), EnMAP y PRISMA: nombre, versión, resolución, cobertura, licencia.
6. Trabajos que hayan aplicado parámetros de CRISM a datos de la Tierra (o Tetracorder a datos de Marte).
7. Grupos detectables solo en uno de los cuerpos.

Fuentes preferidas: earth.jpl.nasa.gov/emit, lpdaac.usgs.gov, pds-geosciences.wustl.edu, crism.jhuapl.edu, usgs.gov
(Tetracorder, splib07), ADS, JGR Planets, Icarus, Remote Sensing of Environment. Un umbral, un criterio o el rango de
operación de un instrumento no es un valor medido.

## Resultado

Equivalencias por grupo mineral:

| Grupo | Bandas diagnósticas (µm) | EMIT L2B | CRISM | M3 (Luna) |
| :-- | :-- | :-- | :-- | :-- |
| Yeso | 1.44, 1.49, 1.75, 1.94 | Gypsum (grupo 2) | BD1750_2, SINDEX2 | No detectable |
| Jarosita | 0.43, 0.91, 1.47, 1.85, 2.26 | Jarosite (grupos 1 y 2) | BD2250, BD920_2 | No detectable |
| Alunita | 1.43, 1.48, 1.76, 2.16 | Alunite | MIN2250, BD2165 | No detectable |
| Sulfatos monohidratados (kieserita) | 2.13, 2.40 | Kieserite / Szomolnokite | BD2100_2 | No detectable |
| Sulfatos polihidratados | 1.44, 1.93, 2.42-2.50 | Epsomite / polihidratado | SINDEX2, BD1900_2 | No detectable |
| Filosilicatos de Al | 1.41, 2.16, 2.21 | Kaolinite, Montmorillonite, Illite | BD2210_2, BD2165 | No detectable |
| Filosilicatos de Fe/Mg | 1.39-1.42, 2.29-2.32, 2.39 | Nontronite, Chlorite, Talc, Serpentine | D2300, BD2290 | No detectable |
| Carbonatos | 2.30-2.35, 2.50-2.55 | Calcite, Dolomite, Magnesite | MIN2295_2480 (Mg), MIN2345_2537 (Ca/Fe) | No detectable |
| Hematita | 0.53, 0.86-0.88 | Hematite | BD860_2, BD530_2 | No detectable |
| Goetita | 0.48-0.50, 0.90-0.94 | Goethite | BD920_2, SH600_2 | No detectable |
| Olivino | 0.85, 1.05, 1.25 | Olivine | OLINDEX3 | Sí (forma de la banda de 1 µm) |
| Piroxeno de bajo Ca | 0.90-0.93, 1.80-1.85 | Orthopyroxene | LCPINDEX2 | Sí (centros de banda menores de 0.95 y 1.95) |
| Piroxeno de alto Ca | 1.00-1.05, 2.10-2.30 | Clinopyroxene | HCPINDEX2 | Sí (centros mayores de 1.00 y 2.15) |
| Sílice hidratada / ópalo | 1.41, 1.92, 2.21, 2.26 | Opal | MIN2250, BD1900_2 | No detectable |
| Plagioclasa | 1.25-1.30 | Plagioclase / Anorthite | BD1300 | Sí (BD1250, anortosita pura) |
| Espinela de Mg | 2.00-2.05 | Spinel | BD2000 sin banda a 1 µm | Sí |
| Agua y OH | 2.82-3.00 | No detectable (EMIT llega a 2.5 µm y la atmósfera satura) | BD3000 | Sí (con corrección térmica) |
| Cloruros | Sin bandas en VNIR-SWIR | No detectable | Solo se infieren (ISLOPE1 y térmico de THEMIS) | No detectable |

**Síntesis**

- En la Luna solo se detectan minerales ígneos: olivino, piroxenos, plagioclasa y espinela. Los secundarios
  (sulfatos, arcillas, carbonatos, óxidos, sílice hidratada) no se detectan en la superficie lunar.
- En Marte se detectan casi todas las clases, sulfatos incluidos: en la Tierra con EMIT (clases de Tetracorder) y en
  Marte con los parámetros de CRISM.
- HyPyRameter (Phillips, Tai Udovicic, Moersch et al., The Planetary Science Journal, 2024-11-01, DOI
  10.3847/psj/ad81f8) calcula los parámetros de CRISM (Viviano-Beck et al. 2014, JGR Planets, DOI
  10.1002/2014je004627) sobre cualquier dato hiperespectral; se aplicó en Cuprite, Nevada, con AVIRIS. Licencia por
  verificar.
- Los cloruros no tienen bandas en el visible e infrarrojo cercano en ningún cuerpo; se infieren con el infrarrojo
  térmico.
- EMITL2BMIN V002 reporta clases de los grupos 1 y 2, profundidad de banda y ajuste, disponible desde 2022-08-09
  (https://cmr.earthdata.nasa.gov/search/collections.json). EMIT solo cubre zonas áridas entre 54°N y 54°S, por lo
  que sitios polares como Haughton, Axel Heiberg, Svalbard y la Antártida quedan fuera.
- EnMAP y PRISMA: sin producto global de minerales; solo escenas por pedido de 30 × 30 km, con registro y propuesta.
- ASTER SWIR solo hasta abril de 2008; los mosaicos continentales de CSIRO cubren solo Australia.
- Las fórmulas completas de los parámetros de CRISM están en Viviano-Beck et al. 2014.

## Preguntas abiertas

- Número de constituyentes de la biblioteca de EMIT (se cita "294"): sin comprobar en el ATBD.
- Aplicación de Tetracorder a CRISM (Clark et al. 2015; Swayze et al. 2016): referencias sin verificar.
- Licencia de HyPyRameter y su comportamiento sobre escenas de EMIT.

## Fuentes

- Viviano-Beck et al. 2014. https://api.crossref.org/works/10.1002/2014je004627 (consultado 2026-11-05)
- Phillips et al. 2024. https://doi.org/10.3847/psj/ad81f8 (consultado 2026-11-05)
- Colecciones de Earthdata. https://cmr.earthdata.nasa.gov/search/collections.json (consultado 2026-11-05)

## Relaciones

- [[I-07-armonizar-tierra-luna-marte]] — la comparación por clases
- [[I-22-indice-de-silice-comparable-entre-cuerpos]] — la parte del infrarrojo térmico
- [[sensores-tierra]], [[sensores-marte]], [[sensores-luna]] — EMIT, CRISM y M3
- [[dimensiones-innegociables]] — la dimensión 1
