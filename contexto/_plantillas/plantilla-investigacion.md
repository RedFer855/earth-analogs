---
title: "I-NN — Título de la investigación"
type: investigacion
status: borrador   # vigente cuando el resultado esté revisado
date: AAAA-MM-DD
updated: AAAA-MM-DD
summary: "Qué pregunta responde, en una frase."
autor: nombre
tipo_investigacion: A   # A = datos · B = opciones
riesgo: critico         # critico | bajo
---

# I-NN — Título de la investigación

Una investigación tiene dos momentos: el **prompt**, que se redacta primero y se entrega para que el equipo elija con
qué agente lanzarlo, y el **resultado**, que se revisa contra el prompt antes de usarlo.

## Prompt

```
I-NN — Título corto

IMPORTANTE: Esta es una consulta de datos puntuales. No escribas una guía general, no repitas información de contexto y no hagas recomendaciones.

OBJETIVO
Una sola pregunta que se responda con datos.

CONTEXTO (solo lo que cambia la respuesta)
- Quiénes somos y dónde operamos.
- Etapa real del proyecto.
- Restricción relevante.

YA SABEMOS (no investigar ni repetir)
- Dato verificado.

PUNTOS A RESPONDER
1. Punto concreto (máximo 8).

ENTREGA
- Tabla: # | Punto | Respuesta | Fuente oficial (enlace) | Fecha de la fuente | Certeza
- Certeza: Confirmado / Probable / No encontrado.
- Máximo 150 palabras fuera de la tabla. Sin introducción ni conclusiones.

REGLAS
- Primero la documentación oficial: sitios esperados.
- Si no encuentras un dato, escribe "No encontrado". No lo deduzcas.
- Montos con moneda y fecha de consulta.
```

## Resultado

Se llena cuando la investigación vuelve y se revisa. Formato de cierre:

### Recomendación

Máximo 200 palabras. Va primero.

### Qué decide y qué no decide

### Riesgos

| Riesgo | Probabilidad | Qué hacer |
| :-- | :-- | :-- |

### Decisiones pendientes y qué información falta

### Bibliografía

Agrupada por nivel, con fecha de consulta.

- `[O]` Oficial del proveedor o del Estado — URL — consultado AAAA-MM-DD.
- `[P]` Práctica documentada.
- `[B]` Blog u opinión.

## Relaciones

- `[[nombre-de-la-nota]]` — por qué se relaciona
