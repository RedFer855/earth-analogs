---
title: "Deuda resuelta 2026"
type: deuda
status: vigente
date: 2026-11-14
updated: 2026-11-15
summary: "Pendientes cerrados en 2026, con cómo se cerraron."
autor: fernando
---

# Deuda resuelta 2026

Cerrados el 2026-11-14 en la rama `feat/etl-mejoras` y corridos con `audit/audit.py`
([[2026-11-14-fernando-etl-corridas-finales]]).

### P-001 — Objetivos de la Luna y Marte a la escala de la celda

`etl/objetivos_comun.py` parte cada sitio en parches de ~1.6 km, calcula ahí las métricas de E-03 con las mismas
funciones (`horn`, `ventana`, `cuantil`) y resume el sitio con mediana y MAD. Lo usan `e11_luna.py` y `e12_marte.py`;
E-11 y E-12 corrieron ok.

### P-002 — THEMIS solo en el centro del sitio

`themis()` en `etl/e12_marte.py` muestrea cada 200 m en todo el círculo y sobre todos los cuadros que lo cubren.

### P-004 — Polvo con QA 3 y DOD > 0.5

`etl/e08_viento_polvo.py` lee `foo_dod3_gt_threshold` (QA 3) y escribe `polvo_frec_dod02_pct`, `_dod05_pct` y
`_dod1_pct`. E-08 corrió ok.

### P-005 — Máscaras de agua en ASTER y MODIS

`etl/e09_material.py` recorta cada tesela de ASTER GED a 99x99 y pone `NaN` donde `LWmap != 0`;
`etl/e04_temperatura.py` exige `Percent_land_in_grid >= 50`. `etl/e05_ndvi.py` usa solo los periodos en que
"VI Quality" marca tierra (bits 11-13 == 1, según la guía MOD13 C6.1); la cobertura de `ndvi_max` baja de 89.0 % a
83.8 % y la de `ndvi_max_clim` de 88.7 % a 80.7 % (píxeles de 0.05° con costa, orilla o agua interior). Que una celda
sin NDVI no pase el filtro de vegetación del motor queda como decisión abierta del equipo.

### P-006 — Temperatura: media, amplitud y años emparejados

`etl/e04_temperatura.py` agrega `lst_media_k`, exige 11 meses para las métricas anuales y calcula el rango diurno con
día y noche del mismo año-mes. E-04 corrió ok.

### P-007 — `etl/e14_extras.py` fuera de git

Sus columnas quedaron repartidas en E-04, E-07, E-08 y E-09. El script y sus columnas viejas se retiraron de la
carpeta de corrida para que E-13 no los incluya en el manifiesto.

### P-003 — Variables de Marte y la Luna que faltan

- Luna (E-11): iluminación de Mazarico (fracción del tiempo con Sol: mediana, MAD y p90 por región; mapa de 60 m
  donde la región cabe y de 120 m para N2, MP y CB), fracción de sombra permanente (PSR) y CPR de Mini-RF (mediana,
  MAD y p90). Sin equivalente terrestre global: quedan en `ausentes` y `advertencias`.
- Marte (E-12): clima de superficie de la Mars Climate Database 6.2 (escenario climatológico, EUV medio) leído de sus
  NetCDF sin compilar el código Fortran: temperatura media, máxima y mínima, rango diurno, amplitud anual y presión.
  La presión se corrige por la diferencia entre la elevación del sitio y la orografía del modelo (hidrostática con la
  temperatura del nivel más bajo); la temperatura no se corrige. Licencia de uso local: todos los campos van en
  `local_only` y el manifiesto los lista (ADR-007, regla 6).
- Ya estaban resueltos: E-12 guarda las 13 capas de TES y E-11 pone a NaN el sin dato de LOLA 20 m.
- Viento de Marte sigue en `ausentes`: no lo pedía este ítem.

### P-008 — Columnas que faltan y nombres del contrato con el motor

- Paso nuevo E-15 (`etl/e15_capas_30m.py`): `agua_ocurrencia_media_pct` y `agua_frac_ocurrencia_gt0` (JRC GSW
  v1.5), `dunas_frac` (GSDP30), `arena_frac` (GSDS30) y `agua_humedal_area_pct` (GLWD v2 `area_pct`, que suma las
  33 clases, lagos y ríos incluidos; por eso no se llama `humedal_area_pct`). Fuera de la extensión de cada producto
  la celda queda en NaN; dentro y sin rasgo, en 0.
- El manifiesto trae `nivel_healpix`, `n_celdas`, `arbol_limpio` y `local_only`.
- Nombres de columna: los del ETL son el contrato (ADR-007, regla 8).

### P-009 — `slope_mean_deg` con pendientes sobre bloques de agua aislados

E-03 terreno se rehízo con la máscara del centro de Horn. En lugar de recalcular las 25 755 teselas se usó
`etl/e03_indice_afectadas.py`: una tesela cambia solo si tiene un píxel de agua o sin dato propio, o si toca el
antimeridiano (18 172 afectadas, 7 583 sanas). Validación: 891 teselas sanas recalculadas en la corrida completa
dieron sumas idénticas bit a bit a las viejas. Resultado: los puntos de control no cambian (Everest 43.24°, Erg Chech
1.32°), la cobertura pasa de 98.829 % a 98.827 % y la mediana de 1.1554° a 1.1555°. Pruebas en
`etl/test_e03_indice.py`.

### P-010 — Comparar tablas por coordenada, no por `ipix`

`etl/cruce.py` lleva las celdas de otra tabla a la malla por latitud geodésica y longitud con `celda_de`, y deja NaN
donde no hay pareja. Pruebas en `etl/test_cruce.py`.

### P-014 — E-13 tardaba unos 10 minutos y no por leer las columnas

La revisión de las 76 columnas cuesta 31 s (0 s con la caché por columna). El tiempo estaba en la relectura
independiente: `_pixel` abría la fuente en cada celda y la aridez se descomprimía de su ZIP una y otra vez. Ahora cada
fuente se abre una sola vez. Con la misma muestra de 60 celdas: aridez de 191 s a 5 s y NDVI de 18 s a 2 s, con
resultado idéntico (`etl/test_e13_incremental.py`, `etl/e13_manifiesto.py`).

### P-011 — Conectar la tabla con el motor de búsqueda

Falta decidir cómo el motor de búsqueda consume la tabla del ETL. Los nombres de columna del ETL son el contrato
(ADR-007 regla 8), así que la conexión no debe renombrar columnas que miden otra cosa: `arena_frac` es arena móvil y
semifija, y la búsqueda necesita solo la móvil. Los perfiles de búsqueda se calculan sobre la tabla actual.

Cerrado el 2026-11-15 (ADR-010): el motor lee `$RUN` tal cual, con los nombres del ETL, sin adaptador ni copia. Los
perfiles los escribe el paso E-20 sobre la tabla actual. Se encontró y corrigió además que la tabla guarda latitud
geodésica y HEALPix trabaja en autálica (hasta 0.128° de diferencia).

## Relaciones

- [[abierta]] — pendientes abiertos
