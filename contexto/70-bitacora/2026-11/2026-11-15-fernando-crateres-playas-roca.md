---
title: "Sesión 2026-11-15 — Cráteres, salares y roca volcánica en el ETL, con su correlación"
type: sesion
status: vigente
date: 2026-11-15
updated: 2026-11-15
summary: "E-17 (cráteres y playas), E-18 (roca volcánica y evaporitas) y E-19 (GeoJSON de pines), más un análisis de qué comparten los entornos de cada tipo de sitio."
autor: fernando
agente: claude-code
modelo: claude-opus-5-5
rama: feat/etl-puntos
scope: [etl/e17_puntos.py, etl/e18_roca.py, etl/e19_export.py, analisis/correlacion.py]
symbols: []
---

# Sesión 2026-11-15 — Cráteres, salares y roca volcánica en el ETL, con su correlación

## Problema o motivo

El reto pide cráteres de impacto y salinas (principio 4) y geología (dimensión 1). El ETL no tenía ninguno.

## Cambios

- `etl/e17_puntos.py` (E-17) → 202 cráteres de Wikidata (185 confirmados) y 73 playas de Natural Earth. Columnas
  `dist_crater_km`, `crater_diam_km_cercano`, `dentro_crater` y `dist_playa_km`.
- `etl/e18_roca.py` (E-18) → `roca_volcanica_frac` y `roca_evaporita_frac` desde GLiM 0.5°.
- `etl/e19_export.py` (E-19) → `export/puntos.geojson` con 332 pines (cráteres, playas y los 57 tubos verificados
  de E-16).
- `analisis/correlacion.py` → comparación por sitio contra controles de la misma latitud; resultados en
  `docs/analisis/point-correlation.md`.
- `ADR-009` y [[fuentes-de-puntos-de-la-tierra]].

## Verificación

- `test_puntos.py` 7 pruebas y `analisis/test_correlacion.py` 3 pruebas: OK.
- E-17 (91 s), E-18 (7 s) y E-19 (0.4 s) corridos con `audit/audit.py` al unir la rama con `main`; las líneas de la primera corrida no pasaron al registro porque su comando guardaba rutas locales. Mismos conteos: 202 cráteres, 73 playas y 332 pines. Cobertura: distancias 100 %, roca 99.3 %.
- Puntos de control: Meteor Crater `dentro_crater=1`; Salar de Uyuni `dist_playa_km=0`; Vredefort dentro.
- Resultado más claro: los salares son mucho más áridos, planos y sin vegetación que sus controles (δ de Cliff entre
  −0.73 y −0.87); los tubos tienen más roca volcánica (+0.67) y más relieve (+0.49). Los cráteres apenas difieren.

## Pendiente

- Glaciares (RGI 7.0) y accesibilidad (Weiss 2018): falta la descarga con cuenta Earthdata y confirmar la licencia.
- GLiM a 0.5° no ve volcanes chicos como el Etna.
