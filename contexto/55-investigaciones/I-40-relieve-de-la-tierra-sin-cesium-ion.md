---
title: "I-40 — Relieve de la Tierra en CesiumJS sin Cesium ion a partir de Copernicus DEM"
type: investigacion
status: vigente
date: 2026-11-10
updated: 2026-11-10
summary: "Compara formas de convertir Copernicus DEM en terreno que CesiumJS cargue sin Cesium ion (quantized-mesh, heightmap, 3D Tiles o en el navegador): datum vertical, peso, Windows, mantenimiento, licencia y si sirve para medir alturas."
autor: fernando
tipo_investigacion: B
riesgo: bajo
---

# I-40 — Relieve de la Tierra en CesiumJS sin Cesium ion

Comparación de alternativas para generar y cargar terreno terrestre en CesiumJS a partir de Copernicus DEM sin token de Cesium ion (complementa [[I-12-cesium-sin-ion-luna-y-marte]]).

## Prompt

```
I-40 — Relieve de la Tierra en CesiumJS sin Cesium ion

IMPORTANTE: Esta es una comparación de opciones contra criterios definidos. No escribas tutoriales de instalación, no repitas el contexto y no elijas una opción: solo compara.

OBJETIVO
Comparar formas de convertir Copernicus DEM GLO-30 en terreno que CesiumJS 1.147 cargue desde un sitio estático, sin Cesium ion.

CONTEXTO (solo lo que cambia la comparación)
- Entorno de referencia: Windows 11; sitio web estático sin acceso obligatorio a internet.
- Se consulta si el resultado permite pedir alturas con CesiumJS (`sampleTerrainMostDetailed`).

YA SABEMOS (no investigar ni repetir)
- Copernicus DEM GLO-30 y GLO-90 se descargan sin cuenta desde AWS S3 (registry.opendata.aws/copernicus-dem) como COG.
- Copernicus DEM es un modelo de superficie (incluye vegetación y edificios) y sus alturas van sobre el geoide EGM2008, no sobre el elipsoide.
- CesiumJS 1.147 es Apache-2.0. Cesium ion queda fuera de la comparación.
- Esta consulta es solo de la Tierra.

OPCIONES A COMPARAR
1. cesium-terrain-builder con salida quantized-mesh (por ejemplo, la imagen Docker de tum-gis).
2. Otras herramientas que generan quantized-mesh desde un GeoTIFF (por ejemplo, tin-terrain de HERE o quantized-mesh-encoder en Python).
3. Heightmap propio cargado con `CustomHeightmapTerrainProvider` de CesiumJS (las alturas se generan offline como PNG o binario por tesela).
4. Terreno calculado en el navegador desde teselas de alturas codificadas en RGB (por ejemplo, cesium-martini).
5. Malla del terreno como 3D Tiles (glTF), sin proveedor de terreno.

CRITERIOS
1. Si acepta Copernicus DEM GeoTIFF/COG directamente y si convierte las alturas de EGM2008 al elipsoide WGS84 (o si hay que hacerlo antes con GDAL/PROJ, y con qué archivo de geoide).
2. Con qué clase de CesiumJS 1.147 se carga sin Cesium ion (`CesiumTerrainProvider.fromUrl`, `CustomHeightmapTerrainProvider`, `Cesium3DTileset`, u otra).
3. Si funciona `sampleTerrainMostDetailed` (o un método equivalente para pedir alturas) sobre el resultado.
4. Peso en disco por área cubierta a 30 m con todos sus niveles, si hay cifras publicadas.
5. Si corre en Windows 11 (nativo, WSL o Docker).
6. Mantenimiento: fecha del último release o commit.
7. Licencia de la herramienta.

ENTREGA
- Tabla comparativa: filas = opciones, columnas = criterios. Cada celda con el dato y, entre paréntesis, la certeza (C = confirmado, P = probable, N = no encontrado).
- Tabla de fuentes: Opción | Criterio | Fuente (enlace) | Fecha.
- Una lista de hasta 5 "hechos que cambiarían la comparación".
- Máximo 300 palabras fuera de las tablas.
- No incluyas recomendación final.

REGLAS
- Usa primero la documentación oficial: cesium.com/learn/cesiumjs/ref-doc, github.com/CesiumGS (incluida la especificación quantized-mesh), los repositorios en GitHub de cada herramienta (README, releases y LICENSE), gdal.org y proj.org.
- Foros y blogs solo si no hay fuente oficial; marca la certeza como P.
- Si una opción no aplica al contexto, dilo en una línea y no la desarrolles.
- Si no encuentras un dato, escribe "No encontrado". No lo deduzcas.
- Español claro.
```

## Resultado

Fuentes consultadas el 2026-11-10. No se encontró el peso en disco de ninguna opción (criterio 4).

| # | Dato | Qué dice la fuente | Fuente `[O]` (consultada 2026-11-10) |
| :-- | :-- | :-- | :-- |
| 2c | Entrada y datum de mago-3d-terrainer | Acepta GeoTIFF; `-g, --geoid` admite Ellipsoid, EGM96, EGM2008, EGM84 o un GeoTIFF | https://github.com/Gaia3D/mago-3d-terrainer (README) |
| 2c | layer.json | Se genera con `-j, --json` ("Generate layer.json for terrain data") | README, arriba |
| 2c | Licencia y versión | MPL-2.0; `v1.14.2-release`, publicado el 2026-07-31 | https://api.github.com/repos/Gaia3D/mago-3d-terrainer/releases/latest |
| 2c | Plataforma | Java 21; el README trae ejemplos con rutas de Windows | README, arriba |
| - | Otros cuerpos | `--body moon` genera terreno de la Luna; el DEM lunar se reproyecta antes a geográficas con `+a=1737400`. Marte no aparece en el README | README, arriba |
| 3, 4 | `CustomHeightmapTerrainProvider` y cesium-martini | Sin `availability`: `sampleTerrainMostDetailed` no aplica y se usa `sampleTerrain` con nivel explícito | - |
| - | Teselas `.terrain` | Vienen en gzip y el servidor HTTP debe responder con `Content-Encoding: gzip` (formato quantized-mesh) | - |

### Hallazgos y brechas abiertas

- **mago-3d-terrainer** (MPL-2.0, v1.14.2, Java 21): el README muestra ejemplos para Windows, la conversión de EGM2008 al elipsoide con `--geoid EGM2008` y la generación de `layer.json` con `-j`. También documenta `--body moon` (con el DEM lunar reproyectado a geográficas con `+a=1737400`); Marte no figura en el README.
- **Brechas sin dato publicado:** ninguna de las fuentes reporta el peso en disco por área cubierta ni prueba práctica de `--body moon`.
- Copernicus DEM es un modelo de superficie (incluye vegetación y edificios), lo que afecta zonas no áridas.

### Bibliografía

- `[O]` Gaia3D/mago-3d-terrainer, README y release v1.14.2 — https://github.com/Gaia3D/mago-3d-terrainer — consultado 2026-11-10.

## Relaciones

- [[I-12-cesium-sin-ion-luna-y-marte]]: alternativas para la Luna y Marte sin Cesium ion
