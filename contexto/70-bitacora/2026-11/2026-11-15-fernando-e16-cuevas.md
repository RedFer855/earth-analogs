---
title: "Sesión 2026-11-15 — Paso E-16 de tubos de lava (Pyroduct v3.0)"
type: sesion
status: vigente
date: 2026-11-15
updated: 2026-11-15
summary: "Se curaron 57 entradas verificadas (55 sistemas únicos) de Pyroduct Digital Catalog v3.0 con fuentes abiertas, se implementó el paso E-16 (cueva_n_tubos y cueva_dist_km) y se regeneró el manifiesto E-13 con 78 columnas y cadena de auditoría íntegra."
autor: fernando
agente: antigravity
modelo: por-confirmar
rama: feat/etl-cuevas
scope:
  - etl/e16_cuevas.py
  - etl/test_e16_cuevas.py
  - etl/sitios/cuevas-pyroduct-coordenadas.json
  - audit/etl-log.jsonl
  - docs/data-sources.md
  - docs/etl-plan.md
  - contexto/55-investigaciones/I-46-coordenadas-de-bocas-de-tubos-de-lava.md
symbols:
  - leer_codigos_zip
  - cargar_cuevas_verificadas
  - agregar_tubos_en_malla
  - distancia_minima_km
  - comprobar_puntos
  - correr
---

# Sesión 2026-11-15 — Paso E-16 de tubos de lava (Pyroduct v3.0)

## Problema o motivo

El índice de `Pyroduct_Digital_Catalog_v3.0.zip` (119 tubos de lava y una fila final `NOTES:`) no incluye coordenadas geográficas en la tabla `.xlsx` ni en los primeros archivos `.txt` inspeccionados. Para integrarlo en la malla HEALPix de nivel 12 (`58,817,178` celdas) era necesario curar y contrastar coordenadas desde fuentes abiertas compatibles comercialmente y agregar un paso específico del ETL (**E-16**) que escribiera columnas separadas según [[ADR-002-malla-primero-y-una-columna-por-capa]] y [[ADR-006-valores-faltantes-y-cobertura]].

## Cambios

- [etl/sitios/cuevas-pyroduct-coordenadas.json](../../etl/sitios/cuevas-pyroduct-coordenadas.json) → tabla curada de los 119 tubos de Pyroduct v3.0 (documentando en `fila_notas_omitida` la exclusión de la fila `NOTES:`): **57 filas verificadas** que representan **55 sistemas únicos** (agrupando `AU.QLD.00`/`AU.QLD.01` en `barkers_cave` y `US.HAW.18`/`US.HAW.19` en `kazumura`) en 8 países (`IT`, `ES`, `US`, `JO`, `JP`, `AU`, `PT`, `IC`), bajo licencias `ODbL 1.0`, `CC0 1.0` y `CC BY 4.0`. Las 62 filas restantes permanecen en `lat: null, lon: null` (2 protegidas: `US.NMX.01`, `ES.LNZ.04`; 2 de actualización futura: `CN.TCG.00`, `CN.TIA.00`; 58 sin boca pública verificable o solo con centroides de parroquia/municipio).
- [etl/e16_cuevas.py](../../etl/e16_cuevas.py) → paso **E-16** del ETL: valida la lista curada contra `Pyroduct_Digital_Catalog_v3.0.zip`, cuenta sistemas únicos por celda (`cueva_n_tubos`, `NaN` fuera de las celdas con cueva) y calcula la distancia geodésica esférica mínima (`RADIO_TIERRA_KM = 6371.0072`) hasta la boca verificada más cercana (`cueva_dist_km`).
- [etl/test_e16_cuevas.py](../../etl/test_e16_cuevas.py) → pruebas unitarias para `E-16` y los invariantes del JSON curado (sin `CC BY-NC`, filas no verificadas en `null`, agrupación de entradas del mismo sistema y métricas haversine).
- [contexto/55-investigaciones/I-46-coordenadas-de-bocas-de-tubos-de-lava.md](../55-investigaciones/I-46-coordenadas-de-bocas-de-tubos-de-lava.md) → pasada a `vigente` con resumen de curación y tabla de contraste haversine entre pares de fuentes independientes (12 entradas verificadas entre 2.2 m y 215.9 m, además del rechazo explícito de centroides parroquiales repetidos en Azores).
- [docs/data-sources.md](../../docs/data-sources.md) y [docs/etl-plan.md](../../docs/etl-plan.md) → incorporan las fuentes abiertas de coordenadas de cuevas con sus licencias (`ODbL 1.0`, `CC0 1.0`, `CC BY 4.0`) y la fila y regla del paso `E-16`.
- [audit/etl-log.jsonl](../../audit/etl-log.jsonl) → registra las corridas auditadas de `E-16` y la regeneración de `E-13`.

## Verificación

- **Corrida auditada `E-16`** (`pixi run python e16_cuevas.py`, `181.4 s`, `resultado: ok`): generó `$RUN/columns/cueva_n_tubos.f32`, `$RUN/columns/cueva_dist_km.f32` y `$RUN/columns/e16.json`; 55 sistemas únicos en 51 celdas HEALPix (`fuera_de_malla: []`), 4 de 4 comprobaciones puntuales en verde, `cueva_dist_km` con 100.0 % de cobertura (`p1: 274.69 km`, `p50: 3040.93 km`, `p99: 8624.86 km`, `máx: 9889.47 km`).
- **Corrida auditada `E-13`** (`pixi run python e13_manifiesto.py 300`, `908.9 s`, `resultado: ok`): regeneró `$RUN/manifest.json` (183,007 B) con 78 columnas incluyendo `cueva_n_tubos` y `cueva_dist_km`, `fallos: []`, `avisos: []` y relecturas independientes en verde (`aridez_ai`: 270/270 exactas; `ndvi_max`: 184/184 válidas; `slope_mean_deg`: error mediano `0.176°` en 40 celdas).
- **Pruebas unitarias y verificación automática**: `pixi run pruebas` en `etl/` (`Ran 73 tests — OK`), `python -I -m unittest discover -s audit -p "test_*.py"` (`Ran 7 tests — OK`), `node audit/verificar.mjs` (`105 línea(s), cadena íntegra`), `node scripts/contexto/build-index.js` + `verificar.js` (`68 notas`, `Errores: 0`), `node --test scripts/contexto/lib.test.js` (`10 pass, 0 fail`) y revisión automática pública (`VEREDICTO: PASA`).

## Lo que no cambió

- No se inventaron coordenadas ni se usaron centroides municipales o parroquiales para las 62 entradas sin boca abierta verificable (permanecen en `null`).
- No se alteraron la rama `main`, el clon principal ni las salidas crudas de `$DATOS` o `$RUN` fuera de git.

## Pendientes

- Si aparecen publicaciones abiertas adicionales con licencias compatibles (`ODbL 1.0`, `CC0 1.0`, `CC BY 4.0`) para las 58 cuevas actualmente en `no_encontrado`, pueden añadirse en `etl/sitios/cuevas-pyroduct-coordenadas.json` y volver a ejecutar `E-16` y `E-13`.

## Relaciones

- [[I-46-coordenadas-de-bocas-de-tubos-de-lava]] — fuente y contraste entre pares de coordenadas de cuevas
- [[licencias-coordenadas-de-cuevas]] — criterios de licencia para Pyroduct, OpenStreetMap y fuentes complementarias
- [[sensores-tierra]] — inventario general de datasets terrestres y DOI de Pyroduct v3.0
- [[ADR-002-malla-primero-y-una-columna-por-capa]] — contrato de una columna por capa alineada a la malla HEALPix
- [[ADR-006-valores-faltantes-y-cobertura]] — manejo de celdas sin dato en `NaN` sin rellenar con ceros
- [[ADR-008-calidad-de-la-tabla-y-manifiesto]] — verificación independiente y manifiesto del ETL
