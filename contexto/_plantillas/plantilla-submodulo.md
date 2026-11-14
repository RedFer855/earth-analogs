---
title: "SM-NN.N — Nombre del submódulo"
type: submodulo
status: borrador
date: AAAA-MM-DD
updated: AAAA-MM-DD
summary: "El comportamiento que entrega, en una frase verificable."
autor: alias
agente: claude-code
modulo: M-NN
responsable: alias
estado_sm: propuesto     # propuesto | en-preguntas | aprobado | en-curso | en-auditoria | cerrado
depende_de: []           # IDs de submódulos: [SM-NN.1]
cambia_contrato: false   # true si modifica el contrato de entrada o salida de una ficha
scope: []
tablas: []
---

# SM-NN.N — Nombre del submódulo

<!-- Guardar como contexto/35-modulos/M-NN-nombre/SM-NN.N-nombre.md.
     Esta nota es lo ÚNICO que lee quien lo implementa. Si le falta algo, se agrega como pregunta, no se busca. -->

## Objetivo

Qué comportamiento queda funcionando, y cómo se nota desde fuera.

## Fuera de alcance

Lo que parece parte de esto pero va en otro submódulo o en otra fase.

## Flujo de negocio

Pasos del actor, con enlace al caso de uso y a sus reglas `RN`.

## Contexto necesario

Extractos copiados del contrato de otros módulos (con enlace a su ficha) y la **lista cerrada** de archivos que se pueden leer.

| Fuente | Extracto o archivo |
| :-- | :-- |
| | |

## Diseño técnico

Entradas y salidas (archivos, structs de Rust, funciones expuestas a Wasm, componentes del visor), con firma.

## Criterios de aceptación

- [ ] Criterio verificable.
- [ ] Pruebas: cuáles y dónde.

## Preguntas

Las hace el agente al planear o al auditar; las responde el responsable. `abierta` o `investigando` bloquean la aprobación.

| ID | Pregunta | Para | Respuesta | Estado |
| :-- | :-- | :-- | :-- | :-- |
| Q-01 | | responsable | | abierta |

## Investigaciones

Lo que ni el agente ni el responsable saben: prompt con `plantilla-investigacion.md` → `I-NN`. Mientras no vuelva, la
pregunta queda `investigando`.

## Plan de PRs

| PR | Contenido | Líneas estimadas | Revisión |
| :-- | :-- | :-- | :-- |
| 1 | | ~500 (tope 1000) | Show / Ask |

## Cierre

<!-- Se llena al cerrar: qué quedó, qué cambió del contrato de la ficha, qué deuda P-NNN dejó.
     Quien venga después lee esto, no las sesiones. -->

## Checklist de auditoría

Para `auditor-submodulo` y para quien aprueba. Plan:

- [ ] Objetivo verificable y "fuera de alcance" explícito.
- [ ] Contexto necesario completo: el implementador no tendría que buscar nada más.
- [ ] Contratos con firma; si toca el contrato de una ficha, `cambia_contrato: true`.
- [ ] Dependencias declaradas y coherentes con la tabla de la ficha.
- [ ] Criterios de aceptación medibles y pruebas nombradas.
- [ ] Ninguna pregunta abierta; lo desconocido tiene su investigación.
- [ ] Cada PR de unas 500 líneas de código; ninguno sobre 1000 con pruebas.

Diff:

- [ ] Cumple cada criterio de aceptación.
- [ ] No toca archivos fuera del diseño ni del contexto listado.
- [ ] La lógica de cálculo vive en el motor (Rust) y se prueba; el visor solo dibuja.
- [ ] Sin datos crudos pesados ni secretos; cada dataset con fuente y licencia; gitleaks limpio.
- [ ] `contexto/` actualizado: ficha, cierre y nota de sesión.

## Relaciones

- `[[M-NN-ficha]]` — módulo al que pertenece
