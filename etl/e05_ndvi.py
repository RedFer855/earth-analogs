"""E-05: NDVI máximo (MOD13C1 V061, 2013-2022; ADR-004).

Un periodo de 16 días entra si la fiabilidad del píxel es 0 o 1 (se descartan nieve, nubes y valores estimados)
y si "VI Quality" (UInt16, nodata 65535) marca tierra (código 1) o costa u orilla (código 2) en los bits 11-13. El
agua (3 a 7) queda fuera. Aceptar solo el 1 dejaba sin NDVI a los píxeles de 0.05° con costa u orilla, que en el norte
son la mayoría (medición en ADR-006).

Códigos de máscara tierra/agua en VI Quality (bits 11-13, según la guía MOD13 C6.1):
  0 = océano somero (shallow ocean)
  1 = tierra (land)
  2 = líneas de costa oceánica y orillas de lagos (ocean coastlines and lake shorelines)
  3 = agua interior somera (shallow inland water)
  4 = agua efímera (ephemeral water)
  5 = agua interior profunda (deep inland water)
  6 = océano moderado o continental (moderate or continental ocean)
  7 = océano profundo (deep ocean)

El máximo exige al menos 3 periodos válidos. ndvi_max_clim es el máximo de la curva climatológica: para cada uno de
los 23 periodos del año, la media de los años con dato; luego el máximo entre periodos, con al menos 3 periodos con
dato (basta la temporada sin nieve). Columnas: ndvi_max, ndvi_n_periodos, ndvi_max_clim y ndvi_media.

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
CODIGOS_TIERRA_VI_QUALITY = (1, 2)  # tierra y costa u orilla; el agua (3 a 7) queda fuera
VI_QUALITY_NODATA = 65535


def es_tierra_vi_quality(vi_quality: np.ndarray) -> np.ndarray:
    """True donde VI Quality (UInt16, nodata 65535) marca tierra (1) o costa u orilla (2) en los bits 11-13."""
    viq = np.asarray(vi_quality)
    return (viq != VI_QUALITY_NODATA) & np.isin((viq >> 11) & 0b111, CODIGOS_TIERRA_VI_QUALITY)


class CurvaClimatologica:
    """Máximo de la curva climatológica del NDVI.

    Se alimenta con los periodos ordenados por día del año: para cada día se promedian los años con dato y se guarda
    el máximo entre días. Así no hace falta tener las 23 rejillas en memoria.
    """

    def __init__(self) -> None:
        self.maximo = self.n_periodos = self._suma = self._cuenta = None
        self._dia = None

    def agregar(self, dia: int, v: np.ndarray) -> None:
        if self._dia is not None and dia != self._dia:
            self._cerrar()
        if self._suma is None:
            self._suma = np.zeros(v.shape, np.float64)
            self._cuenta = np.zeros(v.shape, np.uint8)
            self.maximo = np.full(v.shape, -np.inf, np.float32)
            self.n_periodos = np.zeros(v.shape, np.uint8)
        self._dia = dia
        self._suma += np.nan_to_num(v)
        self._cuenta += np.isfinite(v)

    def _cerrar(self) -> None:
        with np.errstate(invalid="ignore", divide="ignore"):
            media = np.where(self._cuenta > 0, self._suma / self._cuenta, np.nan).astype(np.float32)
        self.maximo = np.fmax(self.maximo, media)
        self.n_periodos += self._cuenta > 0
        self._suma.fill(0)
        self._cuenta.fill(0)

    def resultado(self, min_periodos: int = MIN_PERIODOS) -> np.ndarray:
        if self._dia is not None:
            self._cerrar()
            self._dia = None
        return np.where(self.n_periodos >= min_periodos, self.maximo, np.nan).astype(np.float32)


def anio_y_dia(nombre: str) -> tuple[int, int]:
    """Año y día del año de un archivo MOD13C1.AAAADDD..."""
    s = nombre.split(".")[1]
    return int(s[1:5]), int(s[5:8])


def filtrar_ndvi(ndvi: np.ndarray, fiab: np.ndarray, vi_quality: np.ndarray) -> np.ndarray:
    """Filtra un periodo MOD13C1 a tierra o costa (VI Quality bits 11-13 en 1 o 2), fiabilidad 0 o 1 y NDVI > -3000."""
    ok = (fiab >= 0) & (fiab <= 1) & (ndvi > -3000) & es_tierra_vi_quality(vi_quality)
    return np.where(ok, np.asarray(ndvi, dtype=np.float32) / 10000, np.nan)


def _sub(ruta: str, clave: str):
    ds = gdal.Open(ruta)
    nombre = [s[0] for s in ds.GetSubDatasets() if s[0].endswith(clave)][0]
    sub = gdal.Open(nombre)
    return sub.GetRasterBand(1).ReadAsArray(), sub.GetGeoTransform()


def main() -> int:
    datos, run = ruta_env("DATOS"), ruta_env("RUN")
    t0 = time.time()
    # por día del año y después por año: la curva climatológica se arma día por día
    archivos = sorted((datos / "tierra" / "vegetacion-mod13c1-2013-2022").glob("*.hdf"),
                      key=lambda a: anio_y_dia(a.name)[::-1])
    if len(archivos) != 230:
        print(f"ERROR: se esperaban 230 periodos; hay {len(archivos)}")
        return 1
    maximo = cuenta = geo = suma = None
    curva = CurvaClimatologica()
    for i, a in enumerate(archivos, 1):
        ndvi, geo = _sub(str(a), '"CMG 0.05 Deg 16 days NDVI"')
        fiab, _ = _sub(str(a), '"CMG 0.05 Deg 16 days pixel reliability"')
        viq, _ = _sub(str(a), '"CMG 0.05 Deg 16 days VI Quality"')
        v = filtrar_ndvi(ndvi, fiab, viq)
        if maximo is None:
            maximo = np.full(v.shape, -np.inf, np.float32)
            cuenta = np.zeros(v.shape, np.uint16)
            suma = np.zeros(v.shape, np.float64)
        maximo = np.fmax(maximo, v)
        cuenta += np.isfinite(v)
        suma += np.nan_to_num(v)
        curva.agregar(anio_y_dia(a.name)[1], v)
        if i % 46 == 0:
            print(f"  {i}/230 periodos, {time.time() - t0:.0f} s", flush=True)
    maximo = np.where(cuenta >= MIN_PERIODOS, maximo, np.nan)
    with np.errstate(invalid="ignore", divide="ignore"):
        media = np.where(cuenta >= MIN_PERIODOS, suma / cuenta, np.nan).astype(np.float32)
    clim = curva.resultado()
    del curva
    ipix, lat, lon = cargar_malla(run)
    col = muestrear(maximo, lat, lon, geo)
    n = muestrear(cuenta.astype(np.float32), lat, lon, geo)
    filtro = "VI Quality bits 11-13 en 1 o 2 (tierra y costa u orilla; sin agua); fiabilidad 0 o 1"
    meta = {
        "fuente": "MODIS Terra MOD13C1 V061, 2013-2022 (230 periodos de 16 días)",
        "url": "https://lpdaac.usgs.gov/products/mod13c1v061/",
        "licencia": "NASA open data",
        "metodo": f"{filtro}; máximo con >= 3 periodos válidos; centro de celda",
        "advertencias": ["columna de contexto de la Tierra: no puntúa la semejanza (ADR-003)"],
    }
    cols = [
        escribir_columna(run, "ndvi_max", col, {**meta, "unidad": "adimensional"}),
        escribir_columna(run, "ndvi_n_periodos", n, {**meta, "unidad": "periodos"}),
        escribir_columna(run, "ndvi_max_clim", muestrear(clim, lat, lon, geo), {
            **meta, "unidad": "adimensional",
            "metodo": (f"{filtro}; máximo de la curva climatológica (media 2013-2022 de cada uno de los 23 periodos "
                       "de 16 días, y máximo entre periodos); >= 3 periodos con dato; centro de celda")}),
        escribir_columna(run, "ndvi_media", muestrear(media, lat, lon, geo), {
            **meta, "unidad": "adimensional",
            "metodo": f"{filtro}; media de los periodos válidos; >= 3 periodos; centro de celda"}),
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
