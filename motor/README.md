# Search engine

Compares every land cell of the ETL table with each lunar and Martian target and writes `metrics.json` (ADR-007).
Design and formula: [ADR-010](../contexto/45-decisiones/ADR-010-motor-de-busqueda-sobre-la-tabla-del-etl.md).

## Crates

| Crate | What it does |
| :-- | :-- |
| `nucleo` | The similarity formula. No I/O, no dependencies. Checked against an independent numpy reference. |
| `pipeline` | Reads `$RUN` (memory-mapped columns), sweeps the table in parallel, picks candidates, writes the output. |

## Inputs

Everything comes from the ETL run folder `$RUN`, unchanged:

- `manifest.json` (E-13): grid size and level, table date and commit, source, URL, license and unit of every column.
- `grid/ipix.u32` and `columns/<name>.f32`: one value per cell; missing values are `NaN`.
- `perfiles.json` (E-20): target value, tolerance, Earth scale and correlation per variable, per target.
- `etl/sitios/objetivos-luna.json` and `objetivos-marte.json`: target names and coordinates.

## Run

```bash
cd motor
cargo build --release
RUN=/path/to/run ./target/release/pipeline --objetivo JZ --salida /path/to/output
./target/release/pipeline --ayuda
```

Each run adds or replaces one target in `metrics.json` and writes `resultados/<profile>/<target>.json` with up to 200
candidates: one per level-6 HEALPix region, with value, difference, score and label (`coincide`, `difiere`,
`sin_dato`) per variable, plus diagnostic variables (diurnal and annual temperature range) that are reported but not
scored.

## Coordinates

HEALPix works on a sphere with authalic latitude; the table, the targets and the output use WGS84 geodetic latitude.
`pipeline/src/geo.rs` converts between them with the same Snyder (1987) formulas as `etl/comun.py`.

## Tests

```bash
cargo fmt --check
cargo clippy --workspace --all-targets
cargo test --workspace
RUN=/path/to/run cargo test --release --workspace -- --include-ignored   # also against the real table
```

The reference in `nucleo/tests/referencia_numpy.txt` is synthetic and regenerated with
`pixi run --manifest-path etl/pixi.toml python -I analisis/referencia_motor.py`.
