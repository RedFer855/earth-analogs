---
title: "I-35 — Cómo procesaron otros un DEM global por teselas: bordes, polos y tiempos"
type: investigacion
status: vigente
date: 2026-11-08
updated: 2026-11-08
summary: "Cómo calcularon pendiente, rugosidad y relieve sobre todo un DEM global de 90 m los proyectos publicados (Geomorpho90m, EarthEnv-Topography y otros), qué problemas tuvieron con bordes de tesela, latitudes altas, huecos y el antimeridiano, y cuánto tardaron."
autor: fernando
tipo_investigacion: B
riesgo: critico
---

# I-35 — Cómo procesaron otros un DEM global por teselas

Consulta sobre el cálculo global de derivadas topográficas (pendiente, rugosidad y relieve relativo) sobre Copernicus DEM GLO-90 por teselas, el tratamiento de bordes sin solape, las latitudes altas y la máscara de agua.

## Prompt

```
I-35 — Procesar un DEM global por teselas

Esta es una consulta sobre cómo lo resolvieron otros proyectos, con fuentes. No se busca una guía general de SIG.

OBJETIVO
Saber cómo calcularon pendiente, rugosidad (TRI, desviación) y relieve relativo sobre un DEM global de ~90 m los proyectos publicados, qué problemas tuvieron y cómo los resolvieron.

PUNTOS A RESPONDER
1. Qué proyectos publicados calcularon pendiente o rugosidad sobre todo el planeta a 30-250 m (Geomorpho90m de Amatulli et al. 2020, EarthEnv-Topography, otros con Copernicus DEM): con qué DEM, resolución, software y proyección.
2. Cómo trataron los bordes de tesela: tamaño del solape o "halo" en píxeles, mosaico VRT, o cálculo por bloques. Qué error midieron sin solape.
3. Cómo corrigieron la deformación por latitud al calcular pendiente en coordenadas geográficas (factor de escala, reproyección por tesela o por franja) y qué hicieron por encima de 60° y cerca de los polos.
4. Qué hicieron con huecos (voids), artefactos de agua y bordes de costa en Copernicus DEM, y con el antimeridiano (180°).
5. Tiempos de cálculo y hardware reportados para la Tierra entera.
6. Errores o artefactos conocidos de GLO-90 que afecten pendiente y rugosidad (rayas, terrazas, edificios y bosque como relieve).
7. Si algún proyecto publicó un producto global de pendiente o rugosidad a 90-250 m ya calculado desde Copernicus DEM, con licencia y enlace.

ENTREGA
- Tabla: # | Punto | Respuesta | Fuente (enlace) | Fecha de la fuente | Certeza
- Certeza: Confirmado / Probable / No encontrado.

REGLAS
- Primero artículos con DOI (ESSD, Scientific Data, Remote Sensing of Environment), la documentación de Copernicus DEM (ESA/Airbus) y repositorios de código de esos artículos.
- Si no se encuentra un dato, escribir "No encontrado". No deducirlo.
- Toda cifra de tiempo con el hardware que la produjo.
```

## Hechos externos de partida

- Copernicus DEM GLO-90 (release 2024_1) se distribuye en ~26 000 teselas COG de 1°, con máscara de agua WBM.
- GLO-90 es un DSM (incluye vegetación y edificios) referido a EGM2008; el ancho en longitud de las teselas cambia con la latitud.
- La máscara de agua viene en `AUXFILES/<tesela>_WBM.tif`; clase 1 = océano.

## Hallazgos de la literatura y documentación

1. **Halo de las vecinas.** Según las fuentes, ningún proyecto global calculó pendiente tesela por tesela sin
   solape (Geomorpho90m, GEDTM30, Hydrography90m). Las COG de AWS quitaron la fila y la columna que compartían las
   teselas originales. La documentación describe un VRT con todas las teselas que permite leer cada ventana más un borde de ~0.02° antes de reproyectar y recortar después.
2. **Máscara de agua.** GEDTM30 enmascaró las clases de agua de la WBM (1, 2 y 3), no solo el océano, antes de calcular pendiente; encontró ruido sobre lagos que contamina la pendiente.
3. **Reproyección local por tesela y antimeridiano:** según las fuentes, reproyectar cada tesela en métrica plana evita la distorsión este-oeste de las coordenadas geográficas; en las teselas junto a ±180°, el halo toma vecinas del otro lado del antimeridiano. Al agregar de 90 m a ~200 m, las fuentes indican que no hace falta remuestreo cúbico para subir de resolución en latitudes altas.
4. **Producto ya publicado:** la pendiente de GEDTM30 a 240 m (CC BY 4.0, 4.88 GB, v1.2.0, en Zenodo). Es un modelo de terreno sin bosques ni edificios, calculado con polinomio de 5×5 sobre fusión de varios DEM.
5. **Anchos de tesela por latitud** (readme de AWS): 1200 px hasta 49°, 800 de 50° a 59°, 600 de 60° a 69°, 400 de 70° a 79° y 240 desde 80°; el ancho en longitud es 3x entre 70° y 80° y 5x entre 80° y 85°.

### Limitaciones y riesgos documentados

- Sin solape/halo se introducen discontinuidades de pendiente en los bordes de tesela; nadie ha publicado una medida estándar del error exacto sin halo.
- Sin enmascarar clases WBM 1-3, los lagos introducen artefactos o pendientes falsas.
- GLO-90 es un DSM: bosques y edificios introducen rugosidad falsa, especialmente en zonas húmedas o urbanas.
- Los huecos originales rellenados con SRTM o ASTER en alta montaña pueden generar costuras locales.
- Las cifras de error bajo cobertura forestal publicadas provienen de estudios locales de validación y no constituyen una evaluación global homogénea.
- Los tiempos publicados corresponden a HPC con cientos de GB de RAM; no hay cifras para estaciones de escritorio.

### Bibliografía

- `[O]` Copernicus DEM en AWS, readme — https://copernicus-dem-30m.s3.amazonaws.com/readme.html — consultado 2026-11-08.
- `[O]` GEDTM30, pendiente en grados v1.2.0 — https://zenodo.org/records/18702594 — consultado 2026-11-08 (CC BY 4.0, 240 m = 4.88 GB).
- `[O]` Amatulli et al. 2020, Geomorpho90m — https://doi.org/10.1038/s41597-020-0479-6 — consultado 2026-11-08.
- `[O]` Ho et al. 2025, GEDTM30 — https://doi.org/10.7717/peerj.19673 — consultado 2026-11-08.
- `[O]` Amatulli et al. 2022, Hydrography90m — https://doi.org/10.5194/essd-14-4525-2022 — consultado 2026-11-08.
- `[O]` Copernicus DEM Product Handbook v6.1 — https://dataspace.copernicus.eu/sites/default/files/media/files/2026-10/geo1988-copernicusdem-spe-002_producthandbook_i6.1.pdf — consultado 2026-11-08.
- `[P]` Purinton y Bookhagen 2021 — https://doi.org/10.3389/feart.2021.758606 — consultado 2026-11-08.
- `[P]` Guth et al. 2025 — https://www.mdpi.com/2072-4292/17/23/3919 — consultado 2026-11-08.

## Relaciones

- [[I-07-armonizar-tierra-luna-marte]] — armonización entre cuerpos
