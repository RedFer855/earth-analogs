---
title: "I-10 — Máscaras de agua globales y cómo tratan salares, hielo y depresiones"
type: investigacion
status: vigente
date: 2026-11-04
updated: 2026-11-04
summary: "Qué máscaras de agua terrestres globales existen, a qué resolución, y si marcan como agua o como tierra los salares, lagos secos, hielo, costas y zonas en tierra bajo el nivel del mar."
autor: fernando
tipo_investigacion: A
riesgo: critico
---

# I-10 — Máscaras de agua globales y cómo tratan salares, hielo y depresiones

Evalúa si las máscaras globales de agua permiten excluir el mar sin usar la altura, para no borrar depresiones continentales bajo el nivel del mar como Danakil, el Valle de la Muerte o el Mar Muerto.

## Prompt

```
I-10 — Máscaras de agua terrestres

IMPORTANTE: Esta es una consulta de datos puntuales. No escribas una guía general, no repitas información de contexto y no hagas recomendaciones.

OBJETIVO
Para cada máscara de agua global de la lista, ¿a qué resolución viene, cómo se descarga y si clasifica como agua o como tierra los salares, lagos secos, hielo, costas y zonas de tierra bajo el nivel del mar?

CONTEXTO (solo lo que cambia la respuesta)
- Criterio de evaluación: identificar máscaras gratuitas compatibles con GDAL que excluyan el océano sin excluir desiertos salinos, hielo ni depresiones continentales bajo el nivel del mar.

YA SABEMOS (no investigar ni repetir)
- Copernicus DEM trae una capa de agua (WBM) por tesela.
- Danakil, el Valle de la Muerte y el Mar Muerto están bajo el nivel del mar.

MÁSCARAS
1. Copernicus DEM Water Body Mask (WBM)
2. MODIS Land Water Mask (MOD44W)
3. JRC Global Surface Water (ocurrencia y estacionalidad)
4. ESA WorldCover (clases de agua, nieve y hielo, suelo desnudo)
5. Otra máscara global de océano y tierra a 1 km o menos, si existe

PUNTOS A RESPONDER (por máscara)
1. Producto y versión vigente, resolución y años que cubre.
2. Formato, si GDAL lo abre y cómo se descarga (cuenta si la pide).
3. Clases o valores y qué significa cada uno.
4. ¿Distingue mar de agua continental?
5. ¿Cómo clasifica salares y lagos secos (Salar de Uyuni, Bonneville) y lagos estacionales?
6. ¿Cómo clasifica hielo y glaciares (Antártida, Groenlandia)?
7. ¿Usa la altura para decidir qué es agua? Si sí, ¿cómo trata la tierra bajo el nivel del mar (Mar Muerto, Danakil, Qattara)?
8. Licencia y cómo se cita.

ENTREGA
- Tabla: # | Máscara | Punto | Respuesta | Fuente oficial (enlace) | Fecha de la fuente | Certeza
- Certeza: Confirmado / Probable / No encontrado.
- Máximo 200 palabras fuera de la tabla con contradicciones o advertencias. Sin introducción ni conclusiones.

REGLAS
- Primero documentación oficial: spacedata.copernicus.eu, lpdaac.usgs.gov, earthdata.nasa.gov, global-surface-water.appspot.com, esa-worldcover.org.
- Blogs y foros solo si no hay fuente oficial, con certeza Probable.
- Si no encuentras un dato, escribe "No encontrado". No lo deduzcas.
```

## Resultado

Evaluación de las cinco máscaras globales bajo los ocho criterios. Ninguna utiliza la elevación para clasificar agua, de modo que excluir el océano no elimina depresiones continentales secas como Danakil, el Valle de la Muerte o la orilla seca del Mar Muerto.

### Resumen

| Máscara | Resolución | Separa mar | Salares secos | Hielo | Licencia |
| :-- | :-- | :-- | :-- | :-- | :-- |
| Copernicus DEM WBM (release 2024_1) | 30 o 90 m, misma tesela que el DEM | Sí: 1 océano, 2 lago, 3 río, 0 sin agua | Sin regla publicada | Agua congelada cuenta como tierra (0) | Gratuita con aviso de DLR y Airbus |
| MOD44W V061 | 250 m, anual 2000- | Solo en la capa `Seven_class` | Tierra si el agua dura menos de la mitad del año | Tierra; falsos positivos en márgenes de Groenlandia | Dominio público |
| JRC Global Surface Water v1.5 | 30 m, 1984-2024 | No: quita el mar abierto, no etiqueta la costa | 0 seco; agua estacional mientras está inundado | Glaciares excluidos; Antártida fuera | Copernicus, sin restricción |
| ESA WorldCover 2021 v200 | 10 m | No: mar y lagos son la clase 80 | Clase 60 (suelo desnudo) | Clase 70; Antártida fuera | CC BY 4.0 |
| ASTWBD V001 | 30 m, 83° N-83° S | Sí: océano, río y lago | Sin regla publicada | Tierra | Abierta |

### Verificado en la fuente

| # | Dato verificado | Fuente `[O]` | Fecha |
| :-- | :-- | :-- | :-- |
| 1 | WBM de Copernicus (manual v6.1, 2026-10-09, tabla 8): `0` sin agua, `1` océano, `2` lago, `3` río. | https://dataspace.copernicus.eu/sites/default/files/media/files/2026-10/geo1988-copernicusdem-spe-002_producthandbook_i6.1.pdf | 2026-11-04 |
| 2 | MOD44W V061: 250 m, DOI `10.5067/MODIS/MOD44W.061`. | https://www.earthdata.nasa.gov/data/catalog/lpcloud-mod44w-061 | 2026-11-04 |
| 3 | JRC GSW (actualizado el 2026-10-15): 1984-2024, gratuito y sin cuenta; ocurrencia `0` = no agua, `1-100` %, `255` sin dato. El hielo se trata como observación no válida. Según la guía v5, estacionalidad e historia mensual/anual en v1.5 cubren de 2022 a 2024 (de 2016 a 2021 requiere combinar con la entrega previa). | https://global-surface-water.appspot.com/download · https://storage.googleapis.com/water-world/downloads_ancillary/DataUsersGuidev2024_v.5.pdf | 2026-11-04 |
| 4 | ESA WorldCover v200: CC BY 4.0, sin restricción; cubre toda la tierra observada por Sentinel-2 excepto la Antártida, hasta 82.75° N. | https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/docs/WorldCover_PUM_V2.0.pdf | 2026-11-04 |
| 5 | ASTWBD V001 distingue océano, río y lago desde 0.2 km² (códigos de clase a inspeccionar con `gdalinfo` en los archivos). | https://www.earthdata.nasa.gov/s3fs-public/2025-04/ASTWBD_User_Guide_V1.pdf | 2026-11-04 |

Quedan pendientes de confirmación en fuente oficial el aviso de falsos positivos de MOD44W en los márgenes de Groenlandia y el posible intercambio de metadatos entre las clases 4 y 5 de `Seven_class`.

## Relaciones

- [[sensores-tierra]] — compendio de datasets terrestres
- [[I-06-datasets-terrestres-formato-y-procesamiento]] — fuentes y preprocesamiento de datasets terrestres
