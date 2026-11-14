# Audit trail

Audit trail of the data pipeline: who ran each step, with which tool, when, and what it produced.

## File

`etl-log.jsonl` is append-only, one JSON object per line:

| Field | Meaning |
| :-- | :-- |
| `ts` | Local time, ISO 8601 with offset (`-06:00`, Tegucigalpa) |
| `integrante` | Team member (alias from `team.json`) |
| `agente` | Coding assistant used, or `ninguno` |
| `modelo` | Model of the assistant, if any |
| `paso` | Pipeline step `E-NN` (see the [ETL plan](../docs/etl-plan.md)) |
| `evento` | `inicio`, `fin`, `fallo` or `verificacion` |
| `comando` | Command run, with data roots shown as `$DATOS` and `$RUN` |
| `commit`, `arbol_limpio` | Code version and whether the working tree had uncommitted changes |
| `duracion_s` | Duration in seconds (on `fin` and `fallo`) |
| `salidas` | Outputs: relative path, bytes and sha256 |
| `resultado`, `nota` | Outcome and free note |
| `prev` | sha256 of the previous line; editing any line breaks the chain |

## Use

```bash
# Run a step and record start and end
python audit/audit.py correr --paso E-03 --salida "$RUN/columns" -- python etl/terrain.py
# Record a manual event
python audit/audit.py registrar --paso E-03 --evento verificacion --resultado ok --nota "known points checked"
# Check the chain
node audit/verificar.mjs
```

Set `AUDIT_INTEGRANTE`, `AUDIT_AGENTE` and `AUDIT_MODELO` once per terminal. The log is committed when each step
closes.
