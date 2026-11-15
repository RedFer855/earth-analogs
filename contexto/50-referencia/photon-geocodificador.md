---
title: "Photon de komoot como buscador de lugares del visor"
type: referencia
status: vigente
date: 2026-11-15
updated: 2026-11-15
summary: "La API pública photon.komoot.io busca lugares sobre datos de OpenStreetMap sin clave; pide uso justo, limita a quien abusa y no garantiza disponibilidad."
autor: fernando
consultado: 2026-11-15
vence: 2027-01-14
fuentes:
  - url: https://photon.komoot.io/
    nivel: O
    fecha: 2026-11-15
  - url: https://www.openstreetmap.org/copyright
    nivel: O
    fecha: 2026-11-15
---

# Photon de komoot como buscador de lugares del visor

## El dato

La página de Photon permite usar la API pública en proyectos propios con una condición: "please be fair";
el uso intensivo se limita y no hay garantía de disponibilidad. No publica cifras de límite ni habla de uso comercial.
Los datos son de OpenStreetMap, que se distribuyen bajo ODbL y exigen la atribución "© OpenStreetMap contributors".

## Qué cambia para el proyecto

- El buscador de `visor/src/globo.ts` manda a Photon solo el texto que escribe el usuario y pide 6 resultados; el
  visor muestra "Photon · © OpenStreetMap" como crédito.
- Si Photon no responde, el resto del visor funciona: la búsqueda por coordenadas no depende de él.
- Para una demo con mucho público conviene no depender de la instancia pública (se puede autoalojar Photon).

## Estado de verificación

Verificado — fernando, 2026-11-15, en la página de Photon. La página no nombra la licencia de los datos; ODbL sale
de la página de copyright de OpenStreetMap.

## Relaciones

- [[ADR-011-visor-web-sobre-el-contrato]] — visor web que lo usa
