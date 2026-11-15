<!-- GENERADO por scripts/contexto/build-index.js — no editar a mano -->
# Índice de 45-decisiones

ADR-NNN, estándares E-NN y decisiones pendientes DP-NN. Una línea por nota vigente: `tipo · estado · actualizado` — resumen.
No se inyecta al arrancar: se abre cuando contexto/INDEX.md apunta aquí.

- [[ADR-001-preprocesar-offline-y-servir-ligero]] · adr · vigente · 2026-11-14 — Los rasters pesados se procesan en la PC del equipo; la web solo carga archivos derivados de pocos MB.
- [[ADR-002-malla-primero-y-una-columna-por-capa]] · adr · vigente · 2026-11-14 — El ETL construye primero una malla HEALPix de área igual, y cada capa escribe su propia columna alineada a ella; el manifiesto describe cada columna.
- [[ADR-003-variables-por-proceso-fisico]] · adr · vigente · 2026-11-14 — Las columnas de la tabla describen procesos físicos agrupados en seis dimensiones; cada una exige un equivalente medible en la Luna o en Marte.
- [[ADR-004-periodo-comun-y-climatologia]] · adr · vigente · 2026-11-14 — Las variables que cambian con el tiempo se promedian en una climatología mensual de 2013 a 2022, con filtros de calidad explícitos y huecos como NaN.
- [[ADR-005-regla-de-escala-de-pendiente-y-rugosidad]] · adr · vigente · 2026-11-15 — La pendiente, la rugosidad y el relieve se calculan en bloques cuadrados de 200 m (LAEA local) con ventana de 1 km, igual en la Tierra, la Luna y Marte, y solo después se agregan a la celda.
- [[ADR-006-valores-faltantes-y-cobertura]] · adr · vigente · 2026-11-15 — Un valor faltante es NaN y nunca se rellena; una celda sin dato en una columna sigue en la tabla, y la cobertura de cada columna se declara.
- [[ADR-007-contrato-de-metrics-json]] · adr · vigente · 2026-11-14 — La web solo lee un archivo derivado, metrics.json, con versión, origen de cada número y, por dimensión, en qué coincide y en qué difiere cada análogo.
- [[ADR-008-calidad-de-la-tabla-y-manifiesto]] · adr · vigente · 2026-11-14 — Cada paso del ETL se verifica de forma independiente antes del siguiente, y el manifiesto lleva los indicadores de calidad de cada columna.
- [[ADR-009-capas-de-puntos-y-distancias]] · adr · vigente · 2026-11-15 — Cráteres de impacto, tubos de lava y salares entran como pines y como columnas de distancia al más cercano; las distancias filtran y explican, no puntúan.
- [[ADR-010-motor-de-busqueda-sobre-la-tabla-del-etl]] · adr · vigente · 2026-11-15 — El motor en Rust lee $RUN tal como lo deja el ETL, puntúa con Mahalanobis contraída por cuerpo, tolerancia pseudo-Huber y regla de Gower, deja la temperatura como diagnóstico y escribe metrics.json acumulable con el origen de cada número.
- [[ADR-011-visor-web-sobre-el-contrato]] · adr · vigente · 2026-11-15 — El visor es una página estática con CesiumJS que solo lee metrics.json, el detalle de cada sitio y derivados de pocos MB; dibuja los candidatos como un solo Primitive y cuenta en una ficha en qué coincide y en qué difiere cada uno.
