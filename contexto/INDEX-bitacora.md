<!-- GENERADO por scripts/contexto/build-index.js — no editar a mano -->
# Índice de la bitácora

Todas las sesiones vigentes: una por una las del último mes con notas y del anterior; los meses anteriores,
por su resumen mensual. No se inyecta al arrancar: se consulta cuando la pregunta es sobre el trabajo pasado.
Sesiones: `sesion · autor · agente · fecha` — resumen.

- [[2026-11-15-fernando-etl-escala-200m]] · sesion · fernando · claude-code · 2026-11-15 — El terreno se calcula igual en los tres cuerpos (bloques cuadrados de 200 m, ventana de 1 km); el error de pendiente contra la relectura independiente de E-13 baja de 0.176° a 0.050°.
- [[2026-11-14-fernando-etl-e01-a-e13]] · sesion · fernando · claude-code · 2026-11-14 — Se escribió y corrió el ETL completo (malla, terreno, temperatura, NDVI, aridez, permafrost, viento y polvo, material, agua, objetivos de la Luna y Marte, manifiesto), cada paso con su comprobación y su registro de auditoría; los errores encontrados quedaron corregidos y registrados.
- [[2026-11-14-fernando-etl-deuda-cerrada]] · sesion · fernando · claude-code · 2026-11-14 — E-03 terreno se rehízo solo en las teselas afectadas (índice validado bit a bit), E-11 suma iluminación y Mini-RF, E-12 suma el clima de la MCD 6.2 (local, presión corregida por altura), E-05 usa máscara de tierra, E-15 agrega cinco capas de 30 m y el manifiesto lista n_celdas, nivel y local_only.
- [[2026-11-14-fernando-etl-corridas-finales]] · sesion · fernando · claude-code · 2026-11-14 — E-03 por celda (retomado tras una pausa), E-04, E-07, E-08, E-09, E-11, E-12 y E-13 corrieron con los métodos corregidos, sin fallos y con la cadena de auditoría íntegra (79 líneas); se anotan tiempos y cobertura de cada paso.
- [[2026-11-14-fernando-e03-por-celda-corregido]] · sesion · fernando · claude-code · 2026-11-14 — Una revisión externa del ETL se verificó punto por punto; E-03 por celda se corrigió (centro de Horn, cuantiles lineales, rugosidad y relieve en 5x5, fracción válida exacta, halo en el antimeridiano) y el resto quedó como deuda P-001 a P-010.
