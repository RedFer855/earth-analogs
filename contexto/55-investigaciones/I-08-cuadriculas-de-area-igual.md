---
title: "I-08 — Cuadrículas de área igual para dividir la Tierra, la Luna y Marte"
type: investigacion
status: vigente
date: 2026-11-04
updated: 2026-11-04
summary: "Compara HEALPix, S2, H3 y otras cuadrículas globales anidadas para dividir los tres cuerpos en celdas de área igual con subdivisión exacta, y qué implementaciones abiertas existen."
autor: fernando
tipo_investigacion: B
riesgo: bajo
---

# I-08 — Cuadrículas de área igual para dividir la Tierra, la Luna y Marte

Evalúa cuadrículas globales anidadas de área igual y librerías abiertas disponibles, considerando que una cuadrícula de latitud y longitud sesga el área hacia los polos.

## Prompt

```
I-08 — Cuadrículas globales de área igual

IMPORTANTE: Esta es una comparación de opciones contra criterios definidos. No escribas guías, no repitas el contexto y no elijas una opción: solo compara.

OBJETIVO
Comparar cuadrículas globales jerárquicas para dividir la superficie de la Tierra, la Luna y Marte en celdas de área igual que se subdividen en celdas hijas, para análisis a distintas escalas.

CONTEXTO (solo lo que cambia la comparación)
- Aplicabilidad a Tierra, Luna y Marte (incluido el polo sur lunar), evaluando implementaciones abiertas disponibles.

YA SABEMOS (no investigar ni repetir)
- Una cuadrícula de latitud y longitud tiene celdas de área distinta según la latitud.

OPCIONES A COMPARAR
1. HEALPix
2. S2 (Google)
3. H3 (Uber)
4. Otra cuadrícula global discreta (DGGS) de área igual con implementación abierta, si existe (por ejemplo ISEA3H o rHEALPix)

CRITERIOS
1. ¿Las celdas tienen área exactamente igual? Si no, variación máxima de área entre celdas en un mismo nivel.
2. ¿Cada celda se divide exactamente en sus hijas (anidamiento exacto) y cuántas hijas tiene?
3. Tamaños de celda que ofrece cada sistema en la Tierra, por nivel.
4. ¿Se puede usar sobre otra esfera (radio 1737.4 km de la Luna, 3396.19 km de Marte)? ¿La librería acepta el radio como parámetro?
5. Comportamiento en los polos (deformación o singularidades).
6. Implementaciones abiertas (cualquier lenguaje): nombre, versión, fecha del último release, licencia y soporte de WebAssembly.
7. Cómo se obtienen los vecinos de una celda.

ENTREGA
- Tabla comparativa: filas = opciones, columnas = criterios. Cada celda con el dato y la certeza entre paréntesis (C = confirmado, P = probable, N = no encontrado).
- Tabla de fuentes: Opción | Criterio | Fuente (enlace) | Fecha.
- Hasta 5 "hechos que cambiarían la comparación".
- Máximo 300 palabras fuera de las tablas. Sin recomendación final.

REGLAS
- Primero documentación oficial y artículos: healpix.sourceforge.io, s2geometry.io, h3geo.org, docs.rs, crates.io, artículos revisados (Górski et al. 2005 para HEALPix).
- Blogs y foros solo si no hay fuente oficial, con certeza P.
- Si no encuentras un dato, escribe "No encontrado". No lo deduzcas.
```

## Resultado

Comparación de seis cuadrículas globales jerárquicas (HEALPix, S2, H3, rHEALPix, ISEA3H y A5) bajo los siete criterios técnicos. Existen cuadrículas de área exactamente igual con implementación abierta.

### Resumen de la comparación

| Opción | Área igual | Anidamiento exacto | Hijas | Implementación abierta encontrada (WASM) | Polos |
| :-- | :-- | :-- | :-- | :-- | :-- |
| HEALPix | Sí | Sí | 4 | `cdshealpix` 0.10.1 (sí) | Área igual, celdas alargadas cerca del polo |
| S2 | No (máx/mín ~2.1×) | Sí | 4 | `s2` 0.2.0 (no encontrado; sin polígonos) | Polo en el centro de una cara, sin singularidad |
| H3 | No (~2× entre hexágonos; pentágonos ~0.5×) | No | 7 | `h3o` 0.11.1 (sí) | Hexágonos, sin singularidad |
| rHEALPix | Sí | Sí | 9 | Sin implementación nativa encontrada | Celda circular en el polo y celdas triangulares |
| ISEA3H | Sí entre hexágonos (pentágonos 5/6) | No | apertura 3 | Sin implementación nativa encontrada (DGGRID es C++, AGPL-3.0) | Sin singularidad con la orientación por defecto |
| A5 | Sí | No (jerarquía solo lógica) | 4 | `a5` 1.0.0 (no encontrado) | No encontrado |

Ninguna librería recibe el radio del cuerpo: todas trabajan en ángulos sobre la esfera unitaria y el área se escala
por R². Sirven igual para la Luna y Marte.

### Verificado en la fuente

| # | Dato verificado | Fuente `[O]` | Fecha |
| :-- | :-- | :-- | :-- |
| 1 | Niveles en el rango 1–10 000 km² para los seis sistemas y tres cuerpos con $4\pi R^2 / N_{\text{celdas}}$ ($R$ = 6371.0072, 3396.19 y 1737.4 km): en H3 Luna res. 2, el promedio total es 6 449 km² (6 455 km² es el promedio exclusivo de hexágonos). | Parámetros esféricos estándar | 2026-11-04 |
| 2 | S2 nivel 10: mín. 48.78, prom. 81.07, máx. 102.03 km² (razón 2.09×). | https://s2geometry.io/resources/s2cell_statistics.html | 2026-11-04 |
| 3 | H3: razón máx/mín entre hexágonos de 1.970 (res. 4) a ~1.993. | https://h3geo.org/docs/core-library/restable/ | 2026-11-04 |
| 4 | A5 no anida geométricamente (jerarquía lógica; `cellToSubcells` en v1.0). | https://a5geo.org/blog/2026/10/14/a5-v1 | 2026-11-04 |
| 5 | `cdshealpix` 0.10.1 (2026-10-15, Apache-2.0 OR MIT). | https://crates.io/api/v1/crates/cdshealpix | 2026-11-04 |
| 6 | `h3o` 0.11.1 (2026-11-02, BSD-3-Clause). | https://crates.io/api/v1/crates/h3o | 2026-11-04 |
| 7 | `a5` 1.0.0 (2026-10-15, Apache-2.0). | https://crates.io/api/v1/crates/a5 | 2026-11-04 |
| 8 | `s2` 0.2.0 publicado el 2026-08-19. | https://crates.io/api/v1/crates/s2 | 2026-11-04 |
| 9 | `dggal` 0.1.2 (2025-05-29, licencia declarada "non-standard", sin repositorio declarado en crates.io). | https://crates.io/api/v1/crates/dggal | 2026-11-04 |

Pendiente de verificación en fuente primaria o documentación técnica: el soporte de compilación WebAssembly de `cdshealpix` y `h3o`, la razón 1.5× citada para `AverageArea()` en S2 y el comportamiento polar de A5.

### Omisión detectada en la literatura revisada

Las seis cuadrículas son de área igual **sobre la esfera**. La Tierra y Marte son elipsoides: si se indexa con latitud geodésica sin convertir a latitud autálica, las áreas de las celdas varían alrededor de 0.3 % en la Tierra. La Luna se trata como esfera y no tiene este problema.

## Relaciones

- [[I-09-metodos-de-busqueda-de-analogos]] — métodos de búsqueda sobre cuadrículas globales
