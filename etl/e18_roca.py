"""E-18: fracción de roca volcánica y de evaporitas alrededor de cada celda, desde GLiM a 0.5°.

E-09 ya guarda `glim_clase` (la clase del píxel que contiene el centro). Aquí se agrega cuánto del entorno es de
cada familia, porque una celda de 2.5 km² en el borde de un campo basáltico importa aunque su píxel no lo sea.

Columnas:
  roca_volcanica_frac   fracción de píxeles GLiM volcánicos (vb, va, vi, py) en la ventana de 3x3 (~1.5° x 1.5°)
  roca_evaporita_frac   fracción de píxeles de evaporitas (ev) en la misma ventana; aproxima salares y salinas

Los píxeles de agua (wb) y sin dato (nd) no cuentan en el denominador.

Uso:  pixi run python e18_roca.py
"""

from __future__ import annotations

import numpy as np
from osgeo import gdal

from comun import ruta_env
from comun_tabla import cargar_malla, escribir_columna, muestrear

gdal.UseExceptions()

# Classnames.txt del zip de GLiM 0.5°
VOLCANICAS = (2, 7, 10, 12)  # vb, va, vi, py
EVAPORITAS = (14,)  # ev
NO_CUENTAN = (11, 15)  # wb, nd


def fraccion_ventana(clase: np.ndarray, familia: tuple[int, ...], radio: int = 1) -> np.ndarray:
    """Fracción de píxeles de la familia en una ventana (2r+1)², con vuelta en longitud y sin vuelta en latitud."""
    valido = (clase >= 1) & ~np.isin(clase, NO_CUENTAN)
    es = np.isin(clase, familia) & valido
    num = np.zeros(clase.shape, np.float64)
    den = np.zeros(clase.shape, np.float64)
    for df in range(-radio, radio + 1):
        for dc in range(-radio, radio + 1):
            e = np.roll(es, dc, axis=1).astype(np.float64)
            v = np.roll(valido, dc, axis=1).astype(np.float64)
            if df > 0:
                e[df:], e[:df] = e[:-df].copy(), 0
                v[df:], v[:df] = v[:-df].copy(), 0
            elif df < 0:
                e[:df], e[df:] = e[-df:].copy(), 0
                v[:df], v[df:] = v[-df:].copy(), 0
            num += e
            den += v
    with np.errstate(invalid="ignore", divide="ignore"):
        return np.where(den > 0, num / den, np.nan).astype(np.float32)


def main() -> None:
    datos, run = ruta_env("DATOS"), ruta_env("RUN")
    _, lat, lon = cargar_malla(run)
    ds = gdal.Open(f"/vsizip/{datos.as_posix()}/tierra/litologia-glim-05/hartmann-moosdorf_2012.zip/glim_wgs84_0point5deg.txt.asc")
    clase = ds.ReadAsArray().astype(np.int16)
    geo = ds.GetGeoTransform()
    meta = {
        "fuente": "GLiM v1.0, malla de 0.5° (Hartmann y Moosdorf 2012)", "url": "https://doi.pangaea.de/10.1594/PANGAEA.788537",
        "licencia": "CC BY 3.0", "unidad": "fracción 0-1",
        "advertencias": ["0.5° es mucho más grueso que la celda: describe el entorno, no la celda",
                         "wb (agua) y nd (sin dato) fuera del denominador"]}
    escribir_columna(run, "roca_volcanica_frac", muestrear(fraccion_ventana(clase, VOLCANICAS), lat, lon, geo),
                     {**meta, "metodo": "ventana 3x3 de 0.5°; clases vb, va, vi, py"})
    escribir_columna(run, "roca_evaporita_frac", muestrear(fraccion_ventana(clase, EVAPORITAS), lat, lon, geo),
                     {**meta, "metodo": "ventana 3x3 de 0.5°; clase ev"})


if __name__ == "__main__":
    main()
