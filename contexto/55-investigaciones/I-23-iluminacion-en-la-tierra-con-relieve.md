---
title: "I-23 — Cómo calcular la iluminación con relieve en la Tierra, comparable con la del polo sur lunar"
type: investigacion
status: vigente
date: 2026-11-05
updated: 2026-11-05
summary: "Qué productos o métodos dan la fracción de tiempo con sol directo por celda en la Tierra considerando el horizonte del relieve, y si existen mapas globales ya calculados, para comparar con la iluminación polar lunar de LOLA."
autor: fernando
tipo_investigacion: A
riesgo: critico
---

# I-23 — Iluminación con relieve en la Tierra

La luz (ángulo y duración del sol) es una variable de comparación del reto ([[dimensiones-innegociables]],
dimensión 3). En la Luna está calculada (LOLA, Mazarico et al. 2011); en la Tierra la radiación de NASA POWER es de 1°
y no considera el horizonte del relieve.

## Pregunta de investigación

¿Qué productos globales o métodos abiertos dan, por celda de la Tierra, la fracción de tiempo con sol directo o el
ángulo del horizonte considerando el relieve, para compararla con la iluminación polar de la Luna?

Datos externos de partida:

- Luna: iluminación polar de LOLA (Mazarico et al. 2011), fracción del ciclo con sol, 60 y 120 m/px.
- Tierra: NASA POWER ALLSKY_SFC_SW_DWN (1°, sin relieve); Copernicus DEM GLO-30.
- En el polo sur lunar el sol está siempre rasante y el relieve decide qué recibe luz.

Puntos a responder:

1. Productos globales de radiación solar o sombreado que consideran el horizonte del relieve: nombre, versión,
   resolución, cobertura (latitudes mayores de 60°), licencia, formato.
2. Herramientas abiertas que calculan horas de sol o fracción de sol directo con un DEM: nombre, licencia, qué
   calcula, tiempo de cálculo publicado.
3. Productos globales de factor de vista del cielo o ángulo del horizonte derivados de un DEM global.
4. Trabajos que comparen la iluminación de lugares de la Tierra con la del polo lunar.
5. Definición de la "fracción de tiempo iluminado" de Mazarico et al. 2011 (paso de tiempo, ciclo, horizonte).

Fuentes preferidas: earthdata.nasa.gov, power.larc.nasa.gov, grass.osgeo.org, pgda.gsfc.nasa.gov, ADS, Remote Sensing
of Environment, Solar Energy, Icarus. Un umbral, un criterio o el rango de operación de un instrumento no es un valor
medido.

## Resultado

No se encontró un mapa global de iluminación con relieve a 30 m. Productos y herramientas identificados:

**A 1 km, global:**

- CHELSA-W5E5 v1.0 (1 km, también por encima de 60°): radiación de onda corta que considera las sombras del horizonte
  y el factor de vista del cielo, con radio de hasta 10 km. DOI 10.48364/ISIMIP.836809.3 (DataCite): W5E5 v1.0
  reducido con CHELSA v2.0, publicado en 2022, licencia CC0 1.0.
- Factor de vista del cielo de Li et al. 2024 (ESSD, 2024-04-29, 1 km, global, CC BY 4.0).
  https://doi.org/10.5194/essd-16-2007-2024

Ninguno es "fracción de tiempo con sol directo".

**Herramientas para calcular con un DEM:**

- HORAYZON v1.2 (Steger et al. 2022, GMD, 2022-09-08): horizonte por acimut, factor de vista del cielo y sombras, con
  trazado de rayos y curvatura de la Tierra. https://doi.org/10.5194/gmd-15-6817-2022
- WhiteboxTools TimeInDaylight (MIT): fracción del tiempo diurno sin sombra del relieve, de 0 a 1.
- GRASS r.horizon y r.sun (GPL): r.sun también da la duración de la insolación directa.

**Global Solar Atlas:** cubre de 60°N a 55°S (CC BY 4.0, no abierto en la consulta).

**Definición de Mazarico et al. 2011:**

- fracción media del tiempo en que se ve el sol;
- el sol como disco extendido de unos 0.53°, no como un punto;
- horizonte por perfiles cada 0.5° a 1° de acimut, hasta 150-200 km, con curvatura;
- paso de tiempo de 6 h en el artículo y de 1 h en el catálogo de 2025;
- ciclo de 18.6 años en la Luna.

**Diferencia Tierra-Luna:** la Tierra tiene atmósfera y luz difusa; la Luna no.

Que la literatura descarte análogos naturales de iluminación rasante: no encontrado en las fuentes consultadas
(https://api.crossref.org/works/10.1109/AERO58975.2024.10521257).

## Preguntas abiertas

- Tiempo real de cálculo de r.sun y WhiteboxTools para áreas grandes, sin verificar en la fuente.
- Cobertura y licencia de Global Solar Atlas, sin abrir en la fuente.
- Factor de vista del cielo global a 30 m: no se encontró.

## Fuentes

- <https://doi.org/10.5194/essd-16-2007-2024>
- <https://doi.org/10.5194/gmd-15-6817-2022>
- <https://doi.org/10.1109/AERO58975.2024.10521257>
- <https://doi.org/10.48364/ISIMIP.836809.3>

## Relaciones

- [[dimensiones-innegociables]] — la dimensión 3
- [[sensores-luna]] — la iluminación polar de LOLA
- [[sensores-tierra]] — NASA POWER y Copernicus DEM
