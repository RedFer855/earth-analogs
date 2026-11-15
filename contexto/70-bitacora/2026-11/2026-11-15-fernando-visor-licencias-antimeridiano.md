---
title: "Sesión 2026-11-15 — Licencias del visor y zonas en el antimeridiano"
type: sesion
status: vigente
date: 2026-11-15
updated: 2026-11-15
summary: "Auditoría del visor (PR #33 a #42): EOX vuelve a 2016 (CC BY 4.0) por defecto, se anotan EOX, Macrostrat y Photon en 50-referencia y se corrige la caja y el centro de zonas que cruzan 180°."
autor: fernando
agente: claude-code
modelo: claude-opus-5-5
rama: fix/visor-licencias-bbox
scope: [visor/src, visor/pruebas]
symbols: [calcularBboxZona, centroPoligono, creditoEox]
---

# Sesión 2026-11-15 — Licencias del visor y zonas en el antimeridiano

## Problema o motivo

Al auditar los PR del visor (#33 a #42) salieron cuatro cosas:

- El #37 cambió el mapa base a EOX 2025, que es CC BY-NC-SA 4.0. Contradecía ADR-011, que fija EOX 2016 (CC BY 4.0),
  y no se anotó en `50-referencia/` (regla 5).
- Macrostrat (overlay de la Fase D) y Photon (buscador) no tenían nota de referencia.
- `calcularBboxZona` devolvía una caja de casi 360° para zonas que cruzan el antimeridiano.
- `centroPoligono` promediaba longitudes sin desenrollar: una zona en Fiyi tenía su centro en el meridiano 0, y
  Macrostrat, "volar a zona" y la celda más cercana usaban ese centro.

## Cambios

- `visor/src/globo.ts` → EOX 2016 por defecto. Los años 2018 a 2025 solo con `?imagen=AAAA`. El crédito usa el texto
  oficial de EOX y enlaza la licencia de cada año.
- `visor/src/main.ts` → la opción del selector dice "EOX 2016".
- `visor/src/capas/overlaysZona.ts` → `calcularBboxZona` desenrolla longitudes; si cruza 180° devuelve `west > east`
  (como pide `Cesium.Rectangle`) y si rodea un polo cubre todas las longitudes hasta ese polo.
- `visor/src/datos/cruceZona.ts` → `centroPoligono` promedia longitudes desenrolladas.
- `visor/pruebas/contrato.prueba.ts` → casos de Fiyi, polo sur y crédito de EOX por año.
- Notas nuevas: [[eox-cloudless-licencias]], [[macrostrat-api]], [[photon-geocodificador]].
- [[abierta]] → P-017: el CI no corre las pruebas del ETL.

## Verificación

- `npm run prueba` y `npm run build` en `visor/`: pasan.
- Licencias de EOX leídas en el `WMTSCapabilities.xml` (campo `Abstract` por capa) y en cloudless.eox.at.
- `node scripts/contexto/build-index.js` y `node scripts/contexto/verificar.js`: 0 errores.

## Lo que no cambió

- Los commits #39 a #42 llevan la línea "Hecho con Antigravity". Ya están en main con squash; no se reescribe la
  historia.
- Los overlays de GIBS (AOD y LST) no se tocaron: NASA GIBS no tiene restricción de uso.

## Pendientes

- P-017.

## Relaciones

- [[ADR-011-visor-web-sobre-el-contrato]] — decisión que el #37 había contradicho
- [[2026-11-15-fernando-visor-mapa-2025]] — sesión que cambió el mapa base a 2025
- [[2026-11-15-fernando-visor-fase-d-overlays]] — sesión que agregó Macrostrat y la caja de zona
