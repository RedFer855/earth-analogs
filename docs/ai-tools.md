# AI tools used

The 2026 NASA Space Apps Participant Terms and Conditions require participants to identify the AI tools and other
resources used to build the solution. This is that declaration.

## Tools and scope

| Tool | Team member | Scope of its work | Sessions recorded |
| :-- | :-- | :-- | --: |
| Claude Code (Anthropic) | Fernando (@RedFer855) | Rust engine (`motor/nucleo`, `motor/pipeline`), ETL scripts (`etl/`), MCP server and local bridge (`scripts/mcp/`, `scripts/`), documentation and ADRs | 15 |
| Antigravity (Google, Gemini models) | Guillermo (@IngGuillermoRosa) | Viewer interface (`visor/src/ui`, `visor/src/motor`), panels, layers, sheet layout | 11 |

Sessions are logged one by one in [`contexto/70-bitacora/`](../contexto/70-bitacora/) with the `agente:` field, so the
count above is auditable (`grep -rh '^agente:' contexto/70-bitacora/ | sort | uniq -c`).

## What the humans did

- Chose the challenge, the variable vector, the similarity formula (Mahalanobis with a tolerance zone, Gower mix,
  `S = exp(−γ·D²)`), the output contract and every architecture decision. Each one is an ADR in
  [`contexto/45-decisiones/`](../contexto/45-decisiones/).
- Reviewed every change through pull requests with CI (tests, clippy, gitleaks, repository checks) before it reached
  `main`.
- Verified the arithmetic against an independent implementation in NumPy (`analisis/referencia_motor.py`), row by row,
  on the full table.
- Ran and audited every pipeline execution; the log of each run is in [`audit/`](../audit/).

## What the AI did not do

- **No number in this repository comes from a model.** Every value in the tables, the sheets and `metrics.json` is
  computed from the datasets listed in [data-sources.md](data-sources.md).
- No AI service is called at build time or by the pipeline. The viewer's optional assistant (BYOK) is the only place
  where an external model is invoked, it is off by default, and it needs the user's own key.
- No AI tool had access to credentials. No API key is stored in the repository or in its history.

## Assistant in the viewer (optional, separate from the above)

The **Asistente IA** panel works without a key (deterministic summary generated from the computed facts) or with the
user's own Gemini, OpenAI, DeepSeek or Claude key. The key lives in the page's memory only: never on disk, in
`localStorage` or in the URL. Details: [mcp-and-ai.md](mcp-and-ai.md).
