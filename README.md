# Earth analogs for permanent Moon base locations and Mars

NASA Space Apps Challenge 2026 — team J4Ks (Tegucigalpa, Honduras).

We look for places on Earth that are analogs of the candidate permanent Moon base regions and of Mars, comparing
several physical variables at once (slope, terrain roughness, temperature, aridity, permafrost, wind, dust,
mineralogy) and stating, for every analog, **what matches and what differs** (gravity, atmosphere, pressure and scale
included).

## Status

Creation phase (2026-11-14 and 2026-11-15).

- Data pipeline plan: [docs/etl-plan.md](docs/etl-plan.md)
- Data sources: [docs/data-sources.md](docs/data-sources.md)
- Audit trail of every pipeline run: [audit/](audit/README.md)
- Research notes, decisions and work log: [contexto/](contexto/INDEX.md) (in Spanish)

## Architecture

| Part | Where | What it does |
| :-- | :-- | :-- |
| ETL | [etl/](etl/) | Builds one table of Earth land cells (HEALPix) with one column per variable, offline. |
| Search engine | [motor/](motor/README.md) | Rust. Compares every cell with each Moon and Mars target and writes `metrics.json`. |
| Viewer | [visor/](visor/README.md) | CesiumJS globe with candidates, pins and a sheet of what matches and what differs. |
| Agents and AI | [scripts/mcp/](docs/mcp-and-ai.md) | MCP server for AI agents, local bridge, and a bring-your-own-key assistant in the viewer. |

## Run everything with one command

```bash
node scripts/iniciar.mjs --run /path/to/run --puntos /path/to/other-run
```

Starts the local bridge (engine and assistant), starts the viewer on the first free port and opens the page. `RUN`
and `RUN_PUNTOS` can come from the environment instead of the flags. Without `RUN` the viewer still works; only the
"recalculate with the Rust engine" button is off. Options: `--build` serves the production build, `--sin-abrir`
does not open the browser, `--sin-puente` skips the bridge. Ctrl+C stops everything.

## Use it from an AI agent (MCP)

```bash
node scripts/mcp/servidor-mcp.mjs   # stdio MCP server, no npm dependencies
```

`.mcp.json` registers it for Claude Code. Setup for Claude Desktop, Codex CLI, Cursor and Antigravity, the tool list
and example prompts: [docs/mcp-and-ai.md](docs/mcp-and-ai.md).

## Ask about a candidate with your own AI key

The viewer's **Asistente IA** panel works without a key (deterministic summary) or with your own Gemini, OpenAI,
DeepSeek or Claude key. The key stays in the page's memory only: never on disk, in `localStorage` or in the URL. See
[docs/mcp-and-ai.md](docs/mcp-and-ai.md#key-handling-for-shared-machines-and-judging-vms).

## Data

Open data from NASA, USGS, ESA and other public archives. Each dataset is listed with name, version, URL and license.

## License

Code under the [MIT License](LICENSE). Documentation and notes under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Datasets keep their own licenses.
