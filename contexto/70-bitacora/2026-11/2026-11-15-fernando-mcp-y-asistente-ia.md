---
title: "Sesión 2026-11-15 — Servidor MCP, puente local y asistente IA con clave propia"
type: sesion
status: vigente
date: 2026-11-15
updated: 2026-11-15
summary: "Servidor MCP stdio sin dependencias con 9 herramientas sobre el motor y los datos publicados, asistente BYOK en el visor con la clave solo en memoria y puente 127.0.0.1 que permite recalcular con el motor Rust."
autor: fernando
agente: claude-code
modelo: opus-5.5
rama: feat/mcp-nucleo
scope:
  - scripts/mcp/
  - visor/src/datos/iaCliente.ts
  - visor/src/ui/asistente.ts
  - visor/src/main.ts
  - visor/src/style.css
  - .github/workflows/ci.yml
  - docs/mcp-and-ai.md
symbols:
  - ejecutarMotor
  - explicarCandidato
  - construirSolicitud
  - crearPuente
---

# Sesión 2026-11-15 — Servidor MCP, puente local y asistente IA con clave propia

## Problema o motivo

Se pidió operar el motor y explorar los resultados desde agentes (MCP) y desde el visor con la clave de IA del
propio usuario, sin que esa clave quede en disco en una VM compartida. Decisiones en
[[ADR-012-mcp-y-asistente-con-clave-propia]].

## Cambios

- `scripts/mcp/validacion.mjs`, `healpix.mjs`, `nucleo.mjs`, `explicacion.mjs` → núcleo compartido: validación con
  lista blanca, `redactarSecretos`, `ang2pix` nested con latitud autálica, lectura de `metrics.json`, `resultados/`,
  `puntos.geojson` y `capas7/`, corridas del motor en `salidas/mcp/<id>` y ficha física determinista.
- `scripts/mcp/servidor-mcp.mjs` y `.mcp.json` → 9 herramientas y 3 prompts por stdio.
- `scripts/mcp/puente-http.mjs`, `proveedores-ia.mjs` → puente local con chequeo de `Host`, `Origin` y header anti-CSRF.
- `visor/src/datos/iaCliente.ts`, `visor/src/ui/asistente.ts` → panel «Asistente IA» (Gemini, OpenAI, DeepSeek, Claude)
  y botón «Recalcular con motor Rust» cuando el puente está activo.
- `.github/workflows/ci.yml` → `node --test "scripts/mcp/*.test.mjs"` en el job de auditoría.
- `docs/mcp-and-ai.md`, `README.md` → guía en inglés para cada cliente MCP y política de claves.

Cambios al plan original: `perfil_personalizado` se aplica sobre el perfil de `perfiles.json` (el motor rechaza un
perfil parcial); las corridas no escriben en la carpeta publicada; el puente no guarda claves (no hay
`/api/ia/estado` ni `/api/ia/borrar-clave`); se agregó Claude como proveedor; se revisa `Host` además de `Origin`;
la respuesta del modelo se pinta como texto; Cursor lee `.cursor/mcp.json`, no `.mcp.json`.

## Verificación

- `node --test "scripts/mcp/*.test.mjs"`: 35 pruebas pasan (validación, inyección, HEALPix contra un `ipix` del motor,
  protocolo MCP de punta a punta, seguridad del puente, motor simulado).
- `npm --prefix visor run prueba` (tipos y pruebas, incluida `ia.prueba.ts`) y `npm --prefix visor run build`: pasan.
- Con una corrida real del ETL en `$RUN` local: `explicar_candidato` de CB, pines cerca de Hawái, `capas7` en el
  Atacama y `ejecutar_motor` de JZ con bbox, peso de pendiente 2 y `--puntos` (1,5 s).
- En el navegador: modo sin clave, recálculo por el puente (vista chica → mensaje claro del piso de 40 000 km²;
  vista amplia → 43 candidatos en 0,4 s) y Gemini con clave falsa: URL sin `?key=`, error 400 sin la clave,
  `localStorage` y `sessionStorage` vacíos y la clave ausente del DOM.

## Lo que no cambió

- No se agregó CSP al visor: Cesium carga workers y teselas de varios orígenes y no hubo tiempo de probarla.
- El asistente usa el candidato seleccionado; no toma aún la zona dibujada en el panel de zona.
- No se probaron con clave real OpenAI, DeepSeek ni Claude; solo la forma de la solicitud en las pruebas.

## Pendientes

- Confirmar los modelos por omisión de cada proveedor (decisión pendiente del ADR-012).

## Relaciones

- `[[ADR-012-mcp-y-asistente-con-clave-propia]]` — decisiones de esta sesión
- `[[ADR-010-motor-de-busqueda-sobre-la-tabla-del-etl]]` — motor que se opera
- `[[ADR-011-visor-web-sobre-el-contrato]]` — visor donde vive el asistente
