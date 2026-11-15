# Earth Analogs Web Viewer

Lean CesiumJS + TypeScript + Vite viewer that displays, for each Moon and Mars target site, its top 200 Earth analog candidates on the globe and an inspection sheet explaining where each candidate matches and where it differs.

## What it shows

- **Left panel**: Moon and Mars target sites with their best similarity score, plus the top 50 ranked Earth candidates for the selected site.
- **3D globe**: All 200 HEALPix candidate cells rendered in a single Cesium `Primitive` colored from red (0%) to green (100%), with click picking and camera focus.
- **Right panel**: Detailed comparison table per variable, data coverage, non-scoring temperature diagnostics, planetary context differences (gravity, surface pressure, atmosphere, radiation), potential ice warning at high northern latitudes, and dataset sources/licenses.

## Publishing data

From the repository root, copy and minify the search engine output into `visor/public/datos/`:

```bash
node scripts/visor/publicar-datos.mjs /path/to/run/salida
```

## Development, test, and build

```bash
npm --prefix visor install
npm --prefix visor run dev
npm --prefix visor run prueba
npm --prefix visor run build
```
