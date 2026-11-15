"""What do the surroundings of impact craters, lava tubes and salt flats have in common?

Site-level comparison (the site is the unit, not the cell, so neighbouring cells do not inflate significance):
for every site, the median of each variable over the cells around it is compared with the median of control
cells in the same 2° latitude band and more than 200 km from any site of the same type.

Per type and variable it reports the median paired difference, Cliff's delta between site and control medians,
a Wilcoxon signed-rank p-value and the Holm-corrected p-value. Results do NOT feed the similarity score (ADR-009).

Usage:
  pixi run --manifest-path etl/pixi.toml python analisis/correlacion.py <RUN with base columns> <RUN with point columns> <puntos.geojson>
Output: docs/analisis/point-correlation.json, .md and .png
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
from scipy.stats import wilcoxon

R_KM = 6371.0072
BANDA_DEG = 2.0
LEJOS_KM = 200.0
N_CONTROL = 400
SEMILLA = 20261115

VARIABLES = {
    "slope_mean_deg": "Mean slope (°)",
    "relieve_m": "Local relief (m)",
    "elev_mean_m": "Elevation (m)",
    "aridez_ai": "Aridity index",
    "lst_media_k": "Mean surface temperature (K)",
    "rango_diurno_k": "Diurnal range (K)",
    "ndvi_max_clim": "NDVI max (climatology)",
    "permafrost_prob": "Permafrost probability",
    "polvo_frec_dod05_pct": "Dust frequency DOD>0.5 (%)",
    "viento_tau_media_pa": "Wind stress (Pa)",
    "aster_qi": "ASTER quartz index",
    "arena_frac": "Sand fraction",
    "roca_volcanica_frac": "Volcanic rock fraction",
    "roca_evaporita_frac": "Evaporite fraction",
}

# tipo: (columna de distancia, radio del entorno del sitio en km)
TIPOS = {
    "crater_impacto": ("dist_crater_km", 5.0),
    "tubo_lava": ("cueva_dist_km", 10.0),
    "playa_salar": ("dist_playa_km", 15.0),
}


def xyz(lat, lon):
    la, lo = np.radians(lat), np.radians(lon)
    c = np.cos(la)
    return np.column_stack([c * np.cos(lo), c * np.sin(lo), np.sin(la)]) * R_KM


def cliff_delta(a: np.ndarray, b: np.ndarray) -> float:
    a, b = a[:, None], b[None, :]
    return float(((a > b).sum() - (a < b).sum()) / (a.size * b.size))


def holm(p: list[float]) -> list[float]:
    orden = np.argsort(p)
    m = len(p)
    out = np.empty(m)
    acum = 0.0
    for r, i in enumerate(orden):
        acum = max(acum, min(1.0, (m - r) * p[i]))
        out[i] = acum
    return out.tolist()


def celdas_cerca(lat, lon, la, lo, radio_km):
    dlat = np.degrees(radio_km / R_KM)
    k = np.flatnonzero(np.abs(lat - la) <= dlat)
    if not k.size:
        return k
    d = np.linalg.norm(xyz(lat[k], lon[k]) - xyz(np.array([la]), np.array([lo])), axis=1)
    return k[d <= radio_km]


def main() -> None:
    base, puntos_run, geojson = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])
    lat = np.fromfile(base / "grid" / "lat.f32", dtype=np.float32).astype(np.float64)
    lon = np.fromfile(base / "grid" / "lon.f32", dtype=np.float32).astype(np.float64)

    def col(nombre):
        for r in (puntos_run, base):
            f = r / "columns" / f"{nombre}.f32"
            if f.exists():
                return np.memmap(f, dtype=np.float32, mode="r")
        raise SystemExit(f"falta la columna {nombre}")

    cols = {v: col(v) for v in VARIABLES}
    feats = json.loads(geojson.read_text(encoding="utf-8"))["features"]
    rng = np.random.default_rng(SEMILLA)
    banda = np.floor(lat / BANDA_DEG).astype(np.int16)

    resultados = {}
    for tipo, (col_dist, radio) in TIPOS.items():
        sitios = [f for f in feats if f["properties"]["tipo"] == tipo and f["properties"].get("confirmado", True)]
        lejos = np.asarray(col(col_dist)) > LEJOS_KM
        controles_por_banda: dict[int, np.ndarray] = {}
        med_s = {v: [] for v in VARIABLES}
        med_c = {v: [] for v in VARIABLES}
        n_usados = 0
        for f in sitios:
            lo, la = f["geometry"]["coordinates"]
            k = celdas_cerca(lat, lon, la, lo, radio)
            if not k.size:
                continue
            b = int(np.floor(la / BANDA_DEG))
            if b not in controles_por_banda:
                pool = np.flatnonzero((banda == b) & lejos)
                controles_por_banda[b] = rng.choice(pool, min(N_CONTROL, pool.size), replace=False) if pool.size else pool
            c = controles_por_banda[b]
            if not c.size:
                continue
            n_usados += 1
            for v, arr in cols.items():
                med_s[v].append(np.nanmedian(arr[k]) if np.isfinite(arr[k]).any() else np.nan)
                med_c[v].append(np.nanmedian(arr[c]) if np.isfinite(arr[c]).any() else np.nan)

        filas = []
        for v in VARIABLES:
            s, c = np.array(med_s[v]), np.array(med_c[v])
            ok = np.isfinite(s) & np.isfinite(c)
            if ok.sum() < 8:
                filas.append({"variable": v, "n_sitios": int(ok.sum()), "p": 1.0, "nota": "menos de 8 sitios con dato"})
                continue
            d = s[ok] - c[ok]
            p = float(wilcoxon(d).pvalue) if np.any(d != 0) else 1.0
            filas.append({
                "variable": v, "etiqueta": VARIABLES[v], "n_sitios": int(ok.sum()),
                "mediana_sitio": float(np.median(s[ok])), "mediana_control": float(np.median(c[ok])),
                "diferencia_mediana": float(np.median(d)), "cliff_delta": cliff_delta(s[ok], c[ok]), "p": p,
            })
        for f_, ph in zip(filas, holm([f_["p"] for f_ in filas])):
            f_["p_holm"] = ph
        resultados[tipo] = {"sitios": len(sitios), "sitios_usados": n_usados, "radio_km": radio, "filas": filas}
        print(tipo, n_usados, "sitios")

    sal = Path(__file__).resolve().parent.parent / "docs" / "analisis"
    sal.mkdir(parents=True, exist_ok=True)
    meta = {"metodo": __doc__.split("Usage:")[0].strip(), "banda_deg": BANDA_DEG, "lejos_km": LEJOS_KM,
            "n_control": N_CONTROL, "semilla": SEMILLA}
    (sal / "point-correlation.json").write_text(json.dumps({"meta": meta, "resultados": resultados}, indent=1,
                                                           ensure_ascii=False), encoding="utf-8")
    escribir_md(sal / "point-correlation.md", resultados)
    grafico(sal / "point-correlation.png", resultados)


NOMBRE = {"crater_impacto": "Impact craters", "tubo_lava": "Lava tubes", "playa_salar": "Salt flats / playas"}


def escribir_md(ruta: Path, res: dict) -> None:
    l = ["# What the surroundings of craters, lava tubes and salt flats share", "",
         "Generated by `analisis/correlacion.py`. Site-level comparison against latitude-matched controls more than",
         f"{LEJOS_KM:.0f} km away. |δ| ≥ 0.33 is a medium effect, ≥ 0.47 large. Bold rows have Holm p < 0.05.",
         "These results describe tendencies; they do not enter the similarity score (ADR-009).", ""]
    for tipo, r in res.items():
        l += [f"## {NOMBRE[tipo]} ({r['sitios_usados']} sites, radius {r['radio_km']:.0f} km)", "",
              "| Variable | Sites | Site median | Control median | Cliff's δ | Holm p |", "| :-- | --: | --: | --: | --: | --: |"]
        for f in sorted(r["filas"], key=lambda x: -abs(x.get("cliff_delta", 0))):
            if "cliff_delta" not in f:
                continue
            b = "**" if f["p_holm"] < 0.05 else ""
            l.append(f"| {b}{f['etiqueta']}{b} | {f['n_sitios']} | {f['mediana_sitio']:.3g} | {f['mediana_control']:.3g} | "
                     f"{f['cliff_delta']:+.2f} | {f['p_holm']:.3g} |")
        l.append("")
    ruta.write_text("\n".join(l), encoding="utf-8")


def grafico(ruta: Path, res: dict) -> None:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    fig, ejes = plt.subplots(1, len(res), figsize=(5 * len(res), 6), sharey=True)
    etiquetas = list(VARIABLES.values())
    for ax, (tipo, r) in zip(np.atleast_1d(ejes), res.items()):
        por = {f["variable"]: f for f in r["filas"]}
        y = np.arange(len(VARIABLES))
        d = [por[v].get("cliff_delta", np.nan) for v in VARIABLES]
        sig = [por[v].get("p_holm", 1) < 0.05 for v in VARIABLES]
        ax.barh(y, d, color=["#2a6fdb" if s else "#b8c4d6" for s in sig])
        ax.axvline(0, color="#333", lw=0.8)
        for x in (-0.33, 0.33):
            ax.axvline(x, color="#999", lw=0.6, ls=":")
        ax.set_xlim(-1, 1)
        ax.set_title(f"{NOMBRE[tipo]} (n={r['sitios_usados']})")
        ax.set_xlabel("Cliff's δ (site vs control)")
        ax.set_yticks(y, etiquetas)
        ax.invert_yaxis()
    fig.suptitle("Surroundings of Earth sites vs latitude-matched controls (dark = Holm p < 0.05)")
    fig.tight_layout()
    fig.savefig(ruta, dpi=130)


if __name__ == "__main__":
    main()
