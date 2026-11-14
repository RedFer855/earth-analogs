---
title: "I-01 — Proyectos previos de análogos y de sitios lunares o marcianos en GitHub"
type: investigacion
status: vigente
date: 2026-11-03
updated: 2026-11-14
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
- Hay repositorios públicos creados para este mismo reto en octubre de 2026. Incluirlos en la tabla y describirlos con lo que diga su README.
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

**Repositorios públicos del mismo reto (2026)**

Se revisaron repositorios públicos de este mismo reto (README y documentación, 2026-11-05 y 2026-11-13). No se
describen aquí uno por uno. De esa revisión se anotaron ideas de método. No se usa código de nadie: cada idea se
escribe desde cero, con nuestros datos y nuestras reglas, y se prueba antes de entrar.

- **Similitud en dos modos.** Si el valor del objetivo cae dentro del rango p1–p99 de la Tierra, la similitud es una
  gaussiana con σ = 1,4826·MAD. Si cae fuera, se usa la ECDF y se reporta cuánto falta. Es la base de "hasta dónde
  llega la Tierra" ([[ADR-007-contrato-de-metrics-json]]).
- **Cobertura por dimensión:** cuántas dimensiones se pudieron comparar y cuáles faltan ([[ADR-007-contrato-de-metrics-json]]).
- **Etiquetas de procesos** con reglas fijas sobre valores medidos, sin sumar al puntaje y con el valor como evidencia
  ([[I-18-procesos-como-variables]]).
- **Distancia en km al análogo documentado más cercano**, para marcar candidatos nuevos, y separación mínima entre los
  primeros candidatos para que no se repita el mismo lugar ([[I-03-analogos-terrestres-documentados]]).
- **Distancia de Wasserstein entre histogramas de pendiente**, como alternativa a comparar solo la mediana.
- **Desglose del aporte de cada variable**, reglas explícitas para los faltantes y análisis de sensibilidad.
- **Validación con controles negativos** (bosque, cultivo, ciudad) además de los análogos documentados.
- **Cuidado con los DEM de superficie:** ASTER GDEM mide copas de árboles y edificios, así que la pendiente y la
  rugosidad finas pueden reflejar vegetación y no terreno.
- **Página de datos y método** servida en vivo y aviso de que el índice no es una probabilidad.

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

- <https://github.com/samuelakosaonyejekwe/lunahorizon>

## Relaciones

- [[reto-oficial-y-calendario]] — el reto y el calendario
- [[dimensiones-innegociables]] — las dimensiones contra las que se compara cada proyecto
- [[ADR-007-contrato-de-metrics-json]] — dónde quedaron la cobertura y "hasta dónde llega la Tierra"
- [[referentes-externos-de-analogos]] — referentes de agencias y catálogos
