"""E-01: malla HEALPix de nivel 12, solo celdas de tierra, ipix ascendente.

Una celda es de tierra si su centro cae dentro de una tesela Copernicus GLO-90 y la máscara de agua (WBM) en ese
punto no es océano (clase 1). Lagos y ríos se conservan aquí: el paso de terreno los enmascara después.

Entradas: $DATOS/tierra/glo90/wbm/*_WBM.tif
Salidas:  $RUN/grid/ipix.u32, lat.f32, lon.f32 (latitud geodésica WGS84) y grid.json

Uso: python e01_malla.py [procesos]
"""

from __future__ import annotations

import json
import sys
import time
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

import numpy as np
from cdshealpix.nested import healpix_to_lonlat
from osgeo import gdal

from comun import NIVEL, NPIX, NSIDE, RADIO_AUTALICO_KM, autalica_a_geodesica, nombre_tesela_glo90, ruta_env

gdal.UseExceptions()
BLOQUE = 1 << 24
OCEANO = 1


def esquina_tesela(nombre: str) -> tuple[int, int]:
    """(lat_sur, lon_oeste) a partir de 'Copernicus_DSM_COG_30_N56_00_E094_00_WBM.tif'."""
    partes = nombre.split("_")
    lat = int(partes[4][1:]) * (1 if partes[4][0] == "N" else -1)
    lon = int(partes[6][1:]) * (1 if partes[6][0] == "E" else -1)
    return lat, lon


def teselas_disponibles(dir_wbm: Path) -> dict[tuple[int, int], Path]:
    """Mapa (lat_sur, lon_oeste) -> archivo WBM. Falla si dos archivos dan la misma esquina."""
    teselas = {}
    for ruta in dir_wbm.glob("*_WBM.tif"):
        clave = esquina_tesela(ruta.name)
        if clave in teselas:
            raise SystemExit(f"ERROR: esquina repetida {clave}: {ruta.name} y {teselas[clave].name}")
        teselas[clave] = ruta
    return teselas


def candidatas(teselas: dict) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Recorre todas las celdas y se queda con las que caen en una tesela existente."""
    hay = np.zeros((180, 360), dtype=bool)
    for lat, lon in teselas:
        hay[lat + 90, lon + 180] = True
    ipix_l, lat_l, lon_l = [], [], []
    for inicio in range(0, NPIX, BLOQUE):
        ipix = np.arange(inicio, min(inicio + BLOQUE, NPIX), dtype=np.uint64)
        lon, beta = healpix_to_lonlat(ipix, NIVEL)
        lon = ((lon.deg + 180.0) % 360.0) - 180.0
        lat = autalica_a_geodesica(beta.deg)
        fila = np.clip(np.floor(lat).astype(np.int64) + 90, 0, 179)
        col = np.clip(np.floor(lon).astype(np.int64) + 180, 0, 359)
        dentro = hay[fila, col]
        ipix_l.append(ipix[dentro].astype(np.uint32))
        lat_l.append(lat[dentro])
        lon_l.append(lon[dentro])
    return np.concatenate(ipix_l), np.concatenate(lat_l), np.concatenate(lon_l)


def es_tierra(args: tuple[str, np.ndarray, np.ndarray]) -> np.ndarray:
    """Muestrea la WBM en el centro de cada celda; True si no es océano."""
    ruta, lat, lon = args
    ds = gdal.Open(ruta)
    x0, dx, _, y0, _, dy = ds.GetGeoTransform()
    datos = ds.GetRasterBand(1).ReadAsArray()
    col = np.clip(((lon - x0) / dx).astype(np.int64), 0, datos.shape[1] - 1)
    fila = np.clip(((lat - y0) / dy).astype(np.int64), 0, datos.shape[0] - 1)
    return datos[fila, col] != OCEANO


def main() -> int:
    procesos = int(sys.argv[1]) if len(sys.argv) > 1 else 8
    datos, run = ruta_env("DATOS"), ruta_env("RUN")
    teselas = teselas_disponibles(datos / "tierra" / "glo90" / "wbm")
    if not teselas:
        print("ERROR: no hay teselas WBM")
        return 1
    t0 = time.time()
    ipix, lat, lon = candidatas(teselas)
    clave = (np.floor(lat).astype(np.int64) + 90) * 360 + (np.floor(lon).astype(np.int64) + 180)
    orden = np.argsort(clave, kind="stable")
    cortes = np.flatnonzero(np.diff(clave[orden])) + 1
    grupos = np.split(orden, cortes)
    trabajos = []
    for g in grupos:
        k = int(clave[g[0]])
        ruta = teselas[(k // 360 - 90, k % 360 - 180)]
        trabajos.append((str(ruta), lat[g], lon[g]))
    tierra = np.zeros(ipix.size, dtype=bool)
    with ProcessPoolExecutor(max_workers=procesos) as pool:
        for g, res in zip(grupos, pool.map(es_tierra, trabajos, chunksize=32)):
            tierra[g] = res
    ipix, lat, lon = ipix[tierra], lat[tierra].astype(np.float32), lon[tierra].astype(np.float32)

    fallos = []
    archivos = len(list((datos / "tierra" / "glo90" / "wbm").glob("*_WBM.tif")))
    if len(teselas) != archivos:
        fallos.append(f"teselas leídas {len(teselas)} distintas de archivos WBM {archivos}")
    if ipix.size == 0:
        fallos.append("cero celdas")
    if not np.all(np.diff(ipix.astype(np.int64)) > 0):
        fallos.append("ipix no es estrictamente ascendente")
    if not (np.all(np.abs(lat) <= 90) and np.all(np.abs(lon) <= 180)):
        fallos.append("lat/lon fuera de rango")
    if not (np.isfinite(lat).all() and np.isfinite(lon).all()):
        fallos.append("lat/lon no finitos")

    salida = run / "grid"
    salida.mkdir(parents=True, exist_ok=True)
    ipix.tofile(salida / "ipix.u32")
    lat.tofile(salida / "lat.f32")
    lon.tofile(salida / "lon.f32")
    resumen = {
        "nivel": NIVEL,
        "nside": NSIDE,
        "esquema": "nested",
        "latitud": "esfera = latitud autálica; lat.f32 = geodésica WGS84 (Snyder 1987)",
        "radio_autalico_km": RADIO_AUTALICO_KM,
        "area_celda_km2": 4 * np.pi * RADIO_AUTALICO_KM**2 / NPIX,
        "criterio_tierra": "centro dentro de una tesela GLO-90 y WBM distinto de 1 (océano)",
        "teselas_wbm": len(teselas),
        "celdas": int(ipix.size),
        "lat_min": float(lat.min()) if ipix.size else None,
        "lat_max": float(lat.max()) if ipix.size else None,
        "segundos": round(time.time() - t0, 1),
        "fallos": fallos,
    }
    (salida / "grid.json").write_text(json.dumps(resumen, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps(resumen, indent=2, ensure_ascii=False))
    return 1 if fallos else 0


if __name__ == "__main__":
    sys.exit(main())
