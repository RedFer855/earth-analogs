---
title: "ADR-001 — Preprocesar offline y servir ligero"
type: adr
status: vigente
estado: aceptado
date: 2026-11-14
updated: 2026-11-14
summary: "Los rasters pesados se procesan en la PC del equipo; la web solo carga archivos derivados de pocos MB."
autor: fernando
scope: [docs/etl-plan.md]
tablas: []
cu: []
supersedes: []
---

# ADR-001 — Preprocesar offline y servir ligero

## 1. Contexto

Las fuentes que comparamos (DEM global, temperatura de superficie, NDVI, mineralogía) pesan decenas de GB y están en
formatos científicos (GeoTIFF, HDF, NetCDF). Una página web no puede ni debe leerlas. El reto se entrega como una web
que cualquiera abre sin instalar nada y que se puede explicar en un video corto.

Las investigaciones del equipo coinciden en el punto práctico: los proyectos publicados que cubren todo el planeta a
resolución de decenas de metros procesan por teselas en una máquina y publican un producto derivado, no el crudo
([[I-35-procesar-un-dem-global-por-teselas]], [[I-38-agregar-rasters-a-healpix-y-guardar-la-tabla]]).

## 2. Decisión

1. Todo raster de más de unos pocos MB se lee y procesa **en la PC**, nunca en el navegador.
2. La web solo carga **archivos derivados** (`metrics.json`, mallas) de pocos MB.
3. Los archivos crudos y las salidas intermedias **no entran a git**: viven bajo `$DATOS` y `$RUN`.
4. Cada paso del ETL deja registro en la auditoría ([plan del ETL](../../docs/etl-plan.md)).

## 3. Diseño

| Capa | Dónde corre | Qué entrega |
| :-- | :-- | :-- |
| ETL | PC del equipo, Python | Columnas `.f32` y manifiesto |
| Derivados | PC del equipo | `metrics.json` y mallas para la web |
| Web | Navegador | Solo lee los derivados |

## 4. Alternativas descartadas

| Alternativa | Por qué no |
| :-- | :-- |
| Servir los rasters con un servicio de teselas | Requiere un servidor y credenciales; el reto pide algo abierto y reproducible |
| Procesar en el navegador con WebAssembly | Los rasters no caben en memoria del navegador y la descarga sería de GB |
| Subir los datos a git con LFS | Rompe el tope de tamaño y mezcla datos con código |

## 5. Consecuencias

- La web abre rápido y funciona sin conexión a los datos originales.
- Reproducir el ETL exige descargar las fuentes; el manifiesto dice cuáles y de dónde.
- Un cambio en el ETL obliga a regenerar los derivados.

## 6. Decisiones pendientes

| ID | Decisión | Qué falta para cerrarla |
| :-- | :-- | :-- |
| Q-1 | Formato final de los derivados | Medir tamaño real de `metrics.json` con el primer lote de columnas |

## 7. Fuentes

- `[O]` I-35 y I-38 de este repositorio, con sus fuentes primarias citadas en cada nota.

## Relaciones

- [plan del ETL](../../docs/etl-plan.md) — pasos y reglas del ETL
- [[ADR-002-malla-primero-y-una-columna-por-capa]] — cómo se organiza la salida
