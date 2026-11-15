"""Cruce de otras tablas HEALPix hacia nuestra malla por coordenada geográfica (P-010).

Por qué NO se debe cruzar por `ipix` directamente:
Nuestra malla (E-01) construye celdas de área igual sobre el elipsoide WGS84 convirtiendo la latitud geodésica a
latitud autálica (Snyder 1987) antes de proyectarla a la esfera unidad de HEALPix. Otra tabla HEALPix que coloque la
latitud geodésica directo sobre la esfera numera las celdas distinto: el mismo `ipix` queda desplazado ~10.7 km en la
mediana y hasta 14.3 km a 45° de latitud (P-010). Todo cruce con otra tabla HEALPix debe hacerse pasando por
(lat_geod, lon) con `celda_de`.
"""

from __future__ import annotations

import numpy as np

from comun_tabla import celda_de


def cruzar_por_coordenada(
    ipix_malla: np.ndarray,
    lat_geod: np.ndarray,
    lon: np.ndarray,
    valores: np.ndarray,
    hilos: int = 0,
) -> np.ndarray:
    """Alinea valores de otra tabla (con latitud geodésica y longitud en grados) a `ipix_malla`.

    Usa `celda_de` para asignar cada fila origen a su celda de nivel 12 en nuestra malla (latitud autálica).
    Si varias filas origen caen en la misma celda destino, promedia sus valores finitos.
    Las celdas de `ipix_malla` sin coincidencia (o cuyos valores origen no sean finitos) quedan en NaN.
    """
    ipix_m = np.asarray(ipix_malla, dtype=np.uint32)
    lat = np.asarray(lat_geod, dtype=np.float64)
    lon_arr = np.asarray(lon, dtype=np.float64)
    val = np.asarray(valores, dtype=np.float64)

    if ipix_m.ndim != 1:
        raise ValueError("ipix_malla debe ser un arreglo 1D")
    if lat.ndim != 1 or lon_arr.ndim != 1 or val.ndim != 1:
        raise ValueError("lat_geod, lon y valores deben ser arreglos 1D")
    if not (lat.size == lon_arr.size == val.size):
        raise ValueError("lat_geod, lon y valores deben tener el mismo largo")
    if ipix_m.size > 1 and not np.all(ipix_m[:-1] < ipix_m[1:]):
        raise ValueError("ipix_malla debe estar ordenado estrictamente ascendente")

    salida = np.full(ipix_m.size, np.nan, dtype=np.float32)
    if ipix_m.size == 0 or lat.size == 0:
        return salida

    ok = np.isfinite(lat) & np.isfinite(lon_arr) & (np.abs(lat) <= 90.0) & np.isfinite(val)
    if not ok.any():
        return salida

    ipix_src = celda_de(lat[ok], lon_arr[ok], hilos=hilos)
    val_ok = val[ok]
    u, inv = np.unique(ipix_src, return_inverse=True)
    pos = np.searchsorted(ipix_m, u)
    en = pos < ipix_m.size
    en[en] &= ipix_m[pos[en]] == u[en]
    if not en.any():
        return salida

    suma = np.bincount(inv, weights=val_ok, minlength=u.size)
    cuenta = np.bincount(inv, minlength=u.size)
    salida[pos[en]] = (suma[en] / cuenta[en]).astype(np.float32)
    return salida
