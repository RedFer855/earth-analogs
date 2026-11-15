---
title: "ADR-012 — Servidor MCP, puente local y asistente con clave propia"
type: adr
status: vigente
estado: aceptado
date: 2026-11-15
updated: 2026-11-15
summary: "Agentes operan el motor y leen resultados por un servidor MCP stdio sin dependencias; el visor ofrece un asistente con la clave del usuario que vive solo en memoria y un puente 127.0.0.1 opcional que reenvía sin guardar."
autor: fernando
scope: [scripts/mcp/, visor/src/datos/iaCliente.ts, visor/src/ui/asistente.ts]
tablas: []
cu: []
supersedes: []
---

# ADR-012 — Servidor MCP, puente local y asistente con clave propia

## 1. Contexto

Los jueces y el equipo quieren consultar candidatos, explicar coincidencias y diferencias y correr el motor
(ADR-010) sin leer el código. Pueden hacerlo de dos formas: desde un agente (Claude Code, Codex, Cursor,
Antigravity) o desde el visor (ADR-011) con una IA. En una VM compartida, una clave pegada por un usuario no puede
terminar en disco, en `.env`, en la URL ni en los registros.

## 2. Decisión

- Un servidor MCP por stdio en Node, sin dependencias npm (`scripts/mcp/servidor-mcp.mjs`), con 9 herramientas y
  3 prompts sobre un núcleo compartido (`nucleo.mjs`).
- El cliente nunca pasa rutas: `RUN`, `RUN_PUNTOS`, `EA_DATOS`, `EA_SALIDAS` y `EA_PIPELINE` salen del entorno. Todo
  parámetro se valida con lista blanca de campos antes de tocar disco o procesos; `spawn` sin shell.
- Cada corrida escribe en `salidas/mcp/<id>` sembrada con el `metrics.json` publicado; publicar en el visor exige
  `publicar_visor: true` y solo copia `metrics.json` y el resultado de ese objetivo. Una corrida a la vez.
- `perfil_personalizado` parte del perfil de `perfiles.json` y cambia solo pesos y tolerancias, porque `--perfil-json`
  espera un perfil completo.
- Asistente BYOK en el visor: clave en memoria; `sessionStorage` solo si el usuario lo marca; nunca `localStorage`.
  Gemini con `x-goog-api-key`, nunca `?key=`. Respuestas como texto plano. Sin clave, resumen determinista.
- Puente HTTP opcional en `127.0.0.1:5174`: revisa `Host` y `Origin`, exige `X-Earth-Analogs: 1` en cada `POST`, y
  recibe la clave en cada solicitud sin guardarla. Nunca publica.
- La clave del equipo (`GEMINI_API_KEY` del `.env`) no se usa en el asistente.

## 3. Diseño

| Archivo | Papel |
| :-- | :-- |
| `scripts/mcp/validacion.mjs` | Validación y `redactarSecretos` |
| `scripts/mcp/healpix.mjs` | `ang2pix` nested y latitud autálica (mismas fórmulas que `etl/comun.py`) |
| `scripts/mcp/nucleo.mjs` | Lectura de datos publicados, armado de argumentos y corridas del motor |
| `scripts/mcp/explicacion.mjs` | Ficha física determinista |
| `scripts/mcp/servidor-mcp.mjs` | JSON-RPC por stdio; versiones 2024-11-05, 2025-03-26 y 2025-06-18 |
| `scripts/mcp/puente-http.mjs` | Puente local para el visor |
| `visor/src/datos/iaCliente.ts`, `visor/src/ui/asistente.ts` | Cliente BYOK y panel |

Guía de uso en inglés: `docs/mcp-and-ai.md`.

## 4. Alternativas descartadas

| Alternativa | Por qué no |
| :-- | :-- |
| SDK oficial de MCP (`@modelcontextprotocol/sdk`) | Agrega dependencias y `npm install` a la VM de los jueces; el protocolo stdio es chico |
| Bóveda de la clave en RAM del puente con `/api/ia/estado` y `/api/ia/borrar-clave` | Más superficie; pasar la clave en cada solicitud basta y no deja nada que borrar (decisión de fernando, 2026-11-15) |
| Usar la clave del equipo como respaldo | Expone la clave del equipo en la VM; sin clave el modo determinista ya responde |
| Aceptar rutas (`--maestro`, `--salida`) desde el cliente MCP | Permite leer o escribir fuera del repo |
| Que cada corrida escriba en la carpeta publicada | El motor reemplaza la entrada del objetivo en `metrics.json` y `publicar-datos.mjs` borra la carpeta entera |

## 5. Consecuencias

- Un agente puede explicar y recalcular análogos con los números reales y sin inventar cifras.
- Las corridas MCP viven mientras el proceso del servidor siga abierto; sus archivos quedan en `salidas/mcp/`.
- DeepSeek solo funciona por el puente (su API no está verificada para CORS desde el navegador).
- La tabla de proveedores está duplicada en `iaCliente.ts` y `proveedores-ia.mjs`; si cambia una, cambia la otra.

## 6. Decisiones pendientes

- Modelos por omisión de cada proveedor: los nombres cambian seguido; hoy son editables en el panel (no verificado
  a futuro).

## 7. Fuentes

- `[O]` Model Context Protocol, especificación 2025-06-18 — https://modelcontextprotocol.io/specification/2025-06-18 — no consultada en esta sesión (implementación desde conocimiento previo; probada con un cliente stdio propio).
- `[O]` Gemini API — https://ai.google.dev/api — prueba en vivo 2026-11-15: con una clave falsa en `x-goog-api-key`
  desde el navegador, la API respondió `HTTP 400 API key not valid` (acepta CORS y lee el header).

## Relaciones

- `[[ADR-010-motor-de-busqueda-sobre-la-tabla-del-etl]]` — opciones del motor que expone el servidor
- `[[ADR-011-visor-web-sobre-el-contrato]]` — visor donde vive el asistente
- `[[ADR-007-contrato-de-metrics-json]]` — contrato que leen las herramientas
