---
title: "Deuda resuelta 2026"
type: deuda
status: vigente
date: 2026-11-14
updated: 2026-11-14
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
`etl/e04_temperatura.py` exige `Percent_land_in_grid >= 50`. La máscara del NDVI (MOD13C1) sigue sin hacerse: el NDVI
no puntúa la semejanza.

### P-006 — Temperatura: media, amplitud y años emparejados

`etl/e04_temperatura.py` agrega `lst_media_k`, exige 11 meses para las métricas anuales y calcula el rango diurno con
día y noche del mismo año-mes. E-04 corrió ok.

### P-007 — `etl/e14_extras.py` fuera de git

Sus columnas quedaron repartidas en E-04, E-07, E-08 y E-09. El script y sus columnas viejas se retiraron de la
carpeta de corrida para que E-13 no los incluya en el manifiesto.

## Relaciones

- [[abierta]] — pendientes abiertos
