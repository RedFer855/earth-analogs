"""E-04: temperatura de superficie (MYD11C3 V061, 2013-2022; ADR-004).

Por mes del calendario se promedian los años válidos. Un valor entra si la fracción de tierra es >= 50 %, la LST fue
producida (QC & 3 <= 1), su error es <= 3 K (QC >> 6 <= 2) y el mes tuvo al menos 3 días (o noches) despejados, contando
bits del campo Clear_sky_*. El rango diurno de cada mes calendario promedia (día - noche) solo en años con ambos válidos.
Columnas por celda (el centro de la celda decide el píxel de 0.05°):
  lst_dia_k, lst_noche_k  media de los meses con dato (mínimo 6 meses)
  rango_diurno_k          media de los meses con (día - noche) emparejado (mínimo 6 meses); el negativo se conserva
  amp_anual_k             máximo menos mínimo de la media mensual (día + noche) / 2; exige >= 11 meses
  lst_media_k             media de la climatología mensual (día + noche) / 2; exige >= 11 meses
  lst_dia_max_k           máximo de la climatología mensual de día; exige >= 11 meses de día
  lst_noche_min_k         mínimo de la climatología mensual de noche; exige >= 11 meses de noche
  dtr_max_k               máximo mensual del rango diurno emparejado; exige >= 11 meses emparejados
  lst_n_meses             meses calendario con rango diurno emparejado válido

Uso: python e04_temperatura.py
"""

from __future__ import annotations

import json
import re
import sys
import time
import warnings

import numpy as np
from osgeo import gdal

from comun import ruta_env
from comun_tabla import cargar_malla, escribir_columna, muestrear, valor_en

gdal.UseExceptions()
ESCALA = 0.02
MIN_DESPEJADOS = 3
MIN_TIERRA = 50
MIN_MESES = 6
MIN_MESES_ANUAL = 11


def _sub(ruta: str, clave: str):
    ds = gdal.Open(ruta)
    nombre = [s[0] for s in ds.GetSubDatasets() if s[0].endswith(clave)][0]
    sub = gdal.Open(nombre)
    return sub.GetRasterBand(1).ReadAsArray(), sub.GetGeoTransform()


def _bits(a: np.ndarray) -> np.ndarray:
    """Cuenta los bits en 1 de cada entero de 32 bits."""
    return np.bitwise_count(a.astype(np.uint32)).astype(np.uint8)


def _valido(lst, qc, despejados, tierra=None):
    ok = (lst > 0) & ((qc & 3) <= 1) & ((qc >> 6) <= 2) & (_bits(despejados) >= MIN_DESPEJADOS)
    if tierra is not None:
        ok &= tierra >= MIN_TIERRA
    return np.where(ok, lst.astype(np.float32) * ESCALA, np.nan)


def medias_mensuales(pares) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Promedia por mes calendario día, noche y (día - noche) emparejado por año-mes."""
    sd = sn = sr = cd = cn = cr = None
    for d, n in pares:
        if sd is None:
            sd = np.zeros(d.shape, np.float64)
            sn = np.zeros(d.shape, np.float64)
            sr = np.zeros(d.shape, np.float64)
            cd = np.zeros(d.shape, np.uint8)
            cn = np.zeros(d.shape, np.uint8)
            cr = np.zeros(d.shape, np.uint8)
        ok_d = np.isfinite(d)
        ok_n = np.isfinite(n)
        ok_r = ok_d & ok_n
        sd += np.where(ok_d, d, 0.0)
        cd += ok_d
        sn += np.where(ok_n, n, 0.0)
        cn += ok_n
        sr += np.where(ok_r, d - n, 0.0)
        cr += ok_r
    with np.errstate(invalid="ignore", divide="ignore"):
        return (
            np.where(cd > 0, sd / cd, np.nan).astype(np.float32),
            np.where(cn > 0, sn / cn, np.nan).astype(np.float32),
            np.where(cr > 0, sr / cr, np.nan).astype(np.float32),
        )


def resumir_temperatura(D: np.ndarray, N: np.ndarray, DTR: np.ndarray) -> dict[str, np.ndarray]:
    """Calcula métricas anuales a partir de climatologías de 12 meses (día, noche, DTR emparejado)."""
    nd = np.isfinite(D).sum(0)
    nn = np.isfinite(N).sum(0)
    nr = np.isfinite(DTR).sum(0)
    ambos = np.isfinite(D) & np.isfinite(N)
    nb = ambos.sum(0)
    media = np.where(ambos, (D + N) / 2, np.nan)
    with np.errstate(invalid="ignore"), warnings.catch_warnings():
        warnings.simplefilter("ignore", RuntimeWarning)
        return {
            "lst_dia_k": np.where(nd >= MIN_MESES, np.nanmean(D, 0), np.nan).astype(np.float32),
            "lst_noche_k": np.where(nn >= MIN_MESES, np.nanmean(N, 0), np.nan).astype(np.float32),
            "rango_diurno_k": np.where(nr >= MIN_MESES, np.nanmean(DTR, 0), np.nan).astype(np.float32),
            "amp_anual_k": np.where(nb >= MIN_MESES_ANUAL, np.nanmax(media, 0) - np.nanmin(media, 0), np.nan).astype(
                np.float32),
            "lst_media_k": np.where(nb >= MIN_MESES_ANUAL, np.nanmean(media, 0), np.nan).astype(np.float32),
            "lst_dia_max_k": np.where(nd >= MIN_MESES_ANUAL, np.nanmax(D, 0), np.nan).astype(np.float32),
            "lst_noche_min_k": np.where(nn >= MIN_MESES_ANUAL, np.nanmin(N, 0), np.nan).astype(np.float32),
            "dtr_max_k": np.where(nr >= MIN_MESES_ANUAL, np.nanmax(DTR, 0), np.nan).astype(np.float32),
            "lst_n_meses": nr.astype(np.float32),
        }


def _leer_mes(rutas: list[str]) -> tuple[np.ndarray, np.ndarray, np.ndarray, tuple]:
    geo = None

    def pares():
        nonlocal geo
        for r in rutas:
            ld, geo = _sub(r, "LST_Day_CMG")
            tierra = _sub(r, "Percent_land_in_grid")[0]
            d = _valido(ld, _sub(r, "QC_Day")[0], _sub(r, "Clear_sky_days")[0], tierra)
            n = _valido(_sub(r, "LST_Night_CMG")[0], _sub(r, "QC_Night")[0], _sub(r, "Clear_sky_nights")[0], tierra)
            yield d, n

    dm, nm, rm = medias_mensuales(pares())
    return dm, nm, rm, geo


def main() -> int:
    datos, run = ruta_env("DATOS"), ruta_env("RUN")
    t0 = time.time()
    archivos = sorted((datos / "tierra" / "temperatura-myd11c3-2013-2022").glob("*.hdf"))
    por_mes: dict[int, list] = {m: [] for m in range(1, 13)}
    for a in archivos:
        anio, dia = map(int, re.search(r"\.A(\d{4})(\d{3})\.", a.name).groups())
        mes = int(time.strftime("%m", time.strptime(f"{anio} {dia}", "%Y %j")))
        por_mes[mes].append(str(a))
    if len(archivos) != 120 or any(len(v) != 10 for v in por_mes.values()):
        print(f"ERROR: se esperaban 120 meses (10 por mes); hay {len(archivos)}")
        return 1
    dia_m, noche_m, dtr_m, geo = [], [], [], None
    for mes in range(1, 13):
        dm, nm, rm, geo = _leer_mes(por_mes[mes])
        dia_m.append(dm)
        noche_m.append(nm)
        dtr_m.append(rm)
        print(f"  mes {mes:02d} listo, {time.time() - t0:.0f} s", flush=True)

    ipix, lat, lon = cargar_malla(run)
    nombres = (
        "lst_dia_k", "lst_noche_k", "rango_diurno_k", "amp_anual_k", "lst_media_k",
        "lst_dia_max_k", "lst_noche_min_k", "dtr_max_k", "lst_n_meses",
    )
    out = {k: np.full(ipix.size, np.nan, np.float32) for k in nombres}
    paso = 4_000_000
    for i in range(0, ipix.size, paso):
        s = slice(i, i + paso)
        D = np.stack([muestrear(x, lat[s], lon[s], geo) for x in dia_m])
        N = np.stack([muestrear(x, lat[s], lon[s], geo) for x in noche_m])
        DTR = np.stack([muestrear(x, lat[s], lon[s], geo) for x in dtr_m])
        res = resumir_temperatura(D, N, DTR)
        for k in nombres:
            out[k][s] = res[k]
    del dia_m, noche_m, dtr_m
    meta = {
        "fuente": "MODIS Aqua MYD11C3 V061, 2013-2022 (120 meses)",
        "url": "https://lpdaac.usgs.gov/products/myd11c3v061/",
        "licencia": "NASA open data",
        "metodo": ("Percent_land_in_grid >= 50, QC & 3 <= 1, error <= 3 K, >= 3 días despejados; "
                   "climatología mensual y DTR emparejado por año-mes; centro de celda"),
        "advertencias": ["sesgo de cielo despejado: el rango diurno se agranda en zonas nubosas"],
        "unidad": "K",
    }
    metodos_extra = {
        "rango_diurno_k": meta["metodo"] + "; DTR emparejado, mínimo 6 meses",
        "amp_anual_k": meta["metodo"] + "; exige >= 11 meses con día y noche",
        "lst_media_k": meta["metodo"] + "; media de (día + noche) / 2, exige >= 11 meses",
        "lst_dia_max_k": meta["metodo"] + "; máximo mensual de día, exige >= 11 meses",
        "lst_noche_min_k": meta["metodo"] + "; mínimo mensual de noche, exige >= 11 meses",
        "dtr_max_k": meta["metodo"] + "; máximo mensual de DTR emparejado, exige >= 11 meses",
        "lst_n_meses": meta["metodo"] + "; meses con DTR emparejado",
    }
    cols = [
        escribir_columna(
            run, k, out[k],
            {**meta, **({"unidad": "meses"} if k == "lst_n_meses" else {}),
             **({"metodo": metodos_extra[k]} if k in metodos_extra else {})},
        )
        for k in nombres
    ]
    dtr = out["rango_diurno_k"]
    negativos = int(np.sum(dtr < 0))
    fallos = []
    if not (np.nanmean(dtr) > 0):
        fallos.append("el rango diurno medio no es positivo: día y noche podrían estar invertidos")
    puntos = {"Lut": (30.3, 59.0), "Atacama": (-23.5, -69.0), "Groenlandia centro": (72.6, -38.5)}
    vals = {
        k: {
            "dia": valor_en(ipix, out["lst_dia_k"], *v),
            "dia_max": valor_en(ipix, out["lst_dia_max_k"], *v),
            "dtr": valor_en(ipix, dtr, *v),
        }
        for k, v in puntos.items()
    }
    if not vals["Lut"]["dia"] > 310:
        fallos.append(f"Lut con LST de día baja: {vals['Lut']['dia']}")
    if not vals["Lut"]["dia_max"] > 330:
        fallos.append(f"Lut con máximo de día bajo: {vals['Lut']['dia_max']}")
    r = {"meses": len(archivos), "celdas_dtr_negativo": negativos, "puntos": vals, "fallos": fallos,
         "segundos": round(time.time() - t0, 1)}
    (run / "columns" / "e04.json").write_text(json.dumps({**r, "columnas": cols}, indent=2, ensure_ascii=False),
                                               encoding="utf-8")
    print(json.dumps(r, indent=2, ensure_ascii=False))
    for c in cols:
        print(f"{c['columna']}: cobertura {c['cobertura_pct']} %, p1 {c['p1']}, p50 {c['p50']}, p99 {c['p99']}")
    return 1 if fallos else 0


if __name__ == "__main__":
    sys.exit(main())
