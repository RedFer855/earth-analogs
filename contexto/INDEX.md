<!-- GENERADO por scripts/contexto/build-index.js — no editar a mano -->
# Índice del contexto

Una línea por nota: `tipo · estado · actualizado` — resumen. Sesiones: `sesion · autor · agente · fecha`.
Lee este índice entero y abre solo las 3 a 6 notas que la tarea necesita.
Solo aparece lo vigente: las notas reemplazadas o archivadas no se listan. Algunas carpetas van resumidas
y su detalle está en contexto/: INDEX-sitios.md, INDEX-arquitectura.md, INDEX-decisiones.md, INDEX-referencia.md, INDEX-investigaciones.md, INDEX-qa.md, INDEX-seguridad.md; los summaries de los submódulos, en INDEX-modulos.md.
De la bitácora, solo las 3 sesiones más recientes; el resto está en contexto/INDEX-bitacora.md.

## 00-mapa — Vista para humanos

_(vacía)_

## 10-reto — El reto de NASA Space Apps 2026: enunciado, calendario, criterios del jurado

- [[criterios-del-jurado-y-demo]] · producto · vigente · 2026-11-13 — Rúbrica oficial de Space Apps 2026 (5 criterios, 3 fases, 10 premios), reglas del demo único.
- [[dimensiones-innegociables]] · producto · vigente · 2026-11-13 — Lo que el enunciado oficial pide explícitamente, las ocho dimensiones de analogía y los diez principios del reto.
- [[enunciado-oficial-clasificado]] · producto · vigente · 2026-11-13 — Texto del enunciado oficial ordenado en requisitos, qué evitar, ocho dimensiones y principios de análisis.
- [[reto-oficial-y-calendario]] · producto · vigente · 2026-11-13 — Qué pide el enunciado oficial del reto de análogos terrestres, los 11 recursos publicados el 2026-11-13, el calendario completo y las reglas de participación, entrega única y Super Intelligence (SI).

## 20-casos-de-uso — CU-NN: qué hace con el visor el jurado, un científico o un ingeniero de misión

_(vacía)_

## 25-diagramas — Diagramas: prompt_*.md es la fuente; lo demás se genera

_(vacía)_

## 30-datos — Variables, vector de parámetros, normalización y formato de las tablas ligeras

_(vacía)_

## 32-sitios — SL-NN sitios de base en Luna y Marte · ST-NN análogos terrestres candidatos

_(vacía)_

## 35-modulos — M-NN: ficha y contrato del módulo · SM-NN.N: especificación de cada submódulo (E-02)

_(vacía)_

## 40-arquitectura — Estado vivo: pipeline offline, motor Rust/Wasm, visor 3D, asistente

_(vacía)_

## 45-decisiones — ADR-NNN, estándares E-NN y decisiones pendientes DP-NN

- [[ADR-001-preprocesar-offline-y-servir-ligero]] · [[ADR-002-malla-primero-y-una-columna-por-capa]] · [[ADR-003-variables-por-proceso-fisico]] · [[ADR-004-periodo-comun-y-climatologia]] · [[ADR-005-regla-de-escala-de-pendiente-y-rugosidad]] · [[ADR-006-valores-faltantes-y-cobertura]] · [[ADR-007-contrato-de-metrics-json]] · [[ADR-008-calidad-de-la-tabla-y-manifiesto]]
- _(tipo, estado y summary: ver contexto/INDEX-decisiones.md)_

## 50-referencia — Hechos externos con fecha: misiones, sensores, portales de datos, APIs, reglas de Space Apps

- _(8 notas: ver contexto/INDEX-referencia.md)_

## 55-investigaciones — I-NN y sus prompts

- _(41 notas: ver contexto/INDEX-investigaciones.md)_

## 60-qa — Validación de resultados contra análogos conocidos y pruebas del motor

_(vacía)_

## 65-seguridad — Secretos, licencias de datos y dependencias: hallazgos S-NNN

_(vacía)_

## 70-bitacora — Notas de sesión por mes

- [[2026-11-14-fernando-etl-e01-a-e13]] · sesion · fernando · claude-code · 2026-11-14 — Se escribió y corrió el ETL completo (malla, terreno, temperatura, NDVI, aridez, permafrost, viento y polvo, material, agua, objetivos de la Luna y Marte, manifiesto), cada paso con su comprobación y su registro de auditoría; los errores encontrados quedaron corregidos y registrados.
- [[2026-11-14-fernando-etl-corridas-finales]] · sesion · fernando · claude-code · 2026-11-14 — E-03 por celda (retomado tras una pausa), E-04, E-07, E-08, E-09, E-11, E-12 y E-13 corrieron con los métodos corregidos, sin fallos y con la cadena de auditoría íntegra (79 líneas); se anotan tiempos y cobertura de cada paso.
- [[2026-11-14-fernando-e03-por-celda-corregido]] · sesion · fernando · claude-code · 2026-11-14 — Una revisión externa del ETL se verificó punto por punto; E-03 por celda se corrigió (centro de Horn, cuantiles lineales, rugosidad y relieve en 5x5, fracción válida exacta, halo en el antimeridiano) y el resto quedó como deuda P-001 a P-010.

## 80-deuda — Deuda técnica P-NNN

- [[abierta]] · deuda · vigente · 2026-11-14 — Pendientes abiertos del proyecto, uno por ítem P-NNN.
- [[resuelta-2026]] · deuda · vigente · 2026-11-14 — Pendientes cerrados en 2026, con cómo se cerraron.

## 85-entrega — Lo que se presenta: pitch, video, demo y formulario de Space Apps

_(vacía)_
