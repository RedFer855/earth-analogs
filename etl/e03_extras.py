"""E-03 (paso único): pendiente, elevación, rugosidad, relieve y fracción válida por celda (ADR-005).

Por tesela GLO-90: se arma una ventana con halo de 0.05° de latitud (y 0.05° / cos(lat) de longitud), se enmascara
el agua a 90 m (mar siempre; lago o río de la WBM solo si JRC GSW >= 50 % o sin dato) y se reproyecta el DEM
enmascarado y un raster de validez 0/1 a una rejilla métrica local (LAEA centrada en la tesela) de bloques cuadrados
de 200 m con remuestreo "average" (un bloque es válido si su validez >= 0.999).

Sobre los bloques de 200 m se calculan la pendiente de Horn (sx = sy = 200 m) y la rugosidad y relieve en una ventana
de 5x5 bloques (ventana de 1 km) con al menos 19 bloques válidos (mismo estimador que usan los objetivos de la Luna
y Marte). Los centros de bloque se pasan a lat/lon geodésicas y cada celda se calcula entera desde la tesela de su
centro, con cuantiles lineales (Hyndman-Fan tipo 7).

Columnas: slope_mean_deg, slope_std_deg, terreno_n_px, slope_p90_deg, slope_p99_deg, slope_frac_gt15, elev_mean_m,
elev_std_m, relieve_m, rug_rms_mean_m, rug_rms_p90_m, relieve_mean_m, relieve_p90_m y frac_valida. Ninguna celda se
anula por cobertura (ADR-006): la fracción válida queda en su columna.

Salidas intermedias: $RUN/terreno/celdas/*.npz (una por tesela).

Uso: python e03_extras.py [procesos] [--solo-unir]
"""

from __future__ import annotations

import json
import sys
import time
import zipfile
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path

import numpy as np
from cdshealpix.nested import healpix_to_lonlat
from numpy.lib.stride_tricks import sliding_window_view
from osgeo import gdal, osr

from comun import NIVEL, NPIX, RADIO_AUTALICO_KM, autalica_a_geodesica, ruta_env
from comun_tabla import cargar_malla, cargar_npz, celda_de, escribir_columna, valor_en
from e01_malla import esquina_tesela
from e03_terreno import LIMITE_POLAR, UMBRAL_GSW, _vecinas, horn
import e03_terreno

gdal.UseExceptions()
gdal.SetCacheMax(256 * 1024 * 1024)
HALO_LAT = 0.05
BLOQUE_M = 200.0
UMBRAL_VALIDEZ = 0.999
VENTANA = 5
MIN_VALIDOS_VENTANA = 19  # de 25: unos tres cuartos de la ventana
UMBRAL_PEND = 15
AREA_CELDA_M2 = 4 * np.pi * (RADIO_AUTALICO_KM * 1000) ** 2 / NPIX
ESPERADOS_POR_CELDA = AREA_CELDA_M2 / (BLOQUE_M * BLOQUE_M)
CLAVES = ("n", "media", "desv", "p90", "p99", "f15", "zmedia", "zdesv", "zmin", "zmax", "esperados",
          "rug_media", "rug_p90", "rel_media", "rel_p90")


def _iniciar(datos: str, gsw_vrt: str) -> None:
    e03_terreno._iniciar(datos, gsw_vrt)


def _ventana_ds(fuentes, limites, dx, dy, alg, tipo, nodata, ancho=None, alto=None):
    opts = dict(
        format="MEM", outputBounds=limites, resampleAlg=alg,
        outputType=tipo, dstNodata=nodata, multithread=False,
    )
    if ancho is not None and alto is not None:
        opts["width"] = ancho
        opts["height"] = alto
    else:
        opts["xRes"] = dx
        opts["yRes"] = dy
    return gdal.Warp("", fuentes, **opts)


def _caja(a: np.ndarray, k: int) -> np.ndarray:
    """Suma en una ventana de k x k centrada en cada píxel; fuera del arreglo cuenta como 0."""
    r = k // 2
    c = np.pad(np.pad(a, r).cumsum(0).cumsum(1), ((1, 0), (1, 0)))
    return c[k:, k:] - c[:-k, k:] - c[k:, :-k] + c[:-k, :-k]


def ventana(z: np.ndarray, k: int = VENTANA, min_validos: int = MIN_VALIDOS_VENTANA) -> tuple[np.ndarray, np.ndarray]:
    """Rugosidad (desviación RMS respecto de la media de la ventana) y relieve (máximo - mínimo) en k x k.

    NaN si el bloque central no tiene dato o la ventana tiene menos de min_validos bloques válidos.
    """
    v = np.isfinite(z)
    ref = float(np.mean(z[v])) if v.any() else 0.0  # restar una referencia evita perder precisión en z^2
    z0 = np.where(v, z - ref, 0.0).astype(np.float64)
    n = _caja(v.astype(np.float64), k)
    s1, s2 = _caja(z0, k), _caja(z0 * z0, k)
    with np.errstate(invalid="ignore", divide="ignore"):
        m = s1 / n
        var = np.maximum(s2 / n - m * m, 0.0)
    ok = v & (n >= min_validos - 0.5)
    r = k // 2
    zmax = sliding_window_view(np.pad(np.where(v, z, -np.inf), r, constant_values=-np.inf), (k, k)).max(axis=(2, 3))
    zmin = sliding_window_view(np.pad(np.where(v, z, np.inf), r, constant_values=np.inf), (k, k)).min(axis=(2, 3))
    return np.where(ok, np.sqrt(var), np.nan), np.where(ok, zmax - zmin, np.nan)


def cuantil(ordenados: np.ndarray, inicio: np.ndarray, cuenta: np.ndarray, q: float) -> np.ndarray:
    """Cuantil lineal (tipo 7) de cada grupo de valores ya ordenados dentro del grupo."""
    pos = (cuenta - 1) * q
    lo = np.floor(pos).astype(np.int64)
    hi = np.minimum(lo + 1, cuenta - 1)
    w = pos - lo
    return ordenados[inicio + lo] * (1 - w) + ordenados[inicio + hi] * w


def por_celda(celdas: np.ndarray, v: np.ndarray, ip: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Media y percentil 90 de los valores finitos de v por celda, alineados a ip (celdas ordenadas)."""
    media, p90 = np.full(ip.size, np.nan), np.full(ip.size, np.nan)
    k = np.isfinite(v)
    if not k.any():
        return media, p90
    c, x = celdas[k], v[k]
    o = np.lexsort((x, c))
    c, x = c[o], x[o]
    ini = np.flatnonzero(np.r_[True, c[1:] != c[:-1]])
    cnt = np.diff(np.r_[ini, c.size])
    pos = np.searchsorted(ip, c[ini])
    media[pos] = np.add.reduceat(x, ini) / cnt
    p90[pos] = cuantil(x, ini, cnt, 0.90)
    return media, p90


def tesela(ruta_dem: str, salida: str) -> int:
    lat0, lon0 = esquina_tesela(Path(ruta_dem).name)
    ds = gdal.Open(ruta_dem)
    dx_nat, dy_nat = ds.GetGeoTransform()[1], -ds.GetGeoTransform()[5]
    ds = None
    hx_deg = min(HALO_LAT / max(np.cos(np.radians(max(abs(lat0), abs(lat0 + 1)))), 0.05), 0.5)
    hy = np.ceil(HALO_LAT / dy_nat) * dy_nat
    hx = np.ceil(hx_deg / dx_nat) * dx_nat
    limites = (lon0 - hx, lat0 - hy, lon0 + 1 + hx, lat0 + 1 + hy)
    ds_dem = _ventana_ds(_vecinas("dem", lat0, lon0), limites, dx_nat, dy_nat, "bilinear", gdal.GDT_Float32, np.nan)
    ancho, alto = ds_dem.RasterXSize, ds_dem.RasterYSize
    dem = ds_dem.GetRasterBand(1).ReadAsArray()
    # el dataset se guarda en una variable: si GDAL lo libera antes de leer la banda, ReadAsArray falla
    ds_wbm = _ventana_ds(_vecinas("wbm", lat0, lon0), limites, dx_nat, dy_nat, "near", gdal.GDT_Byte, 255, ancho, alto)
    wbm = ds_wbm.GetRasterBand(1).ReadAsArray()
    ds_wbm = None
    mar = wbm == 1
    lago_rio = np.isin(wbm, (2, 3))
    if lago_rio.any():
        ds_gsw = _ventana_ds([e03_terreno._GSW], limites, dx_nat, dy_nat, "average", gdal.GDT_Float32, np.nan,
                             ancho, alto)
        gsw = ds_gsw.GetRasterBand(1).ReadAsArray()
        ds_gsw = None
        lago_rio &= ~np.isfinite(gsw) | (gsw >= UMBRAL_GSW)
    invalido = mar | lago_rio | (wbm == 255) | ~np.isfinite(dem)
    dem_m = np.where(invalido, np.nan, dem).astype(np.float32)
    val_m = (~invalido).astype(np.float32)
    ds_dem.GetRasterBand(1).WriteArray(dem_m)
    ds_dem.GetRasterBand(1).SetNoDataValue(float("nan"))

    ds_val = gdal.GetDriverByName("MEM").Create("", ancho, alto, 1, gdal.GDT_Float32)
    ds_val.SetGeoTransform(ds_dem.GetGeoTransform())
    ds_val.SetProjection(ds_dem.GetProjection())
    ds_val.GetRasterBand(1).WriteArray(val_m)

    laea = osr.SpatialReference()
    laea.ImportFromProj4(f"+proj=laea +lat_0={lat0 + 0.5} +lon_0={lon0 + 0.5} +datum=WGS84")
    laea.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    laea_wkt = laea.ExportToWkt()
    ds_z = gdal.Warp(
        "", ds_dem, format="MEM", dstSRS=laea_wkt,
        xRes=BLOQUE_M, yRes=BLOQUE_M, resampleAlg="average",
        outputType=gdal.GDT_Float32, srcNodata=np.nan, dstNodata=np.nan,
        multithread=False,
    )
    gt = ds_z.GetGeoTransform()
    lim_laea = (gt[0], gt[3] + ds_z.RasterYSize * gt[5], gt[0] + ds_z.RasterXSize * gt[1], gt[3])
    ds_v = gdal.Warp(
        "", ds_val, format="MEM", dstSRS=laea_wkt,
        outputBounds=lim_laea, width=ds_z.RasterXSize, height=ds_z.RasterYSize,
        resampleAlg="average", outputType=gdal.GDT_Float32,
        multithread=False,
    )
    z = ds_z.GetRasterBand(1).ReadAsArray().astype(np.float64)
    val = ds_v.GetRasterBand(1).ReadAsArray()
    ds_dem = ds_val = ds_z = ds_v = None
    z = np.where(np.isfinite(z) & (val >= UMBRAL_VALIDEZ), z, np.nan)
    if z.shape[0] < 3 or z.shape[1] < 3:
        return 0

    pend = horn(z, abs(gt[1]), abs(gt[5]))
    rug_full, rel_full = ventana(z)
    rug, rel = rug_full[1:-1, 1:-1], rel_full[1:-1, 1:-1]
    zc = z[1:-1, 1:-1]
    ok = np.isfinite(pend) & np.isfinite(zc)
    if not ok.any():
        return 0

    filas_ok, cols_ok = np.nonzero(ok)
    x_ok = gt[0] + (cols_ok + 1.5) * gt[1]
    y_ok = gt[3] + (filas_ok + 1.5) * gt[5]
    wgs84 = osr.SpatialReference()
    wgs84.ImportFromEPSG(4326)
    wgs84.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    tr = osr.CoordinateTransformation(laea, wgs84)
    pts = np.asarray(tr.TransformPoints(list(zip(x_ok.tolist(), y_ok.tolist()))), dtype=np.float64)
    lo = ((pts[:, 0] + 180.0) % 360.0) - 180.0
    la = pts[:, 1]

    celdas = celda_de(la, lo, hilos=1)
    uc = np.unique(celdas)
    lon_c, beta_c = healpix_to_lonlat(uc.astype(np.uint64), NIVEL, num_threads=1)
    lat_c = autalica_a_geodesica(beta_c.deg)
    lon_c = ((lon_c.deg + 180) % 360) - 180
    dentro = (np.floor(lat_c) == lat0) & (np.floor(lon_c) == lon0)
    propias = uc[dentro]
    sel = np.isin(celdas, propias)
    if not sel.any():
        return 0
    celdas = celdas[sel]
    p, zv, rug_v, rel_v = pend[ok][sel], zc[ok][sel], rug[ok][sel], rel[ok][sel]
    orden = np.lexsort((p, celdas))
    celdas, p, zv = celdas[orden], p[orden], zv[orden]
    inicio = np.flatnonzero(np.r_[True, celdas[1:] != celdas[:-1]])
    cuenta = np.diff(np.r_[inicio, celdas.size])
    ip = celdas[inicio]
    esperados = np.full(ip.size, ESPERADOS_POR_CELDA, dtype=np.float64)
    s, s2 = np.add.reduceat(p, inicio), np.add.reduceat(p * p, inicio)
    zs, zs2 = np.add.reduceat(zv, inicio), np.add.reduceat(zv * zv, inicio)
    media = s / cuenta
    zmedia = zs / cuenta
    rug_media, rug_p90 = por_celda(celdas, rug_v[orden], ip)
    rel_media, rel_p90 = por_celda(celdas, rel_v[orden], ip)
    np.savez(
        Path(salida) / f"{Path(ruta_dem).stem}.npz",
        ipix=ip, n=cuenta.astype(np.uint32),
        media=media, desv=np.sqrt(np.maximum(s2 / cuenta - media ** 2, 0)),
        p90=cuantil(p, inicio, cuenta, 0.90), p99=cuantil(p, inicio, cuenta, 0.99),
        f15=np.add.reduceat((p > UMBRAL_PEND).astype(np.float64), inicio) / cuenta,
        zmedia=zmedia, zdesv=np.sqrt(np.maximum(zs2 / cuenta - zmedia ** 2, 0)),
        zmin=np.minimum.reduceat(zv, inicio), zmax=np.maximum.reduceat(zv, inicio), esperados=esperados,
        rug_media=rug_media, rug_p90=rug_p90, rel_media=rel_media, rel_p90=rel_p90,
    )
    return int(ip.size)


def main() -> int:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    procesos = int(args[0]) if args else 8
    datos, run = ruta_env("DATOS"), ruta_env("RUN")
    t0 = time.time()
    # carpeta propia del método de 200 m: las teselas guardadas con los bloques de ~180 m no se reusan al reanudar
    salida = run / "terreno" / "celdas_200m"
    salida.mkdir(parents=True, exist_ok=True)
    gsw_vrt = run / "terreno" / "gsw_occurrence.vrt"
    if "--solo-unir" not in sys.argv:
        if not gsw_vrt.exists():
            tifs = sorted(str(p) for p in (datos / "tierra" / "agua-jrc-gsw-v1_5" / "occurrence").glob("*.tif"))
            gdal.BuildVRT(str(gsw_vrt), tifs, srcNodata=255, VRTNodata=255)
        dems = sorted((datos / "tierra" / "glo90" / "dem").glob("*_DEM.tif"))
        hechas = set()
        for q in salida.glob("*.npz"):
            # Un corte deja archivos a medio escribir: se valida el zip sin abrirlo con numpy (que lo deja abierto al
            # fallar y Windows no deja borrarlo).
            if zipfile.is_zipfile(q):
                try:
                    if set(CLAVES) <= set(cargar_npz(q)):
                        hechas.add(q.stem)
                        continue
                except Exception:  # noqa: BLE001 - un archivo cortado se rehace
                    pass
            q.unlink()
        todas = [d for d in dems if abs(esquina_tesela(d.name)[0] + 0.5) < LIMITE_POLAR]
        pendientes = [d for d in todas if d.stem not in hechas]
        errores = []
        with ProcessPoolExecutor(procesos, initializer=_iniciar, initargs=(str(datos), str(gsw_vrt))) as pool:
            fut = {pool.submit(tesela, str(d), str(salida)): d.name for d in pendientes}
            for i, f in enumerate(as_completed(fut), 1):
                try:
                    f.result()
                except Exception as e:  # noqa: BLE001 - toda tesela que falle hace fallar el paso
                    errores.append(f"{fut[f]}: {e}")
                if i % 2000 == 0:
                    print(f"  {i}/{len(pendientes)} teselas, {time.time() - t0:.0f} s", flush=True)
        polares = len(dems) - len(todas)
        print(f"teselas: {len(dems)} total, {polares} polares fuera de alcance, {len(pendientes)} procesadas ahora, "
              f"{len(errores)} errores")
        if errores:
            (run / "terreno" / "errores.txt").write_text("\n".join(errores), encoding="utf-8")
            print("\n".join(errores[:20]))
            return 1
    ipix_m, lat, lon = cargar_malla(run)
    partes = [cargar_npz(q) for q in sorted(salida.glob("*.npz"))]
    ip = np.concatenate([q["ipix"] for q in partes])
    fallos = []
    if np.unique(ip).size != ip.size:
        fallos.append("una celda quedó en más de una tesela")
    pos = np.searchsorted(ipix_m, ip)
    en = (pos < ipix_m.size) & (ipix_m[np.minimum(pos, ipix_m.size - 1)] == ip)
    col = {}
    for k in CLAVES:
        v = np.full(ipix_m.size, np.nan, np.float32)
        v[pos[en]] = np.concatenate([q[k] for q in partes])[en]
        col[k] = v
    col["frac_valida"] = np.where(np.isfinite(col["n"]), np.minimum(col["n"] / col["esperados"], 1), 0).astype(np.float32)
    fv = col["frac_valida"]
    con_dato = np.isfinite(col["media"])
    distribucion_fv = {f"frac_valida<{u}": float(np.mean(fv[con_dato] < u)) for u in (0.1, 0.25, 0.5, 0.9)}
    meta = {
        "fuente": "Copernicus DEM GLO-90 release 2024_1 (DEM y WBM); JRC GSW v1.5 occurrence",
        "url": "https://registry.opendata.aws/copernicus-dem/",
        "licencia": "Copernicus DEM license; JRC GSW: Copernicus open license",
        "metodo": "halo de vecinas de 0.05° de latitud, agua a 90 m (mar; lago o río si GSW >= 50 % o sin dato), "
                  "proyección LAEA local por tesela en bloques de 200 m (validez >= 0.999), pendiente de Horn, "
                  "cada celda entera en la tesela de su centro, percentiles lineales",
        "advertencias": [
            "teselas a menos de 2° de los polos no se calculan",
            "GLO-90 es un DSM: bosque y edificios agregan rugosidad",
            "celdas con poca fracción válida (costa, lagos) se conservan: ver frac_valida",
        ],
    }
    ficha = meta["advertencias"] + ["para la ficha: no puntúa la semejanza (ADR-005)"]
    met_v = meta["metodo"] + f"; ventana de {VENTANA}x{VENTANA} bloques (ventana de 1 km) con >= {MIN_VALIDOS_VENTANA} válidos"
    cols = [
        escribir_columna(run, "slope_mean_deg", col["media"], {**meta, "unidad": "grados"}),
        escribir_columna(run, "slope_std_deg", col["desv"], {**meta, "unidad": "grados"}),
        escribir_columna(run, "terreno_n_px", np.where(col["n"] > 0, col["n"], np.nan), {**meta, "unidad": "bloques de 200 m"}),
        escribir_columna(run, "slope_p90_deg", col["p90"], {**meta, "unidad": "grados"}),
        escribir_columna(run, "slope_p99_deg", col["p99"], {**meta, "unidad": "grados"}),
        escribir_columna(run, "slope_frac_gt15", col["f15"], {**meta, "unidad": "fracción de bloques de 200 m"}),
        escribir_columna(run, "elev_mean_m", col["zmedia"], {**meta, "unidad": "m (EGM2008)"}),
        escribir_columna(run, "elev_std_m", col["zdesv"], {**meta, "unidad": "m", "advertencias": ficha}),
        escribir_columna(run, "relieve_m", col["zmax"] - col["zmin"], {**meta, "unidad": "m", "advertencias": ficha}),
        escribir_columna(run, "rug_rms_mean_m", col["rug_media"], {**meta, "metodo": met_v, "unidad": "m", "advertencias": ficha}),
        escribir_columna(run, "rug_rms_p90_m", col["rug_p90"], {**meta, "metodo": met_v, "unidad": "m", "advertencias": ficha}),
        escribir_columna(run, "relieve_mean_m", col["rel_media"], {**meta, "metodo": met_v, "unidad": "m", "advertencias": ficha}),
        escribir_columna(run, "relieve_p90_m", col["rel_p90"], {**meta, "metodo": met_v, "unidad": "m", "advertencias": ficha}),
        escribir_columna(run, "frac_valida", fv, {
            **meta, "unidad": "fracción 0-1",
            "metodo": "bloques de 200 m con pendiente / (área de la celda / 0.04 km²); 0 sin dato",
            "distribucion": distribucion_fv}),
    ]
    ok = np.isfinite(col["p90"]) & np.isfinite(col["media"])
    if np.any(col["p99"][ok] < col["p90"][ok]) or np.any(col["p90"][ok] < 0):
        fallos.append("percentiles fuera de orden")
    con_z = np.isfinite(col["media"]) & ~np.isfinite(col["zmedia"])
    if con_z.any():
        fallos.append(f"{int(con_z.sum())} celdas con pendiente y sin elevación")
    r_ok = np.isfinite(col["rug_p90"]) & np.isfinite(col["rug_media"])
    if np.any(col["rug_media"][r_ok] < 0) or np.any(col["rel_media"][np.isfinite(col["rel_media"])] < 0):
        fallos.append("rugosidad o relieve negativos")
    puntos_pend = {
        "Everest": (27.988, 86.925),
        "Mar Muerto (orilla oeste)": (31.45, 35.38),
        "Uyuni (centro)": (-20.2, -67.6),
        "Lut": (30.3, 59.0),
        "Lago Superior (centro)": (47.7, -87.5),
        "Titicaca (centro)": (-15.9, -69.4),
        "Sahara llano (Erg Chech)": (24.5, -2.5),
    }
    vals = {
        k: {
            "slope_mean": valor_en(ipix_m, col["media"], *v),
            "elev": valor_en(ipix_m, col["zmedia"], *v),
            "relieve": valor_en(ipix_m, col["zmax"] - col["zmin"], *v),
            "rug": valor_en(ipix_m, col["rug_media"], *v),
            "frac_valida": valor_en(ipix_m, fv, *v),
        }
        for k, v in puntos_pend.items()
    }
    if not vals["Everest"]["slope_mean"] > 15:
        fallos.append(f"Everest con pendiente baja: {vals['Everest']['slope_mean']}")
    if not (np.isfinite(vals["Uyuni (centro)"]["slope_mean"]) and vals["Uyuni (centro)"]["slope_mean"] < 1.5):
        fallos.append(f"Uyuni debe tener pendiente casi nula: {vals['Uyuni (centro)']['slope_mean']}")
    for lago in ("Lago Superior (centro)", "Titicaca (centro)"):
        if np.isfinite(vals[lago]["slope_mean"]):
            fallos.append(f"{lago} debe ser NaN: {vals[lago]['slope_mean']}")
    for k in ("Lut", "Mar Muerto (orilla oeste)", "Sahara llano (Erg Chech)"):
        if not np.isfinite(vals[k]["slope_mean"]):
            fallos.append(f"{k} sin dato")
    if not vals["Everest"]["elev"] > 6000:
        fallos.append(f"Everest con elevación baja: {vals['Everest']['elev']}")
    if not vals["Mar Muerto (orilla oeste)"]["elev"] < 0:
        fallos.append(f"la orilla del Mar Muerto no está bajo el nivel del mar: {vals['Mar Muerto (orilla oeste)']['elev']}")
    if not vals["Everest"]["rug"] > 10 * vals["Uyuni (centro)"]["rug"]:
        fallos.append(f"la rugosidad del Everest no supera 10 veces la de Uyuni: {vals['Everest']['rug']} y {vals['Uyuni (centro)']['rug']}")
    r = {
        "teselas_con_datos": len(partes),
        "celdas_fuera_de_malla": int((~en).sum()),
        "frac_valida": distribucion_fv,
        "puntos": vals,
        "fallos": fallos,
        "segundos": round(time.time() - t0, 1),
    }
    (run / "columns" / "e03_extras.json").write_text(
        json.dumps({**r, "columnas": cols}, indent=2, ensure_ascii=False), encoding="utf-8",
    )
    (run / "terreno" / "e03.json").write_text(
        json.dumps({**r, "columnas": cols}, indent=2, ensure_ascii=False), encoding="utf-8",
    )
    print(json.dumps(r, indent=2, ensure_ascii=False))
    for c in cols:
        print(f"{c['columna']}: cobertura {c['cobertura_pct']} %, p1 {c['p1']}, p50 {c['p50']}, p99 {c['p99']}")
    return 1 if fallos else 0


if __name__ == "__main__":
    sys.exit(main())
