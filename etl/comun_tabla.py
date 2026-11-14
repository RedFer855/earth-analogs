"""Lectura de la malla y escritura de columnas alineadas a ella."""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from cdshealpix.nested import lonlat_to_healpix
from astropy import units as u

from comun import NIVEL, geodesica_a_autalica


def cargar_malla(run: Path) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    g = run / "grid"
    return (
        np.fromfile(g / "ipix.u32", dtype=np.uint32),
        np.fromfile(g / "lat.f32", dtype=np.float32),
        np.fromfile(g / "lon.f32", dtype=np.float32),
    )


def celda_de(lat_geod: np.ndarray, lon: np.ndarray, hilos: int = 0) -> np.ndarray:
    """ipix nested de nivel 12 para latitud geodésica y longitud, en grados.

    hilos=1 dentro de procesos paralelos: cdshealpix usa todos los núcleos por defecto.
    """
    beta = geodesica_a_autalica(lat_geod)
    lon_q = np.asarray(lon, dtype=np.float64) * u.deg
    return lonlat_to_healpix(lon_q, beta * u.deg, NIVEL, num_threads=hilos).astype(np.uint32)


def escribir_columna(run: Path, nombre: str, valores: np.ndarray, meta: dict) -> dict:
    """Escribe columns/<nombre>.f32 y devuelve la entrada del manifiesto con cobertura y percentiles."""
    col = run / "columns"
    col.mkdir(parents=True, exist_ok=True)
    v = np.asarray(valores, dtype=np.float32)
    if np.isinf(v).any():
        raise SystemExit(f"ERROR: {nombre} tiene infinitos")
    v.tofile(col / f"{nombre}.f32")
    ok = np.isfinite(v)
    p = np.percentile(v[ok], [1, 50, 99, 99.9]).tolist() if ok.any() else [None] * 4
    entrada = {
        **meta,
        "columna": nombre,
        "celdas": int(v.size),
        "cobertura_pct": round(100 * float(ok.mean()), 3),
        "p1": p[0],
        "p50": p[1],
        "p99": p[2],
        "p99_9": p[3],
    }
    (col / f"{nombre}.json").write_text(json.dumps(entrada, indent=2, ensure_ascii=False), encoding="utf-8")
    return entrada


def cargar_npz(ruta) -> dict[str, np.ndarray]:
    """Lee un .npz entero a memoria y cierra el archivo (Windows limita los archivos abiertos)."""
    with np.load(ruta) as q:
        return {k: q[k] for k in q.files}


def sumas_por_celda(ipix: np.ndarray, valores: dict[str, np.ndarray]) -> dict[str, np.ndarray]:
    """Suma y cuenta de cada variable por celda (para juntar después entre teselas)."""
    u_, inv = np.unique(ipix, return_inverse=True)
    out = {"ipix": u_}
    for k, v in valores.items():
        ok = np.isfinite(v)
        out[f"{k}_s"] = np.bincount(inv[ok], weights=v[ok], minlength=u_.size)
        out[f"{k}_n"] = np.bincount(inv[ok], minlength=u_.size).astype(np.uint32)
    return out


def juntar_sumas(ipix_malla: np.ndarray, archivos: list, nombres: list[str]) -> dict[str, np.ndarray]:
    """Junta las sumas parciales de varias teselas y devuelve la media por celda, alineada a la malla."""
    partes = [cargar_npz(a) for a in archivos]
    ip = np.concatenate([q["ipix"] for q in partes])
    u_, inv = np.unique(ip, return_inverse=True)
    pos = np.searchsorted(ipix_malla, u_)
    en = (pos < ipix_malla.size) & (ipix_malla[np.minimum(pos, ipix_malla.size - 1)] == u_)
    out = {}
    for k in nombres:
        s = np.bincount(inv, weights=np.concatenate([q[f"{k}_s"] for q in partes]))
        n = np.bincount(inv, weights=np.concatenate([q[f"{k}_n"] for q in partes]))
        col = np.full(ipix_malla.size, np.nan, np.float32)
        with np.errstate(invalid="ignore", divide="ignore"):
            col[pos[en]] = np.where(n[en] > 0, s[en] / n[en], np.nan)
        out[k] = col
    return out


def indices_en_rejilla(lat: np.ndarray, lon: np.ndarray, geo: tuple, forma: tuple) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Fila y columna del píxel de una rejilla regular (geotransform de GDAL) que contiene cada punto.

    Devuelve (fila, col, dentro). Para rejillas más gruesas que la celda, el centro de la celda decide el píxel.
    """
    x0, dx, _, y0, _, dy = geo
    col = np.floor((np.asarray(lon, dtype=np.float64) - x0) / dx).astype(np.int64)
    fila = np.floor((np.asarray(lat, dtype=np.float64) - y0) / dy).astype(np.int64)
    dentro = (fila >= 0) & (fila < forma[0]) & (col >= 0) & (col < forma[1])
    return np.clip(fila, 0, forma[0] - 1), np.clip(col, 0, forma[1] - 1), dentro


def muestrear(arr: np.ndarray, lat: np.ndarray, lon: np.ndarray, geo: tuple) -> np.ndarray:
    """Valor del píxel que contiene cada centro de celda; NaN fuera de la rejilla."""
    f, c, dentro = indices_en_rejilla(lat, lon, geo, arr.shape)
    v = arr[f, c].astype(np.float32)
    v[~dentro] = np.nan
    return v


def muestrear_por_franjas(ds, lat: np.ndarray, lon: np.ndarray, sin_dato=None, filas_por_franja: int = 2000) -> np.ndarray:
    """Como muestrear, pero leyendo el raster de GDAL por franjas de filas (para rasters de varios GB)."""
    b = ds.GetRasterBand(1)
    f, c, dentro = indices_en_rejilla(lat, lon, ds.GetGeoTransform(), (ds.RasterYSize, ds.RasterXSize))
    out = np.full(lat.size, np.nan, np.float32)
    nd = b.GetNoDataValue() if sin_dato is None else sin_dato
    for f0 in range(0, ds.RasterYSize, filas_por_franja):
        h = min(filas_por_franja, ds.RasterYSize - f0)
        k = np.flatnonzero(dentro & (f >= f0) & (f < f0 + h))
        if not k.size:
            continue
        franja = b.ReadAsArray(0, f0, ds.RasterXSize, h)
        v = franja[f[k] - f0, c[k]]
        w = v.astype(np.float32)
        if nd is not None:
            w[v == nd] = np.nan
        out[k] = w
    return out


def valor_en(ipix_malla: np.ndarray, columna: np.ndarray, lat: float, lon: float) -> float:
    """Valor de una columna en la celda que contiene (lat, lon); NaN si la celda no está en la malla."""
    c = celda_de(np.array([lat]), np.array([lon]))[0]
    i = np.searchsorted(ipix_malla, c)
    if i < ipix_malla.size and ipix_malla[i] == c:
        return float(columna[i])
    return float("nan")
