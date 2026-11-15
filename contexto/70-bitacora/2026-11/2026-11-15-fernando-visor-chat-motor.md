---
title: "Sesión 2026-11-15 — Chat que controla el motor desde el visor"
type: sesion
status: vigente
date: 2026-11-15
updated: 2026-11-15
summary: "El chat del visor entiende peticiones como «busca zonas como Jezero, 50 candidatos», carga el sitio y corre el motor por el puente local, con o sin clave API; campo de varias líneas, modo fácil y científico, y pestaña Motor con todos los controles."
autor: fernando
agente: claude-code
modelo: sonnet-5.5
rama: feat/visor-chat-motor
scope:
  - visor/src/ui/asistente.ts
  - visor/src/datos/agenteMotor.ts
  - visor/src/main.ts
  - visor/src/style.css
  - visor/pruebas/agente.prueba.ts
symbols:
  - Asistente
  - interpretarPeticion
  - validarSitio
  - sistemaSinSitio
---

# Sesión 2026-11-15 — Chat que controla el motor desde el visor

## Problema o motivo

El chat solo contestaba sobre un candidato o análogo ya elegido («Primero elige un candidato o un análogo»), el campo
era de una línea y la única forma de correr el motor era un botón escondido. Se pidió poder escribir «busca zonas como
Jezero, unos 50 escenarios» y que el visor lo haga.

## Cambios

- `visor/src/datos/agenteMotor.ts` → acciones en JSON que el visor valida antes de ejecutar (variables del perfil real,
  rangos acotados, sin campos extra): `ejecutar_motor`, `filtrar`, `seleccionar` y la nueva `elegir_sitio` (solo ids del
  índice). Prompt del agente en modo fácil y científico, y prompt para cuando aún no hay sitio.
- `interpretarPeticion` → sin clave API entiende un verbo de búsqueda más un sitio (por nombre o código) o una
  cantidad; «escenarios», «lugares» y «zonas» valen como candidatos, con tope de 500.
- `visor/src/ui/asistente.ts` → asistente con pestañas Chat, Motor y Clave API, y modos Fácil y Científico, dentro de la
  pestaña Chat del panel de análogos. Campo de varias líneas (Enter envía, Mayús+Enter baja de línea). La pestaña Motor
  tiene preajustes en palabras y, en científico, peso y tolerancia por variable, área, separación, exclusión, k y piso.
  Corre el motor por el puente local y, si no está, filtra la lista publicada.
- Análogos documentados → siguen contestando solo sobre el análogo, sin tocar el motor.
- `visor/src/main.ts` → el chat recibe el índice desde el inicio y puede pedir cargar un sitio; el resultado recalculado
  ya no reinicia el contexto del chat.

## Verificación

- `npm --prefix visor run prueba` → pasan `tsc --noEmit` y las pruebas, con casos nuevos de `interpretarPeticion`,
  `validarSitio` y `sistemaSinSitio`.
- Prueba manual en el navegador con el puente local activo: «busca nuevas zonas de jezero unos 50 escenarios» sin clave
  carga JZ, corre el motor en 1 s y deja 50 candidatos en el globo (no publicados); una pregunta posterior responde sobre
  el mejor candidato. Con clave API no se probó: no había una a mano.

## Lo que no cambió

- El camino con clave API (el modelo propone la acción y el visor la valida) no se ejecutó contra un proveedor real.
- Elegir un análogo documentado y preguntar no se repitió en el navegador.

## Relaciones

- [[2026-11-15-fernando-visor-panel-analogos]] — panel donde vive el chat
