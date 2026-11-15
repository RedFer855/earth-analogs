---
title: "Sesión 2026-11-15 — Motor de búsqueda sobre la tabla del ETL"
type: sesion
status: vigente
date: 2026-11-15
updated: 2026-11-15
summary: "Se conectó el motor en Rust con $RUN sin adaptador, se corrigió la fórmula, se agregó E-20 para los perfiles y se corrigió la latitud autálica frente a la geodésica; los 21 sitios corren y 57 pruebas pasan, 5 de ellas contra la tabla real."
autor: fernando
agente: claude-code
modelo: opus-5.5
rama: feat/motor-escenarios
scope:
  - motor/
  - etl/e20_perfiles.py
  - etl/test_e20_perfiles.py
  - etl/cola.py
  - analisis/referencia_motor.py
  - .github/workflows/ci.yml
  - contexto/45-decisiones/ADR-010-motor-de-busqueda-sobre-la-tabla-del-etl.md
symbols:
  - Perfil::deltas
  - factor_gower
  - acumular
  - autalica_a_geodesica
  - geodesica_a_autalica
  - perfil_de_sitio
---

# Sesión 2026-11-15 — Motor de búsqueda sobre la tabla del ETL

## Problema o motivo

Faltaba el motor que compara la tabla del ETL con los sitios de la Luna y Marte y escribe `metrics.json` (P-011). La
fórmula tenía que corregirse antes de usarla (ADR-010, sección 1).

## Cambios

- `etl/e20_perfiles.py` (nuevo paso E-20) → escribe `$RUN/perfiles.json`: 21 perfiles con las cuatro variables de
  terreno, tolerancia = MAD del sitio, escala de la Tierra resistente a valores extremos, correlación en una muestra fija, λ por cuerpo y la
  temperatura como diagnóstico. Entra en la cola después de E-13.
- `motor/nucleo/src/perfil.rs` → la tolerancia atenúa con pseudo-Huber en vez de anular la diferencia.
- `motor/pipeline/src/barrido.rs` → regla de Gower: celdas incompletas entran con S × fracción presente si tienen las
  obligatorias y al menos el 70 % de las variables.
- `motor/pipeline/src/entrada.rs` → pesos, λ y diagnóstico por perfil; la Luna solo acepta variables de terreno.
- `motor/pipeline/src/escenarios.rs` → los escenarios usan la misma λ y los mismos pesos que la corrida normal.
- `motor/pipeline/src/tabla.rs` y `salida.rs` → fuente, licencia y unidad salen del manifiesto; por variable,
  diferencia y etiqueta `coincide`/`difiere`/`sin_dato`; variables faltantes; `contrato.tabla` con fecha y commit de
  E-13; `metrics.json` acumula sitios y se reinicia si cambia la tabla.
- `motor/pipeline/src/geo.rs` → conversión entre latitud autálica (HEALPix) y geodésica (tabla, sitios, salida).
- `analisis/referencia_motor.py` → la fórmula en numpy, aparte; genera los valores sintéticos de la prueba del núcleo.
- `.github/workflows/ci.yml` → job `motor` (formato, clippy con `-D warnings` y pruebas), requerido por `CI completo`.
- Comentarios de módulo en todo el motor y `motor/README.md`.

## Verificación

- La prueba de humo contra la tabla real encontró que la latitud de los centros difería hasta 0.128° de
  `grid/lat.f32`: E-01 guarda latitud geodésica y HEALPix usa autálica. Con la conversión la diferencia máxima es
  3.8e-6°, el redondeo de `f32`.
- `cargo test --workspace`: 53 pasan; con `RUN` apuntando a la corrida del 2026-11-15 y `--include-ignored`, 57 pasan,
  incluidos los 4 que leen la tabla real.
- El núcleo coincide con la referencia de numpy a 1e-12 en S, en S sin tolerancia y en la nota de cada variable.
- `etl/test_e20_perfiles.py` y `etl/test_cola.py`: 15 pasan. E-20 corrió con `audit/audit.py` (2.8 s, cadena íntegra).
- Corrida de los 21 sitios con separación de 100 km: 200 candidatos por sitio, `metrics.json` de 13 KB con los 21,
  detalle de 6.4 MB en total. Para JZ el mejor candidato está en 31.12° N, 2.46° E, con las cuatro variables dentro
  de la tolerancia; el diagnóstico dice 26.7 K de rango diurno en la Tierra frente a 85.5 K en Jezero.

## Lo que no cambió

- No se usa un adaptador que copie la tabla ni renombre columnas: el motor lee `$RUN` directo (ADR-007, regla 8).
- No se aplicaron la calibración por grados de libertad ni la transformación logarítmica (P-016).
- Los resultados de la corrida quedaron fuera del repo; se regeneran con E-20 y el motor.

## Pendientes

- P-015: 256 de 4 200 candidatos caen en el hielo de Groenlandia; falta una columna de hielo permanente.
- P-012: falta un catálogo público de análogos documentados para medir cuántos aparecen en el ranking.
- P-016: calibraciones del puntaje que quedaron fuera.

## Relaciones

- [[ADR-010-motor-de-busqueda-sobre-la-tabla-del-etl]] — decisiones de esta sesión
- [[ADR-007-contrato-de-metrics-json]] — contrato que escribe el motor
- [[abierta]] — P-012, P-015 y P-016
