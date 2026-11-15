"""Coherencia de escala del terreno entre la Tierra, la Luna y Marte (ADR-005).

Para cada sitio lunar y marciano se calcula el percentil que ocupa la mediana de pendiente, de rugosidad y de relieve
dentro de la distribución terrestre (muestra de 3 000 000 celdas). Si las tres magnitudes se miden con la misma escala
en los tres cuerpos, los tres percentiles de un sitio coinciden; la dispersión (máximo menos mínimo) mide cuánto no.

Uso: python medir_coherencia_escala.py [carpeta_columns] [carpeta_objetivos]   (por defecto $RUN/columns y $RUN/objetivos)
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np

from comun import ruta_env

COLUMNAS = {"pendiente": "slope_mean_deg", "rugosidad": "rug_rms_mean_m", "relieve": "relieve_mean_m"}
MUESTRA = 3_000_000


def dispersiones(columnas: Path, objetivos: Path) -> dict[str, float]:
    datos = {k: np.fromfile(columnas / f"{v}.f32", "<f4") for k, v in COLUMNAS.items()}
    idx = np.sort(np.random.default_rng(0).choice(datos["pendiente"].size, MUESTRA, replace=False))
    muestra = {k: v[idx] for k, v in datos.items()}
    valido = np.logical_and.reduce([np.isfinite(v) for v in muestra.values()])
    ordenada = {k: np.sort(v[valido]) for k, v in muestra.items()}

    def percentil(k: str, x: float) -> float:
        return 100.0 * np.searchsorted(ordenada[k], x) / ordenada[k].size

    sitios = {}
    for archivo, clave in (("objetivos_luna.json", "regiones"), ("objetivos_marte.json", "sitios")):
        for nombre, s in json.loads((objetivos / archivo).read_text(encoding="utf-8"))[clave].items():
            t = s.get("terreno")
            if t:
                p = [percentil(k, t[v]["mediana"]) for k, v in COLUMNAS.items()]
                sitios[f"{archivo[10:14]}:{nombre}"] = max(p) - min(p)
    return sitios


if __name__ == "__main__":
    run = ruta_env("RUN")
    col = Path(sys.argv[1]) if len(sys.argv) > 1 else run / "columns"
    obj = Path(sys.argv[2]) if len(sys.argv) > 2 else run / "objetivos"
    d = dispersiones(col, obj)
    print(f"{len(d)} sitios; dispersión máxima {max(d.values()):.2f} puntos de percentil, media {np.mean(list(d.values())):.2f}")
