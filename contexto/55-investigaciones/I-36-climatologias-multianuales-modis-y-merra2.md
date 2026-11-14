---
title: "I-36 — Filtros de calidad y climatologías ya publicadas de MODIS y MERRA-2"
type: investigacion
status: vigente
date: 2026-11-08
updated: 2026-11-08
summary: "Cómo filtrar por calidad y tratar los huecos por nubes en MYD11C3 y MOD13C1 en climatologías multianuales, y si ya existe una climatología publicada de LST, NDVI o velocidad de fricción."
autor: fernando
tipo_investigacion: B
riesgo: bajo
---

# I-36 — Filtros de calidad y climatologías ya publicadas

Consulta sobre filtros de calidad y manejo de nubes en MYD11C3 y MOD13C1 para climatologías multianuales (por ejemplo 2013–2022), y sobre si existen productos globales ya publicados de LST, NDVI máximo o frecuencia de velocidad de fricción.

**Hechos conocidos en las fuentes:**

- Aqua (MYD11C3, ~13:30 y ~01:30) y Terra (MOD11C3): desde 2021 las órbitas derivan (en 2026, Terra pasa ~9:00 y Aqua ~15:15).
- MOD11C3 trae `Clear_sky_days` y `Clear_sky_nights`.
- Escalas: LST × 0,02 = K; NDVI × 0,0001, relleno −3000.

## Prompt

```
I-36 — Filtros de calidad y climatologías publicadas de MODIS y MERRA-2

Esta es una consulta de datos puntuales con fuentes. No se busca una guía general de MODIS.

OBJETIVO
Saber cómo filtrar por calidad y tratar los huecos por nubes en MYD11C3 y MOD13C1 en climatologías multianuales, y si ya existe una climatología publicada de temperatura de superficie, NDVI o velocidad de fricción.

PRODUCTOS
MYD11C3 V061 (LST mensual de Aqua, 0,05°), MOD13C1 V061 (NDVI 16 días, 0,05°), MERRA-2 M2T1NXFLX (USTAR horario). Escala global.

PUNTOS A RESPONDER
1. Qué bits de QC_Day y QC_Night de MYD11C3 aceptan los trabajos publicados para climatologías, y cuántos días despejados mínimos piden por mes.
2. Qué filtro de VI Quality o pixel reliability de MOD13C1 aceptan antes de tomar el máximo o un percentil alto del NDVI.
3. Qué sesgo documentado deja el promedio de solo cielo despejado en la LST (más cálido de día, más frío de noche) y de cuánto es.
4. Si existe una climatología ya calculada de LST de MODIS (día y noche, o rango diario), con periodo, resolución, DOI y licencia.
5. Si existe una climatología ya calculada de NDVI máximo de MODIS, con periodo, resolución, DOI y licencia.
6. Si existe un producto ya calculado de frecuencia de velocidad de fricción sobre un umbral, o de frecuencia de levantamiento de arena, derivado de MERRA-2 o ERA5, con DOI y licencia.

ENTREGA
- Tabla: # | Punto | Respuesta | Fuente (enlace) | Fecha de la fuente | Certeza
- Certeza: Confirmado / Probable / No encontrado.

REGLAS
- Primero las guías de usuario oficiales de MOD11 y MOD13 (LP DAAC), la documentación de MERRA-2 (GMAO, GES DISC) y artículos con DOI.
- Si no se encuentra un dato, escribir "No encontrado". No deducirlo.
```

## Resultado

Según las fuentes consultadas (hallazgo 6), no hay climatología publicada de Aqua para 2013-2022.

### Hallazgos principales

1. **MYD11C3:** aceptar `QC & 3 ≤ 1` (LST producida) y error de LST ≤ 3 K (`QC >> 6 ≤ 2`). Es el criterio estándar de
   las climatologías globales; uno más estricto vacía las zonas nubosas.
2. **`Clear_sky_days` y `Clear_sky_nights` son campos de bits, no conteos:** un bit por día del mes (`uint32` en MYD11C3). El número de días sale de contar los bits en 1.
3. **Mínimo de días despejados:** el algoritmo oficial no pone umbral. En literatura (Sismanidis et al. 2022), un mes entra si tiene al menos 3 días despejados. La regla de "mínimo 12 días" de Agathangelidis y Cartalis 2018 corresponde a un estudio urbano.
4. **MOD13C1:** aceptar `pixel reliability ≤ 1` y descartar 2 (nieve), 3 (nubes) y **4 (estimado desde la climatología
   histórica)**; en los archivos oficiales el valor 4 corresponde a "[4]: Estimated".
5. **Sesgo de cielo despejado:** de día, la LST despejada es más cálida (+2 a +8 K en latitudes medias, poco en
   desiertos); de noche, más fría (~−2 K). Agranda el rango diario sobre todo en zonas nubosas; en zonas áridas el sesgo es pequeño. Varias fuentes provienen de estaciones de EE. UU. o Groenlandia: valen como orden de magnitud, no como corrección global.
6. **Climatologías de LST publicadas:** OpenLandMap es de Terra (MOD11A2), de 2000 a 2020 (Zenodo v1.1, licencia CC BY-SA 4.0); Metz et al. es de 2003 a 2016; Bechtel, de 2003 a 2014. Ninguna usa Aqua en 2013 a 2022.
7. **Viento:** no existe una frecuencia de u* sobre umbral ya calculada. **iDust-ut** (CC BY 4.0, v1.5, 2026-03-03, en Zenodo) da umbral de viento global ajustado a MERRA-2 y ERA5, pero en viento a 10 m, no en u*.

### Limitaciones y preguntas abiertas

- En zonas con noche polar pueden quedar meses sin datos válidos.
- Pasar iDust-ut (viento a 10 m) a u* requiere relacionarlo con la rugosidad superficial.

### Bibliografía

- `[O]` LP DAAC, MOD11 User Guide V6.1 — https://lpdaac.usgs.gov/documents/715/MOD11_User_Guide_V61.pdf — consultado 2026-11-08.
- `[O]` LP DAAC, MOD13 User Guide V6.1 — https://lpdaac.usgs.gov/documents/621/MOD13_User_Guide_V61.pdf — consultado 2026-11-08.
- `[O]` iDust-ut v1.5 — https://zenodo.org/records/18849600 — consultado 2026-11-08 (CC BY 4.0).
- `[O]` OpenLandMap, LST de largo plazo v1.1 — https://zenodo.org/records/6458406 — consultado 2026-11-08 (CC BY-SA 4.0, Terra).
- `[P]` Ermida et al. 2019, sesgo de cielo despejado — https://doi.org/10.1029/2018JD029354 — consultado 2026-11-08.
- `[P]` Sismanidis et al. 2022 — https://doi.org/10.3390/rs14102318 — consultado 2026-11-08.

## Relaciones

- [[I-28-viento-como-numero-de-shields]] — umbral y cálculo de USTAR
- [[I-32-tormentas-de-polvo-en-marte-y-analogos-terrestres]] — emisión y frecuencia de polvo
- [[I-11-sesgo-por-escala-de-cada-variable]] — sesgos por resolución
