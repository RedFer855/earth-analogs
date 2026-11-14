# Data pipeline (ETL) plan

Status: plan. Code is written step by step during the creation phase, and every run is recorded in the
[audit trail](../audit/README.md).

## 1. Goal

Build one table that describes every land cell of the Earth with the variables we compare against the Moon base
regions and Mars sites: terrain, temperature, vegetation, aridity, permafrost, wind, dust and mineralogy. The table is
the input of the similarity engine; the website only loads light derived files (`metrics.json`, meshes).

## 2. Principles

1. **Open data only.** Every column names its dataset, version, URL and license in the manifest.
2. **Nothing is filled.** A missing value is `NaN`, never `0`. If a source cannot be read, its column does not exist
   and the manifest says why.
3. **Fail loud.** Any step that fails on any tile exits with code 1. "It finished" is not "it is correct": each step
   has a check, and the next step does not start until the check passes.
4. **Read-only on raw data.** Raw files live under `$DATOS`, outputs under `$RUN`. Neither enters git.
5. **Physics over looks.** Columns describe processes (slope, thermal range, aridity), not images.

## 3. Architecture: one grid, one file per column

- **Step E-01 builds the grid first.** HEALPix level 12 (≈ 2.5 km² per cell), land cells only, ascending `ipix`:
  `grid/ipix.u32`, `grid/lat.f32`, `grid/lon.f32`.
- **Every layer writes its own column** `columns/<name>.f32`, aligned to that grid (same length, same order).
  Layers do not depend on each other and can run in parallel or be skipped.
- **The master table is a manifest**, not a merged file: `manifest.json` lists, per column, source, version, URL,
  license, method, coverage (% non-NaN), warnings and percentiles (p1, p50, p99, p99.9). The percentiles feed the
  "how far Earth gets" comparison against lunar and Martian values.
- Columns that come from models with restricted licenses are tagged `local_only` and never written to public outputs.

## 4. Steps and time gates

| Step | Output | Check before moving on |
| :-- | :-- | :-- |
| E-00 | This plan | Reviewed by the team |
| E-01 | Grid | Cell count, ascending `ipix`, `lat`/`lon` inside range |
| E-02 | Source check | Every input readable; size and format match the dataset documentation |
| E-03 | Terrain: `slope_mean_deg`, `slope_std_deg` (roughness and relief only for the site sheet) | Known points (Everest, Dead Sea, Uyuni, Lut) in place; flat lakes and sea are `NaN` |
| E-04 | Land surface temperature: day, night, diurnal range, annual amplitude | 120 months read; diurnal range sign checked |
| E-05 | NDVI maximum | All periods read; boreal forest has a value |
| E-06 | Aridity index and ET0 | Values north of 80° N set to `NaN` |
| E-07 | Permafrost (mean annual ground temperature) | Northern hemisphere coverage only, declared |
| E-08 | Wind and dust (operational dust profile) | Monthly series complete, no duplicate months |
| E-09 | Emissivity / silica and lithology (material dust profile) | Emissivity inside 0.5–1; "no data" class is `NaN` |
| E-10 | Surface water, dunes and sand at 30 m | Every tile done, zero tile errors |
| E-11 | Lunar targets (9 Artemis regions) | Day > night temperature in almost all pixels |
| E-12 | Mars targets (12 sites) | Hematite maximum falls in Meridiani (search between 60° S and 60° N) |
| E-13 | Manifest and independent verification | See section 6 |

**Gates (local time, Tegucigalpa):**

- **14:00 Saturday** — E-01 to E-07 verified (phase A). If not, cut to terrain + temperature and one target per
  body.
- **19:00 Saturday** — E-08, E-09, E-11, E-12 verified (phase B).
- E-10 runs only if time is left (phase C).

## 5. Source rules

| Source | Rule |
| :-- | :-- |
| Copernicus GLO-90 DEM | Tiles are not square: cell width comes from each tile's geotransform. Sea is exactly 0 m: mask the sea before computing slope. Lakes and rivers are masked only where surface-water occurrence ≥ 50 %; salt flats stay. Within 2° of the poles is out of scope (Antarctica is excluded by the challenge). Slope at 200 m before aggregating to the cell. |
| JRC Global Surface Water | Read through one mosaic (VRT) so overlapping tiles are counted once. Pick tiles by the cell's bounding box, not by its center, so border cells see both neighbors. Max 4 processes (memory). |
| GSDP30 / GSDS30 | Same mosaic rule as surface water. Legend: 1 = mobile sand, 2 = semi-fixed or fixed, 3 = other. |
| MODIS MYD11C3 (LST) | 2013–2022 climatology, 120 months. Negative diurnal range is kept and flagged, not clipped. |
| MODIS MOD13C1 (NDVI) | Maximum requires at least 3 valid periods. |
| Global Aridity Index | Set to `NaN` from 80° N (the index breaks there); do not cut by value. Exact 0 is real data. |
| Obu permafrost | The archive uses Deflate64: extract first, then read. |
| MERRA-2 | Group files by month and drop exact duplicates before averaging. |
| MODIS dust (MODFDS) | Coordinates read as cell centers (CF convention); the possible half-cell offset is written in the manifest. |
| ASTER GED | Emissivity outside 0.5–1 is fill: set to `NaN`; derived indices inherit it. |
| EMIT | `lat`/`lon` are the upper-left corner, not the center. |
| GLiM | Class 15 (`nd`) is "no data": set to `NaN`. Class 11 (`wb`) is water. |
| Mars Climate Database | Time is universal time at longitude 0: convert to local time before taking day and night. Values are `local_only`. |
| Ground ice (Karjalainen) | Not used until its unit is read from the source paper. |
| Sky-view factor (Li et al. 2024) | It is the fraction of visible sky, not illumination. Context for the site sheet only; it does not score similarity. |
| LOLA `LDEM_80S_20M` V2.1 | Open through the `.lbl` label. Heights are in km over a 1737.4 km sphere; polar stereographic. |
| LOLA illumination (Mazarico et al. 2011) | Read full resolution: the COG overviews are not valid for measurement. Context for the site sheet only. |
| Diviner GDR L3 polar | `d` is local time 6–18 h and `n` is 18–6 h. Confirm with the data that day is warmer than night before using them. |
| Diviner H-parameter (Hayne et al. 2017) | FITS file: read with `astropy`, not GDAL. Context only. |
| HRSC-MOLA blended DEM 200 m | Int16, no data −32768, uncompressed: read by windows. Where HRSC is missing, the 200 m are interpolated MOLA (provisional product). |
| TES thermal inertia (Putzig and Mellon 2007) | Binary with a 14 400-byte ASCII header, big-endian. Check how 0 and −32768 are used as no data; the `msk` layer marks interpolated pixels. |
| THEMIS thermal inertia mosaic | Only between 60° S and 60° N; quadrangles are named by their south-west corner. |

Water fractions are a partition: land + ocean + lake + river = 1. Ephemeral water is a part of lake + river.

## 6. Verification

- **Independent sampling:** for a random set of cells, read the source again by a different path and compare.
- **Location checks:** the maximum of each layer and known places (Everest, Dead Sea, Lut, Pilbara, Qaidam,
  Uyuni) fall where they should.
- **Table checks:** 0 infinities, every column file has the grid's byte length, water partition sums to 1.
- **Quality indicators:** coverage per column and the agreement of the engine with documented terrestrial analogs,
  measured on this table and written in the manifest.

## 7. Audit

Every step is run through `audit/audit.py correr --paso E-NN -- <command>`, which records start, end,
duration, outputs and result. See the [audit trail](../audit/README.md).

## 8. Decisions

The choices behind this plan are recorded as decision notes in
[`contexto/45-decisiones/`](../contexto/45-decisiones/):

- [ADR-001](../contexto/45-decisiones/ADR-001-preprocesar-offline-y-servir-ligero.md) — preprocess offline, serve light
- [ADR-002](../contexto/45-decisiones/ADR-002-malla-primero-y-una-columna-por-capa.md) — grid first, one column per layer
- [ADR-003](../contexto/45-decisiones/ADR-003-variables-por-proceso-fisico.md) — variables by physical process
- [ADR-004](../contexto/45-decisiones/ADR-004-periodo-comun-y-climatologia.md) — common period and climatology
- [ADR-005](../contexto/45-decisiones/ADR-005-regla-de-escala-de-pendiente-y-rugosidad.md) — slope and roughness scale rule
- [ADR-006](../contexto/45-decisiones/ADR-006-valores-faltantes-y-cobertura.md) — missing values and coverage
- [ADR-007](../contexto/45-decisiones/ADR-007-contrato-de-metrics-json.md) — `metrics.json` contract
- [ADR-008](../contexto/45-decisiones/ADR-008-calidad-de-la-tabla-y-manifiesto.md) — table quality and manifest

## 9. Environment and resources

- **One locked environment for every node:** Python with GDAL built with HDF4, HDF5 and netCDF. FITS files are read
  with `astropy`. The lock file is committed, so every PC runs the same versions.
- **Processes per step are declared** in the audited command. Memory-heavy steps (30 m layers) run with fewer
  processes; a step that runs out of memory on some tiles must fail, not continue.
- **Disk:** E-02 measures the free space in `$DATOS` and `$RUN` and records it in the audit trail before any
  layer runs.

## 10. Never overwrite a verified output

- A new run writes to a new folder (`$RUN/<name>_new/`); the verified one is not touched.
- The new output is verified with the same checks. Columns that were not meant to change must be **byte-identical**
  to the verified ones. If an unchanged column moves in a single cell, the run broke something.
- Only then is the old output renamed as a dated backup and the new one takes its place. The audit trail records
  which output produced which results.

## 11. Two nodes, same plan

Two PCs run the same plan in parallel as a backup.

- Both start from the same commit, the same lock file and the same source versions (checksums in the manifest).
- After each step, both compare per column: cell count, coverage, percentiles and a checksum. Deterministic steps
  must match byte for byte; any other difference is reported with the column, the cells and the size of the gap.
- A mismatch stops the step on both nodes until it is explained and written down.

## 12. Named exceptions

A check may accept a known bias only as a **named exception**: value, reason and who accepted it, printed under
`EXCEPTIONS` and never as a pass. At most three per run. Anything else is a failure and stops the plan.

## 13. Rules for agents

- Every number goes into a JSON file together with the method that produced it.
- An agent saying "done" is not a result: the validator runs and its output is read.
- Place names derived from coordinates are marked "not verified" until checked against a gazetteer.
- Agents never edit the audit trail by hand; it is written only by `audit/audit.py`.

## 14. Open items

- **Target sites:** E-11 and E-12 need the 9 Artemis regions and the 12 Mars sites as files in
  `contexto/32-sitios/`. They are not in the repository yet.
- **Decisions for the team**, to close before the steps that use them:
  - whether the sixth dimension searches with aridity combined with the diurnal thermal range;
  - whether the annual temperature amplitude enters against Mars, marked as model data;
  - the sources of the two dust profiles (material and operational) and how a cell found by both is marked;
  - whether illumination stays in the site sheet only;
  - latitude convention for the grid (authalic or geodetic), before E-01.
