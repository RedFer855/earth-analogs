"""E-12: valores objetivo de 12 sitios de Marte (etl/sitios/objetivos-marte.json), en círculos de 50 km de radio.

  Relieve:     HRSC-MOLA blended DEM v2, 200 m (Int16, sin dato -32768; se lee por ventanas) -> parches de ~1.6 km
               con pendiente de Horn (espaciado métrico por fila en esfera de 3396.19 km), cuantiles lineales,
               rugosidad y relieve en ventana 5x5; resumen por sitio con mediana y MAD (escala de celda terrestre).
  Minerales:   TES Bandfield 2002, 4 ppd; el .hdr no trae georreferencia: se asigna (-180, 0.25, 90, -0.25).
               Capas en el orden de la lista de ASU; sin dato -1. Se guardan las 13 capas en el círculo.
  Inercia térmica (contexto): THEMIS Quantitative 100 m (solo 60° S a 60° N), muestreo regular cada 200 m en todo el
               círculo y todos los cuadros que lo cubran; resumen con mediana y MAD, o None si no hay cobertura.
  Clima superficial (uso solo local): Mars Climate Database v6.2 (clim_aveEUV, 12 meses x 12 horas, rejilla 49 x 64
               de 3.75° x 5.625°), interpolación bilineal al centro de cada sitio con envolvimiento en longitud y
               corrección hidrostática de ps usando orografía de mountain.nc y temperatura del nivel más bajo.
Comprobación: el máximo de hematita de TES entre 60° S y 60° N cae en Meridiani; tsurf MCD en [120, 330] K,
              ps corregida en [100, 1500] Pa, rango diurno > 0 y mayor ps corregida en el sitio más bajo
              (también para todo par con desnivel > 1500 m).

Salida: $RUN/objetivos/objetivos_marte.json

Uso: python e12_marte.py
"""

from __future__ import annotations

import json
import math
import sys
import time
from pathlib import Path

import numpy as np
from osgeo import gdal, osr

from comun import ruta_env
from objetivos_comun import parches, puntos_circulo, resumen, resumir_parches

gdal.UseExceptions()
R_MARTE = 3396190.0
BLOQUE_M = 200.0  # bloque cuadrado de terreno, igual que en la Tierra y la Luna (ADR-005)
MARGEN_TERRENO_M = 2000.0  # borde extra para que los parches del límite del círculo tengan vecinos
# Valores estándar de Marte, no verificados en la documentación de la MCD
R_GAS_MARTE = 191.18  # J kg-1 K-1, constante específica del gas de la atmósfera de Marte
G_MARTE = 3.7274  # m s-2, aceleración de la gravedad superficial de Marte
CAPAS_TES = ["cuarzo", "feldespato_k", "plagioclasa", "anfibol", "piroxeno_bajo_ca", "piroxeno_alto_ca", "olivino",
             "hematita", "sulfatos", "carbonatos", "silicatos_lamina_vidrio", "polvo_superficial", "error_rms"]
GEO_MCD = (-182.8125, 5.625, 0.0, 91.875, 0.0, -3.75)
CAMPOS_MCD_LOCAL = (
    "mcd_tsurf_media_k",
    "mcd_rango_diurno_k",
    "mcd_amp_anual_k",
    "mcd_tsurf_max_k",
    "mcd_tsurf_min_k",
    "mcd_ps_media_pa",
    "mcd_ps_grid_media_pa",
    "mcd_z_gcm_m",
    "mcd_dz_m",
)
ADVERTENCIA_MCD = (
    "la rejilla de MCD 6.2 es de ~5.625° x 3.75° (cientos de km), mucho más gruesa que el círculo de 50 km del sitio; "
    "es una climatología de modelo y no una observación; además, la LST terrestre (MODIS) mide temperatura de piel "
    "satelital en dos pasos horarios, mientras que mcd_rango_diurno_k usa 12 horas del día, por lo que el rango "
    "diurno terrestre es una cota inferior"
)
ADVERTENCIA_MCD_TSURF = (
    "tsurf de MCD no se corrige por elevación: la temperatura superficial depende del albedo y la inercia térmica "
    "locales, no solo de la altura; aplicar un gradiente vertical sería inventado"
)


def _lon180(lon_e: float) -> float:
    return ((lon_e + 180) % 360) - 180


def _circulo(lat, lon, radio_m, geo, forma):
    """Ventana (c0, f0, w, h) y máscara de un círculo en una rejilla lat/lon, con distancia de gran círculo."""
    x0, dx, _, y0, _, dy = geo
    dlat = np.degrees(radio_m / R_MARTE)
    dlon = dlat / max(np.cos(np.radians(lat)), 0.05)
    c0 = int((lon - dlon - x0) / dx)
    c1 = int(np.ceil((lon + dlon - x0) / dx))
    f0 = int((lat + dlat - y0) / dy)
    f1 = int(np.ceil((lat - dlat - y0) / dy))
    c0, f0 = max(c0, 0), max(f0, 0)
    c1, f1 = min(c1, forma[1]), min(f1, forma[0])
    lats = y0 + (np.arange(f0, f1) + 0.5) * dy
    lons = x0 + (np.arange(c0, c1) + 0.5) * dx
    la, lo = np.meshgrid(np.radians(lats), np.radians(lons), indexing="ij")
    p1, l1 = np.radians(lat), np.radians(lon)
    d = 2 * np.arcsin(np.sqrt(np.sin((la - p1) / 2) ** 2 + np.cos(p1) * np.cos(la) * np.sin((lo - l1) / 2) ** 2))
    return (c0, f0, c1 - c0, f1 - f0), d * R_MARTE <= radio_m, lats


def bloques_200m(ds, lat, lon, radio_m):
    """Reproyecta el DEM alrededor del sitio a LAEA local con píxeles cuadrados de 200 m (promedio de área).

    El DEM es una rejilla lat/lon: 200 m de N a S pero 200·cos(lat) m de E a O. Con bloques cuadrados de 200 m la
    pendiente, la rugosidad y el relieve se miden a la misma escala que en la Tierra (E-03) y la Luna (ADR-005).
    Devuelve (z, máscara del círculo de radio_m).
    """
    geo = ds.GetGeoTransform()
    lado = float(np.ceil((radio_m + MARGEN_TERRENO_M) / BLOQUE_M) * BLOQUE_M)
    (c0, f0, w, h), _, _ = _circulo(lat, lon, lado * np.sqrt(2), geo, (ds.RasterYSize, ds.RasterXSize))
    srs = osr.SpatialReference(wkt=ds.GetProjection())
    laea = srs.CloneGeogCS()  # mismo cuerpo y datum que el DEM: PROJ no transforma entre cuerpos distintos
    laea.SetLAEA(float(lat), float(lon), 0.0, 0.0)
    ventana = gdal.Translate("", ds, format="VRT", srcWin=[c0, f0, w, h])
    dst = gdal.Warp("", ventana, format="MEM", dstSRS=laea.ExportToWkt(), outputBounds=(-lado, -lado, lado, lado),
                    xRes=BLOQUE_M, yRes=BLOQUE_M, resampleAlg="average", srcNodata=-32768, dstNodata=np.nan,
                    outputType=gdal.GDT_Float32, multithread=False)
    z = dst.GetRasterBand(1).ReadAsArray().astype(np.float64)
    dst = ventana = None
    centros = -lado + (np.arange(z.shape[1]) + 0.5) * BLOQUE_M
    x, y = np.meshgrid(centros, centros[::-1][: z.shape[0]])
    return z, np.hypot(x, y) <= radio_m


def terreno_marte(ds, lat, lon, radio_m):
    """Calcula métricas de terreno en parches de ~1.6 km dentro del círculo de radio_m, en bloques de 200 m."""
    z, m = bloques_200m(ds, lat, lon, radio_m)
    ps = parches(z, BLOQUE_M, BLOQUE_M, m)
    terreno = resumir_parches(ps)
    sm = terreno["slope_mean_deg"]["mediana"] if terreno["slope_mean_deg"] else None
    ss = terreno["slope_std_deg"]["mediana"] if terreno["slope_std_deg"] else None
    return sm, ss, int(m.sum()), terreno


def tes(datos: Path):
    ds = gdal.Open(str(datos / "marte" / "tes-minerales-bandfield-2002" / "TES_mineral_maps_4_ppd.envi"))
    a = ds.ReadAsArray().astype(np.float32)  # 13 x 720 x 1440
    a[a == -1] = np.nan
    return a, (-180.0, 0.25, 0.0, 90.0, 0.0, -0.25)


def themis(datos: Path, lat: float, lon_e: float, radio_m: float):
    """Muestrea THEMIS cada 200 m en todo el círculo sobre todos los cuadros y devuelve resumen y lista de cuadros."""
    lats_p, lons_p = puntos_circulo(lat, lon_e, radio_m, R_MARTE, 200.0)
    vals = np.full(lats_p.size, np.nan, dtype=np.float64)
    cuadros: list[str] = []
    for r in sorted((datos / "marte" / "themis-ti-100m").glob("*.tif")):
        if not np.isnan(vals).any():
            break
        ds = gdal.Open(str(r))
        srs = osr.SpatialReference(wkt=ds.GetProjection())
        srs.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
        geo_cs = srs.CloneGeogCS()
        geo_cs.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
        tr = osr.CoordinateTransformation(geo_cs, srs)
        x0, dx, _, y0, _, dy = ds.GetGeoTransform()
        rx, ry = ds.RasterXSize, ds.RasterYSize
        b = ds.GetRasterBand(1)
        nodata = b.GetNoDataValue()
        for usar_180 in (True, False):
            faltan = np.isnan(vals)
            if not faltan.any():
                break
            lons_cand = _lon180_arr(lons_p[faltan]) if usar_180 else (lons_p[faltan] % 360)
            pts = np.column_stack([lons_cand, lats_p[faltan]])
            xy = np.asarray(tr.TransformPoints(pts.tolist()), dtype=np.float64)
            finito = np.isfinite(xy[:, 0]) & np.isfinite(xy[:, 1])
            if not finito.any():
                continue
            c = np.full(xy.shape[0], -1, dtype=np.int64)
            f = np.full(xy.shape[0], -1, dtype=np.int64)
            c[finito] = np.floor((xy[finito, 0] - x0) / dx).astype(np.int64)
            f[finito] = np.floor((xy[finito, 1] - y0) / dy).astype(np.int64)
            en = (c >= 0) & (c < rx) & (f >= 0) & (f < ry)
            if not en.any():
                continue
            c_en, f_en = c[en], f[en]
            c0, c1 = int(c_en.min()), int(c_en.max()) + 1
            f0, f1 = int(f_en.min()), int(f_en.max()) + 1
            arr = b.ReadAsArray(c0, f0, c1 - c0, f1 - f0).astype(np.float64)
            if nodata is not None:
                arr[arr == nodata] = np.nan
            arr[~np.isfinite(arr) | (arr <= 0)] = np.nan
            muestra = arr[f_en - f0, c_en - c0]
            validas = np.isfinite(muestra)
            if validas.any():
                idx_faltan = np.flatnonzero(faltan)[en][validas]
                vals[idx_faltan] = muestra[validas]
                if r.name not in cuadros:
                    cuadros.append(r.name)
    res = resumen(vals)
    return (res, cuadros) if res is not None else (None, None)


def _lon180_arr(lons: np.ndarray) -> np.ndarray:
    return ((lons + 180) % 360) - 180


def _mezcla_lineal(v0: np.ndarray, v1: np.ndarray, w: float) -> np.ndarray:
    if w == 0.0:
        return np.array(v0, dtype=np.float64, copy=True)
    if w == 1.0:
        return np.array(v1, dtype=np.float64, copy=True)
    return (1.0 - w) * v0 + w * v1


def _indices_bilineales_mcd(
    lat: float,
    lon_e: float,
    forma_lat_lon: tuple[int, int],
    geo: tuple[float, ...],
) -> tuple[int, int, float, int, int, float]:
    """Índices y pesos bilineales para (lat, lon_e) sobre la rejilla regular MCD con envolvimiento en longitud."""
    n_lat, n_lon = forma_lat_lon
    if n_lat < 2 or n_lon < 2:
        raise ValueError(f"rejilla MCD demasiado pequeña: {forma_lat_lon}")
    if not (np.isfinite(lat) and np.isfinite(lon_e)) or not (-90.0 <= lat <= 90.0):
        raise ValueError(f"coordenada fuera de rango: lat={lat}, lon_e={lon_e}")
    x0, dx, _, y0, _, dy = geo
    lon_norm = _lon180(float(lon_e))
    lon_0 = x0 + 0.5 * dx
    ancho_lon = n_lon * dx
    fx = ((lon_norm - lon_0) % ancho_lon) / dx
    c0 = int(np.floor(fx)) % n_lon
    c1 = (c0 + 1) % n_lon
    wx = float(fx - np.floor(fx))

    lat_0 = y0 + 0.5 * dy
    fy = float(np.clip((float(lat) - lat_0) / dy, 0.0, n_lat - 1))
    f0 = min(int(np.floor(fy)), n_lat - 2)
    f1 = f0 + 1
    wy = float(fy - f0)
    return f0, f1, wy, c0, c1, wx


def _interpolar_rejilla(arr: np.ndarray, idx: tuple[int, int, float, int, int, float]) -> np.ndarray:
    f0, f1, wy, c0, c1, wx = idx
    a = np.asarray(arr, dtype=np.float64)
    fila0 = _mezcla_lineal(a[..., f0, c0], a[..., f0, c1], wx)
    fila1 = _mezcla_lineal(a[..., f1, c0], a[..., f1, c1], wx)
    return _mezcla_lineal(fila0, fila1, wy)


def interpolar_campo_mcd(
    campo_mcd: np.ndarray,
    lat: float,
    lon_e: float,
    geo: tuple[float, ...] = GEO_MCD,
) -> np.ndarray:
    """Interpola bilinealmente un arreglo MCD con dimensiones finales (lat, lon) al centro del sitio."""
    arr = np.asarray(campo_mcd, dtype=np.float64)
    if arr.ndim < 2:
        raise ValueError(f"forma incompatible de MCD: {arr.shape}")
    idx = _indices_bilineales_mcd(lat, lon_e, arr.shape[-2:], geo)
    return _interpolar_rejilla(arr, idx)


def interpolar_mcd_sitio(
    tsurf_mcd: np.ndarray,
    ps_mcd: np.ndarray,
    lat: float,
    lon_e: float,
    geo: tuple[float, ...] = GEO_MCD,
) -> tuple[np.ndarray, np.ndarray]:
    """Interpola bilinealmente tsurf y ps de MCD (12 meses x 12 horas x 49 lat x 64 lon) para un sitio."""
    t_arr = np.asarray(tsurf_mcd, dtype=np.float64)
    p_arr = np.asarray(ps_mcd, dtype=np.float64)
    if t_arr.ndim < 2 or t_arr.shape != p_arr.shape:
        raise ValueError(f"formas incompatibles de MCD: tsurf={t_arr.shape}, ps={p_arr.shape}")
    idx = _indices_bilineales_mcd(lat, lon_e, t_arr.shape[-2:], geo)
    return _interpolar_rejilla(t_arr, idx), _interpolar_rejilla(p_arr, idx)


def corregir_ps_hidrostatica(
    ps_grid: np.ndarray,
    t1: np.ndarray,
    z_sitio_m: float | None,
    z_gcm_m: float | None,
) -> np.ndarray:
    """Corrige ps de MCD por la diferencia entre la elevación del sitio y la orografía del modelo."""
    ps_arr = np.asarray(ps_grid, dtype=np.float64)
    t1_arr = np.asarray(t1, dtype=np.float64)
    if ps_arr.shape != t1_arr.shape:
        raise ValueError(f"formas incompatibles para corrección hidrostática: ps={ps_arr.shape}, t1={t1_arr.shape}")
    if z_sitio_m is None or not np.isfinite(z_sitio_m) or z_gcm_m is None or not np.isfinite(z_gcm_m):
        return np.full(ps_arr.shape, np.nan, dtype=np.float64)
    dz = float(z_sitio_m) - float(z_gcm_m)
    valido = np.isfinite(ps_arr) & np.isfinite(t1_arr) & (t1_arr > 0.0)
    ps_corr = np.full(ps_arr.shape, np.nan, dtype=np.float64)
    h = (R_GAS_MARTE * t1_arr[valido]) / G_MARTE
    ps_corr[valido] = ps_arr[valido] * np.exp(-dz / h)
    return ps_corr


def resumir_mcd_sitio(
    tsurf: np.ndarray | None,
    ps_grid: np.ndarray | None,
    ps_corregida: np.ndarray | None = None,
    z_gcm_m: float | None = None,
    z_sitio_m: float | None = None,
) -> dict[str, float]:
    """Calcula las métricas climáticas de MCD para un sitio a partir de arreglos (12 meses, 12 horas)."""
    nan = float("nan")
    salida = {k: nan for k in CAMPOS_MCD_LOCAL}
    if tsurf is not None:
        t_arr = np.asarray(tsurf, dtype=np.float64)
        if t_arr.ndim == 2 and t_arr.size > 0 and np.all(np.isfinite(t_arr)):
            media_diaria = t_arr.mean(axis=1)
            rango_diario = t_arr.max(axis=1) - t_arr.min(axis=1)
            salida["mcd_tsurf_media_k"] = float(t_arr.mean())
            salida["mcd_rango_diurno_k"] = float(rango_diario.mean())
            salida["mcd_amp_anual_k"] = float(media_diaria.max() - media_diaria.min())
            salida["mcd_tsurf_max_k"] = float(t_arr.max())
            salida["mcd_tsurf_min_k"] = float(t_arr.min())
    if ps_corregida is not None:
        p_corr_arr = np.asarray(ps_corregida, dtype=np.float64)
        if p_corr_arr.ndim == 2 and p_corr_arr.size > 0 and np.all(np.isfinite(p_corr_arr)):
            salida["mcd_ps_media_pa"] = float(p_corr_arr.mean())
    if ps_grid is not None:
        p_grid_arr = np.asarray(ps_grid, dtype=np.float64)
        if p_grid_arr.ndim == 2 and p_grid_arr.size > 0 and np.all(np.isfinite(p_grid_arr)):
            salida["mcd_ps_grid_media_pa"] = float(p_grid_arr.mean())
    if z_gcm_m is not None and np.isfinite(z_gcm_m):
        salida["mcd_z_gcm_m"] = float(z_gcm_m)
        if z_sitio_m is not None and np.isfinite(z_sitio_m):
            salida["mcd_dz_m"] = float(z_sitio_m) - float(z_gcm_m)
    return salida


def _leer_bandas_netcdf(ruta: Path, var: str) -> tuple[np.ndarray, tuple[float, ...]]:
    ds = gdal.Open(f'NETCDF:"{ruta}":{var}')
    a = ds.ReadAsArray().astype(np.float64)
    nd = ds.GetRasterBand(1).GetNoDataValue()
    if nd is not None and np.isfinite(nd):
        a[np.isclose(a, nd)] = np.nan
    return a, ds.GetGeoTransform()


def _leer_temp_nivel_bajo_netcdf(ruta: Path) -> tuple[np.ndarray, tuple[float, ...]]:
    """Lee el nivel más bajo de 'temp' seleccionando bandas por metadatos NETCDF_DIM_Time y NETCDF_DIM_altitude."""
    ds = gdal.Open(f'NETCDF:"{ruta}":temp')
    registros: list[tuple[float, float, int]] = []
    for idx in range(1, ds.RasterCount + 1):
        banda = ds.GetRasterBand(idx)
        meta = banda.GetMetadata()
        t_raw = meta.get("NETCDF_DIM_Time")
        alt_raw = meta.get("NETCDF_DIM_altitude")
        if t_raw is None or alt_raw is None:
            raise ValueError(
                f"faltan metadatos NETCDF_DIM_Time/NETCDF_DIM_altitude en {ruta.name} banda {idx}"
            )
        registros.append((float(str(alt_raw).strip()), float(str(t_raw).strip()), idx))
    if not registros:
        raise ValueError(f"sin bandas de temperatura en {ruta.name}")
    alt_min = min(alt for alt, _, _ in registros)
    bajas = [(t_val, idx) for alt, t_val, idx in registros if math.isclose(alt, alt_min, rel_tol=1e-9, abs_tol=1e-12)]
    bajas.sort(key=lambda item: item[0])
    if len(bajas) != 12 or len({t_val for t_val, _ in bajas}) != 12:
        raise ValueError(
            f"se esperaban 12 tiempos en el nivel más bajo ({alt_min}) de {ruta.name}, hay {len(bajas)}"
        )
    capas = []
    for _, idx in bajas:
        banda = ds.GetRasterBand(idx)
        arr = banda.ReadAsArray().astype(np.float64)
        nd = banda.GetNoDataValue()
        if nd is not None and np.isfinite(nd):
            arr[np.isclose(arr, nd)] = np.nan
        capas.append(arr)
    return np.stack(capas, axis=0), ds.GetGeoTransform()


def cargar_mcd(
    run: Path,
) -> tuple[np.ndarray | None, np.ndarray | None, np.ndarray | None, np.ndarray | None, tuple[float, ...] | None]:
    """Carga tsurf, ps, temp del nivel más bajo (12, 12, 49, 64) y orografía (49, 64) de MCD 6.2."""
    dir_data = run / "cache" / "mcd" / "MCD_6.2" / "data"
    dir_mcd = dir_data / "clim_aveEUV"
    ruta_orog = dir_data / "mountain.nc"
    rutas = [dir_mcd / f"clim_{mes:02d}_me.nc" for mes in range(1, 13)]
    if not ruta_orog.exists() or not all(r.exists() for r in rutas):
        return None, None, None, None, None
    orog, geo_orog = _leer_bandas_netcdf(ruta_orog, "orography")
    if orog.ndim == 3 and orog.shape[0] == 1:
        orog = orog[0]
    if orog.shape != (49, 64):
        raise ValueError(f"forma inesperada en {ruta_orog.name}: orography={orog.shape}")
    tsurf_meses, ps_meses, temp_meses = [], [], []
    geo_ref = geo_orog
    for r in rutas:
        t_m, geo_t = _leer_bandas_netcdf(r, "tsurf")
        p_m, geo_p = _leer_bandas_netcdf(r, "ps")
        temp_m, geo_temp = _leer_temp_nivel_bajo_netcdf(r)
        if t_m.shape != (12, 49, 64) or p_m.shape != (12, 49, 64) or temp_m.shape != (12, 49, 64):
            raise ValueError(
                f"forma inesperada en {r.name}: tsurf={t_m.shape}, ps={p_m.shape}, temp={temp_m.shape}"
            )
        if geo_t != geo_p or geo_t != geo_temp:
            raise ValueError(f"geotransform distinto entre tsurf, ps y temp en {r.name}")
        if geo_t != geo_ref:
            raise ValueError(f"geotransform inconsistente en {r.name}: {geo_t} != {geo_ref}")
        tsurf_meses.append(t_m)
        ps_meses.append(p_m)
        temp_meses.append(temp_m)
    return (
        np.stack(tsurf_meses, axis=0),
        np.stack(ps_meses, axis=0),
        np.stack(temp_meses, axis=0),
        orog,
        geo_ref,
    )


def _comparar_par_presion(
    sitios: dict[str, dict],
    cod_bajo: str,
    elev_bajo: float,
    cod_alto: str,
    elev_alto: float,
) -> str | None:
    ps_bajo = sitios[cod_bajo].get("mcd_ps_media_pa")
    ps_alto = sitios[cod_alto].get("mcd_ps_media_pa")
    if ps_bajo is None or ps_alto is None or not (np.isfinite(ps_bajo) and np.isfinite(ps_alto)):
        return f"no se pudo comparar presión entre {cod_bajo} y {cod_alto}: falta mcd_ps_media_pa"
    if not (ps_bajo > ps_alto):
        return (
            f"el sitio más bajo ({cod_bajo}, {elev_bajo:.0f} m, {ps_bajo:.1f} Pa) no tiene mayor "
            f"presión corregida que el más alto ({cod_alto}, {elev_alto:.0f} m, {ps_alto:.1f} Pa) "
            f"(desnivel {elev_alto - elev_bajo:.0f} m)"
        )
    return None


def validar_mcd_sitios(sitios: dict[str, dict]) -> tuple[list[str], list[str]]:
    """Comprueba rangos físicos de MCD por sitio y mayor presión corregida al bajar en elevación."""
    fallos: list[str] = []
    avisos: list[str] = []
    elevaciones: list[tuple[float, str]] = []
    for codigo, s in sitios.items():
        for campo in ("mcd_tsurf_media_k", "mcd_tsurf_min_k", "mcd_tsurf_max_k"):
            val = s.get(campo)
            if val is None or not np.isfinite(val) or not (120.0 <= val <= 330.0):
                fallos.append(f"{codigo}: {campo}={val} fuera de [120, 330] K")
        ps = s.get("mcd_ps_media_pa")
        if ps is None or not np.isfinite(ps) or not (100.0 <= ps <= 1500.0):
            fallos.append(f"{codigo}: mcd_ps_media_pa={ps} fuera de [100, 1500] Pa")
        dtr = s.get("mcd_rango_diurno_k")
        if dtr is None or not np.isfinite(dtr) or not (dtr > 0.0):
            fallos.append(f"{codigo}: mcd_rango_diurno_k={dtr} debe ser > 0")
        amp = s.get("mcd_amp_anual_k")
        if amp is None or not np.isfinite(amp) or amp < 0.0:
            fallos.append(f"{codigo}: mcd_amp_anual_k={amp} inválido")

        terreno = s.get("terreno")
        elev_info = terreno.get("elev_mean_m") if isinstance(terreno, dict) else None
        if isinstance(elev_info, dict):
            med = elev_info.get("mediana")
            if med is not None and np.isfinite(med):
                elevaciones.append((float(med), codigo))

    if len(elevaciones) >= 2:
        pares_fallidos: set[frozenset[str]] = set()
        for i in range(len(elevaciones)):
            e1, c1 = elevaciones[i]
            for j in range(i + 1, len(elevaciones)):
                e2, c2 = elevaciones[j]
                if abs(e1 - e2) > 1500.0:
                    if e1 < e2:
                        cod_bajo, elev_bajo, cod_alto, elev_alto = c1, e1, c2, e2
                    else:
                        cod_bajo, elev_bajo, cod_alto, elev_alto = c2, e2, c1, e1
                    err = _comparar_par_presion(sitios, cod_bajo, elev_bajo, cod_alto, elev_alto)
                    if err is not None:
                        fallos.append(err)
                        pares_fallidos.add(frozenset((cod_bajo, cod_alto)))

        elev_min, cod_bajo = min(elevaciones)
        elev_max, cod_alto = max(elevaciones)
        if elev_min < elev_max:
            if frozenset((cod_bajo, cod_alto)) not in pares_fallidos:
                err = _comparar_par_presion(sitios, cod_bajo, elev_min, cod_alto, elev_max)
                if err is not None:
                    fallos.append(err)
        else:
            avisos.append("comprobación MCD de presión vs elevación omitida: todos los sitios tienen igual elevación")
    else:
        avisos.append("comprobación MCD de presión vs elevación omitida: falta elevación en al menos dos sitios")
    return fallos, avisos


def main() -> int:
    datos, run = ruta_env("DATOS"), ruta_env("RUN")
    t0 = time.time()
    lista = json.loads((Path(__file__).parent / "sitios" / "objetivos-marte.json").read_text(encoding="utf-8"))
    radio_m = lista["radio_km"] * 1000
    dem = gdal.Open(str(datos / "marte" / "hrsc-mola-blend-200m" / "Mars_HRSC_MOLA_BlendDEM_Global_200mp_v2.tif"))
    a_tes, geo_tes = tes(datos)
    tsurf_mcd, ps_mcd, temp_mcd, orog_mcd, geo_mcd = cargar_mcd(run)
    fallos = []
    if any(x is None for x in (tsurf_mcd, ps_mcd, temp_mcd, orog_mcd, geo_mcd)):
        fallos.append("faltan archivos de MCD 6.2 en $RUN/cache/mcd/MCD_6.2/data (clim_aveEUV o mountain.nc)")
    # máximo de hematita entre 60° S y 60° N
    hem = a_tes[CAPAS_TES.index("hematita")]
    f60 = slice(int((90 - 60) / 0.25), int((90 + 60) / 0.25))
    sub = hem[f60]
    f, c = np.unravel_index(np.nanargmax(sub), sub.shape)
    lat_max = 90 - (f60.start + f + 0.5) * 0.25
    lon_max = -180 + (c + 0.5) * 0.25
    meridiani = abs(lat_max - (-2)) < 5 and abs(lon_max - (-5)) < 10
    if not meridiani:
        fallos.append(f"el máximo de hematita cae en ({lat_max}, {lon_max}), no en Meridiani")
    sitios = {}
    for s in lista["sitios"]:
        lon = _lon180(s["lon_e"])
        sm, ss, n, terreno = terreno_marte(dem, s["lat"], lon, radio_m)
        (cc0, ff0, w, h), m, _ = _circulo(s["lat"], lon, radio_m, geo_tes, a_tes.shape[1:])
        minerales = {}
        for idx, nombre in enumerate(CAPAS_TES):
            v = a_tes[idx, ff0:ff0 + h, cc0:cc0 + w][m]
            minerales[f"tes_{nombre}"] = float(np.nanmean(v)) if np.isfinite(v).any() else None
        ti, cuadros = themis(datos, s["lat"], s["lon_e"], radio_m)
        elev_info = terreno.get("elev_mean_m") if isinstance(terreno, dict) else None
        z_sitio = elev_info.get("mediana") if isinstance(elev_info, dict) else None
        if (
            tsurf_mcd is not None
            and ps_mcd is not None
            and temp_mcd is not None
            and orog_mcd is not None
            and geo_mcd is not None
        ):
            tsurf_s, ps_grid_s = interpolar_mcd_sitio(tsurf_mcd, ps_mcd, s["lat"], s["lon_e"], geo_mcd)
            t1_s = interpolar_campo_mcd(temp_mcd, s["lat"], s["lon_e"], geo_mcd)
            z_gcm = float(interpolar_campo_mcd(orog_mcd, s["lat"], s["lon_e"], geo_mcd))
            ps_corr_s = corregir_ps_hidrostatica(ps_grid_s, t1_s, z_sitio, z_gcm)
            mcd_res = resumir_mcd_sitio(tsurf_s, ps_grid_s, ps_corr_s, z_gcm, z_sitio)
        else:
            mcd_res = resumir_mcd_sitio(None, None)
        sitios[s["codigo"]] = {"nombre": s["nombre"], "lat": s["lat"], "lon_e": s["lon_e"], "slope_mean_deg": sm,
                               "slope_std_deg": ss, "pixeles_200m": n, "terreno": terreno, **minerales,
                               "themis_ti": ti, "themis_cuadros": cuadros, **mcd_res}
        sm_txt = f"{sm:.2f}" if sm is not None else "nan"
        ss_txt = f"{ss:.2f}" if ss is not None else "nan"
        t_txt = f"{mcd_res['mcd_tsurf_media_k']:.1f}" if np.isfinite(mcd_res["mcd_tsurf_media_k"]) else "nan"
        p_txt = f"{mcd_res['mcd_ps_media_pa']:.0f}" if np.isfinite(mcd_res["mcd_ps_media_pa"]) else "nan"
        p_grid_txt = f"{mcd_res['mcd_ps_grid_media_pa']:.0f}" if np.isfinite(mcd_res["mcd_ps_grid_media_pa"]) else "nan"
        dz_txt = f"{mcd_res['mcd_dz_m']:+.0f}" if np.isfinite(mcd_res["mcd_dz_m"]) else "nan"
        print(f"  {s['codigo']}: pendiente {sm_txt} ± {ss_txt}° ({n} px), hematita {minerales['tes_hematita']}, "
              f"MCD T {t_txt} K, ps {p_txt} Pa (grid {p_grid_txt} Pa, dz {dz_txt} m)", flush=True)
    fallos_mcd, avisos_mcd = validar_mcd_sitios(sitios)
    fallos.extend(fallos_mcd)
    for av in avisos_mcd:
        print(f"  aviso MCD: {av}", flush=True)
    salida = run / "objetivos"
    salida.mkdir(parents=True, exist_ok=True)
    r = {
        "cuerpo": "marte",
        "fuentes": {"relieve": "HRSC-MOLA blended DEM global 200 m v2 (USGS)", "minerales": "TES Bandfield 2002, 4 ppd",
                    "inercia_termica": "THEMIS global TI mosaic, Quantitative 100 m (contexto)",
                    "clima": "Mars Climate Database v6.2 (LMD-OU-AOPP-IAA-ESA-CNES, https://www-mars.lmd.jussieu.fr/; "
                             "escenario climatología, EUV solar promedio; uso solo local)"},
        "metodo": (f"círculo de {lista['radio_km']} km; parches de ~1.6 km a 200 m (Horn, cuantiles lineales, "
                   "ventana 5x5) resumidos con mediana y MAD; medias de las 13 capas TES en el círculo; "
                   "THEMIS muestreado cada 200 m en todo el círculo; "
                   "MCD 6.2 interpolado bilinealmente al centro de cada sitio (12 meses x 12 horas locales), "
                   "con corrección hidrostática de ps usando la orografía del modelo y temp del nivel más bajo"),
        "ausentes": ["viento (Mars Climate Database: pendiente)",
                     "agua y aridez (no comparables)"],
        "local_only": list(CAMPOS_MCD_LOCAL),
        "advertencias": [ADVERTENCIA_MCD, ADVERTENCIA_MCD_TSURF, *avisos_mcd],
        "hematita_maxima_60S_60N": {"lat": lat_max, "lon": lon_max, "en_meridiani": bool(meridiani)},
        "sitios": sitios,
        "fallos": fallos,
        "segundos": round(time.time() - t0, 1),
    }
    (salida / "objetivos_marte.json").write_text(json.dumps(r, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps({k: v for k, v in r.items() if k != "sitios"}, indent=2, ensure_ascii=False))
    return 1 if fallos else 0


if __name__ == "__main__":
    sys.exit(main())
