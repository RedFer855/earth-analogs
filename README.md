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

## WebAssembly: the engine scoring inside the browser

`motor/wasm` wraps the same `nucleo` profile in an `extern "C"` ABI (no `wasm-bindgen`, so the artifact is one `.wasm`
of ~36 KB that loads with `WebAssembly.instantiateStreaming`). JavaScript writes the profile and the cells into Wasm
linear memory, gets back `S` and `D²` per cell, and frees explicitly.

```bash
cd motor && cargo build -p wasm --target wasm32-unknown-unknown --release
node visor/pruebas/wasm/paridad.mjs    # nativo vs wasm, 1e-9
```

The parity test scores the four cells of `motor/wasm/src/datos_prueba.rs` twice — once with the native binary, once
with the `.wasm` — and fails if `S` or `D²` differ. That is the guarantee ADR-003 asks for: one formula, two targets.

What stays native is the sweep: 58.7 million cells × 6 variables in `f32` are 1.41 GB, and `memmap2` on
`wasm32-unknown-unknown` is a stub that returns `Unsupported` while `rayon` falls back to a single thread. So the
browser re-scores candidates that the native engine already prefiltered, instead of scanning the planet.

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

Open data from NASA, USGS, ESA and other public archives. Raw files stay outside the repository (`$DATOS`, git-ignored);
what this repository carries is the code that reads them and the aggregated results. Every product is listed with
name, version, source and license in [docs/data-sources.md](docs/data-sources.md) — Earth, Moon and Mars — including the
cases where a source publishes no license and must be cited by service, version and access date.

The master table (58,700,374 HEALPix level-12 cells, 77 columns, ~23 GB) is **not** distributed: it is rebuilt from those
sources with `etl/`. Nothing from a dataset is quoted in this repository without its source.

## Licenses

| What | License |
| :-- | :-- |
| Code (`motor/`, `etl/`, `scripts/`, `visor/`) | [MIT](LICENSE) |
| Documentation and notes (`README`, `docs/`, `contexto/`) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| Third-party software (134 Rust crates, 121 npm packages, 5 Python packages) | Their own OSI licenses, all permissive; inventory in [docs/dependencies.md](docs/dependencies.md) |
| Datasets | Their own: NASA open data, CC BY 3.0/4.0, Copernicus and ODbL 1.0; see [docs/data-sources.md](docs/data-sources.md) |

Raw data files are not redistributed here. The aggregated outputs (`metrics.json`, `robustez.json`, sheets) are derived
work by the team and travel under the same MIT license, keeping the attribution of their sources.

## AI tools used

Declared in [docs/ai-tools.md](docs/ai-tools.md): Claude Code (engine, ETL, MCP bridge) and Antigravity/Gemini (viewer
interface), with the session count per tool, what the team decided and reviewed, and the explicit statement that **no
figure in this repository comes from a model**. Every number is computed from the datasets above and verified against
an independent NumPy implementation.

## NASA Space Apps requirements

Checked against the *2026 NASA Space Apps Participant Terms and Conditions* (https://www.spaceappschallenge.org/legal/):

| Requirement | Where |
| :-- | :-- |
| Original content freely available or OSI-licensed (Apache-2.0 is NASA's default when none is stated) | MIT, root [`LICENSE`](LICENSE) |
| Licenses of all third-party materials identified in the documentation | [docs/dependencies.md](docs/dependencies.md) |
| Every source cited, even open-source and freely available ones | [docs/data-sources.md](docs/data-sources.md) |
| AI tools and other resources identified | [docs/ai-tools.md](docs/ai-tools.md) |
| Publicly accessible, no registration, no password | Public repository; the viewer runs locally with one command and needs no account or key |
| No secrets in the repository | `.env` ignored, gitleaks in CI, no key in history |

