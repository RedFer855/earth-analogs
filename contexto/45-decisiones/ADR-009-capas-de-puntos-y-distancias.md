---
title: "ADR-009 — Capas de puntos: pin más distancia por celda, sin puntuar"
type: adr
status: vigente
estado: aceptado
date: 2026-11-15
updated: 2026-11-15
summary: "Cráteres de impacto, tubos de lava y salares entran como pines y como columnas de distancia al más cercano; las distancias filtran y explican, no puntúan."
autor: fernando
scope: [etl/e17_puntos.py, etl/e18_roca.py, etl/e19_export.py, motor/pipeline/src/salida.rs]
tablas: [dist_crater_km, crater_diam_km_cercano, dentro_crater, cueva_dist_km, dist_playa_km, roca_volcanica_frac, roca_evaporita_frac]
cu: []
supersedes: []
---

# ADR-009 — Capas de puntos: pin más distancia por celda, sin puntuar

## 1. Contexto

El reto pide cráteres de impacto (principio 4), cuevas y tubos de lava (dimensión 7) y salinas (principio 4). Hasta
el 2026-11-14 el ETL solo tenía capas raster promediadas por celda. Un cráter o la boca de un tubo es un punto: si
se promedia, desaparece en la celda que lo contiene y no dice nada a las demás.

## 2. Decisión

1. Lo que es un punto se guarda como **pin** (`$RUN/puntos/puntos-tierra.json`, E-17; los tubos en `etl/sitios/cuevas-pyroduct-coordenadas.json`, E-16) y cada celda recibe la
   **distancia al más cercano** de cada tipo (`dist_*_km`).
2. Lo que cubre un área se guarda como **columna por celda** (`roca_volcanica_frac`, `roca_evaporita_frac`, E-18).
3. Las distancias **no entran al puntaje de similitud**. El motor las usa como filtro opcional ("a menos de 50 km de
   un tubo") y como dato en `metrics.json` (`cerca_de`). Las columnas de área sí pueden ser variables del perfil.
   Estado al 2026-11-15: el motor ya escribe `cerca_de` (`tubo_lava_km`, `crater_km`, `salar_km`, a 0.1 km, `null`
   sin dato) en cada candidato de `resultados/<perfil>/<sitio>.json`, y las columnas aparecen en `fuentes` de
   `metrics.json` con su licencia. El filtro por distancia sigue sin implementar.
4. Los pines salen al visor como GeoJSON (`$RUN/export/puntos.geojson`, E-19), con fuente, licencia y atribución en
   cada uno.

## 3. Diseño

- Distancia de gran círculo sobre la esfera de radio autálico, con árbol k-d en coordenadas cartesianas.
- `dentro_crater` = 1 si la celda toca el cráter: centro a menos de radio + 1.13 km (media diagonal de la celda).
  Sin ese margen, los cráteres más chicos que una celda no marcan ninguna (Meteor Crater, 1.2 km, quedaba fuera).
- `dist_playa_km` = 0 dentro del polígono; afuera, distancia al borde densificado cada 2 km.
- Cráteres: Wikidata (CC0), consulta del 2026-11-15, 202 entradas, 185 confirmadas. Las no confirmadas (Gusev, que
  está en Marte, y estructuras discutidas como Shiva o Wilkes Land) quedan como pin con `confirmado=false` y no
  cuentan en las distancias.
- Tubos: E-16 (`cueva_dist_km`, `cueva_n_tubos`) solo usa bocas verificadas una a una con fuente abierta: 57 de las
  119 de Pyroduct v3.0, cada una con su fuente.

## 4. Alternativas descartadas

| Alternativa | Por qué no |
| :-- | :-- |
| Earth Impact Database (PASSC) | El dominio passc.net está aparcado (comprobado 2026-11-15) y nunca declaró licencia |
| Impact Earth / Osinski et al. 2022 | Artículo CC BY-NC-ND; la licencia de la tabla no está declarada |
| Promediar los puntos por celda con `cruzar_por_coordenada` | El punto solo existe en una celda; las vecinas no se enteran |
| Distancias como variable del puntaje | Premia la cercanía a lo ya conocido; el reto pide no redescubrir análogos conocidos |

## 5. Consecuencias

- Cuatro columnas nuevas de cráteres y playas, más las dos de tubos de E-16, y dos de roca, con cobertura de 100 % (distancias) y 99.3 % (roca).
- El visor responde "a cuántos km está el tubo o cráter más cercano" leyendo una columna, sin cálculo en la web.
- GLiM a 0.5° es grueso: el Etna sale con 0 de roca volcánica. La versión vectorial lo resolvería si su licencia sale
  abierta.

## 6. Decisiones pendientes

| # | Decisión | Qué falta para cerrarla |
| :-- | :-- | :-- |
| Pendiente 1 | Las 62 bocas de Pyroduct sin coordenada verificada | Segunda fuente por boca (I-46) |
| Pendiente 2 | Glaciares (RGI 7.0) y accesibilidad (Weiss 2018) | Descarga con cuenta Earthdata y licencia de MAP confirmada |
| Pendiente 3 | GLiM vectorial | Licencia declarada por la Universidad de Hamburgo |

## 7. Fuentes

- `[O]` Wikidata, servicio SPARQL — https://query.wikidata.org/ — consultado 2026-11-15.
- `[O]` Pyroduct Digital Catalog v3.0 — https://zenodo.org/records/14535885 — consultado 2026-11-15.
- `[O]` Natural Earth 1:10m Playas — https://www.naturalearthdata.com/downloads/10m-physical-vectors/ — consultado 2026-11-15.
- `[O]` GLiM 0.5° — https://doi.pangaea.de/10.1594/PANGAEA.788537 — consultado 2026-11-15.

## Relaciones

- [[ADR-007-contrato-de-metrics-json]] — `cerca_de` va en metrics.json
- [[fuentes-de-puntos-de-la-tierra]] — licencias y tamaños
- [[licencias-coordenadas-de-cuevas]] — licencias de cuevas
- [[I-46-coordenadas-de-bocas-de-tubos-de-lava]] — contraste de coordenadas
