"""E-07: permafrost y hielo en el suelo (Obu et al. 2018; Karjalainen et al. 2022).

Columnas por celda (el centro de la celda decide el píxel):
  magt_c            temperatura media anual del suelo (Obu MAGT 2000-2016, hemisferio norte, fuera de [-100, 100] es NaN)
  permafrost_prob   probabilidad de permafrost (Obu PERPROB 2000-2016, fracción 0-1, hemisferio norte)
  hielo_suelo_gam   contenido de hielo en el suelo GAM (Karjalainen 2022, 0-100, nodata 128 es NaN)
  hielo_suelo_gbm   contenido de hielo en el suelo GBM (Karjalainen 2022, 0-100, nodata 128 es NaN)

Los zip de Obu usan Deflate64: se extraen primero a $RUN/cache con GDAL y después se leen en su proyección polar.
Las capas de Karjalainen llegan hasta ~30.03° N en EPSG:4326 y las celdas fuera del raster quedan en NaN.

Uso: python e07_permafrost.py
"""

from __future__ import annotations

import json
import sys
import time

import numpy as np
from osgeo import gdal, osr

from comun import ruta_env
from comun_tabla import cargar_malla, escribir_columna, indices_en_rejilla, muestrear_por_franjas, valor_en

gdal.UseExceptions()
NOMBRE_MAGT = "UiO_PEX_MAGTM_5.0_20181127_2000_2016_NH"
NOMBRE_PROB = "UiO_PEX_PERPROB_5.0_20181128_2000_2016_NH"


def extraer(datos, run, nombre: str = NOMBRE_MAGT) -> str:
    cache = run / "cache"
    cache.mkdir(parents=True, exist_ok=True)
    destino = cache / f"{nombre}.tif"
    if not destino.exists():
        origen = f"/vsizip/{datos.as_posix()}/tierra/permafrost-obu-2018/{nombre}.zip/{nombre}.tif"
        gdal.CopyFile(origen, str(destino))
    return str(destino)


def limpiar_magt(v: np.ndarray) -> np.ndarray:
    """Convierte a NaN valores no finitos o fuera de [-100, 100] °C."""
    out = np.asarray(v, dtype=np.float32).copy()
    out[~np.isfinite(out) | (out < -100) | (out > 100)] = np.nan
    return out


def normalizar_perprob(v: np.ndarray) -> np.ndarray:
    """Escala PERPROB a fracción 0-1 si viene en 0-100."""
    out = np.asarray(v, dtype=np.float32)
    if np.isfinite(out).any() and np.nanmax(out) > 1.5:
        return (out / 100).astype(np.float32)
    return out


def _leer_polar(ruta: str, lat: np.ndarray, lon: np.ndarray) -> tuple[np.ndarray, float | None]:
    ds = gdal.Open(ruta)
    b = ds.GetRasterBand(1)
    sin_dato = b.GetNoDataValue()
    srs = osr.SpatialReference(wkt=ds.GetProjection())
    wgs = osr.SpatialReference()
    wgs.ImportFromEPSG(4326)
    wgs.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    srs.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    tr = osr.CoordinateTransformation(wgs, srs)
    col = np.full(lat.size, np.nan, np.float32)
    norte = np.flatnonzero(lat > -10)  # el raster polar llega hasta unos 7° S
    a = b.ReadAsArray()
    paso = 2_000_000
    for i in range(0, norte.size, paso):
        k = norte[i:i + paso]
        xy = np.array(tr.TransformPoints(np.column_stack([lon[k], lat[k]]).astype(np.float64)))
        f, c, dentro = indices_en_rejilla(xy[:, 1], xy[:, 0], ds.GetGeoTransform(), a.shape)
        v = a[f, c].astype(np.float32)
        malo = ~dentro | ~np.isfinite(v)
        if sin_dato is not None:
            malo |= a[f, c] == sin_dato
        v[malo] = np.nan
        col[k] = v
    return col, sin_dato


def _karjalainen(datos, archivo: str, lat: np.ndarray, lon: np.ndarray) -> np.ndarray:
    ds = gdal.Open(str(datos / "tierra" / "hielo-karjalainen-2022" / archivo))
    return muestrear_por_franjas(ds, lat, lon, sin_dato=128)


def main() -> int:
    datos, run = ruta_env("DATOS"), ruta_env("RUN")
    t0 = time.time()
    ipix, lat, lon = cargar_malla(run)
    magt_raw, sin_dato = _leer_polar(extraer(datos, run, NOMBRE_MAGT), lat, lon)
    magt = limpiar_magt(magt_raw)
    perprob = normalizar_perprob(_leer_polar(extraer(datos, run, NOMBRE_PROB), lat, lon)[0])
    gam = _karjalainen(datos, "VIC_GAM_mean.tif", lat, lon)
    gbm = _karjalainen(datos, "VIC_GBM_mean.tif", lat, lon)
    meta_obu = {
        "url": "https://doi.org/10.1594/PANGAEA.888600",
        "licencia": "CC BY 3.0",
        "metodo": "extraído del zip con GDAL; centro de celda transformado a la proyección del raster",
        "advertencias": [
            "producto del hemisferio norte; su raster polar llega hasta unos 7° S",
            "los Andes y otras zonas del sur no están cubiertos",
        ],
    }
    meta_karj = {
        "fuente": "Karjalainen et al. 2022 v1.1, contenido de hielo del suelo en el primer metro (30 arcsec)",
        "url": "https://doi.org/10.5281/zenodo.7009875",
        "licencia": "CC BY 4.0",
        "metodo": "centro de celda en EPSG:4326; nodata 128 es NaN; solo celdas dentro del raster",
        "advertencias": ["cubre desde 82.72° N hasta ~30.03° N"],
        "unidad": "valor de la fuente (0-100)",
    }
    cols = [
        escribir_columna(run, "magt_c", magt, {
            **meta_obu,
            "fuente": "Obu et al. 2018, ESA CCI Permafrost / PANGAEA, MAGT 2000-2016 v5.0 (hemisferio norte)",
            "metodo": meta_obu["metodo"] + "; valores fuera de [-100, 100] son NaN",
            "unidad": "°C",
        }),
        escribir_columna(run, "permafrost_prob", perprob, {
            **meta_obu,
            "fuente": "Obu et al. 2018, ESA CCI Permafrost / PANGAEA, PERPROB 2000-2016 v5.0 (hemisferio norte)",
            "unidad": "fracción 0-1",
        }),
        escribir_columna(run, "hielo_suelo_gam", gam, meta_karj),
        escribir_columna(run, "hielo_suelo_gbm", gbm, meta_karj),
    ]
    # Yakutia central, lejos de la ciudad y del Lena: en la celda de Yakutsk la fuente no tiene hielo (ciudad y río)
    puntos = {"Siberia (Yakutsk)": (62.0, 129.7), "Yakutia central": (62.5, 131.0),
              "Alaska norte (Prudhoe)": (70.2, -148.5), "Sahara": (24.5, -2.5)}
    vals = {
        k: {
            "magt": valor_en(ipix, magt, *v),
            "perprob": valor_en(ipix, perprob, *v),
            "gam": valor_en(ipix, gam, *v),
        }
        for k, v in puntos.items()
    }
    fallos = []
    if not vals["Siberia (Yakutsk)"]["magt"] < 0:
        fallos.append(f"Yakutsk sin permafrost (MAGT): {vals['Siberia (Yakutsk)']['magt']}")
    if not vals["Alaska norte (Prudhoe)"]["magt"] < 0:
        fallos.append(f"Prudhoe sin permafrost (MAGT): {vals['Alaska norte (Prudhoe)']['magt']}")
    if not vals["Alaska norte (Prudhoe)"]["perprob"] > 0.9:
        fallos.append(f"Prudhoe con probabilidad de permafrost baja: {vals['Alaska norte (Prudhoe)']['perprob']}")
    for k in ("Yakutia central", "Alaska norte (Prudhoe)"):
        if not np.isfinite(vals[k]["gam"]):
            fallos.append(f"{k} sin hielo_suelo_gam: {vals[k]['gam']}")
    if np.isfinite(vals["Sahara"]["gam"]):
        fallos.append(f"Sahara tiene hielo_suelo_gam fuera del raster: {vals['Sahara']['gam']}")
    if np.isfinite(magt[lat < -10]).any() or np.isfinite(perprob[lat < -10]).any():
        fallos.append("hay valores de Obu al sur de 10° S, fuera del raster")
    r = {"puntos": vals, "sin_dato": sin_dato, "fallos": fallos, "segundos": round(time.time() - t0, 1)}
    (run / "columns" / "e07.json").write_text(json.dumps({**r, "columnas": cols}, indent=2, ensure_ascii=False),
                                               encoding="utf-8")
    print(json.dumps(r, indent=2, ensure_ascii=False))
    for c in cols:
        print(f"{c['columna']}: cobertura {c['cobertura_pct']} %, p1 {c['p1']}, p50 {c['p50']}, p99 {c['p99']}")
    return 1 if fallos else 0


if __name__ == "__main__":
    sys.exit(main())
