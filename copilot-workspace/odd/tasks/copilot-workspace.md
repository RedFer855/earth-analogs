# Feature: Copilot workspace (chat search + viewer + copilot + 3D sandbox)

Locator: `copilot-workspace/odd/tasks/copilot-workspace.md` · Engram mirror: `odd/copilot-workspace/tasks`
Branch: `feat/copilot-workspace` (repository `github.com/Arvillax/simulador`).

## Objective

Carry out the integration plan "Plan integrado V2: chat buscador + visor + copiloto + simulador 3D" (kept outside this
repository; the user's local copy) as a new app `copilot-workspace/` in this repository. It holds a chat search, a
minimal CesiumJS viewer, the mission-viability copilot, and the existing 3D sandbox (`nasa-3d-sandbox/`) embedded
through `?embed=1`.

## Constraints

- User decision (2026-11-15): build here, as a new app. Do not write to `earth-analogs` or
  `analogos-space-apps-2026`, and copy no code, data, figures or text from them.
- Sample data (`metrics.json`, `resultados/<profile>/<site>.json`, `puntos.geojson`) is generated synthetically in
  this repository, labelled "synthetic sample", and follows the field names used in the plan.
- Missing values stay `null`, are listed in `missingVars`, and are never shown as 0 (ADR-007 rule restated in the plan).
- No secrets in source. Gemini runs only with a key typed by the viewer (kept in `sessionStorage`) or through a proxy
  URL; the offline parser gives the same `findTestSites(...)` call without a key.
- The model name `gemini-3.8-flash` from the plan is not verified; it is configurable. `@google/genai` 3.3.0 exists on
  npm (published 2026-11-12).
- Plan step 6 (`salida.rs` in earth-analogs) is out of scope.

## Delivery strategy

`ask-on-risk`. Work-unit commits on `feat/copilot-workspace`; push, PR and merge are the user's decision.

## Tasks

- [x] C1 — Scaffold `copilot-workspace/` (Vite + TS), types (`copilot.types.ts`), synthetic sample data generator and
  files. Route: delegated writer.
- [x] C2 — Search: `siteIndexStore.ts`, `queryParser.ts` (Spanish and English, < 5 ms), `siteRecommender.ts` (P-015
  polar filter, Haversine pin bonus, `combinedScore = 0.45·(similarity·100) + 0.55·suitability + bonusPin`).
  Test-first.
- [x] C3 — Engine and adapter: `deterministicRules.ts` (green/yellow/red + `testSuitabilityScore`),
  `fallbackTemplates.ts`, `etlToCopilotMapper.ts` (N1, N2, N3, N5 from the published fields; N4, N6, N7 and
  `surfaceTempK` as missing). Test-first.
- [x] C4 — Buses: `copilotEventBus.ts` (`nasa:visor-focus-sites`, `nasa:visor-select-cell`, `nasa:visor-tour-step`),
  `simulatorTransport.ts` (iframe `?embed=1` + `postMessage`, lazy mount, `PAUSE`/`RESUME` on hide, alert
  subscription, clean destroy). Test-first for the pure parts.
- [ ] C5 — UI: `RecommendationCards.ts`, `ReadinessMatrix.ts`, `ActionChips.ts`, `CopilotPanel.ts`, minimal CesiumJS
  viewer with pins; safe rendering with `textContent`.
- [ ] C6 — Gemini: `systemPrompt.ts`, `simulatorTools.ts` (4 function calls), `geminiClient.ts` (`@google/genai`), with
  the anti-hallucination rule and the offline fallback.
- [ ] C7 — Verify acceptance T1–T4 of the plan in the browser.

## Acceptance (from the plan)

- T1: "quiero una zona para probar el rover en pendiente fuerte en Marte" without a key returns #1..#5 in < 50 ms,
  excludes the polar ice caps, highlights 5 pins and loads the selection in the 3D.
- T2: missing N4/N6/N7/`surfaceTempK` never show as 0 and never create fake ice (280 K neutral, `missingVars`).
- T3: the "N6 = 0" chip on the Moon turns the 3D to PSR, raises `LIDAR_PSR_OPTICAL_BLIND` / `SUIT_SOLAR_DEFICIT_PSR`
  to the copilot and offers the remedy action.
- T4: opening and closing the 3D panel next to CesiumJS lazy-mounts and sends `PAUSE`/`RESUME` without duplicated
  listeners or a lost CesiumJS context.

## Progress

- 2026-11-15: feature document created; branch `feat/copilot-workspace` from `main` `be1c7d9`.
- 2026-11-15: C1 done in `24b44ee` (delegated writer). Vite 8 + TS 7 + Cesium 1.147.0 + vitest 5; synthetic data
  from `scripts/generate-synthetic-data.mjs` (seed 20261115, 6 targets x 40 cells, 15 pins). Checks: tsc OK, vitest
  5/5, build OK.
- 2026-11-15: C3 committed before C2 because the recommender consumes the rules and the mapper. RED: both test files
  failed with "Cannot find module"; GREEN: 21/21 after implementation. Thresholds restated from the sandbox solvers.
  Commit `22b8149`.
- 2026-11-15: C2 RED: three search test files failed with "Cannot find module"; GREEN: 38/38, then the T1 sample
  test (39/39). T1 offline on the sample: parse 0.53 ms, parse + rank 2.7 ms (warm cache); top 5 all Mars, lat <= 60.
  Commit `796ec31`.
- 2026-11-15: C4 RED: bus and transport test files failed with "Cannot find module"; GREEN: 49/49. The transport
  takes DOM seams (`TransportEnv`) so lazy mount, PAUSE/RESUME, origin checks and listener cleanup run in Node.
  No sandbox change needed: `mountSandbox` already reads `?origin=` and restricts its `message` listener to it.

## Next step

C1–C5 (delegated writer), then C6 Gemini, then C7.
