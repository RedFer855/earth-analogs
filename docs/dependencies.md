# Third-party software and licenses

Inventory of the third-party code this project compiles, runs or ships. The pinned, complete list lives in the lock
files (`motor/Cargo.lock`, `visor/package-lock.json`); this page records the licenses that apply and how to reproduce
the full inventory.

Everything below is open source and OSI-approved (MIT, Apache-2.0, BSD, Zlib, ISC, MPL-2.0). Nothing with a
no-derivatives or non-commercial clause is part of the code that this repository distributes.

## Rust — engine

`motor/nucleo` has **no production dependencies**. `motor/pipeline` and the workspace compile **134 third-party
crates** in total.

| Crate | Version constraint | License | Used for |
| :-- | :-- | :-- | :-- |
| anyhow | 1 | MIT OR Apache-2.0 | Error handling in the binary |
| bytemuck | 1 | Zlib OR Apache-2.0 OR MIT | Reading `f32`/`u32` columns as typed slices |
| cdshealpix | 0.10.1 | Apache-2.0 OR MIT | HEALPix cell centres and vertices |
| memmap2 | 0.9 | MIT OR Apache-2.0 | Memory-mapping the master table |
| rayon | 1 | MIT OR Apache-2.0 | Parallel sweep |
| serde / serde_json | 1 | MIT OR Apache-2.0 | Reading profiles, writing `metrics.json` |
| nalgebra (dev only) | 0.35 | Apache-2.0 | Cross-checking the linear algebra in tests |
| proptest (dev only) | 1 | MIT OR Apache-2.0 | Property tests |

Full inventory with version and license of every crate:

```bash
cd motor && cargo metadata --format-version 1 \
  | python -c "import json,sys; [print(p['name'], p['version'], p.get('license')) for p in json.load(sys.stdin)['packages'] if p.get('source')]"
```

## JavaScript / TypeScript — viewer

**121 packages** are installed by `npm ci`; the four direct ones are:

| Package | Version | License | Used for |
| :-- | :-- | :-- | :-- |
| cesium | 1.147.0 | Apache-2.0 | 3D globe, imagery, entities, primitives |
| vite | ^5.4.10 | MIT | Dev server and production build |
| typescript | ~5.6.2 | Apache-2.0 | Type checking |
| vite-plugin-static-copy | ^2.1.0 | MIT | Copies Cesium's `Assets`, `Workers`, `Widgets`, `ThirdParty` into the build |

Reproduce with `cd visor && npm ci && npx license-checker --summary`. CesiumJS ships its own `ThirdParty` notices with
the build; they are redistributed unmodified.

## Python — ETL (not shipped, run offline)

| Package | License | Used for |
| :-- | :-- | :-- |
| numpy | BSD-3-Clause | Raster arithmetic and statistics |
| scipy | BSD-3-Clause | Filters and interpolation |
| astropy | BSD-3-Clause | FITS/WCS handling for planetary products |
| cdshealpix | Apache-2.0 | HEALPix indexing |
| GDAL (osgeo) | MIT/X11 | Reading GeoTIFF, PDS, NetCDF and HDF |

## Imagery shown in the globe (not redistributed)

| Service | License | Note |
| :-- | :-- | :-- |
| Sentinel-2 cloudless (EOX, s2maps.eu) | CC BY-NC-SA 4.0 | Optional background, ~10 m. Non-commercial: the project is a non-profit hackathon and the tiles are requested at runtime, never redistributed |
| NASA GIBS Blue Marble Next Generation | NASA open data | Default public-domain fallback, no restrictions |

## Datasets

Every dataset keeps its own license; the complete table (product, version, source and license) is in
[data-sources.md](data-sources.md). Raw dataset files are not redistributed in this repository.
