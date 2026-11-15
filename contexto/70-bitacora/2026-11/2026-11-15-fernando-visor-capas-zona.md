---
title: "Sesión 2026-11-15 — Capas temáticas por zona en el visor"
type: sesion
status: vigente
date: 2026-11-15
updated: 2026-11-15
summary: "Cada tarjeta de zona del catálogo abre un panel de capas con geología, suelos y polvo, radiación, agua y NDVI recortados al polígono, con datos de servicios abiertos."
autor: fernando
agente: claude-code
modelo: sonnet-5.5
rama: feat/visor-capas-zona
scope:
  - visor/src/capas/gestorCapasZona.ts
  - visor/src/capas/proveedores/
  - visor/src/ui/panelCapasZona.ts
  - visor/src/ui/catalogo.ts
  - visor/vite.config.ts
symbols:
  - ZoneLayerManager
  - ZoneLayerPanel
---

# Sesión 2026-11-15 — Capas temáticas por zona en el visor

## Problema o motivo

Una zona guardada solo mostraba área, perímetro y las medias del ETL. Faltaba poder mirar, dentro del polígono, la
geología, el suelo, la radiación, el agua y la vegetación.

## Cambios

- `visor/src/capas/gestorCapasZona.ts` y `visor/src/capas/proveedores/` → un proveedor por familia: geología
  (Macrostrat), suelos y polvo (SoilGrids y GIBS), radiación (NASA POWER), agua y salares (JRC y OpenStreetMap) y NDVI
  (GIBS). Cada uno baja los datos, los recorta al polígono, pinta una imagen sobre el globo y devuelve leyenda,
  estadísticas, fuente y crédito.
- `visor/src/ui/panelCapasZona.ts` → panel con familias, subcapa, opacidad, leyenda y métricas.
- `visor/src/ui/catalogo.ts` → botón **Capas** en la tarjeta de cada zona; al borrar la zona se cierra el panel.
- `visor/vite.config.ts` → rutas `/proxy/…` para Macrostrat, NASA POWER, SoilGrids y Overpass en el servidor de
  desarrollo y en `vite preview`.
- `contexto/50-referencia/capas-tematicas-por-zona.md` → licencias de cada servicio y lo que no está verificado.

## Verificación

- `npm --prefix visor run prueba` → pasa, con la prueba nueva de `utilCapas`.
- Prueba manual en el navegador con la zona de 16 km alrededor de Yungay: las cinco familias devuelven datos reales
  (geología granítica del Cretácico, suelo franco, radiación media de unos 7 kWh/m²/día, sin agua, NDVI de suelo
  desnudo). Sin los proxies la geología, la radiación y los suelos fallaban con «sin dato».

## Lo que no cambió

- Elevación y pendiente por zona quedan fuera: las trae otra rama. La capa de sílice por zona también, porque
  necesita un archivo por zona que el repo público no tiene.
- Fuera de `localhost` las consultas van directas y pueden fallar por CORS; no se probó.

## Relaciones

- [[2026-11-15-fernando-visor-catalogo-izquierdo]] — catálogo donde vive el botón
- [[capas-tematicas-por-zona]] — licencias de los servicios
