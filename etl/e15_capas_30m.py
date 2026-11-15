"""E-15: agregación a celdas HEALPix de cuatro capas globales de 30 m y 15″ (GSW, GSDP30, GSDS30 y GLWD v2).

Columnas producidas (el nombre es el contrato, ADR-007):
  agua_ocurrencia_media_pct   media de ocurrencia de agua superficial JRC GSW v1.5 sobre píxeles válidos de 30 m (0-100 %)
  agua_frac_ocurrencia_gt0    fracción de píxeles válidos de GSW con ocurrencia > 0 (0-1)
  dunas_frac                  fracción de píxeles válidos de GSDP30 en clases de dunas (0-7 y 10; 8=manto, 9=otros -> 0)
  arena_frac                  fracción de píxeles válidos de GSDS30 en clases de arena 1 o 2 (3=otros -> 0)
  agua_humedal_area_pct            media de GLWD_v2_0_area_pct (todas las 33 clases de GLWD v2, incluyendo lagos y ríos, 0-100 %)

Cada tesela fuente se lee por ventanas de filas y, en las capas de 30 m, se reduce primero a bloques de 5x5 píxeles
(~150 m) contando píxeles válidos y de clase antes de proyectar los centros de bloque y asignarlos con celda_de. Las
sumas parciales por tesela se guardan en $RUN/capas30/sumas/*.npz para permitir reanudar, y luego se unen por celda.
Fuera de la extensión válida de cada producto la celda queda en NaN; dentro de la extensión sin rasgo queda en 0.

Entradas:
  $DATOS/tierra/agua-jrc-gsw-v1_5/occurrence/*.tif
  $DATOS/tierra/dunas-gsdp30/GSDP30.zip (/vsizip/)
  $DATOS/tierra/dunas-gsds30/GSDS30.zip (/vsizip/)
  $DATOS/tierra/glwd-v2/GLWD_v2_0_combined_classes_tif.zip (/vsizip/)
Salidas:
  $RUN/capas30/sumas/*.npz
  $RUN/capas30/e15.json
  $RUN/columns/{agua_ocurrencia_media_pct,agua_frac_ocurrencia_gt0,dunas_frac,arena_frac,agua_humedal_area_pct}.{f32,json}

Uso: python e15_capas_30m.py [procesos] [--solo-unir]
"""

from __future__ import annotations

import json
import sys
import time
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path
from typing import Callable

import numpy as np
from osgeo import gdal

from comun import A_WGS84, ruta_env
from comun_tabla import cargar_malla, celda_de, escribir_columna, juntar_sumas, valor_en

gdal.UseExceptions()
gdal.SetCacheMax(128 * 1024 * 1024)

BLOQUE_30M = 5
VENTANA_FILAS = 2560  # múltiplo de 5 y de 512 (bloque TIFF de GSW)
VENTANA_GLWD = 240
FRANJA_GLWD_NPZ = 2400

Clasificador = Callable[[np.ndarray], tuple[np.ndarray, dict[str, np.ndarray]]]


def _iniciar_worker() -> None:
    gdal.UseExceptions()
    gdal.SetCacheMax(128 * 1024 * 1024)


def mercator_a_lonlat(x: np.ndarray, y: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Inversa de EPSG:3857 (Web Mercator) a (lat_deg, lon_deg) WGS84."""
    x_arr = np.asarray(x, dtype=np.float64)
    y_arr = np.asarray(y, dtype=np.float64)
    lon = (x_arr / A_WGS84) * (180.0 / np.pi)
    lon = ((lon + 180.0) % 360.0) - 180.0
    lat = (2.0 * np.arctan(np.exp(y_arr / A_WGS84)) - np.pi / 2.0) * (180.0 / np.pi)
    return np.clip(lat, -90.0, 90.0), lon


def clasificar_gsw(arr: np.ndarray) -> tuple[np.ndarray, dict[str, np.ndarray]]:
    """JRC GSW occurrence: 0-100 válido (255 sin dato); extrae ocurrencia y > 0."""
    valid = arr <= 100
    occ = np.where(valid, arr, np.uint8(0))
    gt0 = valid & (arr > 0)
    return valid, {"agua_ocurrencia_media_pct": occ, "agua_frac_ocurrencia_gt0": gt0}


def clasificar_gsdp30(arr: np.ndarray) -> tuple[np.ndarray, dict[str, np.ndarray]]:
    """GSDP30: clases 0-10 válidas (255 sin dato); duna = 0-7 o 10 (8=manto de arena, 9=otros -> 0)."""
    valid = arr <= 10
    duna = (arr <= 7) | (arr == 10)
    return valid, {"dunas_frac": duna}


def clasificar_gsds30(arr: np.ndarray) -> tuple[np.ndarray, dict[str, np.ndarray]]:
    """GSDS30: clases 1-3 válidas (0/255 sin dato); arena = 1 o 2 (3=otros -> 0)."""
    valid = (arr >= 1) & (arr <= 3)
    arena = (arr == 1) | (arr == 2)
    return valid, {"arena_frac": arena}


def clasificar_glwd(arr: np.ndarray) -> tuple[np.ndarray, dict[str, np.ndarray]]:
    """GLWD v2 area_pct: 0-100 válido (255 sin dato)."""
    valid = arr <= 100
    pct = np.where(valid, arr, np.uint8(0))
    return valid, {"agua_humedal_area_pct": pct}


CAPAS_BLOQUE: dict[str, tuple[Clasificador, list[str], bool]] = {
    "gsw": (clasificar_gsw, ["agua_ocurrencia_media_pct", "agua_frac_ocurrencia_gt0"], False),
    "gsdp30": (clasificar_gsdp30, ["dunas_frac"], True),
    "gsds30": (clasificar_gsds30, ["arena_frac"], True),
}


def combinar_parciales(partes: list[dict[str, np.ndarray] | None], nombres: list[str]) -> dict[str, np.ndarray]:
    """Combina diccionarios de sumas parciales por celda en uno solo con ipix único."""
    activas = [p for p in partes if p is not None and p["ipix"].size > 0]
    if not activas:
        out: dict[str, np.ndarray] = {"ipix": np.array([], dtype=np.uint32)}
        for k in nombres:
            out[f"{k}_s"] = np.array([], dtype=np.float64)
            out[f"{k}_n"] = np.array([], dtype=np.uint32)
        return out
    if len(activas) == 1:
        return activas[0]
    ip = np.concatenate([q["ipix"] for q in activas])
    u_, inv = np.unique(ip, return_inverse=True)
    out = {"ipix": u_.astype(np.uint32)}
    for k in nombres:
        out[f"{k}_s"] = np.bincount(inv, weights=np.concatenate([q[f"{k}_s"] for q in activas]))
        out[f"{k}_n"] = np.bincount(inv, weights=np.concatenate([q[f"{k}_n"] for q in activas])).astype(np.uint32)
    return out


def _agregar_submatriz(
    valid: np.ndarray,
    vars_arr: dict[str, np.ndarray],
    geo: tuple[float, float, float, float, float, float],
    fila_global: int,
    col_global: int,
    bloque: int,
    es_mercator: bool,
    hilos: int,
) -> dict[str, np.ndarray] | None:
    h, w = valid.shape
    if h == 0 or w == 0:
        return None
    x0, dx, rx, y0, ry, dy = geo
    if rx != 0 or ry != 0:
        raise ValueError(f"Geotransformada con rotación no soportada: {geo}")

    if bloque > 1:
        nb_r, nb_c = h // bloque, w // bloque
        if nb_r == 0 or nb_c == 0:
            return None
        v_sub = valid[: nb_r * bloque, : nb_c * bloque]
        n_blk = v_sub.reshape(nb_r, bloque, nb_c, bloque).sum(axis=(1, 3), dtype=np.uint32)
        br_idx, bc_idx = np.nonzero(n_blk > 0)
        if br_idx.size == 0:
            return None
        n_pts = n_blk[br_idx, bc_idx]
        y_vec = y0 + (fila_global + (np.arange(nb_r, dtype=np.float64) + 0.5) * bloque) * dy
        x_vec = x0 + (col_global + (np.arange(nb_c, dtype=np.float64) + 0.5) * bloque) * dx
        y_pts = y_vec[br_idx]
        x_pts = x_vec[bc_idx]
        sumas = {}
        for k, a in vars_arr.items():
            a_sub = a[: nb_r * bloque, : nb_c * bloque]
            s_blk = a_sub.reshape(nb_r, bloque, nb_c, bloque).sum(axis=(1, 3), dtype=np.uint32)
            sumas[k] = s_blk[br_idx, bc_idx].astype(np.float64)
    else:
        r_idx, c_idx = np.nonzero(valid)
        if r_idx.size == 0:
            return None
        n_pts = np.ones(r_idx.size, dtype=np.uint32)
        y_vec = y0 + (fila_global + np.arange(h, dtype=np.float64) + 0.5) * dy
        x_vec = x0 + (col_global + np.arange(w, dtype=np.float64) + 0.5) * dx
        y_pts = y_vec[r_idx]
        x_pts = x_vec[c_idx]
        sumas = {k: a[r_idx, c_idx].astype(np.float64) for k, a in vars_arr.items()}

    if es_mercator:
        lat_pts, lon_pts = mercator_a_lonlat(x_pts, y_pts)
    else:
        lat_pts = np.clip(y_pts, -90.0, 90.0)
        lon_pts = ((x_pts + 180.0) % 360.0) - 180.0

    celdas = celda_de(lat_pts, lon_pts, hilos=hilos)
    u_, inv = np.unique(celdas, return_inverse=True)
    out: dict[str, np.ndarray] = {"ipix": u_}
    tot_n = np.bincount(inv, weights=n_pts).astype(np.uint32)
    for k, vals in sumas.items():
        out[f"{k}_s"] = np.bincount(inv, weights=vals)
        out[f"{k}_n"] = tot_n
    return out


def agregar_ventana(
    arr: np.ndarray,
    clasificador: Clasificador,
    geo: tuple[float, float, float, float, float, float],
    fila_inicio: int = 0,
    bloque: int = BLOQUE_30M,
    es_mercator: bool = False,
    hilos: int = 1,
) -> dict[str, np.ndarray] | None:
    """Clasifica una ventana (H, W) y agrega sus píxeles válidos por celda mediante bloques BxB."""
    valid, vars_arr = clasificador(arr)
    if not valid.any():
        return None
    nombres = list(vars_arr)
    h, w = arr.shape
    hb = (h // bloque) * bloque if bloque > 1 else h
    wb = (w // bloque) * bloque if bloque > 1 else w
    partes = []
    if hb > 0 and wb > 0:
        partes.append(
            _agregar_submatriz(
                valid[:hb, :wb],
                {k: v[:hb, :wb] for k, v in vars_arr.items()},
                geo,
                fila_inicio,
                0,
                bloque,
                es_mercator,
                hilos,
            )
        )
    if hb > 0 and wb < w:
        partes.append(
            _agregar_submatriz(
                valid[:hb, wb:],
                {k: v[:hb, wb:] for k, v in vars_arr.items()},
                geo,
                fila_inicio,
                wb,
                1,
                es_mercator,
                hilos,
            )
        )
    if hb < h:
        partes.append(
            _agregar_submatriz(
                valid[hb:, :],
                {k: v[hb:, :] for k, v in vars_arr.items()},
                geo,
                fila_inicio + hb,
                0,
                1,
                es_mercator,
                hilos,
            )
        )
    combinado = combinar_parciales(partes, nombres)
    return combinado if combinado["ipix"].size else None


def _ya_hecha(ruta: Path, clave: str) -> bool:
    if not ruta.exists():
        return False
    try:
        with np.load(ruta) as q:
            _ = q[clave]
        return True
    except Exception:  # noqa: BLE001 - un archivo truncado o corrupto se borra y se rehace
        ruta.unlink(missing_ok=True)
        return False


def procesar_tesela(
    capa: str,
    ruta_raster: str,
    ruta_salida: str,
    bloque: int = BLOQUE_30M,
    filas_ventana: int = VENTANA_FILAS,
) -> dict:
    """Procesa una tesela fuente por ventanas de filas y guarda las sumas parciales por celda."""
    clasificador, nombres, es_mercator = CAPAS_BLOQUE[capa]
    ds = gdal.Open(ruta_raster)
    if ds is None:
        raise RuntimeError(f"No se pudo abrir {ruta_raster}")
    geo = ds.GetGeoTransform()
    w, h = ds.RasterXSize, ds.RasterYSize
    banda = ds.GetRasterBand(1)
    partes = []
    for r0 in range(0, h, filas_ventana):
        h_win = min(filas_ventana, h - r0)
        arr = banda.ReadAsArray(0, r0, w, h_win)
        parcial = agregar_ventana(
            arr,
            clasificador,
            geo,
            fila_inicio=r0,
            bloque=bloque,
            es_mercator=es_mercator,
            hilos=1,
        )
        if parcial is not None:
            partes.append(parcial)
    ds = None
    combinado = combinar_parciales(partes, nombres)
    np.savez(ruta_salida, **combinado)
    total_px = int(combinado[f"{nombres[0]}_n"].sum()) if combinado["ipix"].size else 0
    return {"capa": capa, "tesela": Path(ruta_raster).name, "celdas": int(combinado["ipix"].size), "pixeles": total_px}


def procesar_glwd(
    ruta_glwd: str,
    dir_sumas: Path,
    filas_por_npz: int = FRANJA_GLWD_NPZ,
    filas_ventana: int = VENTANA_GLWD,
) -> dict:
    """Lee GLWD_v2_0_area_pct.tif secuencialmente por franjas y guarda sumas reanudables por banda de filas."""
    ds = gdal.Open(ruta_glwd)
    if ds is None:
        raise RuntimeError(f"No se pudo abrir {ruta_glwd}")
    geo = ds.GetGeoTransform()
    w, h = ds.RasterXSize, ds.RasterYSize
    banda = ds.GetRasterBand(1)
    nombres = ["agua_humedal_area_pct"]
    hechas = 0
    procesadas = 0
    for r_banda in range(0, h, filas_por_npz):
        ruta_npz = dir_sumas / f"glwd__f{r_banda:05d}.npz"
        if _ya_hecha(ruta_npz, "agua_humedal_area_pct_n"):
            hechas += 1
            continue
        r_fin = min(r_banda + filas_por_npz, h)
        partes = []
        for r0 in range(r_banda, r_fin, filas_ventana):
            h_win = min(filas_ventana, r_fin - r0)
            arr = banda.ReadAsArray(0, r0, w, h_win)
            parcial = agregar_ventana(
                arr,
                clasificar_glwd,
                geo,
                fila_inicio=r0,
                bloque=1,
                es_mercator=False,
                hilos=0,
            )
            if parcial is not None:
                partes.append(parcial)
        combinado = combinar_parciales(partes, nombres)
        np.savez(ruta_npz, **combinado)
        procesadas += 1
    ds = None
    return {"franjas_omitidas": hechas, "franjas_procesadas": procesadas}


def validar_resultados(
    ipix_malla: np.ndarray,
    lat_malla: np.ndarray,
    cols: dict[str, np.ndarray],
    lon_malla: np.ndarray | None = None,
) -> tuple[dict, list[str]]:
    """Comprueba rangos físicos, consistencia interna, límites geográficos y puntos conocidos."""
    fallos: list[str] = []
    for nombre, arr in cols.items():
        if arr.size != ipix_malla.size:
            fallos.append(f"{nombre}: largo {arr.size} distinto de la malla {ipix_malla.size}")
        if np.isinf(arr).any():
            fallos.append(f"{nombre}: contiene infinitos")

    for nombre, lo, hi in (
        ("agua_ocurrencia_media_pct", 0.0, 100.0),
        ("agua_frac_ocurrencia_gt0", 0.0, 1.0),
        ("dunas_frac", 0.0, 1.0),
        ("arena_frac", 0.0, 1.0),
        ("agua_humedal_area_pct", 0.0, 100.0),
    ):
        v = cols[nombre]
        ok = np.isfinite(v)
        if ok.any():
            vmin, vmax = float(v[ok].min()), float(v[ok].max())
            if vmin < lo - 1e-5 or vmax > hi + 1e-5:
                fallos.append(f"{nombre}: fuera de [{lo}, {hi}] (min={vmin}, max={vmax})")

    occ = cols["agua_ocurrencia_media_pct"]
    gt0 = cols["agua_frac_ocurrencia_gt0"]
    ambas = np.isfinite(occ) & np.isfinite(gt0)
    if np.any(occ[ambas] > 100.0 * gt0[ambas] + 1e-2):
        fallos.append("agua_ocurrencia_media_pct supera 100 * agua_frac_ocurrencia_gt0")

    sur_glwd = lat_malla < -57.0
    if np.isfinite(cols["agua_humedal_area_pct"][sur_glwd]).any():
        fallos.append("agua_humedal_area_pct tiene valores finitos al sur de 57° S (fuera de GLWD v2)")

    puntos_gsw = {
        "Lago Superior (centro)": (47.7, -87.5),
        "Lago Victoria (centro)": (-1.0, 33.0),
        "Sahara (Erg Chech)": (24.5, -2.5),
        "Atacama (hiperárido)": (-23.5, -69.0),
    }
    puntos_dunas = {
        "Rub' al Khali (centro)": (20.0, 50.0),
        "Taklamakán (centro)": (39.0, 83.0),
        "Gran Erg Oriental (Sahara)": (30.5, 6.5),
        "Amazonía (selva)": (-3.5, -62.0),
    }
    puntos_arena = {
        "Rub' al Khali (centro)": (20.0, 50.0),
        "Taklamakán (centro)": (39.0, 83.0),
        "Gran Erg Oriental (Sahara)": (30.5, 6.5),
        "Amazonía (selva)": (-3.5, -62.0),
    }
    puntos_glwd = {
        "Pantanal (centro)": (-17.5, -57.0),
        "Delta del Okavango": (-19.3, 22.9),
        "Lago Superior (centro)": (47.7, -87.5),
        "Atacama (hiperárido)": (-23.5, -69.0),
    }

    vals = {
        "gsw": {
            k: {
                "occ": valor_en(ipix_malla, occ, *coord),
                "gt0": valor_en(ipix_malla, gt0, *coord),
            }
            for k, coord in puntos_gsw.items()
        },
        "dunas_frac": {k: valor_en(ipix_malla, cols["dunas_frac"], *coord) for k, coord in puntos_dunas.items()},
        "arena_frac": {k: valor_en(ipix_malla, cols["arena_frac"], *coord) for k, coord in puntos_arena.items()},
        "agua_humedal_area_pct": {
            k: valor_en(ipix_malla, cols["agua_humedal_area_pct"], *coord) for k, coord in puntos_glwd.items()
        },
    }

    for lago in ("Lago Superior (centro)", "Lago Victoria (centro)"):
        vo, vg = vals["gsw"][lago]["occ"], vals["gsw"][lago]["gt0"]
        if not (np.isfinite(vo) and vo > 80.0 and np.isfinite(vg) and vg > 0.9):
            fallos.append(f"GSW {lago}: esperado agua permanente (occ={vo}, gt0={vg})")
    for seco in ("Sahara (Erg Chech)", "Atacama (hiperárido)"):
        vo, vg = vals["gsw"][seco]["occ"], vals["gsw"][seco]["gt0"]
        if not (np.isfinite(vo) and vo < 1.0 and np.isfinite(vg) and vg < 0.05):
            fallos.append(f"GSW {seco}: esperado casi sin agua superficial (occ={vo}, gt0={vg})")

    for nombre, umbral in (
        ("Rub' al Khali (centro)", 0.5),
        ("Taklamakán (centro)", 0.3),
    ):
        vd = vals["dunas_frac"][nombre]
        if not (np.isfinite(vd) and vd > umbral):
            fallos.append(f"dunas_frac {nombre}: esperado > {umbral}, obtenido {vd}")
        va = vals["arena_frac"][nombre]
        if not (np.isfinite(va) and va > umbral):
            fallos.append(f"arena_frac {nombre}: esperado > {umbral}, obtenido {va}")

    if np.isfinite(vals["dunas_frac"]["Amazonía (selva)"]) and vals["dunas_frac"]["Amazonía (selva)"] >= 0.01:
        fallos.append(f"dunas_frac Amazonía (selva): esperado NaN o < 0.01, obtenido {vals['dunas_frac']['Amazonía (selva)']}")
    if np.isfinite(vals["arena_frac"]["Amazonía (selva)"]) and vals["arena_frac"]["Amazonía (selva)"] >= 0.01:
        fallos.append(f"arena_frac Amazonía (selva): esperado NaN o < 0.01, obtenido {vals['arena_frac']['Amazonía (selva)']}")

    for humedal, umbral in (
        ("Pantanal (centro)", 20.0),
        ("Lago Superior (centro)", 80.0),
    ):
        vh = vals["agua_humedal_area_pct"][humedal]
        if not (np.isfinite(vh) and vh > umbral):
            fallos.append(f"agua_humedal_area_pct {humedal}: esperado > {umbral}, obtenido {vh}")
    va_glwd = vals["agua_humedal_area_pct"]["Atacama (hiperárido)"]
    if not (np.isfinite(va_glwd) and va_glwd < 5.0):
        fallos.append(f"agua_humedal_area_pct Atacama (hiperárido): esperado finito < 5.0, obtenido {va_glwd}")

    # Medias regionales (cambio del 2026-11-14 tras la primera corrida): el punto del Gran Erg Oriental caía en el borde
    # del erg (GSDP30 clase 9 en toda la celda) y el del Okavango en una zona con islas secas. Un recálculo independiente
    # de esas celdas dio el mismo valor que la columna, así que el fallo era del punto y no del código. Una media sobre
    # la región no depende de que una celda caiga en una isla o en un corredor.
    if lon_malla is not None:
        regiones = {
            "Gran Erg Oriental (29-31.5 N, 6-9.5 E)": ((29.0, 31.5, 6.0, 9.5), (("dunas_frac", 0.3), ("arena_frac", 0.3))),
            "Delta del Okavango (18.8-20 S, 22.3-23.6 E)": ((-20.0, -18.8, 22.3, 23.6), (("agua_humedal_area_pct", 20.0),)),
        }
        vals["regiones"] = {}
        for nombre, ((la0, la1, lo0, lo1), pruebas) in regiones.items():
            dentro = (lat_malla >= la0) & (lat_malla <= la1) & (lon_malla >= lo0) & (lon_malla <= lo1)
            vals["regiones"][nombre] = {}
            for col, umbral in pruebas:
                v = cols[col][dentro]
                media = float(np.nanmean(v)) if np.isfinite(v).any() else float("nan")
                vals["regiones"][nombre][col] = {"media": media, "celdas": int(dentro.sum()),
                                                 "con_dato": int(np.isfinite(v).sum())}
                if not (np.isfinite(media) and media > umbral):
                    fallos.append(f"{col} {nombre}: media regional esperada > {umbral}, obtenida {media}")

    return vals, fallos


def unir(run: Path, sumas: Path) -> dict:
    """Junta las sumas por celda de cada producto, escribe las 5 columnas .f32/.json y valida puntos conocidos."""
    ipix, lat, lon = cargar_malla(run)
    grupos = {
        "gsw": sorted(sumas.glob("gsw__*.npz")),
        "gsdp30": sorted(sumas.glob("gsdp30__*.npz")),
        "gsds30": sorted(sumas.glob("gsds30__*.npz")),
        "glwd": sorted(sumas.glob("glwd__*.npz")),
    }
    faltan = [k for k, v in grupos.items() if not v]
    if faltan:
        raise SystemExit(f"ERROR: faltan archivos .npz de sumas para {faltan}")

    cols_gsw = juntar_sumas(ipix, grupos["gsw"], ["agua_ocurrencia_media_pct", "agua_frac_ocurrencia_gt0"])
    cols_gsdp = juntar_sumas(ipix, grupos["gsdp30"], ["dunas_frac"])
    cols_gsds = juntar_sumas(ipix, grupos["gsds30"], ["arena_frac"])
    cols_glwd = juntar_sumas(ipix, grupos["glwd"], ["agua_humedal_area_pct"])

    cols = {**cols_gsw, **cols_gsdp, **cols_gsds, **cols_glwd}

    meta_gsw = {
        "fuente": "JRC Global Surface Water v1.5 (occurrence, 1984-2024)",
        "version": "v1.5",
        "url": "https://global-surface-water.appspot.com/download",
        "licencia": "Copernicus open license (Source: EC JRC/Google)",
        "advertencias": ["en GSW, 255 es sin dato (océano/fuera de máscara) y 0 es tierra válida sin agua detectada"],
    }
    entradas = [
        escribir_columna(
            run,
            "agua_ocurrencia_media_pct",
            cols["agua_ocurrencia_media_pct"],
            {
                **meta_gsw,
                "unidad": "%",
                "metodo": "píxeles válidos de 30 m (0-100, 255 sin dato) agregados por bloques 5x5 (~150 m) "
                "al centro de bloque en celda_de; media de ocurrencia sobre píxeles válidos",
            },
        ),
        escribir_columna(
            run,
            "agua_frac_ocurrencia_gt0",
            cols["agua_frac_ocurrencia_gt0"],
            {
                **meta_gsw,
                "unidad": "fracción (0-1)",
                "metodo": "píxeles válidos de 30 m (0-100, 255 sin dato) agregados por bloques 5x5 (~150 m) "
                "al centro de bloque en celda_de; fracción de píxeles válidos con ocurrencia > 0",
            },
        ),
        escribir_columna(
            run,
            "dunas_frac",
            cols["dunas_frac"],
            {
                "fuente": "GSDP30 (Global Sand Dune Product 30 m, Zheng et al.)",
                "version": "Zenodo 13907012",
                "url": "https://doi.org/10.5281/zenodo.13907012",
                "licencia": "CC BY 4.0",
                "unidad": "fracción (0-1)",
                "metodo": "teselas EPSG:3857 leídas por ventanas y reducidas en bloques 5x5 (~150 m); "
                "duna = clases 0-7 y 10, no-duna válida = clases 8 (manto de arena) y 9 (otros), 255 = sin dato; "
                "centros convertidos a WGS84 con inversa Web Mercator (R=6378137) y asignados con celda_de; "
                "media simple por celda porque el factor de área Mercator cos(lat)^2 es prácticamente constante "
                "dentro de una celda (~1.6 km)",
                "advertencias": [
                    "fuera de las 331 teselas de GSDP30 o con solo nodata 255 queda NaN; "
                    "dentro de la extensión sin duna (clases 8 o 9) vale 0"
                ],
            },
        ),
        escribir_columna(
            run,
            "arena_frac",
            cols["arena_frac"],
            {
                "fuente": "GSDS30 (Global Sand Stabilization 30 m, 2017, Zheng et al.)",
                "version": "2017 (Zenodo 10441041)",
                "url": "https://doi.org/10.5281/zenodo.10441041",
                "licencia": "CC BY 4.0",
                "unidad": "fracción (0-1)",
                "metodo": "teselas EPSG:3857 leídas por ventanas y reducidas en bloques 5x5 (~150 m); "
                "clases 1=arena móvil, 2=semifija o fija, 3=otra (según docs/etl-plan.md, no verificado contra la publicación); "
                "arena = clases 1 o 2 sobre válidas {1, 2, 3} (0 y 255 sin dato, nodata no declarado en cabecera); "
                "centros convertidos a WGS84 con inversa Web Mercator (R=6378137) y asignados con celda_de; "
                "media simple por celda porque el factor de área Mercator cos(lat)^2 es prácticamente constante "
                "dentro de una celda (~1.6 km)",
                "advertencias": [
                    "leyenda 1/2/3 según docs/etl-plan.md, no verificado contra la publicación",
                    "sin nodata declarado en la cabecera GeoTIFF; valores fuera de {1, 2, 3} tratados como sin dato",
                ],
            },
        ),
        escribir_columna(
            run,
            "agua_humedal_area_pct",
            cols["agua_humedal_area_pct"],
            {
                "fuente": "GLWD v2.0, combined classes, area_pct (Lehner et al. 2025)",
                "version": "2.0",
                "url": "https://doi.org/10.6084/m9.figshare.28519994",
                "licencia": "CC BY 4.0",
                "unidad": "%",
                "metodo": "GLWD_v2_0_area_pct.tif (15 arcsec, ~500 m, EPSG:4326, 255 sin dato) leído por franjas y "
                "promediado por celda vía celda_de; según GLWD_TechDoc_v2_0.pdf, area_pct suma el porcentaje de "
                "área de las 33 clases de GLWD v2 combinadas (01-07 lagos, embalses, ríos y arroyos, más 08-33 "
                "humedales vegetados, turberas, costeros, salares y arrozales)",
                "advertencias": [
                    "incluye las 33 clases de GLWD v2 (no solo humedales vegetados, también lagos, embalses, ríos y arrozales)",
                    "extensión de 56° S a 84° N (excluye Antártida)",
                ],
            },
        ),
    ]

    puntos, fallos = validar_resultados(ipix, lat, cols, lon)
    return {
        "sumas_npz": {k: len(v) for k, v in grupos.items()},
        "puntos": puntos,
        "columnas": entradas,
        "fallos": fallos,
    }


def _listar_tifs_vsizip(ruta_dir_vsi: str) -> list[str]:
    entradas = gdal.ReadDir(ruta_dir_vsi) or []
    return sorted(
        f"{ruta_dir_vsi}/{n}"
        for n in entradas
        if n not in (".", "..") and n.lower().endswith(".tif")
    )


def main() -> int:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    procesos = int(args[0]) if args else 4
    datos, run = ruta_env("DATOS"), ruta_env("RUN")
    base_dir = run / "capas30"
    sumas = base_dir / "sumas"
    sumas.mkdir(parents=True, exist_ok=True)
    t0 = time.time()

    if "--solo-unir" not in sys.argv:
        gsw_tifs = sorted(str(p) for p in (datos / "tierra" / "agua-jrc-gsw-v1_5" / "occurrence").glob("*.tif"))
        gsdp_dir = f"/vsizip/{datos.as_posix()}/tierra/dunas-gsdp30/GSDP30.zip/GSDP30"
        gsdp_tifs = _listar_tifs_vsizip(gsdp_dir)
        gsds_dir = f"/vsizip/{datos.as_posix()}/tierra/dunas-gsds30/GSDS30.zip/GSDS30"
        gsds_tifs = _listar_tifs_vsizip(gsds_dir)
        glwd_tif = (
            f"/vsizip/{datos.as_posix()}/tierra/glwd-v2/GLWD_v2_0_combined_classes_tif.zip/"
            "GLWD_v2_0_combined_classes/GLWD_v2_0_area_pct.tif"
        )

        if not gsw_tifs or not gsdp_tifs or not gsds_tifs:
            print(
                f"ERROR: faltan entradas (gsw={len(gsw_tifs)}, gsdp30={len(gsdp_tifs)}, gsds30={len(gsds_tifs)})"
            )
            return 1

        trabajos: list[tuple[str, str, Path, str]] = []
        for r in gsw_tifs:
            trabajos.append(("gsw", r, sumas / f"gsw__{Path(r).stem}.npz", "agua_ocurrencia_media_pct_n"))
        for r in gsdp_tifs:
            trabajos.append(("gsdp30", r, sumas / f"gsdp30__{Path(r).stem}.npz", "dunas_frac_n"))
        for r in gsds_tifs:
            trabajos.append(("gsds30", r, sumas / f"gsds30__{Path(r).stem}.npz", "arena_frac_n"))

        pendientes = [(c, r, out) for c, r, out, clave in trabajos if not _ya_hecha(out, clave)]
        print(
            f"teselas 30 m: {len(trabajos)} total, {len(trabajos) - len(pendientes)} ya hechas, "
            f"{len(pendientes)} pendientes (procesos={procesos})",
            flush=True,
        )

        errores: list[str] = []
        if pendientes:
            with ProcessPoolExecutor(procesos, initializer=_iniciar_worker) as pool:
                fut = {pool.submit(procesar_tesela, c, r, str(out)): f"{c}:{Path(r).name}" for c, r, out in pendientes}
                for i, f in enumerate(as_completed(fut), 1):
                    try:
                        f.result()
                    except Exception as e:  # noqa: BLE001 - toda tesela que falle se informa y hace fallar el paso
                        errores.append(f"{fut[f]}: {e}")
                    if i % 50 == 0 or i == len(pendientes):
                        print(f"  {i}/{len(pendientes)} teselas, {time.time() - t0:.0f} s", flush=True)

        if errores:
            (base_dir / "errores.txt").write_text("\n".join(errores), encoding="utf-8")
            print("\n".join(errores[:20]))
            return 1

        res_glwd = procesar_glwd(glwd_tif, sumas)
        print(f"GLWD v2: {res_glwd}", flush=True)

    r = unir(run, sumas)
    r["segundos"] = round(time.time() - t0, 1)
    (base_dir / "e15.json").write_text(json.dumps(r, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps({k: v for k, v in r.items() if k != "columnas"}, indent=2, ensure_ascii=False))
    for c in r["columnas"]:
        print(f"{c['columna']}: cobertura {c['cobertura_pct']} %, p1 {c['p1']}, p50 {c['p50']}, p99 {c['p99']}")
    return 1 if r["fallos"] else 0


if __name__ == "__main__":
    sys.exit(main())
