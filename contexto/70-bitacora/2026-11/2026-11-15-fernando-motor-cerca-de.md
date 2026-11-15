---
title: "Sesión 2026-11-15 — cerca_de en el motor"
type: sesion
status: vigente
date: 2026-11-15
updated: 2026-11-15
summary: "El motor escribe cerca_de (distancia al tubo de lava, cráter y salar más cercanos) en cada candidato, con las columnas opcionales de $RUN o de --puntos; no puntúan. Los 21 sitios corren y la distancia coincide con la columna."
autor: fernando
agente: claude-code
modelo: opus-5.5
rama: feat/motor-cerca-de
scope:
  - motor/pipeline/src/salida.rs
  - motor/pipeline/src/tabla.rs
  - motor/pipeline/src/ejecutar.rs
  - motor/pipeline/src/main.rs
  - motor/pipeline/tests/cerca.rs
  - motor/README.md
  - contexto/45-decisiones/ADR-009-capas-de-puntos-y-distancias.md
symbols:
  - CercaDe
  - Cercanas::de_fila
  - Tabla::abrir_extra
  - Tabla::tiene_f32
  - fuentes_de
---

# Sesión 2026-11-15 — cerca_de en el motor

## Problema o motivo

ADR-009 §2.3 decide que las distancias a puntos (tubos de lava, cráteres, salares) no puntúan pero se informan como
`cerca_de`. El motor no lo escribía. El visor necesita mostrar "a X km del tubo de lava más cercano" en la ficha de
cada candidato.

## Cambios

- `salida.rs` → cada `Celda` gana `cerca_de: {tubo_lava_km, crater_km, salar_km}` (`Option<f64>`, redondeado a
  0.1 km, `null` si el valor no es finito), leído de `cueva_dist_km`, `dist_crater_km` y `dist_playa_km` en la fila
  del candidato. Se omite si no hay ninguna de las tres columnas. `fuentes_de` recibe pares (columna, tabla) para que
  las columnas de otra carpeta digan su propia fuente y licencia en `fuentes` de `metrics.json`.
- `tabla.rs` → `Tabla::abrir_extra`: abre otra corrida sobre la misma malla. Sin `manifest.json` toma `n_celdas` y
  nivel de la principal y el origen de cada columna de `columns/<nombre>.json`; con manifiesto exige el mismo
  `n_celdas` y nivel. Si las dos tienen `grid/ipix.u32`, deben ser idénticos. `Tabla::tiene_f32` dice si una columna
  existe sin abrirla.
- `ejecutar.rs`, `main.rs` → opción `--puntos DIR`. Cada columna se busca primero en `$RUN` y luego en `DIR`.
- `nucleo` y el barrido no cambian: las distancias no entran a la nota.

## Verificación

- `cargo fmt --check`, `cargo clippy --workspace --all-targets --locked -- -D warnings` y
  `cargo test --workspace --locked` pasan en `motor/`.
- Pruebas nuevas: `cerca_de` sin columnas (se omite), con columnas parciales, NaN e infinito a `null`, redondeo;
  `fuentes_de` con dos tablas; carpeta extra sin manifiesto, columna de otro tamaño, otra malla y otro `n_celdas`.
- Prueba ignorada `cerca_de_coincide_con_las_columnas_de_la_tabla_real`: pasa con `RUN` solo y con
  `PUNTOS` apuntando a la corrida de E-17.
- Los 21 sitios corren con `--puntos` apuntando a la corrida de E-17 (misma malla): 4200 candidatos, todos con `cerca_de` y sin
  `null`. Comprobado contra la columna en dos candidatos:
  - JZ, rango 1 (31.12° N, 2.46° E): tubo 1352.3, cráter 285.5, salar 379.6 km; columnas 1352.307, 285.481, 379.556.
  - CB, rango 4 (31.93° N, 50.43° E): tubo 1252.5, cráter 994.4, salar 217.4 km; columnas 1252.471, 994.362, 217.446.
- `fuentes` de `metrics.json` lista Pyroduct v3.0 (CC BY 4.0), Wikidata (CC0 1.0) y Natural Earth (dominio público).

## Lo que no cambió

- El filtro opcional por distancia ("a menos de 50 km de un tubo", ADR-009 §2.3) sigue sin implementar.
- `version_contrato` sigue en 1.0.0: `cerca_de` es un campo nuevo y opcional.
- `escenarios` (estabilidad) no escribe `cerca_de`.

## Pendientes

- Cuando E-13 incorpore `dist_crater_km` y `dist_playa_km` a `$RUN`, `--puntos` deja de hacer falta.

## Relaciones

- [[ADR-009-capas-de-puntos-y-distancias]] — decide que las distancias se informan como `cerca_de`
- [[ADR-010-motor-de-busqueda-sobre-la-tabla-del-etl]] — diseño del motor
- [[ADR-007-contrato-de-metrics-json]] — contrato de la salida
- [[2026-11-15-fernando-motor-sobre-etl]] — sesión anterior del motor
