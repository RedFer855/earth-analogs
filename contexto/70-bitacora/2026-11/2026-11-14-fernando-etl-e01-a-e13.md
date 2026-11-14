---
title: "Sesión 2026-11-14 — ETL de E-01 a E-13 con auditoría"
type: sesion
status: vigente
date: 2026-11-14
updated: 2026-11-14
summary: "Se escribió y corrió el ETL completo (malla, terreno, temperatura, NDVI, aridez, permafrost, viento y polvo, material, agua, objetivos de la Luna y Marte, manifiesto), cada paso con su comprobación y su registro de auditoría; los errores encontrados quedaron corregidos y registrados."
autor: fernando
agente: claude-code
modelo: opus-5.5
rama: feat/etl-e03-terreno
scope: [etl/, audit/audit.py]
symbols: []
---

# Sesión 2026-11-14 — ETL de E-01 a E-13 con auditoría

## Problema o motivo

Correr el plan del ETL ([plan del ETL](../../../docs/etl-plan.md)) de punta a punta, con el entorno fijado, una
comprobación por paso y cada corrida en el registro de auditoría.

## Cambios

- `etl/pixi.toml`, `etl/pixi.lock` → entorno fijado (Python 3.12, GDAL 3.13 con HDF4, HDF5 y netCDF, astropy,
  cdshealpix 0.9).
- `etl/e01_malla.py` → malla HEALPix nivel 12 de tierra (WBM distinto de océano), latitud autálica en la esfera.
- `etl/e02_fuentes.py` → apertura de una muestra de cada fuente, periodos de las series y disco libre.
- `etl/e03_terreno.py` → pendiente a ~180 m con halo, agua enmascarada a 90 m y suma por celda.
- `etl/e04_temperatura.py` a `etl/e10_agua.py` → una columna por capa, con su entrada de manifiesto.
- `etl/e11_luna.py`, `etl/e12_marte.py` → valores objetivo de las 9 regiones de Artemis y de 12 sitios de Marte.
- `etl/e13_manifiesto.py` → manifiesto, comprobaciones de tabla y relectura independiente.
- `etl/sitios/` → regiones de la Luna (USGS, I-17) y lista de 12 sitios de Marte con radio de 50 km.
- `audit/audit.py` → candado al agregar eventos, para correr pasos en paralelo sin romper la cadena.

## Verificación

- Pruebas: `pixi run pruebas` en `etl/` y las de `audit/`.
- Cada paso con su comprobación (puntos conocidos, rangos, coberturas); el detalle está en `$RUN/columns/eNN.json`
  y en el registro de auditoría.
- E-13: relectura independiente de aridez y NDVI, y pendiente comparada con un método distinto (GLO-90 crudo a UTM
  200 m y `gdaldem slope`) en celdas al azar.
- Resultados medidos hoy (detalle en `$RUN/manifest.json` y en el registro):
  - malla: 58 817 178 celdas de tierra, de unos 2.5 km² cada una;
  - 37 columnas, todas del largo de la malla y sin infinitos;
  - aridez releída en 270 celdas: 0 distintas; NDVI en 192 celdas: 0 periodos mayores que el máximo;
  - pendiente contra el método UTM en 40 celdas sin agua: error mediano 0.18°, p90 0.84°;
  - E-11: el día es más cálido que la noche en el 99.07 % del mapa polar de Diviner;
  - E-12: la hematita máxima de TES entre 60° S y 60° N cae en Meridiani.

## Errores encontrados y corregidos

- E-01 leyó una sola tesela por un error al interpretar el nombre; la comprobación no lo vio. Se corrigió el código
  y se agregó la comprobación de teselas leídas.
- E-02 no buscaba en subcarpetas.
- E-03 iba lento por hilos de cdshealpix compitiendo entre procesos; la unión abría demasiados archivos a la vez.
- E-08 tomaba mal la forma del arreglo de emisión de polvo; MODFDS ahora exige 60 meses válidos.
- E-09 corría EMIT media celda hacia el lado contrario de la esquina.
- E-10 iba lento (una celda por píxel de 90 m); ahora cuenta por bloques de 2x2.
- E-11 comprobaba día y noche solo dentro de las regiones polares, donde la hora local no los separa: ahora en el
  mapa completo.

## Mejoras de la tarde

- E-07 lee el permafrost hasta 10° S: el raster polar de Obu llega hasta unos 7° S y antes se cortaba en 25° N.
- E-05 agrega `ndvi_max_clim` (media de los máximos anuales) y `ndvi_media`.
- `etl/e03_extras.py` agrega `slope_p90_deg`, `slope_p99_deg`, `slope_frac_gt15`, `elev_mean_m`, `elev_std_m` y
  `relieve_m`: cada celda entera en la tesela de su centro, con halo en número par de píxeles para que los bloques
  coincidan con E-03. Comprobación: la pendiente media recalculada coincide con `slope_mean_deg` (diferencia mediana
  menor que 0.01°); solo difieren celdas en los límites de franja de latitud de GLO-90.

## Lo que no cambió

- Mars Climate Database: no se usó (uso local, pendiente).
- Dunas y arena a 30 m (GSDP30, GSDS30): no se corrieron.

## Pendientes

- Revisar la lista de 12 sitios de Marte y el radio de 50 km.
- Coordenadas de cuatro aterrizajes marcadas como no verificadas en `etl/sitios/objetivos-marte.json`.
- Cómo se registra el segundo nodo en la auditoría.

## Relaciones

- [[ADR-002-malla-primero-y-una-columna-por-capa]] — la malla y las columnas
- [[ADR-005-regla-de-escala-de-pendiente-y-rugosidad]] — la pendiente
- [[ADR-008-calidad-de-la-tabla-y-manifiesto]] — las comprobaciones
