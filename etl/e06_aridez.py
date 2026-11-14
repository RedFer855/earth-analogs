"""E-06: índice de aridez y ET0 (Global Aridity Index and PET v3.1).

El índice se guarda multiplicado por 10 000 en el GeoTIFF (UInt16): se divide. ET0 está en mm/año. 65535 es sin dato.
Desde 80° N los dos se anulan (el índice se rompe ahí); no se corta por valor. Un 0 exacto del índice es dato.
El centro de cada celda decide el píxel de 30" (~1 km).

Uso: python e06_aridez.py
"""

from __future__ import annotations

import json
import sys
import time

import numpy as np
from osgeo import gdal

from comun import ruta_env
from comun_tabla import cargar_malla, escribir_columna, indices_en_rejilla, valor_en

gdal.UseExceptions()
NORTE = 80.0
SIN_DATO = 65535


def _leer(ruta: str, lat, lon):
    ds = gdal.Open(ruta)
    geo = ds.GetGeoTransform()
    f, c, dentro = indices_en_rejilla(lat, lon, geo, (ds.RasterYSize, ds.RasterXSize))
    a = ds.GetRasterBand(1).ReadAsArray()
    v = a[f, c].astype(np.float32)
    v[(~dentro) | (a[f, c] == SIN_DATO)] = np.nan
    return v


def main() -> int:
    datos, run = ruta_env("DATOS"), ruta_env("RUN")
    t0 = time.time()
    z = f"/vsizip/{datos.as_posix()}/tierra/aridez-global-ai-v3_1/Global-AI_ET0__annual_v3_1.zip/Global-AI_ET0__annual_v3_1"
    ipix, lat, lon = cargar_malla(run)
    ai = _leer(f"{z}/ai_v31_yr.tif", lat, lon) / 10000
    et0 = _leer(f"{z}/et0_v31_yr.tif", lat, lon)
    norte = lat >= NORTE
    ai[norte] = np.nan
    et0[norte] = np.nan
    meta = {
        "fuente": "Global Aridity Index and Potential Evapotranspiration Database v3.1 (Zomer y Trabucco)",
        "url": "https://doi.org/10.6084/m9.figshare.7504448",
        "licencia": "CC BY 4.0",
        "metodo": "índice / 10000; 65535 sin dato; anulado desde 80° N; centro de celda",
        "advertencias": ["el índice se rompe al norte de 80° N; se anula ahí sin cortar por valor"],
    }
    cols = [
        escribir_columna(run, "aridez_ai", ai, {**meta, "unidad": "adimensional (P/ET0)"}),
        escribir_columna(run, "et0_mm_anio", et0, {**meta, "unidad": "mm/año"}),
    ]
    puntos = {"Sahara (Erg Chech)": (24.5, -2.5), "Atacama": (-23.5, -69.0), "Amazonía": (-3.5, -62.0)}
    vals = {k: valor_en(ipix, ai, *v) for k, v in puntos.items()}
    fallos = []
    if not vals["Sahara (Erg Chech)"] < 0.05:
        fallos.append(f"Sahara no es hiperárido: {vals['Sahara (Erg Chech)']}")
    if not vals["Amazonía"] > 1.0:
        fallos.append(f"Amazonía no es húmeda: {vals['Amazonía']}")
    if np.isfinite(ai[norte]).any():
        fallos.append("quedan valores al norte de 80° N")
    r = {"puntos": vals, "celdas_anuladas_norte": int(norte.sum()), "fallos": fallos,
         "segundos": round(time.time() - t0, 1)}
    (run / "columns" / "e06.json").write_text(json.dumps({**r, "columnas": cols}, indent=2, ensure_ascii=False),
                                               encoding="utf-8")
    print(json.dumps(r, indent=2, ensure_ascii=False))
    for c in cols:
        print(f"{c['columna']}: cobertura {c['cobertura_pct']} %, p1 {c['p1']}, p50 {c['p50']}, p99 {c['p99']}")
    return 1 if fallos else 0


if __name__ == "__main__":
    sys.exit(main())
