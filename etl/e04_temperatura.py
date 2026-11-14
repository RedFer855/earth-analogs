"""E-04: temperatura de superficie (MYD11C3 V061, 2013-2022; ADR-004).

Por mes del calendario se promedian los años válidos. Un valor entra si la LST fue producida (QC & 3 <= 1), su error
es <= 3 K (QC >> 6 <= 2) y el mes tuvo al menos 3 días (o noches) despejados, contando bits del campo Clear_sky_*.
Columnas por celda (el centro de la celda decide el píxel de 0.05°):
  lst_dia_k, lst_noche_k  media de los meses con dato (mínimo 6 meses)
  rango_diurno_k          media de (día - noche) en los meses con los dos; el negativo se conserva
  amp_anual_k             máximo menos mínimo de la media mensual (día + noche) / 2; exige los 12 meses
  lst_n_meses             meses con día y noche

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
MIN_MESES = 6


def _sub(ruta: str, clave: str):
    ds = gdal.Open(ruta)
    nombre = [s[0] for s in ds.GetSubDatasets() if s[0].endswith(clave)][0]
    sub = gdal.Open(nombre)
    return sub.GetRasterBand(1).ReadAsArray(), sub.GetGeoTransform()


def _bits(a: np.ndarray) -> np.ndarray:
    a = a.astype(np.uint32)
    n = np.zeros(a.shape, dtype=np.uint8)
    for k in range(32):
        n += ((a >> k) & 1).astype(np.uint8)
    return n


def _valido(lst, qc, despejados):
    ok = (lst > 0) & ((qc & 3) <= 1) & ((qc >> 6) <= 2) & (_bits(despejados) >= MIN_DESPEJADOS)
    return np.where(ok, lst.astype(np.float32) * ESCALA, np.nan)


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
    dia_m, noche_m, geo = [], [], None
    for mes in range(1, 13):
        sd = sn = None
        cd = cn = None
        for r in por_mes[mes]:
            ld, geo = _sub(r, "LST_Day_CMG")
            d = _valido(ld, _sub(r, "QC_Day")[0], _sub(r, "Clear_sky_days")[0])
            n = _valido(_sub(r, "LST_Night_CMG")[0], _sub(r, "QC_Night")[0], _sub(r, "Clear_sky_nights")[0])
            if sd is None:
                sd, sn = np.zeros(d.shape, np.float64), np.zeros(d.shape, np.float64)
                cd, cn = np.zeros(d.shape, np.uint8), np.zeros(d.shape, np.uint8)
            sd += np.nan_to_num(d)
            cd += np.isfinite(d)
            sn += np.nan_to_num(n)
            cn += np.isfinite(n)
        with np.errstate(invalid="ignore", divide="ignore"):
            dia_m.append(np.where(cd > 0, sd / cd, np.nan).astype(np.float32))
            noche_m.append(np.where(cn > 0, sn / cn, np.nan).astype(np.float32))
        print(f"  mes {mes:02d} listo, {time.time() - t0:.0f} s", flush=True)

    ipix, lat, lon = cargar_malla(run)
    lst_dia = np.full(ipix.size, np.nan, np.float32)
    lst_noche, dtr, amp = lst_dia.copy(), lst_dia.copy(), lst_dia.copy()
    nb = np.zeros(ipix.size, np.float32)
    paso = 4_000_000
    for i in range(0, ipix.size, paso):
        s = slice(i, i + paso)
        D = np.stack([muestrear(x, lat[s], lon[s], geo) for x in dia_m])  # 12 x celdas
        N = np.stack([muestrear(x, lat[s], lon[s], geo) for x in noche_m])
        nd, nn = np.isfinite(D).sum(0), np.isfinite(N).sum(0)
        ambos = np.isfinite(D) & np.isfinite(N)
        nb[s] = ambos.sum(0)
        with np.errstate(invalid="ignore"), warnings.catch_warnings():
            warnings.simplefilter("ignore", RuntimeWarning)
            lst_dia[s] = np.where(nd >= MIN_MESES, np.nanmean(D, 0), np.nan)
            lst_noche[s] = np.where(nn >= MIN_MESES, np.nanmean(N, 0), np.nan)
            dtr[s] = np.where(nb[s] >= MIN_MESES, np.nanmean(np.where(ambos, D - N, np.nan), 0), np.nan)
            media = (D + N) / 2
            amp[s] = np.where(nb[s] == 12, np.nanmax(media, 0) - np.nanmin(media, 0), np.nan)
    del dia_m, noche_m
    meta = {
        "fuente": "MODIS Aqua MYD11C3 V061, 2013-2022 (120 meses)",
        "url": "https://lpdaac.usgs.gov/products/myd11c3v061/",
        "licencia": "NASA open data",
        "metodo": "QC & 3 <= 1, error <= 3 K, >= 3 días despejados por mes; climatología mensual; centro de celda",
        "advertencias": ["sesgo de cielo despejado: el rango diurno se agranda en zonas nubosas"],
        "unidad": "K",
    }
    cols = [
        escribir_columna(run, "lst_dia_k", lst_dia, meta),
        escribir_columna(run, "lst_noche_k", lst_noche, meta),
        escribir_columna(run, "rango_diurno_k", dtr, meta),
        escribir_columna(run, "amp_anual_k", amp, {**meta, "metodo": meta["metodo"] + "; exige 12 meses"}),
        escribir_columna(run, "lst_n_meses", nb.astype(np.float32), {**meta, "unidad": "meses"}),
    ]
    negativos = int(np.sum(dtr < 0))
    fallos = []
    if not (np.nanmean(dtr) > 0):
        fallos.append("el rango diurno medio no es positivo: día y noche podrían estar invertidos")
    puntos = {"Lut": (30.3, 59.0), "Atacama": (-23.5, -69.0), "Groenlandia centro": (72.6, -38.5)}
    vals = {k: {"dia": valor_en(ipix, lst_dia, *v), "dtr": valor_en(ipix, dtr, *v)} for k, v in puntos.items()}
    if not vals["Lut"]["dia"] > 310:
        fallos.append(f"Lut con LST de día baja: {vals['Lut']['dia']}")
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
