---
title: "I-19 — Subsuelo: cuevas, fosas y tubos de lava en la Tierra, la Luna y Marte"
type: investigacion
status: vigente
date: 2026-11-05
updated: 2026-11-05
summary: "Qué catálogos y productos registran cuevas, fosas (pits) y tubos de lava en la Luna, Marte y la Tierra, con qué atributos, y cómo se han comparado entre cuerpos para usarlos como variable o capa de puntos."
autor: fernando
tipo_investigacion: A
riesgo: critico
---

# I-19 — Subsuelo: cuevas, fosas y tubos de lava

La dimensión 7 del reto abarca cuevas, tubos de lava y subsuelo ([[dimensiones-innegociables]]). En la
Tierra se identificó el Pyroduct Digital Catalog ([[sensores-tierra]]); no se relevaron las fuentes equivalentes de la Luna y Marte.

## Prompt

```
I-19 — Cuevas, fosas y tubos de lava en la Tierra, la Luna y Marte

IMPORTANTE: Esta es una consulta de datos puntuales. No escribas una guía general, no repitas información de contexto y no hagas recomendaciones.

OBJETIVO
¿Qué catálogos de cuevas, fosas (pits) y tubos de lava existen para la Luna, Marte y la Tierra, con qué atributos medidos, y cómo se han comparado entre cuerpos?

CONTEXTO (solo lo que cambia la respuesta)
- Reto de NASA Space Apps 2026: dimensión sobre cuevas, tubos de lava, entornos subterráneos y otras características del subsuelo.
- Evaluación de catálogos utilizables como capas de puntos o variables espaciales (p. ej., densidad de cuevas o distancia al tubo más cercano).

YA SABEMOS (no investigar ni repetir)
- Tierra: Pyroduct Digital Catalog v3.0 (115 tubos de lava, CC BY 4.0, DOI concepto 10.5281/zenodo.14535885) y WOKAM (mapa mundial de karst, 1:40 000 000).

PUNTOS A RESPONDER
1. Catálogos de fosas y posibles entradas a cuevas en la Luna (por ejemplo, el atlas de fosas lunares de LROC): nombre, versión, número de elementos, atributos (diámetro, profundidad, coordenadas, tipo de terreno), formato, licencia, enlace.
2. Catálogos de cuevas candidatas en Marte (por ejemplo, Mars Global Cave Candidate Catalog): mismos atributos que en el punto 1.
3. Evidencia publicada de tubos de lava intactos o colapsados en la Luna y Marte (radar, gravimetría, imágenes): qué lugares, qué dimensiones, qué fuente.
4. Catálogos globales de cuevas y tubos de lava en la Tierra además de Pyroduct (bases de datos de cuevas volcánicas, catálogos nacionales con cobertura amplia): nombre, cobertura, atributos, licencia.
5. Tubos de lava y cuevas de la Tierra usados como análogos de la Luna o Marte por agencias espaciales (por ejemplo, programas de ESA o NASA de entrenamiento o pruebas en cuevas): lugar, coordenadas, para qué se usan.
6. Trabajos que comparan cuantitativamente tubos de lava o fosas entre la Tierra y la Luna o Marte (dimensiones, relación ancho-profundidad, efecto de la gravedad en el tamaño).
7. Si existe algún producto que detecte cavidades del subsuelo desde órbita en la Tierra a escala global (radar, gravimetría, interferometría): nombre y resolución, o "No encontrado".

ENTREGA
- Tabla: # | Punto | Cuerpo | Catálogo o lugar | Atributos | Número de elementos | Formato y licencia | Fuente oficial (enlace) | Fecha de la fuente | Certeza
- Certeza: Confirmado / Probable / No encontrado.
- Máximo 150 palabras fuera de la tabla. Sin introducción ni conclusiones.

REGLAS
- Primero la documentación oficial y artículos revisados: lroc.asu.edu, pds.nasa.gov, astrogeology.usgs.gov, esa.int, zenodo.org, ADS (ui.adsabs.harvard.edu), Icarus, JGR Planets, Planetary and Space Science.
- Si no encuentras un dato, escribe "No encontrado". No lo deduzcas.
- Coordenadas en grados decimales.
```

## Resultado

### Catálogos y evidencia planetaria

- **Luna — LROC Lunar Pit Atlas:** ~278 entradas listadas en la tabla web (`lroc.im-ldi.com/atlases/pits/list`) con nombre, latitud, longitud, diámetros, azimut y profundidad (p. ej., Mare Tranquillitatis Pit en 8.3355°, 33.222°, 105 m de profundidad). La tabla web no incluye columna de tipo de terreno ni polígonos, y la única descarga directa disponible es `lroc_pits_atlas.pdf`. Según `lroc.im-ldi.com/about/terms`, el material web que no proviene del PDS mantiene derechos reservados.
- **Luna — Nubes de puntos internas de 6 fosas** (Wagner y Robinson 2022): versión 1.0.0 (2022-07-25), CC BY 4.0, 131.8 MB ([O] Zenodo `6622042`).
- **Marte — Mars Global Cave Candidate Catalog (MGC³)** (Cushing, PDS, `doi:10.17189/1519222`): ~1062 entradas reportadas con coordenadas, tipo y confianza (~100 con diámetro y profundidad); conteo exacto, fecha y términos pendientes de verificación directa en PDS (USGS devolvió 403).
- **Evidencia de tubos intactos en la Luna y Marte:**
  - Fosa de Mare Tranquillitatis con radar Mini-RF (Carrer et al. 2024, *Nature Astronomy*; cifras reportadas de ~45 m de ancho y 135–175 m de profundidad pendientes de lectura directa en la fuente).
  - Marius Hills con el radar de SELENE y gravimetría GRAIL (Kaku et al. 2017).
  - Anomalías gravitacionales de GRAIL en los mares lunares (Chappaz et al. 2017).
  - Cadenas de colapso en Arsia Mons y Olympus Mons en Marte.
- **Catálogos y análogos terrestres:**
  - Fuera de Pyroduct Digital Catalog v3.0 (115 tubos de lava, CC BY 4.0) y WOKAM (karst, 1:40 000 000), los inventarios regionales de la UIS confirman que no existe una base global estandarizada de cuevas volcánicas.
  - En entrenamiento espacial, la ESA opera los programas CAVES y PANGAEA en Lanzarote (incluyendo el tubo de La Corona; Undara y Barhout también se citan sin coordenadas verificadas en esta nota).
  - No existe un producto orbital global que detecte cavidades subsuperficiales en la Tierra.
- **Comparación cuantitativa entre cuerpos (Sauro et al. 2020, *Earth-Science Reviews*):**
  - Ancho de colapso: decenas de metros en la Tierra, 200 a 400 m en Marte y 500 a 900 m en la Luna (tubos terrestres 10 a 30 veces más angostos).
  - Volumen por metro de tubo: ~80 veces mayor que en la Tierra en Marte y de 300 a 700 veces en la Luna, debido a la menor gravedad.

### Pendientes de verificación

- Verificar MGC³ en el PDS (`10.17189/1519222`), los permisos de reutilización de la tabla web de LROC y las coordenadas exactas de La Corona y de los sitios de entrenamiento de la ESA.

## Fuentes

- <https://lroc.im-ldi.com/atlases/pits/list>
- <https://doi.org/10.5281/zenodo.14535885>
- <https://doi.org/10.17189/1519222>

## Relaciones

- [[dimensiones-innegociables]] — la dimensión 7
- [[sensores-tierra]] — el Pyroduct Digital Catalog, según la fuente
