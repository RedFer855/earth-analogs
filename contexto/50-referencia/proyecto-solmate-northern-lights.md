---
title: "SolMate (Team Northern Lights): proyecto externo del mismo reto"
type: referencia
status: vigente
date: 2026-11-13
updated: 2026-11-13
summary: "SolMate puntúa unas 1,9 millones de celdas de 0,1° contra 11 objetivos de la Luna y Marte. Su validación usa como controles bosques, cultivos y ciudades, y los análogos lunares quedan en el percentil mediano 51,6."
autor: fernando
consultado: 2026-11-13
vence: 2026-12-13
fuentes:
  - url: https://github.com/Tanbin-CS/solmate
    nivel: P
    fecha: 2026-11-13
  - url: https://github.com/Tanbin-CS/solmate/blob/main/docs/VALIDATION.md
    nivel: P
    fecha: 2026-11-13
  - url: https://github.com/hellorifat/solmate
    nivel: P
    fecha: 2026-11-13
---

# SolMate (Team Northern Lights): proyecto externo del mismo reto

## El dato

- **Repositorio activo:** `Tanbin-CS/solmate`, público, con licencia Apache-2.0. Se creó el 2026-10-11 y el último push
  es del 2026-11-14T04:22Z (consultado con `gh api` el 2026-11-13, hora de Honduras). El prototipo de octubre,
  `hellorifat/solmate`, no tiene licencia, así que, según su repositorio, no es reutilizable.
- **Qué hace:** puntúa unas 1,9 millones de celdas de tierra a 0,1° (~11 km) contra 11 objetivos: 9 regiones Artemis,
  Jezero y Arcadia. Usa 7 dimensiones. El núcleo está en Python, con copia en TypeScript dentro de un Web Worker, y el
  terreno a 100 m se calcula en Cloud Run. La app en vivo y los videos no se verificaron.
- **Validación** (`docs/VALIDATION.md`, tabla del 31 de octubre):
  - Positivos: 17 sitios pareados con Marte y 10 con la Luna. Controles: 20 sitios de bosque, cultivo, pastizal,
    sabana, humedal y ciudad.
  - AUC: Jezero 0,844; mediana de la Luna 0,760; Arcadia 0,582.
  - Percentil mediano de los positivos lunares entre toda la tierra: 51,6, apenas por encima de una ubicación al azar.
  - Su terreno a 100 m da en la Luna un AUC de 0,36 a 0,44, peor que el azar. Lo atribuyen a que ASTER GDEM mide copas
    de árboles y edificios, y por eso no lo mezclan en el puntaje.
- **Métodos observados en su código:**
  - `compute/modes.py`: si el objetivo cae dentro del rango p1–p99 de la Tierra, la similitud es una gaussiana con
    σ = 1,4826·MAD (*match*). Si cae fuera, es la ECDF (*toward*) y se reporta la brecha.
  - `config/processes.yaml`: etiquetas por reglas fijas sobre valores medidos.
  - `compute/novelty.py`: distancia al análogo conocido más cercano y supresión de candidatos vecinos (*spaced top*).

## Estado de verificación

Repositorio y documentos leídos con `gh api` el 2026-11-13. Las cifras salen de su `VALIDATION.md` y no se reprodujeron. El despliegue y los videos no se verificaron.

## Relaciones

- [[dimensiones-innegociables]]: dimensiones y principios oficiales del reto
- [[I-01-proyectos-previos-de-analogos-en-github]]: otros proyectos públicos relacionados
- [[I-18-procesos-como-variables]]: procesos como variables por celda
- [[referentes-externos-de-analogos]]: referentes de agencias y catálogos externos
