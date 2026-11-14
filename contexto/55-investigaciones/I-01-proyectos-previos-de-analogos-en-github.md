---
title: "I-01 — Proyectos previos de análogos y de sitios lunares o marcianos en GitHub"
type: investigacion
status: vigente
date: 2026-11-03
updated: 2026-11-05
summary: "Qué proyectos públicos (Space Apps anteriores, universidades, agencias) ya comparan sitios terrestres con la Luna o Marte o seleccionan sitios de base, qué datos y métodos usan y qué es reutilizable según sus licencias."
autor: fernando
tipo_investigacion: B
riesgo: critico
---

# I-01 — Proyectos previos de análogos y de sitios lunares o marcianos en GitHub

## Prompt

La búsqueda abarca las 8 dimensiones ([[dimensiones-innegociables]]) e incluye repositorios públicos reportados para el reto.

```
I-01 — Proyectos previos de análogos terrestres de la Luna y Marte

IMPORTANTE: Compara opciones concretas. No escribas una guía general ni repitas el contexto.

OBJETIVO
¿Qué proyectos públicos ya comparan lugares de la Tierra con sitios de la Luna o Marte, o seleccionan sitios de base o aterrizaje con datos abiertos, qué cubren y qué no?

CONTEXTO (solo lo que cambia la respuesta)
- Reto de NASA Space Apps 2026: "Identify Earth Locations that Analog the Permanent Moon Base Locations and Mars".
- Se busca identificar qué proyectos públicos comparan lugares de la Tierra con la Luna o Marte usando variables físicas, qué cubren y qué no.
- Las 8 dimensiones del reto: geología y minerales; terreno; temperatura e iluminación; agua y hielo; polvo, viento y erosión; biología y habitabilidad; cuevas y subsuelo; condiciones para aterrizar, moverse y construir.

YA SABEMOS (no investigar ni repetir)
- Portales de datos: Moon Trek, Mars Trek, USGS Astrogeology STAC, OpenTopography.
- Repo reportado para este mismo reto: github.com/shishir-kuet/terrestrial-analog-finder (creado en octubre de 2026). Incluirlo en la tabla y describirlo con lo que diga su README.
- Sanganeria (2026, National High School Journal of Science) compara brillo de imágenes de la Tierra, la Luna y Marte, no variables físicas.
- Netzel y Stepinski (2018, BAMS) buscan climas parecidos en una grilla global (no es de análogos planetarios).

PUNTOS A RESPONDER
1. Repos públicos creados para el reto de Space Apps 2026 sobre análogos (búsqueda en GitHub por nombre del reto, "terrestrial analog", "earth analog moon mars", "analog finder").
2. Proyectos de Space Apps 2023 a 2025 sobre análogos o selección de sitios lunares o marcianos (Artemis, CLPS), con repo o página pública.
3. Repos o herramientas académicas que calculen similitud entre terrenos o ambientes de la Tierra y de Marte o la Luna.
4. Para cada proyecto: si busca en toda la Tierra o en lugares elegidos a mano (cuántos), qué variables usa y a qué dimensiones del reto corresponden, método de comparación, si dice dónde falla la analogía, licencia, última actividad.
5. Qué dimensiones del reto no cubre ninguno de los proyectos encontrados.
6. Confirmar si el reto de 2026 es nuevo o tuvo un antecesor con otro nombre en ediciones anteriores de Space Apps.

ENTREGA
- Tabla: # | Proyecto | URL | Año | Qué hace | Cobertura (toda la Tierra o N lugares) | Variables y dimensiones | Método | ¿Dice dónde falla? | Licencia | Última actividad | Certeza
- Certeza: Confirmado / Probable / No encontrado.
- Máximo 200 palabras fuera de la tabla. Sin recomendaciones.

REGLAS
- Primero GitHub, el sitio de Space Apps (spaceappschallenge.org) y sitios de NASA o ESA; artículos en ADS para las herramientas académicas.
- Solo proyectos con código, datos o página accesibles. Describir con lo que dice el propio proyecto.
- Si no encuentras un dato, escribe "No encontrado". No lo deduzcas.
```

## Resultado

**`shishir-kuet/terrestrial-analog-finder`** (GitHub API y README, consultados el 2026-11-05):

- Repositorio público creado el 2026-10-09, último push el 2026-10-10. No declara licencia en el repositorio.
- Según su README, qué hace:
  - Ordena 558 ventanas de la Tierra de 12 × 12 km: 20 sitios con nombre y 538 celdas de una grilla regular sobre 12 regiones desérticas, polares y volcánicas.
  - Las compara con 12 regiones de referencia: 8 del polo sur lunar (LOLA a 5 m) y 4 de Marte (DTM de CTX: Jezero, Gale, Meridiani y el sur de Utopia).
  - Todo va a una malla común de 30 m.
- Variables de terreno declaradas en el README: relieve local, pendiente mediana y P90, rugosidad de base corta, integral hipsométrica y la distancia de Wasserstein entre histogramas de pendiente.
- Capa térmica y mineral según el README:
  - En la Tierra: ECOSTRESS, VIIRS y EMIT.
  - En Marte: la inercia térmica de TES.
  - En la Luna: el producto polar de Diviner.
  - Solo la inercia térmica entra al puntaje, y con peso 0 por defecto.
- Método declarado: distancia ponderada con escala resistente, reglas explícitas para faltantes y desglose del aporte de cada variable. Incluye un análisis de sensibilidad y advierte que el índice no es una probabilidad.
- Pila declarada: Python, GDAL, FastAPI y React con Leaflet. Los datos son archivos JSON y PNG.
- Alcance según su README: analiza 558 ventanas en 12 regiones elegidas (no cobertura terrestre global), su puntaje combina variables de terreno con una sola variable térmica opcional y no incluye agua/hielo, polvo/viento, cuevas ni biología.

**Otros proyectos y literatura**

- **Space Data Atlas** (swapniltamse): licencia MIT, público, último push el 2026-10-29 (GitHub API). Es una guía con cuadernos para retos de Space Apps 2026, incluido el de análogos terrestres. Filtra la Tierra por cajas delimitadoras con SRTM, EMIT y HLS.
- **Ediciones anteriores del reto:** las ediciones de 2023 a 2025 tuvieron retos de sismología, Artemis II, hábitats y reciclaje, pero ninguno de análogos. En 2026 existe además otro reto lunar, "Lunar Landing Site Navigator".
- **Proyectos de Space Apps anteriores** (LunaBot 2025, Moonquakes 2023, Lunar Trek 2023, Artemis+ 2025): ninguno compara con la Tierra. (LunaHorizon en `github.com/samuelakosaonyejekwe/lunahorizon` devolvió 404 en GitHub API el 2026-11-05 y corresponde a "Lunar Landing Site Navigator".)
- **Académicos:**
  - Planetary Code Collection (Schörghofer) modela la irradiancia de un solo sitio, Mauna Kea.
  - MarsRetrieval busca similitud de imágenes dentro de Marte.
  - Katwijk Beach es un conjunto de datos de rover de la ESA.
  - Méndez et al. 2021 tratan la habitabilidad.
  - Ninguno busca en toda la Tierra.

## Fuentes

- <https://github.com/shishir-kuet/terrestrial-analog-finder>
- <https://github.com/samuelakosaonyejekwe/lunahorizon>

## Relaciones

- [[reto-oficial-y-calendario]] — el reto y el calendario
- [[dimensiones-innegociables]] — las dimensiones contra las que se compara cada proyecto
- [[proyecto-solmate-northern-lights]] — otro proyecto externo del mismo reto
