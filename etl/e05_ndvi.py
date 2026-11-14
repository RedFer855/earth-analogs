"""E-05: NDVI máximo (MOD13C1 V061, 2013-2022; ADR-004).

Un periodo de 16 días entra si la fiabilidad del píxel es 0 o 1 (se descartan nieve, nubes y valores estimados).
El máximo exige al menos 3 periodos válidos. Columnas: ndvi_max y ndvi_n_periodos.

Uso: python e05_ndvi.py
"""

from __future__ import annotations

import json
import sys
import time

import numpy as np
from osgeo import gdal

from comun import ruta_env
from comun_tabla import cargar_malla, escribir_columna, muestrear, valor_en

gdal.UseExceptions()
MIN_PERIODOS = 3


def _sub(ruta: str, clave: str):
    ds = gdal.Open(ruta)
    nombre = [s[0] for s in ds.GetSubDatasets() if s[0].endswith(clave)][0]
    sub = gdal.Open(nombre)
    return sub.GetRasterBand(1).ReadAsArray(), sub.GetGeoTransform()


def main() -> int:
    datos, run = ruta_env("DATOS"), ruta_env("RUN")
    t0 = time.time()
    archivos = sorted((datos / "tierra" / "vegetacion-mod13c1-2013-2022").glob("*.hdf"))
    if len(archivos) != 230:
        print(f"ERROR: se esperaban 230 periodos; hay {len(archivos)}")
        return 1
    maximo = cuenta = geo = suma = None
    max_anio: dict[int, np.ndarray] = {}
    for i, a in enumerate(archivos, 1):
        anio = int(a.name.split(".")[1][1:5])
        ndvi, geo = _sub(str(a), '"CMG 0.05 Deg 16 days NDVI"')
        fiab, _ = _sub(str(a), '"CMG 0.05 Deg 16 days pixel reliability"')
        v = np.where((fiab >= 0) & (fiab <= 1) & (ndvi > -3000), ndvi.astype(np.float32) / 10000, np.nan)
        if maximo is None:
            maximo = np.full(v.shape, -np.inf, np.float32)
            cuenta = np.zeros(v.shape, np.uint16)
            suma = np.zeros(v.shape, np.float64)
        maximo = np.fmax(maximo, v)
        cuenta += np.isfinite(v)
        suma += np.nan_to_num(v)
        if anio not in max_anio:
            max_anio[anio] = [np.full(v.shape, -np.inf, np.float32), np.zeros(v.shape, np.uint8)]
        max_anio[anio][0] = np.fmax(max_anio[anio][0], v)
        max_anio[anio][1] += np.isfinite(v)
        if i % 46 == 0:
            print(f"  {i}/230 periodos, {time.time() - t0:.0f} s", flush=True)
    maximo = np.where(cuenta >= MIN_PERIODOS, maximo, np.nan)
    with np.errstate(invalid="ignore", divide="ignore"):
        media = np.where(cuenta >= MIN_PERIODOS, suma / cuenta, np.nan).astype(np.float32)
    # climatología del máximo: media de los máximos anuales (cada año con al menos 3 periodos válidos)
    s_clim = np.zeros(maximo.shape, np.float64)
    n_clim = np.zeros(maximo.shape, np.uint8)
    for mx, n in max_anio.values():
        ok = n >= MIN_PERIODOS
        s_clim += np.where(ok, mx, 0)
        n_clim += ok
    del max_anio
    with np.errstate(invalid="ignore", divide="ignore"):
        clim = np.where(n_clim >= 5, s_clim / n_clim, np.nan).astype(np.float32)
    ipix, lat, lon = cargar_malla(run)
    col = muestrear(maximo, lat, lon, geo)
    n = muestrear(cuenta.astype(np.float32), lat, lon, geo)
    meta = {
        "fuente": "MODIS Terra MOD13C1 V061, 2013-2022 (230 periodos de 16 días)",
        "url": "https://lpdaac.usgs.gov/products/mod13c1v061/",
        "licencia": "NASA open data",
        "metodo": "fiabilidad 0 o 1; máximo con >= 3 periodos válidos; centro de celda",
        "advertencias": ["columna de contexto de la Tierra: no puntúa la semejanza (ADR-003)"],
    }
    cols = [
        escribir_columna(run, "ndvi_max", col, {**meta, "unidad": "adimensional"}),
        escribir_columna(run, "ndvi_n_periodos", n, {**meta, "unidad": "periodos"}),
        escribir_columna(run, "ndvi_max_clim", muestrear(clim, lat, lon, geo), {
            **meta, "unidad": "adimensional", "metodo": "media de los máximos anuales; >= 3 periodos por año y >= 5 años"}),
        escribir_columna(run, "ndvi_media", muestrear(media, lat, lon, geo), {
            **meta, "unidad": "adimensional", "metodo": "media de los periodos válidos; >= 3 periodos"}),
    ]
    puntos = {"taiga (Siberia central)": (62.0, 100.0), "Amazonía": (-3.5, -62.0), "Sahara (Erg Chech)": (24.5, -2.5)}
    vals = {k: valor_en(ipix, col, *v) for k, v in puntos.items()}
    fallos = []
    if not np.isfinite(vals["taiga (Siberia central)"]):
        fallos.append("la taiga no tiene NDVI")
    if not vals["Amazonía"] > 0.7:
        fallos.append(f"NDVI máximo bajo en la Amazonía: {vals['Amazonía']}")
    if not vals["Sahara (Erg Chech)"] < 0.2:
        fallos.append(f"NDVI máximo alto en el Sahara: {vals['Sahara (Erg Chech)']}")
    r = {"periodos": len(archivos), "puntos": vals, "fallos": fallos, "segundos": round(time.time() - t0, 1)}
    (run / "columns" / "e05.json").write_text(json.dumps({**r, "columnas": cols}, indent=2, ensure_ascii=False),
                                               encoding="utf-8")
    print(json.dumps(r, indent=2, ensure_ascii=False))
    for c in cols:
        print(f"{c['columna']}: cobertura {c['cobertura_pct']} %, p1 {c['p1']}, p50 {c['p50']}, p99 {c['p99']}")
    return 1 if fallos else 0


if __name__ == "__main__":
    sys.exit(main())
