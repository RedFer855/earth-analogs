# Agents (MCP) and the AI assistant (bring your own key)

Two ways to drive the search engine and read its results without opening the code:

1. **Agent mode (MCP):** any MCP client (Claude Code, Claude Desktop, Codex CLI, Cursor, Antigravity) talks to
   `node scripts/mcp/servidor-mcp.mjs` over stdio. It reads the published results and can run the Rust engine with
   all of its options.
2. **Assistant in the viewer:** the web viewer has an "Asistente IA" panel. Without a key it gives a deterministic
   summary built from the engine numbers. With your own Gemini, OpenAI, DeepSeek or Claude key it answers questions
   about the selected candidate using only those numbers.

Both need only Node 22 or newer. There are no npm dependencies.

## Data the tools read

| Variable | What it is | Default |
| :-- | :-- | :-- |
| `EA_DATOS` | Published folder (`metrics.json`, `resultados/`, `puntos.geojson`, `capas7/`) | `$RUN/salida` if it has `metrics.json`, else `visor/public/datos` |
| `RUN` | ETL run folder (`manifest.json`, `columns/`, `perfiles.json`). Needed only to run the engine | unset |
| `RUN_PUNTOS` | Second run with distance columns, passed as `--puntos` when `usar_puntos` is true | unset |
| `EA_SALIDAS` | Where each engine run writes its own folder | `salidas/mcp/` (ignored by git) |
| `EA_PIPELINE` | Engine binary | `motor/target/release/pipeline(.exe)`, then `debug` |

Build the engine once with `cd motor && cargo build --release`. Clients never pass file paths: every path comes from
these variables or from the repository.

## Agent mode (MCP)

### Tools

| Tool | What it does | Writes? |
| :-- | :-- | :-- |
| `listar_objetivos` | Moon and Mars target sites, profiles and best published score | no |
| `listar_resultados` | Published results (site × profile) and the MCP runs of this session | no |
| `obtener_candidatos` | Earth candidates for a target, filtered by score, bounding box or full coverage | no |
| `explicar_candidato` | Physical sheet of one candidate: what matches, what differs, non-scored diagnostics, nearby lava tubes, craters and salt flats, warnings, and gravity, pressure, atmosphere and radiation | no |
| `consultar_pines` | Lava tubes, impact craters and salt flats by type, box or distance to a point | no |
| `resumir_capas7` | Earth variables at ~50 km (HEALPix level 7) at a point or summarized over a box | no |
| `ejecutar_motor` | Runs `pipeline` with `objetivo`, `perfil`, `candidatos`, `hilos`, `bbox`, `region_geojson`, `perfil_personalizado` (weights and tolerances), `separacion_km`, `excluir_km`, `k_area`, `min_area_km2`, `solo_barrido`, `usar_puntos`, `publicar_visor` | its own run folder; `publicar_visor: true` replaces that target in `visor/public/datos` |
| `ejecutar_escenarios` | Runs `--escenarios` and returns how stable each candidate is across scenarios | its own run folder |
| `estado_corrida` | Status, duration, engine report and top 5 candidates of a run | no |

Only one engine run at a time. `ejecutar_motor` waits up to `esperar_s` (default 50 s) and then returns the run id;
call `estado_corrida` with it. To read a finished run, pass `corrida: "<id>"` to `obtener_candidatos` or
`explicar_candidato`.

Prompts: `evaluar_analogo`, `comparar_objetivos` and `buscar_en_region`. They tell the model to use only tool numbers
and to state what matches and what differs.

### Claude Code

The repository has `.mcp.json`; open the repo and approve the `earth-analogs` server when asked. Or add it by hand:

```bash
claude mcp add earth-analogs -- node scripts/mcp/servidor-mcp.mjs
```

Set `RUN` in the shell before starting `claude` to let it run the engine.

### Claude Desktop

Edit `claude_desktop_config.json` (Settings → Developer → Edit Config) and restart the app. Use absolute paths:

```json
{
  "mcpServers": {
    "earth-analogs": {
      "command": "node",
      "args": ["C:/path/to/earth-analogs/scripts/mcp/servidor-mcp.mjs"],
      "env": { "RUN": "C:/path/to/run" }
    }
  }
}
```

### OpenAI Codex CLI

```bash
codex mcp add earth-analogs --env RUN=/path/to/run -- node /path/to/earth-analogs/scripts/mcp/servidor-mcp.mjs
```

Or in `~/.codex/config.toml`:

```toml
[mcp_servers.earth-analogs]
command = "node"
args = ["/path/to/earth-analogs/scripts/mcp/servidor-mcp.mjs"]
env = { RUN = "/path/to/run" }
```

### Cursor

Cursor reads `.cursor/mcp.json` (project) or `~/.cursor/mcp.json` (global), not `.mcp.json`. Copy the same block,
with an absolute path if you use the global file.

### Antigravity

Open the MCP servers panel → *Manage MCP Servers* → *View raw config* and add the same `earth-analogs` block as
for Claude Desktop, with absolute paths. (Menu names not verified on every version.)

### Example prompts

- "List the Mars targets and explain the best Earth analog for Jezero (JZ)."
- "Which lava tubes are within 100 km of candidate 3 for CB? What differs physically from the Moon?"
- "Run the engine for JZ only inside 15,-15,35,30 with slope weight 2, then explain the top result."

## Assistant in the viewer (bring your own key)

Open the viewer, pick a candidate and click **Asistente IA**.

- **Sin clave (no key):** deterministic summary of the same numbers the sheet shows. Always available.
- **With a key:** choose the provider, paste the key, click *Usar clave*. The model gets a short JSON with the
  candidate values, the target values, tolerances, labels, nearby features and planetary differences, and an
  instruction not to invent figures.

| Provider | Endpoint | Key travels in | From the browser |
| :-- | :-- | :-- | :-- |
| Google Gemini | `generativelanguage.googleapis.com/v1beta/models/<model>:generateContent` | `x-goog-api-key` header | yes |
| OpenAI | `api.openai.com/v1/chat/completions` | `Authorization: Bearer` | yes |
| DeepSeek | `api.deepseek.com/v1/chat/completions` | `Authorization: Bearer` | only through the local bridge |
| Claude (Anthropic) | `api.anthropic.com/v1/messages` | `x-api-key` | yes (`anthropic-dangerous-direct-browser-access`) |

The model name is editable; defaults change over time.

### Key handling (for shared machines and judging VMs)

- The key lives only in this page's memory. It is never written to `.env`, disk, `localStorage`, cookies, the URL
  or the console. The input field is `type="password"` and is cleared after loading.
- *Recordar solo en esta pestaña* keeps it in `sessionStorage`, which the browser deletes when the tab closes.
- *Borrar clave* drops it from memory and from `sessionStorage`. Reloading the page also drops it.
- Gemini keys go in the `x-goog-api-key` header, never in `?key=`.
- Every error shown in the panel is passed through a redactor that masks `AIza…`, `sk-…`, `Bearer …` and the key
  itself.
- Model answers are rendered as plain text (`textContent`), never as HTML.
- The team's own keys are never used: without a key the assistant stays deterministic.

## Local bridge (optional)

```bash
RUN=/path/to/run node scripts/mcp/puente-http.mjs
```

It listens on `http://127.0.0.1:5174` only. When the viewer finds it (only when you open the assistant), it:

- lets DeepSeek (or any provider) be called through it, avoiding browser CORS limits;
- shows **Recalcular con motor Rust**, which runs the engine for the selected target, optionally only inside the
  current view, and draws the new candidates without publishing them.

Protections: the `Host` header must be `127.0.0.1` or `localhost` (DNS rebinding), `Origin` must be a localhost
origin or listed in `EA_PUENTE_ORIGENES`, and every `POST` needs `X-Earth-Analogs: 1`. The key arrives in
`X-IA-Clave` on each request, is forwarded to the provider and is not stored or logged; there is no key vault and no
endpoint that returns a key. The bridge never publishes to the viewer.

## Tests

```bash
node --test "scripts/mcp/*.test.mjs"
npm --prefix visor run prueba
```
