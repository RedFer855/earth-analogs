---
title: "I-17 — Sitios objetivo en la Luna y Marte, con coordenadas y valores por variable"
type: investigacion
status: vigente
date: 2026-11-05
updated: 2026-11-05
summary: "Cuáles son las regiones candidatas oficiales para bases lunares (Artemis) y los sitios de aterrizaje y exploración de Marte, con coordenadas, fuente oficial y valores físicos publicados en la literatura."
autor: fernando
tipo_investigacion: A
riesgo: critico
---

# I-17 — Sitios objetivo en la Luna y Marte

Identifica los sitios objetivo oficiales en la Luna y Marte, sus coordenadas, polígonos y valores físicos publicados ([[dimensiones-innegociables]]).

## Prompt

```
I-17 — Sitios objetivo en la Luna y Marte

IMPORTANTE: Esta es una consulta de datos puntuales. No escribas una guía general, no repitas información de contexto y no hagas recomendaciones.

OBJETIVO
¿Cuáles son los sitios oficiales candidatos a base lunar permanente y a aterrizaje o exploración en Marte, con sus coordenadas y el valor medido de cada variable física en ese sitio?

CONTEXTO (solo lo que cambia la respuesta)
- Sitios objetivo oficiales en la Luna y Marte para caracterizar con variables físicas publicadas: pendiente, rugosidad, iluminación, temperatura superficial, inercia térmica, mineralogía (emisividad o índice de sílice), hielo/permafrost y viento.
- Escala de interés de cientos de metros a pocos kilómetros, indicando el producto de datos del que proviene cada medición.

YA SABEMOS (no investigar ni repetir)
- Productos lunares: LOLA (relieve), LOLA Polar Illumination y Permanent Shadow (Mazarico et al. 2011), Diviner (temperatura y emisividad), LROC.
- Productos marcianos: MOLA, HRSC-MOLA, HiRISE, CTX, THEMIS, TES, CRISM, SWIM (hielo).
- No buscar análogos terrestres: solo los sitios de la Luna y Marte.

PUNTOS A RESPONDER
1. Lista oficial vigente de regiones candidatas de Artemis III en el polo sur lunar (la más reciente de la NASA): nombre, centro aproximado (latitud, longitud), tamaño de la región, fecha del anuncio.
2. Para cada región del punto 1: pendiente media o rango, fracción de tiempo con sol (iluminación), cercanía a zonas en sombra permanente, temperatura de superficie (rango o media). Con el producto y la resolución de donde sale cada valor.
3. Otros sitios lunares propuestos para bases permanentes fuera de Artemis III (otras agencias o programas), si los hay, con coordenadas y fuente.
4. Sitios de Marte propuestos para exploración humana o bases (por ejemplo, los talleres de "Exploration Zones" de la NASA): nombre, coordenadas, por qué se eligieron.
5. Sitios de aterrizaje de rovers en Marte con datos publicados de terreno (Curiosity en Gale, Perseverance en Jezero y otros): coordenadas y valores publicados de pendiente, rugosidad, inercia térmica y mineralogía.
6. Para los sitios de Marte de los puntos 4 y 5: hielo cerca de la superficie (según SWIM u otro producto), temperatura de superficie y viento.
7. Si existe un conjunto de datos ya armado con valores por sitio (tabla o archivo descargable) para cualquiera de estos sitios.

ENTREGA
- Tabla: # | Sitio | Cuerpo | Latitud | Longitud | Variable | Valor | Unidad | Producto y resolución | Fuente oficial (enlace) | Fecha de la fuente | Certeza
- Una fila por sitio y variable.
- Certeza: Confirmado / Probable / No encontrado.
- Máximo 150 palabras fuera de la tabla. Sin introducción ni conclusiones.

REGLAS
- Primero la documentación oficial: nasa.gov, ntrs.nasa.gov, pds.nasa.gov, lroc.asu.edu, pgda.gsfc.nasa.gov, artículos revisados en ADS (ui.adsabs.harvard.edu).
- Si un valor no está publicado para ese sitio, escribe "No encontrado". No lo calcules ni lo deduzcas.
- Coordenadas en grados decimales, latitud y longitud este.
```

## Resultado

### Regiones candidatas de alunizaje de Artemis (actualización 2024)

- **Lista oficial vigente (NASA RELEASE24-136, 2024-10-28):** https://www.nasa.gov/news-release/nasa-provides-update-on-artemis-iii-moon-landing-regions/ enumera 9 regiones sin orden de prioridad: Peak near Cabeus B, Haworth, Malapert Massif, Mons Mouton Plateau, Mons Mouton, Nobile Rim 1, Nobile Rim 2, de Gerlache Rim 2 y Slater Plain. El comunicado no incluye coordenadas ni polígonos.
- **Actualización de misión:** según nasa.gov/mission/artemis-iii (actualizada el 2026-10-19) y comunicado del 2026-10-23, Artemis III pasó a ser una demostración tripulada en órbita baja en 2027, trasladando el primer alunizaje al polo sur a Artemis IV en 2028; las 9 regiones permanecen como la lista oficial vigente de candidatas.
- **Áreas y rango térmico conjunto (NTRS `20250007692`, NASA TFAWS 2025, LEMS-A3, Rodriguez-Ruiz y Burbridge, 2025-08-04):** reporta áreas, perímetros y latitud central de las 9 regiones (8003 km² en total; sin longitudes) y el rango térmico conjunto del polo sur entre -203 °C y +10 °C (≈70 a 283 K), valor agregado del conjunto más que medición por región individual.
- **Diferencia entre criterios de selección y mediciones (LPSC 2025 #2655, Moye et al.):** valores como temperatura media de verano ≤ 125 K, pendiente ≤ 20° / < 8° o distancia a PSR ≤ 2 km corresponden a criterios del mapeo y requisitos de alunizaje/EVA, no a mediciones promedio de cada sitio. Entre las mediciones reportadas figuran los porcentajes de área con pendiente < 8° (Mons Mouton Plateau 12.7 %, Slater Plain 19 a 25 %), mediciones en radios de 100 m para Haworth, Nobile Rim 1, Peak Near Shackleton y Connecting Ridge (TTU, 2024), y resolución de iluminación de 120 m/px para Cabeus B, Mons Mouton Plateau y Nobile Rim 2.
- **Relieve de alta resolución de las 13 regiones de 2022:** PGDA Product 78 (`pgda.gsfc.nasa.gov/products/78`; Zenodo `10.5281/zenodo.17954508`; PSJ `10.3847/PSJ/ae5b70`) provee modelos de elevación de 5 m por *shape-from-shading* (con pendiente, VRM y ortomosaico de máxima iluminación) para las 13 regiones anunciadas en agosto de 2022; no incluye Mons Mouton Plateau, Slater Plain ni Peak near Cabeus B ni archivo oficial descargable de contornos para las 13 regiones. (El conjunto `terranova-robotics` en Hugging Face no es un producto oficial de la NASA.)

### Contornos y centroides oficiales de las 9 regiones Artemis

El data release del USGS (`10.5066/P1MEQ6UK`, 2024-12-05, dominio público; *Down Selected Artemis III Candidate Landing Site Navigational Grids*) incluye el paquete `A3_9regions-lonlat-simplified.zip` (shapefile y GeoJSON con 9 polígonos en `GCS_Moon_2000`, esfera de 1737.4 km, además de cuadrículas LGRS de 1 km, 100 m y 10 m). Sus centroides en estereográfica polar sur y áreas coinciden dentro del <1 % con NTRS `20250007692`:

| Región | Código | Latitud del centro | Longitud del centro (°E) | Área del polígono (km²) | Área en NTRS (km²) |
| :-- | :-- | --: | --: | --: | --: |
| Peak near Cabeus B | CB | -83.637 | 291.251 | 399.8 | 397.3 |
| Haworth | HW | -86.764 | 337.223 | 888.0 | 886.6 |
| Malapert Massif | MA | -85.995 | 359.764 | 441.0 | 439.9 |
| Mons Mouton Plateau | MP | -84.335 | 30.592 | 4451.8 | 4428.4 |
| Mons Mouton | MM | -85.427 | 31.743 | 256.0 | 255.2 |
| Nobile Rim 1 | N1 | -85.436 | 37.347 | 400.0 | 398.7 |
| Nobile Rim 2 | N2 | -83.954 | 58.822 | 400.0 | 397.8 |
| de Gerlache Rim 2 | G2 | -88.230 | 295.372 | 400.0 | 399.8 |
| Slater Plain | SP | -87.164 | 125.538 | 399.8 | 399.3 |

Mons Mouton y Nobile Rim 1 son adyacentes y quedan dentro del borde sur de Mons Mouton Plateau.

### Otros sitios lunares y sitios en Marte

- **Otros sitios lunares:** ILRS/Chang'e-7 (Shackleton, de Gerlache, Amundsen; trampa fría en -88.71°, 167.10°E), Schrödinger (HERACLES) y Nobile (VIPER).
- **Mediciones publicadas en sitios de rovers y landers de Marte:**
  - Inercia térmica medida en superficie: Gale (265 a 375, REMS), Jezero (180 a 605, MEDA), InSight (160 a 230, RAD) y Zhurong (258). (Nota: cifras citadas en literatura secundaria como 2.82 m en Gale y 2.35 m en Jezero corresponden al RMSE de alineación de DEM, no a rugosidad del terreno; rangos como 0–70 m/s o ≥ 133 K corresponden a envolventes instrumentales o de diseño térmico, no a mediciones ambientales.)
  - Pendiente media medida: InSight 4.4° (HiRISE 1 m) y Zhurong 2.1° ± 3.3° (HiRIC).
  - Viento al mediodía en Jezero: ~10 m/s (MEDA); longitud de rugosidad aerodinámica z0 = 1 cm (modelo MEDA).
  - En Gale conviene distinguir el punto de aterrizaje (`137.44°E`) del centro del cráter (`138.0°E`).
- **Sitios candidatos de Starship en Marte** (seleccionados por presencia de hielo somero según SWIM y SHARAD): Phlegra Montes (`PM-1`, 35.23°, 163.95°E), Arcadia Planitia (`AP-1`, 39.84°, 202.14°E; `AP-9`) y Erebus Montes (`EM-16`, 39.89°, 192.03°E).
- **Exploration Zones de la NASA (taller 2015, LPI Contribution 1879):** zonas circulares de **100 km de radio**, sin lista consolidada oficial descargable de las ~47 propuestas:
  - Noctis Landing: -6.494°, 267.547°E.
  - Deuteronilus Mensae: 39.3°, 23.2°E.
  - Erebus Montes: 38.9°, 188.5°E.
  - Acheron Fossae: 36.8°, 222.8°E.
  - Mawrth Vallis: 24.3°, 340.8°E.
  - Jezero: 18.38°, 77.58°E.

## Fuentes

- <https://www.nasa.gov/news-release/nasa-provides-update-on-artemis-iii-moon-landing-regions/>
- <https://nasa.gov/mission/artemis-iii>
- <https://pgda.gsfc.nasa.gov/products/78>
- <https://doi.org/10.5281/zenodo.17954508>
- <https://doi.org/10.3847/PSJ/ae5b70>
- <https://doi.org/10.5066/P1MEQ6UK>

## Relaciones

- [[dimensiones-innegociables]] — las dimensiones y lo que pide el reto
- [[sensores-luna]], [[sensores-marte]] — los productos de donde salen los valores
