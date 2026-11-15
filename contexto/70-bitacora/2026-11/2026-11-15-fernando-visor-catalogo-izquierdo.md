---
title: "Sesión 2026-11-15 — Catálogo y Misiones: panel izquierdo del visor con zonas y pines"
type: sesion
status: vigente
date: 2026-11-15
updated: 2026-11-15
summary: "El visor gana el panel izquierdo Catálogo y Misiones: zonas guardadas y pines del usuario con filtro Marte/Luna, tarjetas con variables reales del ETL y exportar/importar GeoJSON validado."
autor: fernando
agente: claude-code
modelo: sonnet-5.5
rama: feat/visor-panel-catalogo
scope:
  - visor/src/ui/catalogo.ts
  - visor/src/panel/catalogo.css
  - visor/src/datos/catalogo.ts
  - visor/src/capas/pinesUsuario.ts
  - visor/src/capas/zonas.ts
  - visor/src/ui/barra.ts
  - visor/src/main.ts
symbols:
  - PanelCatalogo
  - CapaPinesUsuario
  - importarCatalogoGeoJson
  - exportarCatalogoAGeoJson
---

# Sesión 2026-11-15 — Catálogo y Misiones: panel izquierdo del visor

## Problema o motivo

El visor solo tenía el panel derecho (análogos). Faltaba un lugar fijo, al lado izquierdo, donde ver las zonas que se
dibujan y guardar pines, en el mismo estilo de vidrio oscuro del panel derecho.

## Cambios

- `visor/src/ui/catalogo.ts` y `visor/src/panel/catalogo.css` → panel «Catálogo y Misiones» con pestañas
  Zonas poligonales y Puntos y pines, filtro Todas/Marte/Luna, botón Ocultar con píldora para volver, y pie con
  Exportar GeoJSON e Importar.
- Tarjeta de zona → nombre editable, cuerpo (Marte o Luna) y sitio objetivo del índice, superficie y perímetro, y las
  medias de pendiente, relieve, rugosidad, aridez, rango diurno y NDVI máximo leídas de las columnas nivel 7 que ya
  carga el visor. Acciones: Volar, Relleno/Contorno, GeoJSON, color y Borrar.
- Tarjeta de pin → nombre, categoría (Tierra, Marte, Luna), coordenadas, notas, Volar, Medir, GeoJSON y Borrar.
- `visor/src/capas/pinesUsuario.ts` → pines del usuario con persistencia en `localStorage`, etiqueta y color por
  categoría. No se mezclan con los puntos de referencia del ETL.
- `visor/src/datos/catalogo.ts` → exportar e importar GeoJSON. Lo importado se trata como entrada no confiable:
  tope de 2 MB, 300 elementos y 2000 vértices; rango de coordenadas; color solo `#rrggbb`; texto sin caracteres de
  control; ids nuevos. El HTML se escapa al pintar.
- `visor/src/capas/zonas.ts` → avisa cambios, edita zonas, relleno por zona y alta de varias a la vez.
- `visor/src/ui/barra.ts` → botones Marcar Pin (clic en el globo) y Guardar Pin; `medirEn` para medir desde una tarjeta.
  La barra se parte en filas en pantallas angostas para no tapar los paneles.
- `visor/src/style.css` → el panel de análisis de zona se corre a la derecha del catálogo.

## Verificación

- `npm --prefix visor run prueba` → `tsc --noEmit` y las pruebas pasan, incluida `catalogo.prueba.ts` nueva (ida y
  vuelta, coordenadas fuera de rango, propiedades hostiles, límites de tamaño).
- Prueba manual en el navegador con datos locales: guardar pin por coordenadas y con Marcar Pin, medir zona y
  guardarla, asignar cuerpo y objetivo, cambiar color y relleno, importar un GeoJSON con un punto inválido (se omite y
  se avisa), recargar y ver que zonas y pines persisten. Sin errores en la consola.

## Lo que no cambió

- Los puntos de referencia del ETL siguen en el panel derecho.
- La elevación del terreno por zona no se calcula: el visor público no tiene relieve; las variables salen del ETL.

## Relaciones

- [[2026-11-15-fernando-visor-panel-analogos]] — panel derecho con el que comparte estilo
- [[2026-11-15-fernando-visor-pines]] — puntos de referencia del ETL
