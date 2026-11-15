---
title: "ADR-011 — Visor web sobre el contrato del motor"
type: adr
status: vigente
estado: aceptado
date: 2026-11-15
updated: 2026-11-15
summary: "El visor es una página estática con CesiumJS que solo lee metrics.json, el detalle de cada sitio y derivados de pocos MB; dibuja los candidatos como un solo Primitive y cuenta en una ficha en qué coincide y en qué difiere cada uno."
autor: fernando
scope: [visor/, scripts/visor/]
tablas: []
cu: []
supersedes: []
---

# ADR-011 — Visor web sobre el contrato del motor

## 1. Contexto

El motor (ADR-010) deja `metrics.json` y un archivo por sitio con 200 candidatos. El reto pide mostrar en qué
coinciden y en qué difieren los análogos, y el equipo quiere además ver tubos de lava, cráteres y salares, y buscar
zonas que cumplan varias condiciones a la vez. La web no puede leer la tabla (ADR-001, ADR-007).

[[I-14-alternativas-de-globo-3d]] deja a CesiumJS como el único que maneja la Tierra, la Luna y Marte, el
polo sur y terreno sin token. [[I-13-rendimiento-de-poligonos-en-cesium]] mide que miles de `Entity` bajan a 10-15
cuadros por segundo y que un `Primitive` con color por instancia aguanta.

## 2. Decisión

1. **Página estática.** Vite + TypeScript + CesiumJS, sin framework y sin servidor propio. Lee archivos de
   `visor/public/datos/` que copia `scripts/visor/publicar-datos.mjs` desde la salida del motor, minificados. El
   script se niega a copiar algo con `local_only` o `es_ejemplo`.
2. **Solo lo que dice el contrato.** El visor valida `version_contrato` al abrir y avisa si no coincide. Cada número
   de la pantalla sale de un campo del contrato, con su fuente y licencia.
3. **Candidatos como un solo `Primitive`** con una instancia por celda (polígono de `vertices`), color por `nota`.
4. **La ficha es el centro.** Por variable: valor de la Tierra, valor del objetivo, diferencia y
   coincide/difiere/sin dato; cobertura; temperatura como diagnóstico que no puntúa; y lo que ningún dato captura
   (gravedad, presión, atmósfera, radiación) desde `cuerpos`. Avisa cuando la celda puede caer sobre hielo (P-015).
5. **Estado en la URL** (`?sitio=JZ&candidato=3`) para compartir una vista.
6. **Imagen base abierta:** Sentinel-2 cloudless 2025 de EOX (CC BY-NC-SA 4.0), con 2016 (CC BY 4.0) de respaldo,
   luego NASA GIBS Blue Marble y por último NaturalEarthII, que viene con Cesium. Relieve de Cesium ion solo si hay
   token en `.env`. *Enmienda del 2026-11-15:* se pasó de 2016 a 2025 porque la imagen es más reciente y la licencia
   permite el uso no comercial con atribución ([[I-39-imagen-satelital-de-la-tierra-sin-clave]],
   [[eox-cloudless-licencias]]). Condiciones: el visor no se vende, el crédito con la licencia queda visible y lo que
   se derive de esas teselas se comparte con la misma licencia.
7. **Lo siguiente entra por fases** sobre esta base: pines de E-19 con distancia `cerca_de` del motor (ADR-009),
   búsqueda por varias condiciones sobre capas agregadas de E-21, estabilidad de escenarios y vista del sitio en la
   Luna o Marte.

## 3. Diseño

| Pieza | Qué hace |
| :-- | :-- |
| `visor/src/globo.ts` | Crea el globo, la cadena de imágenes y el buscador de lugares (Photon/OSM) |
| `visor/src/datos/contrato.ts` | Tipos del contrato, carga y validación, ayudas puras probadas |
| `visor/src/capas/candidatos.ts` | Un `Primitive` de relleno y otro de contorno; selección con clic |
| `visor/src/ui/panel.ts` y `ficha.ts` | Sitios por cuerpo, lista de candidatos y ficha |
| `scripts/visor/publicar-datos.mjs` | Copia la salida del motor al visor |

## 4. Alternativas descartadas

| Alternativa | Por qué no |
| :-- | :-- |
| Un servidor que consulte la tabla en vivo | Rompe ADR-001: la web solo carga derivados ligeros |
| `Entity` por candidato | Se vuelve lento con miles de polígonos (I-13) |
| MapLibre o deck.gl | No manejan la Luna ni Marte ni el polo sur (I-14) |
| Esri World Imagery | Exige clave y licencia propia |

## 5. Consecuencias

- Se puede publicar en cualquier hosting estático; los datos pesan unos 3 MB minificados para los 21 sitios.
- Cada corrida nueva del motor se publica corriendo el script; el visor no se recompila.

## 6. Decisiones pendientes

| ID | Decisión | Qué falta para cerrarla |
| :-- | :-- | :-- |
| Q-1 | Dónde se publica (GitHub Pages u otro) | Decidir el hosting y su flujo en CI |

## Relaciones

- [[ADR-007-contrato-de-metrics-json]] — contrato que lee el visor
- [[ADR-010-motor-de-busqueda-sobre-la-tabla-del-etl]] — quién escribe los datos
- [[ADR-009-capas-de-puntos-y-distancias]] — pines y distancias, que informan y no puntúan
- [[ADR-001-preprocesar-offline-y-servir-ligero]] — por qué no hay servidor
