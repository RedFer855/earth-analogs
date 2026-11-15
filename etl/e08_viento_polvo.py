"""E-08: viento y polvo (perfil de polvo operativo).

Columnas:
  ustar_media_ms, ustar_p95_ms   velocidad de fricción de MERRA-2 (M2T1NXFLX, 1 de cada 5 días, 2013-2022, horaria)
  viento_tau_media_pa            esfuerzo del viento tau = RHOA * USTAR^2 medio de MERRA-2 (M2T1NXFLX)
  viento_frac_tau_gt_0p02,
  _0p05, _0p10, _0p20            fracción de horas con tau > 0.02, 0.05, 0.10 y 0.20 Pa
  duem_kg_m2_s                   emisión de polvo media de MERRA-2 (M2TMNXADG, DUEM001 a DUEM005 sumados, 120 meses)
  polvo_frec_dod02_pct           frecuencia de tormentas de polvo, DOD > 0.2 (MODFDS, QA 3, % de días por mes)
  polvo_frec_dod05_pct           frecuencia de tormentas de polvo, DOD > 0.5 (MODFDS, QA 3, % de días por mes)
  polvo_frec_dod1_pct            frecuencia de tormentas de polvo, DOD > 1 (MODFDS, QA 3, % de días por mes)
  polvo_n_meses                  meses válidos de MODFDS (DOD > 0.2, QA 3) de 120

MERRA-2 trae meses repetidos: se agrupan por mes, se comprueba que los repetidos sean idénticos y se usa uno.
MODFDS se lee como centros de píxel (convención CF); el posible corrimiento de media celda queda en el manifiesto.

Uso: python e08_viento_polvo.py
"""

from __future__ import annotations

import json
import re
import sys
import time
from collections import defaultdict

import numpy as np
from osgeo import gdal

from comun import ruta_env
from comun_tabla import cargar_malla, escribir_columna, muestrear, valor_en

gdal.UseExceptions()
MIN_MESES_MODFDS = 60  # de 120: una media de pocos meses queda sesgada por la estación
UMBRALES_TAU = (0.02, 0.05, 0.10, 0.20)


def nombre_tau(umbral: float) -> str:
    """Nombre de columna para fracción de horas sobre un umbral de tau con dos decimales."""
    return f"viento_frac_tau_gt_{umbral:.2f}".replace(".", "p")


def esfuerzo_cortante(rhoa: np.ndarray, ustar_arr: np.ndarray) -> np.ndarray:
    """Calcula tau = RHOA * USTAR^2 en Pa y descarta valores no finitos o fuera de rango (> 100 Pa)."""
    tau = rhoa.astype(np.float32) * (ustar_arr.astype(np.float32) ** 2)
    tau[~np.isfinite(tau) | (tau > 100)] = np.nan
    return tau


def _var(ruta: str, var: str):
    ds = gdal.Open(f'NETCDF:"{ruta}":{var}')
    a = ds.ReadAsArray().astype(np.float32)
    nd = ds.GetRasterBand(1).GetNoDataValue()
    if nd is not None:
        a[np.isclose(a, nd)] = np.nan
    return a, ds.GetGeoTransform()


def ustar_y_tau(datos):
    archivos = sorted((datos / "tierra" / "merra2-viento-1de5-2013-2022").glob("*.nc4"))
    if not archivos:
        raise SystemExit("ERROR: sin archivos de u*")
    suma_u = cuenta_u = suma_t = horas_t = sobre = geo = None
    muestras = []
    for i, a in enumerate(archivos):
        u, geo = _var(str(a), "USTAR")  # 24 x 361 x 576
        rho, _ = _var(str(a), "RHOA")
        tau = esfuerzo_cortante(rho, u)
        if suma_u is None:
            forma = u.shape[1:]
            suma_u, cuenta_u = np.zeros(forma), np.zeros(forma)
            suma_t, horas_t = np.zeros(forma), np.zeros(forma)
            sobre = {t: np.zeros(forma) for t in UMBRALES_TAU}
        suma_u += np.nansum(u, 0)
        cuenta_u += np.isfinite(u).sum(0)
        suma_t += np.nansum(tau, 0)
        horas_t += np.isfinite(tau).sum(0)
        for t in UMBRALES_TAU:
            sobre[t] += (tau > t).sum(0)
        if i % 10 == 0:
            muestras.append(u)
    with np.errstate(invalid="ignore", divide="ignore"):
        media_u = (suma_u / cuenta_u).astype(np.float32)
        tau_media = (suma_t / horas_t).astype(np.float32)
        frac_tau = {t: (sobre[t] / horas_t).astype(np.float32) for t in UMBRALES_TAU}
    p95 = np.nanpercentile(np.concatenate(muestras, 0), 95, axis=0).astype(np.float32)
    return media_u, p95, tau_media, frac_tau, geo, len(archivos)


def duem(datos):
    por_mes = defaultdict(list)
    for a in sorted((datos / "tierra" / "merra2-polvo-mensual").glob("*.nc4")):
        por_mes[re.search(r"\.(\d{6})\.", a.name).group(1)].append(a)
    if len(por_mes) != 120:
        raise SystemExit(f"ERROR: MERRA-2 polvo con {len(por_mes)} meses; se esperaban 120")
    suma = geo = None
    duplicados = 0
    for mes, rutas in sorted(por_mes.items()):
        totales = []
        for r in rutas:
            t = None
            for k in range(1, 6):
                v, geo = _var(str(r), f"DUEM00{k}")
                v = v if v.ndim == 2 else v[0]
                t = v if t is None else t + v
            totales.append(t)
        for t in totales[1:]:
            duplicados += 1
            if not np.array_equal(t, totales[0], equal_nan=True):
                raise SystemExit(f"ERROR: el mes {mes} está repetido con valores distintos")
        suma = totales[0].astype(np.float64) if suma is None else suma + totales[0]
    return (suma / 120).astype(np.float32), geo, duplicados


def modfds(datos, umbral: str):
    archivos = sorted((datos / "tierra" / "modfds-tormentas-polvo").glob(f"MODFDS_MON_GLB_L3_dod_gt_{umbral}_*.nc"))
    if len(archivos) != 10:
        raise SystemExit(f"ERROR: MODFDS {umbral} con {len(archivos)} años; se esperaban 10")
    suma = cuenta = geo = None
    for a in archivos:
        v, geo = _var(str(a), "foo_dod3_gt_threshold")  # 12 meses, QA 3
        v[v < 0] = np.nan
        if suma is None:
            suma, cuenta = np.zeros(v.shape[1:]), np.zeros(v.shape[1:])
        suma += np.nansum(v, 0)
        cuenta += np.isfinite(v).sum(0)
    with np.errstate(invalid="ignore", divide="ignore"):
        media = np.where(cuenta >= MIN_MESES_MODFDS, suma / cuenta, np.nan).astype(np.float32)
    return media, cuenta.astype(np.float32), geo


def main() -> int:
    datos, run = ruta_env("DATOS"), ruta_env("RUN")
    t0 = time.time()
    ipix, lat, lon = cargar_malla(run)
    um, up, tm, ftau, geo_u, n_u = ustar_y_tau(datos)
    d, geo_d, dup = duem(datos)
    f02, n02, geo_f = modfds(datos, "0.2")
    f05, _, _ = modfds(datos, "0.5")
    f1, _, _ = modfds(datos, "1")
    base = {"licencia": "NASA open data"}
    meta_tau = {
        **base,
        "fuente": f"MERRA-2 M2T1NXFLX USTAR y RHOA, {n_u} días (1 de cada 5) de 2013-2022, horario",
        "url": "https://disc.gsfc.nasa.gov/datasets/M2T1NXFLX_5.12.4/summary",
        "metodo": "tau = RHOA * USTAR^2 por hora; centro de celda",
    }
    tau_media_celda = muestrear(tm, lat, lon, geo_u)
    cols = [
        escribir_columna(run, "ustar_media_ms", muestrear(um, lat, lon, geo_u), {
            **base, "fuente": f"MERRA-2 M2T1NXFLX USTAR, {n_u} días (1 de cada 5) de 2013-2022, horario",
            "url": "https://disc.gsfc.nasa.gov/datasets/M2T1NXFLX_5.12.4/summary", "unidad": "m/s",
            "metodo": "media de todas las horas; centro de celda"}),
        escribir_columna(run, "ustar_p95_ms", muestrear(up, lat, lon, geo_u), {
            **base, "fuente": "MERRA-2 M2T1NXFLX USTAR",
            "url": "https://disc.gsfc.nasa.gov/datasets/M2T1NXFLX_5.12.4/summary",
            "unidad": "m/s", "metodo": "percentil 95 de las horas de 1 de cada 10 archivos diarios; centro de celda"}),
        escribir_columna(run, "viento_tau_media_pa", tau_media_celda, {**meta_tau, "unidad": "Pa"}),
    ]
    for t in UMBRALES_TAU:
        cols.append(escribir_columna(run, nombre_tau(t), muestrear(ftau[t], lat, lon, geo_u), {
            **meta_tau, "unidad": "fracción de horas", "metodo": meta_tau["metodo"] + f"; tau > {t:.2f} Pa"}))
    cols.append(escribir_columna(run, "duem_kg_m2_s", muestrear(d, lat, lon, geo_d), {
        **base, "fuente": "MERRA-2 M2TMNXADG DUEM001-DUEM005, 2013-2022", "unidad": "kg m-2 s-1",
        "url": "https://disc.gsfc.nasa.gov/datasets/M2TMNXADG_5.12.4/summary",
        "metodo": f"suma de los 5 tamaños, media de 120 meses; {dup} archivos repetidos idénticos descartados"}))
    f02_celda = muestrear(f02, lat, lon, geo_f)
    f05_celda = muestrear(f05, lat, lon, geo_f)
    f1_celda = muestrear(f1, lat, lon, geo_f)
    for nombre, col_celda, u in (
        ("polvo_frec_dod02_pct", f02_celda, "0.2"),
        ("polvo_frec_dod05_pct", f05_celda, "0.5"),
        ("polvo_frec_dod1_pct", f1_celda, "1"),
    ):
        cols.append(escribir_columna(run, nombre, col_celda, {
            **base, "fuente": f"MODFDS_MON_GLB_L3 v1, DOD > {u}, QA 3, 2013-2022",
            "url": "https://disc.gsfc.nasa.gov/datasets/MODFDS_MON_GLB_L3_1/summary", "unidad": "% de días por mes",
            "metodo": f"media de los meses válidos, con al menos {MIN_MESES_MODFDS} de 120; centro de celda",
            "advertencias": ["coordenadas leídas como centro (CF); posible corrimiento de media celda (0.05°)",
                             "solo tierra entre 80° S y 80° N"]}))
    cols.append(escribir_columna(run, "polvo_n_meses", muestrear(n02, lat, lon, geo_f), {
        **base, "fuente": "MODFDS_MON_GLB_L3 v1, DOD > 0.2, QA 3", "unidad": "meses válidos de 120",
        "url": "https://disc.gsfc.nasa.gov/datasets/MODFDS_MON_GLB_L3_1/summary", "metodo": "centro de celda"}))
    duem_celda = muestrear(d, lat, lon, geo_d)
    puntos = {"Bodélé": (17.0, 18.0), "Taklamakán": (39.0, 83.0), "Amazonía": (-3.5, -62.0)}
    vals = {
        k: {
            "duem": valor_en(ipix, duem_celda, *v),
            "tau": valor_en(ipix, tau_media_celda, *v),
            "frec02": valor_en(ipix, f02_celda, *v),
            "frec05": valor_en(ipix, f05_celda, *v),
        }
        for k, v in puntos.items()
    }
    fallos = []
    if not vals["Bodélé"]["duem"] > 10 * vals["Amazonía"]["duem"]:
        fallos.append("la emisión de polvo de Bodélé no supera a la Amazonía")
    if not vals["Bodélé"]["tau"] > vals["Amazonía"]["tau"]:
        fallos.append("tau medio de Bodélé no supera a la Amazonía")
    if not vals["Bodélé"]["frec02"] > vals["Amazonía"]["frec02"]:
        fallos.append("la frecuencia de tormentas DOD > 0.2 de Bodélé no supera a la Amazonía")
    if not vals["Bodélé"]["frec05"] > vals["Amazonía"]["frec05"]:
        fallos.append("la frecuencia de tormentas DOD > 0.5 de Bodélé no supera a la Amazonía")
    r = {"puntos": vals, "merra2_repetidos": dup, "fallos": fallos, "segundos": round(time.time() - t0, 1)}
    (run / "columns" / "e08.json").write_text(json.dumps({**r, "columnas": cols}, indent=2, ensure_ascii=False),
                                               encoding="utf-8")
    print(json.dumps(r, indent=2, ensure_ascii=False))
    for c in cols:
        print(f"{c['columna']}: cobertura {c['cobertura_pct']} %, p1 {c['p1']}, p50 {c['p50']}, p99 {c['p99']}")
    return 1 if fallos else 0


if __name__ == "__main__":
    sys.exit(main())
