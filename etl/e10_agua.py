"""E-10: agua superficial por celda y dos columnas de contexto.

Por tesela GLO-90 se cuentan los píxeles de 90 m de la WBM por clase y por celda HEALPix:
  frac_tierra, frac_oceano, frac_lago, frac_rio   partición: suman 1 en cada celda (0 sin agua, 1 océano, 2 lago, 3 río)
  frac_efimero                                    lago o río de la WBM con ocurrencia de JRC GSW < 50 %; es una parte
                                                  de lago + río, no un término más de la partición
Contexto (no puntúan la semejanza):
  glwd_clase       GLWD v2, clase principal (centro de celda)
  cielo_visible    factor de cielo visible de Li et al. 2024 (centro de celda); no es iluminación

Uso: python e10_agua.py [procesos]
"""

from __future__ import annotations

import json
import sys
import time
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path

import numpy as np
from osgeo import gdal

from comun import ruta_env
from comun_tabla import cargar_malla, celda_de, escribir_columna, juntar_sumas, muestrear_por_franjas, valor_en

gdal.UseExceptions()
UMBRAL_GSW = 50
CLASES = ["tierra", "oceano", "lago", "rio"]
_GSW: str | None = None


def _iniciar(gsw_vrt: str) -> None:
    global _GSW
    _GSW = gsw_vrt


def tesela(ruta: str, salida: str) -> int:
    ds = gdal.Open(ruta)
    x0, dx, _, y0, _, dy = ds.GetGeoTransform()
    w = ds.GetRasterBand(1).ReadAsArray()
    h, c = w.shape
    efim = np.zeros(w.shape, dtype=bool)
    agua = (w == 2) | (w == 3)
    if agua.any():
        g = gdal.Warp("", [_GSW], format="MEM", outputBounds=(x0, y0 + dy * h, x0 + dx * c, y0), width=c, height=h,
                      resampleAlg="average", outputType=gdal.GDT_Float32, dstNodata=np.nan, multithread=False)
        occ = g.GetRasterBand(1).ReadAsArray()
        efim = agua & np.isfinite(occ) & (occ < UMBRAL_GSW)
    # Se cuentan los píxeles de 90 m por clase en bloques de 2x2 y cada bloque va a la celda de su centro:
    # el conteo es exacto dentro del bloque y la celda (~1.6 km) contiene unos 80 bloques.
    h2, c2 = (h // 2) * 2, (c // 2) * 2

    def bloque(m):
        return m[:h2, :c2].reshape(h2 // 2, 2, c2 // 2, 2).sum(axis=(1, 3)).ravel().astype(np.float64)

    conteos = {k: bloque(w == i) for i, k in enumerate(CLASES)}
    conteos["efimero"] = bloque(efim)
    total = bloque(w != 255)
    lat = y0 + (np.arange(h2 // 2) + 0.5) * 2 * dy
    lon = x0 + (np.arange(c2 // 2) + 0.5) * 2 * dx
    la, lo = np.repeat(lat, c2 // 2), np.tile(lon, h2 // 2)
    ok = total > 0
    celdas = celda_de(la[ok], lo[ok], hilos=1)
    u_, inv = np.unique(celdas, return_inverse=True)
    s = {"ipix": u_}
    tot = np.bincount(inv, weights=total[ok])
    for k, x in conteos.items():
        s[f"{k}_s"] = np.bincount(inv, weights=x[ok])
        s[f"{k}_n"] = tot
    np.savez(Path(salida) / f"{Path(ruta).stem}.npz", **s)
    return int(total.sum())


def main() -> int:
    procesos = int(sys.argv[1]) if len(sys.argv) > 1 else 8
    datos, run = ruta_env("DATOS"), ruta_env("RUN")
    t0 = time.time()
    sumas = run / "agua" / "sumas"
    sumas.mkdir(parents=True, exist_ok=True)
    gsw_vrt = run / "terreno" / "gsw_occurrence.vrt"
    if not gsw_vrt.exists():
        print("ERROR: falta el VRT de GSW de E-03")
        return 1
    wbms = sorted((datos / "tierra" / "glo90" / "wbm").glob("*_WBM.tif"))
    hechas = {p.stem for p in sumas.glob("*.npz")}
    pendientes = [p for p in wbms if p.stem not in hechas]
    errores = []
    with ProcessPoolExecutor(procesos, initializer=_iniciar, initargs=(str(gsw_vrt),)) as pool:
        fut = {pool.submit(tesela, str(p), str(sumas)): p.name for p in pendientes}
        for i, f in enumerate(as_completed(fut), 1):
            try:
                f.result()
            except Exception as e:  # noqa: BLE001 - toda tesela que falle hace fallar el paso
                errores.append(f"{fut[f]}: {e}")
            if i % 4000 == 0:
                print(f"  {i}/{len(pendientes)} teselas, {time.time() - t0:.0f} s", flush=True)
    print(f"teselas WBM: {len(wbms)}, procesadas ahora {len(pendientes)}, errores {len(errores)}")
    if errores:
        print("\n".join(errores[:20]))
        return 1
    ipix, lat, lon = cargar_malla(run)
    fr = juntar_sumas(ipix, sorted(sumas.glob("*.npz")), CLASES + ["efimero"])
    meta = {"fuente": "Copernicus DEM GLO-90 release 2024_1, máscara de agua (WBM); JRC GSW v1.5 occurrence",
            "url": "https://registry.opendata.aws/copernicus-dem/", "licencia": "Copernicus DEM license",
            "unidad": "fracción de píxeles de 90 m", "metodo": "conteo de píxeles WBM por clase y por celda"}
    cols = [escribir_columna(run, f"frac_{k}", fr[k], meta) for k in CLASES]
    cols.append(escribir_columna(run, "frac_efimero", fr["efimero"], {
        **meta, "metodo": "lago o río de la WBM con ocurrencia GSW < 50 %; parte de lago + río"}))
    z = f"/vsizip/{datos.as_posix()}/tierra/glwd-v2/GLWD_v2_0_combined_classes_tif.zip/GLWD_v2_0_combined_classes/GLWD_v2_0_main_class.tif"
    glwd = muestrear_por_franjas(gdal.Open(z), lat, lon)
    cols.append(escribir_columna(run, "glwd_clase", glwd, {
        "fuente": "GLWD v2.0, combined classes, main class", "url": "https://doi.org/10.6084/m9.figshare.28519994",
        "licencia": "CC BY 4.0", "unidad": "clase", "metodo": "centro de celda; 255 es sin dato; 0 se conserva como viene de la fuente",
        "advertencias": ["contexto: no puntúa la semejanza"]}))
    nc = datos / "tierra" / "iluminacion-li-2024" / "SKY_VIEW_FACTOR_1k_c230606.nc"
    sub = [s[0] for s in gdal.Open(str(nc)).GetSubDatasets()]
    cielo = muestrear_por_franjas(gdal.Open(sub[0] if sub else str(nc)), lat, lon)
    cielo[(cielo < 0) | (cielo > 1)] = np.nan
    cols.append(escribir_columna(run, "cielo_visible", cielo, {
        "fuente": "Li et al. 2024, sky-view factor 1 km", "url": "https://doi.org/10.5194/essd-16-1-2024",
        "licencia": "CC BY 4.0", "unidad": "fracción de cielo visible", "metodo": "centro de celda",
        "advertencias": ["no es iluminación; contexto para la ficha"]}))
    suma = fr["tierra"] + fr["oceano"] + fr["lago"] + fr["rio"]
    ok = np.isfinite(suma)
    fallos = []
    if np.abs(suma[ok] - 1).max() > 1e-5:
        fallos.append(f"la partición no suma 1: desvío máximo {np.abs(suma[ok] - 1).max()}")
    if np.any(fr["efimero"][ok] > fr["lago"][ok] + fr["rio"][ok] + 1e-6):
        fallos.append("frac_efimero mayor que lago + río")
    puntos = {"Lago Superior (centro)": (47.7, -87.5), "Uyuni (centro)": (-20.2, -67.6), "Sahara (Erg Chech)": (24.5, -2.5)}
    vals = {k: {c: valor_en(ipix, fr[c], *v) for c in ("tierra", "lago", "efimero")} for k, v in puntos.items()}
    if not vals["Lago Superior (centro)"]["lago"] > 0.9:
        fallos.append("el Lago Superior no sale como lago")
    if not vals["Sahara (Erg Chech)"]["tierra"] > 0.99:
        fallos.append("el Sahara no sale como tierra")
    r = {"teselas": len(wbms), "puntos": vals, "fallos": fallos, "segundos": round(time.time() - t0, 1)}
    (run / "columns" / "e10.json").write_text(json.dumps({**r, "columnas": cols}, indent=2, ensure_ascii=False),
                                               encoding="utf-8")
    print(json.dumps(r, indent=2, ensure_ascii=False))
    for c in cols:
        print(f"{c['columna']}: cobertura {c['cobertura_pct']} %, p1 {c['p1']}, p50 {c['p50']}, p99 {c['p99']}")
    return 1 if fallos else 0


if __name__ == "__main__":
    sys.exit(main())
