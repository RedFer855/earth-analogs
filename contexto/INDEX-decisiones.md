<!-- GENERADO por scripts/contexto/build-index.js — no editar a mano -->
# Índice de 45-decisiones

ADR-NNN, estándares E-NN y decisiones pendientes DP-NN. Una línea por nota vigente: `tipo · estado · actualizado` — resumen.
No se inyecta al arrancar: se abre cuando contexto/INDEX.md apunta aquí.

- [[ADR-001-preprocesar-offline-y-servir-ligero]] · adr · vigente · 2026-11-14 — Los rasters pesados se procesan en la PC del equipo; la web solo carga archivos derivados de pocos MB.
- [[ADR-002-malla-primero-y-una-columna-por-capa]] · adr · vigente · 2026-11-14 — El ETL construye primero una malla HEALPix de área igual, y cada capa escribe su propia columna alineada a ella; el manifiesto describe cada columna.
- [[ADR-003-variables-por-proceso-fisico]] · adr · vigente · 2026-11-14 — Las columnas de la tabla describen procesos físicos agrupados en seis dimensiones; cada una exige un equivalente medible en la Luna o en Marte.
- [[ADR-004-periodo-comun-y-climatologia]] · adr · vigente · 2026-11-14 — Las variables que cambian con el tiempo se promedian en una climatología mensual de 2013 a 2022, con filtros de calidad explícitos y huecos como NaN.
- [[ADR-005-regla-de-escala-de-pendiente-y-rugosidad]] · adr · vigente · 2026-11-14 — La pendiente se calcula en el DEM fino con halo y agua enmascarada, y solo después se agrega a la celda; la rugosidad y el relieve quedan para la ficha del sitio.
- [[ADR-006-valores-faltantes-y-cobertura]] · adr · vigente · 2026-11-14 — Un valor faltante es NaN y nunca se rellena; una celda sin dato en una columna sigue en la tabla, y la cobertura de cada columna se declara.
- [[ADR-007-contrato-de-metrics-json]] · adr · vigente · 2026-11-14 — La web solo lee un archivo derivado, metrics.json, con versión, origen de cada número y, por dimensión, en qué coincide y en qué difiere cada análogo.
- [[ADR-008-calidad-de-la-tabla-y-manifiesto]] · adr · vigente · 2026-11-14 — Cada paso del ETL se verifica de forma independiente antes del siguiente, y el manifiesto lleva los indicadores de calidad de cada columna.
