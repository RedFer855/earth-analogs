---
title: "M-NN — Nombre del módulo"
type: modulo
status: vigente
date: AAAA-MM-DD
updated: AAAA-MM-DD
summary: "Qué resuelve el módulo para el reto, en una frase."
autor: alias
responsable: alias      # programador dueño: responde las preguntas de sus agentes y aprueba sus submódulos
tablas: []
cu: []
---

# M-NN — Nombre del módulo

<!-- Guardar como contexto/35-modulos/M-NN-nombre/M-NN-ficha.md. Corta y estable: el detalle vive en cada submódulo. -->

## Propósito y flujo

Qué hace el módulo, en 3 a 5 líneas. Enlaza los casos de uso y las reglas; no los copies.

## Contrato de entrada

Lo que este módulo consume de módulos anteriores. Si cambia, lo aprueba el responsable del otro módulo.

| Qué | De dónde | Forma |
| :-- | :-- | :-- |
| | `M-NN` | archivo, struct o función |

## Contrato de salida

Lo que este módulo expone a los que vienen después. Es lo **único** que otro módulo debería necesitar leer de este.
Cambiarlo requiere `cambia_contrato: true` en el submódulo y la aprobación de un integrador.

| Qué | Forma | Estable desde |
| :-- | :-- | :-- |
| | archivo, struct, función Wasm o componente | `SM-NN.N` |

## Submódulos

| ID | Objetivo | Depende de | Estado |
| :-- | :-- | :-- | :-- |
| `[[SM-NN.1-nombre]]` | | — | propuesto |

## Relaciones

- `[[nombre-de-la-nota]]` — por qué se relaciona
