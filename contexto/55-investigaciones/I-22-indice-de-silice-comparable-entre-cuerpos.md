---
title: "I-22 — Índice de sílice o emisividad comparable entre ASTER, Diviner y TES"
type: investigacion
status: vigente
date: 2026-11-05
updated: 2026-11-05
summary: "Qué índice mineral del infrarrojo térmico se puede calcular igual en la Tierra (ASTER GED), la Luna (Diviner) y Marte (TES/THEMIS), con qué bandas, y si ya se comparó entre cuerpos."
autor: fernando
tipo_investigacion: A
riesgo: critico
---

# I-22 — Índice de sílice comparable entre cuerpos

Según la fuente, un índice basáltico no describe el polo sur lunar (tierras altas, no mar). La pregunta es qué índice de emisividad del
infrarrojo térmico se calcula de forma comparable con ASTER, Diviner y TES ([[dimensiones-innegociables]],
dimensión 1).

## Pregunta de investigación

¿Qué índice mineral del infrarrojo térmico (contenido de sílice, posición del pico de Christiansen u otro) se puede
calcular con las bandas de ASTER en la Tierra, Diviner en la Luna y TES o THEMIS en Marte, y si ya se usó para
comparar los tres cuerpos?

Datos externos de partida:

- Tierra: ASTER GED AG1km V003 (emisividad de 5 bandas, 1 km) y AST_05 V004 (15-90 m); escala × 0.001.
- Luna: Diviner tiene 3 canales cerca de 8 µm para el pico de Christiansen (CF).
- Marte: TES (espectros de 6 a 50 µm) y THEMIS (10 bandas en el infrarrojo térmico).

Puntos a responder:

1. Índices publicados de sílice o composición con las 5 bandas térmicas de ASTER: fórmula, bandas y fuente.
2. Producto de Diviner con el CF global o polar: nombre, versión, resolución, cobertura del polo sur, formato y valores
   típicos en tierras altas y mares.
3. Producto de TES o THEMIS con un índice comparable: nombre, versión, resolución, cobertura.
4. Relación publicada entre la posición del CF y el contenido de SiO₂.
5. Trabajos que hayan comparado la emisividad o el CF de rocas terrestres con la Luna o Marte, con valores.
6. Cobertura de ASTER en las zonas polares de la Tierra y fechas.

Fuentes preferidas: lpdaac.usgs.gov, earthdata.nasa.gov, pds-geosciences.wustl.edu, diviner.ucla.edu, ADS, Remote
Sensing of Environment, JGR Planets, Icarus. Un umbral, un criterio o el rango de operación de un instrumento no es un
valor medido.

## Resultado

**Tierra, ASTER** (5 bandas térmicas de 8.125 a 11.65 µm; 90 m en AST_05 y 1 km en GED):

- Índice de cuarzo de Ninomiya et al. 2005: QI = B11·B11 / (B10·B12). Vale de 1.10 a 1.30 en cuarzo y granito, y menos
  de 1.00 en rocas máficas.
- Índice de máficos: MI = B12 / B13. Vale de 1.05 a 1.25 en basalto y gabro, y menos de 0.95 en rocas félsicas.
- Estimación de sílice de Hook et al. 2005, con las bandas 10 a 14: de 65 % a 76 % en rocas félsicas y de 45 % a 52 %
  en máficas.

**Luna, Diviner.** El CF sale de un ajuste parabólico de 3 puntos con los canales 3, 4 y 5 (7.8, 8.25 y 8.55 µm). Mapa
corregido de Lucey, Greenhagen, Donaldson Hanna y Bowles (2021-02-23, CC BY 4.0, DOI 10.5281/zenodo.4558194, Zenodo),
de 32 ppd (unos 950 m/px): unos 7.95 µm en las tierras altas y unos 8.28 µm en los mares.

**Marte:** TES TSDR (desconvolución en minerales, 3 × 6 km) y mosaicos de THEMIS (100 m/px) con ratios de emisividad
entre bandas.

**De CF a SiO₂ (% en peso):**

- Cooper et al. 2002 (JGR): SiO₂ = −29.8 · λCF + 296, con r² = 0.772. Coeficientes no abiertos en la fuente.
- Renggli et al. (2026): λCF = 1.28 × 10⁻⁴ · SiO₂² − 3.55 × 10⁻² · SiO₂ + 9.649, con 50.9 ± 1.6 % en las tierras altas
  lunares y 45.8 ± 0.9 % en los mares. El artículo de 2026: no encontrado en las fuentes consultadas; en Crossref aparece un resumen de
  Renggli en Goldschmidt 2025 (10.7185/gold2025.27385).

**Limitación de ASTER:** su primera banda empieza en 8.125 µm, y el CF de las anortositas (unos 7.95 µm) y de las
rocas félsicas cae por debajo, así que ASTER no mide el CF.

**Efecto del ambiente:** el CF se corre al medir en vacío frente a medir en aire (Donaldson Hanna et al. 2012).

**Cobertura polar de ASTER:** la órbita no pasa más allá de unos 82.7° de latitud, y en la Antártida solo hay datos
útiles en el verano austral (noviembre a febrero). University Valley (77.9°S) y Haughton (75.4°N) quedan dentro.

## Preguntas abiertas

- Coeficientes de Cooper 2002 y de Hook 2005 sin confirmar en su fuente.
- Existencia y contenido del artículo de Renggli et al. 2026.

## Fuentes

- Lucey et al. 2021. https://doi.org/10.5281/zenodo.4558194 (consultado 2026-11-05)
- Crossref. https://api.crossref.org (consultado 2026-11-05)

## Relaciones

- [[dimensiones-innegociables]] — la dimensión 1
- [[I-24-equivalencias-de-clases-minerales]] — visible e infrarrojo cercano
- [[sensores-tierra]], [[sensores-luna]], [[sensores-marte]] — ASTER, Diviner y TES
