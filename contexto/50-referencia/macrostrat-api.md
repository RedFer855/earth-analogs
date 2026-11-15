---
title: "API de Macrostrat v2 para unidades geológicas"
type: referencia
status: vigente
date: 2026-11-15
updated: 2026-11-15
summary: "La API pública de Macrostrat (v2) devuelve unidades geológicas cartografiadas por punto, sin clave, con datos bajo CC BY 4.0; el visor la consulta en vivo como overlay opcional."
autor: fernando
consultado: 2026-11-15
vence: 2027-02-13
fuentes:
  - url: https://macrostrat.org/api
    nivel: O
    fecha: 2026-11-15
---

# API de Macrostrat v2 para unidades geológicas

## El dato

La raíz de la API (`https://macrostrat.org/api`, versión 2) declara la licencia "CC-BY 4.0" y remite a `/meta`
para más detalle. No pide clave. El visor llama a `/api/v2/geologic_units/map?lat=…&lng=…` con el centro de la zona
dibujada y muestra hasta 6 unidades (nombre, litología, edad).

## Qué cambia para el proyecto

- Es un overlay opcional del visor (Fase D), no una entrada del ETL ni del motor: no altera ningún puntaje.
- CC BY 4.0 obliga a atribuir: el panel muestra "Macrostrat API v2" como fuente.
- La consulta es por un solo punto (el centro), no por toda la zona: en zonas grandes la unidad mostrada puede no
  representar el resto.

## Estado de verificación

Verificado — fernando, 2026-11-15, licencia leída en la raíz de la API. Los términos de `/meta` no se leyeron
(no verificado).

## Relaciones

- [[ADR-011-visor-web-sobre-el-contrato]] — visor web que la consume
