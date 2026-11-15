---
title: "Sesión 2026-11-15 — Licencias del visor y zonas en el antimeridiano"
type: sesion
status: vigente
date: 2026-11-15
updated: 2026-11-15
summary: "Auditoría del visor (PR #33 a #42): la búsqueda en el globo ya no detiene el render (esquinas HEALPix corregidas contra cdshealpix), EOX 2025 queda por defecto con su licencia en el crédito y en ADR-011, se anotan EOX, Macrostrat y Photon y se corrigen las zonas que cruzan 180°."
autor: fernando
agente: claude-code
modelo: claude-opus-5-5
rama: fix/visor-licencias-bbox
scope: [visor/src, visor/pruebas]
symbols: [calcularBboxZona, centroPoligono, creditoEox, ipixAVertices, xyfALocal, pedirOpcional]
---

# Sesión 2026-11-15 — Licencias del visor y zonas en el antimeridiano

## Problema o motivo

Al auditar los PR del visor (#33 a #42) salieron estas cosas:

- Al pulsar "Como Jezero" (o cualquier sitio) y "Buscar en el globo", Cesium mostraba "DeveloperError: normalized
  result is not a number" y el globo quedaba en negro. Causa: `ipixAVertices` calculaba las esquinas con la fórmula
  del centro de la celda corrida media celda. Con datos reales, celdas que miden 0.4° salían de 20° a 325° de ancho,
  y en el polo dividía entre cero (con `nside` 128, una sonda en Node se quedaba colgada). `PolygonGeometry` no puede
  triangular esos polígonos y detiene el render. Lo mismo pasaba con las capas coropléticas.
- Si faltaba `estabilidad.json`, Vite respondía con `index.html` y quedaba un error de JSON en la consola.

- El #37 cambió el mapa base a EOX 2025, que es CC BY-NC-SA 4.0, sin actualizar ADR-011 (que decía 2016) ni anotar
  la licencia en `50-referencia/` (regla 5). El crédito tampoco mostraba la licencia.
- Macrostrat (overlay de la Fase D) y Photon (buscador) no tenían nota de referencia.
- `calcularBboxZona` devolvía una caja de casi 360° para zonas que cruzan el antimeridiano.
- `centroPoligono` promediaba longitudes sin desenrollar: una zona en Fiyi tenía su centro en el meridiano 0, y
  Macrostrat, "volar a zona" y la celda más cercana usaban ese centro.

## Cambios

- Decisión de fernando: EOX 2025 se queda por defecto, porque el proyecto no se vende y I-39 ya había confirmado que
  la licencia permite el uso no comercial. ADR-011 se enmendó con esa decisión y sus condiciones.
- `visor/src/globo.ts` → el crédito usa el texto oficial de EOX y enlaza la licencia de cada año (CC BY 4.0 en 2016,
  CC BY-NC-SA 4.0 desde 2018). 2016 sigue de respaldo y otro año se pide con `?imagen=AAAA`.
- `visor/src/capas/overlaysZona.ts` → `calcularBboxZona` desenrolla longitudes; si cruza 180° devuelve `west > east`
  (como pide `Cesium.Rectangle`) y si rodea un polo cubre todas las longitudes hasta ese polo.
- `visor/src/datos/cruceZona.ts` → `centroPoligono` promedia longitudes desenrolladas.
- `visor/pruebas/contrato.prueba.ts` → casos de Fiyi, polo sur y crédito de EOX por año.
- `visor/src/datos/healpix.ts` → las esquinas usan `xyfALocal`, que es `xyf2loc` de la biblioteca HEALPix, con
  coordenadas de cara en [0, 1]. En el polo la longitud queda indefinida y toma el promedio de las otras esquinas. Las
  longitudes se envuelven con módulo, no con bucles.
- `visor/src/capas/capas7.ts` → descarta celdas con esquinas no finitas y lleva los vértices a ±89.95° para que la
  proyección estereográfica de Cesium no reciba un punto en el polo.
- `visor/src/datos/contrato.ts` → `pedirOpcional` trata como ausente una respuesta que no es JSON.
- `visor/pruebas/contrato.prueba.ts` → recorre las 196 608 celdas de nivel 7. Exige esquinas finitas y anchos menores
  de 5° fuera de los casquetes, y compara la celda 10942 con `cdshealpix.nested.vertices`.
- Notas nuevas: [[eox-cloudless-licencias]], [[macrostrat-api]], [[photon-geocodificador]].
- [[abierta]] → P-017: el CI no corre las pruebas del ETL.

## Verificación

- `npm run prueba` y `npm run build` en `visor/`: pasan. Con el `healpix.ts` anterior, la prueba nueva no termina.
- Las esquinas de 202 celdas repartidas por las 12 caras coinciden con `cdshealpix` (pixi del ETL) con un error
  menor de 2e-6°.
- En el navegador, con los datos de E-21: "Como Jezero", "Como Shackleton", la búsqueda con celdas parciales y las
  12 capas coropléticas se dibujan sin error. Sobre la Antártida las celdas se ven como rombos de HEALPix.
- Licencias de EOX leídas en el `WMTSCapabilities.xml` (campo `Abstract` por capa) y en cloudless.eox.at.
- `node scripts/contexto/build-index.js` y `node scripts/contexto/verificar.js`: 0 errores.

## Lo que no cambió

- Los commits #39 a #42 llevan la línea "Hecho con Antigravity". Ya están en main con squash; no se reescribe la
  historia.
- Los overlays de GIBS (AOD y LST) no se tocaron: NASA GIBS no tiene restricción de uso.

## Pendientes

- P-017.

## Relaciones

- [[ADR-011-visor-web-sobre-el-contrato]] — enmendada para EOX 2025
- [[I-39-imagen-satelital-de-la-tierra-sin-clave]] — investigación de la licencia de EOX
- [[2026-11-15-fernando-visor-mapa-2025]] — sesión que cambió el mapa base a 2025
- [[2026-11-15-fernando-visor-fase-d-overlays]] — sesión que agregó Macrostrat y la caja de zona
