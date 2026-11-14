"""E-07: temperatura media anual del suelo (Obu et al. 2018, MAGT 2000-2016, hemisferio norte).

El zip usa Deflate64: se extrae primero a $RUN/cache con GDAL (que sí lo lee de corrido) y después se lee el GeoTIFF.
El raster está en una proyección polar: cada centro de celda se transforma a esa proyección para elegir el píxel.
Solo cubre el hemisferio norte y la cobertura parcial es de la fuente: nunca se rellena con 0.

Uso: python e07_permafrost.py
"""

from __future__ import annotations

import json
import sys
import time

import numpy as np
from osgeo import gdal, osr

from comun import ruta_env
from comun_tabla import cargar_malla, escribir_columna, indices_en_rejilla, valor_en

gdal.UseExceptions()
NOMBRE = "UiO_PEX_MAGTM_5.0_20181127_2000_2016_NH"


def extraer(datos, run) -> str:
    cache = run / "cache"
    cache.mkdir(parents=True, exist_ok=True)
    destino = cache / f"{NOMBRE}.tif"
    if not destino.exists():
        origen = f"/vsizip/{datos.as_posix()}/tierra/permafrost-obu-2018/{NOMBRE}.zip/{NOMBRE}.tif"
        gdal.CopyFile(origen, str(destino))
    return str(destino)


def main() -> int:
    datos, run = ruta_env("DATOS"), ruta_env("RUN")
    t0 = time.time()
    ruta = extraer(datos, run)
    ds = gdal.Open(ruta)
    b = ds.GetRasterBand(1)
    sin_dato = b.GetNoDataValue()
    srs = osr.SpatialReference(wkt=ds.GetProjection())
    wgs = osr.SpatialReference()
    wgs.ImportFromEPSG(4326)
    wgs.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    srs.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    tr = osr.CoordinateTransformation(wgs, srs)
    ipix, lat, lon = cargar_malla(run)
    col = np.full(ipix.size, np.nan, np.float32)
    norte = np.flatnonzero(lat > 25)
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
    meta = {
        "fuente": "Obu et al. 2018, ESA CCI Permafrost / PANGAEA, MAGT 2000-2016 v5.0 (hemisferio norte)",
        "url": "https://doi.org/10.1594/PANGAEA.888600",
        "licencia": "CC BY 3.0",
        "metodo": "extraído del zip con GDAL; centro de celda transformado a la proyección del raster",
        "advertencias": ["solo hemisferio norte; los Andes y otras zonas del sur no están cubiertos"],
        "unidad": "°C",
    }
    cols = [escribir_columna(run, "magt_c", col, meta)]
    puntos = {"Siberia (Yakutsk)": (62.0, 129.7), "Alaska norte (Prudhoe)": (70.2, -148.5), "Sahara": (24.5, -2.5)}
    vals = {k: valor_en(ipix, col, *v) for k, v in puntos.items()}
    fallos = []
    if not vals["Siberia (Yakutsk)"] < 0:
        fallos.append(f"Yakutsk sin permafrost: {vals['Siberia (Yakutsk)']}")
    if not vals["Alaska norte (Prudhoe)"] < 0:
        fallos.append(f"Prudhoe sin permafrost: {vals['Alaska norte (Prudhoe)']}")
    if np.isfinite(col[lat < 0]).any():
        fallos.append("hay valores en el hemisferio sur")
    r = {"puntos": vals, "sin_dato": sin_dato, "fallos": fallos, "segundos": round(time.time() - t0, 1)}
    (run / "columns" / "e07.json").write_text(json.dumps({**r, "columnas": cols}, indent=2, ensure_ascii=False),
                                               encoding="utf-8")
    print(json.dumps(r, indent=2, ensure_ascii=False))
    for c in cols:
        print(f"{c['columna']}: cobertura {c['cobertura_pct']} %, p1 {c['p1']}, p50 {c['p50']}, p99 {c['p99']}")
    return 1 if fallos else 0


if __name__ == "__main__":
    sys.exit(main())
