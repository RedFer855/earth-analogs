# Copilot workspace

A chat search, a minimal CesiumJS viewer, the mission-viability copilot, and the 3D sandbox (`../nasa-3d-sandbox`)
embedded through `?embed=1`, in one page. It runs fully offline: no API key, no Cesium ion token, no network imagery.

## Run

```bash
npm install
npm run dev          # http://localhost:5190/
```

The 3D panel embeds the sandbox dev server. Start it in `../nasa-3d-sandbox` with `npm run dev` (Vite default,
`http://localhost:5173/`). To point at another sandbox URL, add `?sandbox=<url>` to the workspace URL, for example
`http://localhost:5190/?sandbox=http://localhost:5173/`. Commands go to that URL's origin only; messages from any
other origin are ignored.

## Checks

```bash
npx tsc --noEmit
npx vitest run
npm run build
```

## Sample data

`public/data/` holds a **synthetic sample** produced by `npm run data` (`scripts/generate-synthetic-data.mjs`, seeded
PRNG). It follows the field names of the published ETL output (`slope_mean_deg`, `rug_rms_mean_m`, `relieve_mean_m`,
`diagnostico.rango_diurno_k`, `ipix`, `lat`, `lon`, `similitud`), but the values and Earth coordinates are random and
must not be cited. Silica (N4), solar illumination (N6), saltation (N7) and surface temperature are absent on purpose:
the copilot lists them in `missingVars` and never shows them as 0.

## Layout

```text
src/copilot/
  types/    copilot.types.ts (contracts; sandbox types restated from nasa-3d-sandbox/src/bridge/copilotContract.ts)
  search/   siteIndexStore, queryParser (offline, Spanish and English), siteRecommender
  engine/   deterministicRules, fallbackTemplates
  bridge/   etlToCopilotMapper, copilotEventBus, simulatorTransport
  ui/       RecommendationCards, ReadinessMatrix, ActionChips, CopilotPanel
  viewer/   CesiumJS globe with pins
```
