"""E-09: material de superficie (perfil de polvo de material).

Columnas:
  aster_emis_media, aster_qi,            ASTER GED AG1km V003: emisividad media (bandas 10 a 14), índice de cuarzo
  aster_mi, aster_ci                     QI = B11^2 / (B10 B12), máficos MI = B12 / B13 y carbonatos CI = B13 / B14
                                         (Ninomiya et al. 2005); recorte 99x99 por tesela y máscara LWmap == 0
  glim_clase                             GLiM v1.0 a 0.5°: clase 1-16; 15 (nd, sin dato) es NaN; 11 (wb) es agua
  emit_<mineral>                         EMIT L3 ASA V002 a 0.5°: abundancia de 11 minerales; lat/lon son la esquina
                                         superior izquierda, no el centro
  arcilla_gkg, limo_gkg                  SoilGrids 2.0, arcilla y limo de 0-5 cm en g/kg, proyección Homolosine
  suelo_fino_pct                         SoilGrids 2.0, (arcilla + limo) de 0-5 cm (g/kg / 10) en %

Emisividad fuera de 0.5-1 es relleno: NaN, y los índices la heredan. ASTER se promedia por celda (sus píxeles de
~1 km son más chicos que la celda); el resto usa el píxel que contiene el centro de la celda.

Uso: python e09_material.py [procesos]
"""

from __future__ import annotations

import json
import sys
import time
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path

import numpy as np
from osgeo import gdal, osr

from comun import ruta_env
from comun_tabla import (cargar_malla, celda_de, escribir_columna, indices_en_rejilla, juntar_sumas, muestrear,
                         sumas_por_celda, valor_en)

gdal.UseExceptions()
MINERALES = ["Calcite", "Chlorite", "Dolomite", "Goethite", "Gypsum", "Hematite", "Illite+Muscovite", "Kaolinite",
             "Montmorillonite", "Vermiculite", "Quartz+Feldspar"]


def _h5(ruta: str, var: str) -> np.ndarray:
    return gdal.Open(f'HDF5:"{ruta}"://{var}').ReadAsArray()


def recortar_tesela_aster(
    e_crudo: np.ndarray, la: np.ndarray, lo: np.ndarray, lw: np.ndarray
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Descarta fila y columna de borde repetidas y enmascara emisividad donde LWmap != 0 o fuera de 0.5-1."""
    e = e_crudo[:, :-1, :-1].astype(np.float32) * 0.001
    la_r = la[:-1, :-1]
    lo_r = lo[:-1, :-1]
    lw_r = lw[:-1, :-1]
    e[(e < 0.5) | (e > 1)] = np.nan
    e[:, lw_r != 0] = np.nan
    return e, la_r, lo_r


def indices_aster(e: np.ndarray) -> dict[str, np.ndarray]:
    """Calcula emisividad media e índices QI, MI y CI (Ninomiya 2005) a partir de bandas 10-14."""
    b10, b11, b12, b13, b14 = e
    with np.errstate(invalid="ignore", divide="ignore"):
        return {
            "emis": e.mean(0),
            "qi": b11 * b11 / (b10 * b12),
            "mi": b12 / b13,
            "ci": b13 / b14,
        }


def aster_tesela(ruta: str, salida: str) -> int:
    e, la, lo = recortar_tesela_aster(
        _h5(ruta, "Emissivity/Mean"),
        _h5(ruta, "Geolocation/Latitude"),
        _h5(ruta, "Geolocation/Longitude"),
        _h5(ruta, "Land_Water_Map/LWmap"),
    )
    valores = indices_aster(e)
    ok = np.isfinite(la) & np.isfinite(lo) & (np.abs(la) <= 90)
    if not ok.any():
        return 0
    celdas = celda_de(la[ok], lo[ok], hilos=1)
    s = sumas_por_celda(celdas, {k: v[ok].astype(np.float64) for k, v in valores.items()})
    np.savez(Path(salida) / f"{Path(ruta).stem}.npz", **s)
    return int(ok.sum())


def aster(datos: Path, run: Path, ipix: np.ndarray, procesos: int) -> dict:
    sumas = run / "material" / "aster_celdas"
    sumas.mkdir(parents=True, exist_ok=True)
    hechas = {p.stem for p in sumas.glob("*.npz")}
    tifs = [t for t in sorted((datos / "tierra" / "silice-aster-ged-ag1km").glob("*.h5")) if t.stem not in hechas]
    errores = []
    with ProcessPoolExecutor(procesos) as pool:
        fut = {pool.submit(aster_tesela, str(t), str(sumas)): t.name for t in tifs}
        for f in as_completed(fut):
            try:
                f.result()
            except Exception as ex:  # noqa: BLE001 - toda tesela que falle hace fallar el paso
                errores.append(f"{fut[f]}: {ex}")
    if errores:
        raise SystemExit("ERROR en ASTER:\n" + "\n".join(errores[:20]))
    return juntar_sumas(ipix, sorted(sumas.glob("*.npz")), ["emis", "qi", "mi", "ci"])


def glim(datos: Path, lat, lon) -> np.ndarray:
    ds = gdal.Open(f"/vsizip/{datos.as_posix()}/tierra/litologia-glim-05/hartmann-moosdorf_2012.zip/glim_wgs84_0point5deg.txt.asc")
    a = ds.ReadAsArray().astype(np.float32)
    a[(a < 1) | (a == 15)] = np.nan
    return muestrear(a, lat, lon, ds.GetGeoTransform())


def emit(datos: Path, lat, lon) -> dict:
    ruta = datos / "tierra" / "mineral-emit-l3asa" / "EMIT_L3_ASA_002.nc"
    out = {}
    for m in MINERALES:
        ds = gdal.Open(f'NETCDF:"{ruta}":{m}')
        x0, dx, rx, y0, ry, dy = ds.GetGeoTransform()
        # GDAL lee lat/lon como centros; en EMIT son la esquina superior izquierda: se corre media celda.
        geo = (x0 + dx / 2, dx, rx, y0 + dy / 2, ry, dy)
        a = ds.ReadAsArray().astype(np.float32)
        a[a <= -9999] = np.nan
        out[m] = muestrear(a, lat, lon, geo)
    return out


def soilgrids(datos: Path, lat, lon) -> dict[str, np.ndarray]:
    partes = {}
    for comp in ("clay", "silt"):
        ds = gdal.Open(str(datos / "tierra" / "soilgrids-1km" / f"{comp}_0-5cm_mean_1000.tif"))
        srs = osr.SpatialReference(wkt=ds.GetProjection())
        srs.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
        wgs = osr.SpatialReference()
        wgs.ImportFromEPSG(4326)
        wgs.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
        tr = osr.CoordinateTransformation(wgs, srs)
        a = ds.ReadAsArray()
        v = np.full(lat.size, np.nan, np.float32)
        paso = 2_000_000
        for i in range(0, lat.size, paso):
            xy = np.array(tr.TransformPoints(np.column_stack([lon[i:i + paso], lat[i:i + paso]]).astype(np.float64)))
            f, c, dentro = indices_en_rejilla(xy[:, 1], xy[:, 0], ds.GetGeoTransform(), a.shape)
            crudo = a[f, c]
            w = crudo.astype(np.float32)
            w[(crudo < 0) | ~dentro] = np.nan
            v[i:i + paso] = w
        partes[comp] = v
    return {
        "arcilla": partes["clay"],
        "limo": partes["silt"],
        "fino": (partes["clay"] + partes["silt"]) / 10,
    }


def main() -> int:
    procesos = int(sys.argv[1]) if len(sys.argv) > 1 else 10
    datos, run = ruta_env("DATOS"), ruta_env("RUN")
    t0 = time.time()
    ipix, lat, lon = cargar_malla(run)
    a = aster(datos, run, ipix, procesos)
    print(f"  ASTER listo, {time.time() - t0:.0f} s", flush=True)
    meta_a = {
        "fuente": "ASTER GED AG1km V003 (bandas 10 a 14)",
        "url": "https://lpdaac.usgs.gov/products/ag1kmv003/",
        "licencia": "NASA open data",
        "metodo": "recorte 99x99 por tesela; LWmap != 0 y emisividad fuera de 0.5-1 son NaN; media por celda",
        "advertencias": ["los índices heredan el NaN de cualquier banda anulada"],
    }
    cols = [
        escribir_columna(run, "aster_emis_media", a["emis"], {**meta_a, "unidad": "emisividad"}),
        escribir_columna(run, "aster_qi", a["qi"], {**meta_a, "unidad": "índice (Ninomiya 2005)"}),
        escribir_columna(run, "aster_mi", a["mi"], {**meta_a, "unidad": "índice (Ninomiya 2005)"}),
        escribir_columna(run, "aster_ci", a["ci"], {
            **meta_a, "unidad": "índice (Ninomiya 2005)", "metodo": meta_a["metodo"] + "; B13 / B14"}),
        escribir_columna(run, "glim_clase", glim(datos, lat, lon), {
            "fuente": "GLiM v1.0, malla de 0.5° (Hartmann y Moosdorf 2012)", "url": "https://doi.org/10.1029/2012GC004370",
            "licencia": "CC BY 3.0", "unidad": "clase 1-16", "metodo": "centro de celda; clase 15 (nd) es NaN",
            "advertencias": ["clase 11 (wb) es agua", "0.5° es mucho más grueso que la celda"]}),
    ]
    for m, v in emit(datos, lat, lon).items():
        nombre = "emit_" + m.lower().replace("+", "_")
        cols.append(escribir_columna(run, nombre, v, {
            "fuente": "EMIT L3 ASA V002 (0.5°)", "url": "https://lpdaac.usgs.gov/products/emitl3asav002/",
            "licencia": "NASA open data", "unidad": "abundancia",
            "metodo": "lat/lon como esquina superior izquierda; centro de celda",
            "advertencias": ["a 0.5° se diluyen los minerales locales"]}))
    sg = soilgrids(datos, lat, lon)
    meta_sg = {
        "fuente": "SoilGrids 2.0, arcilla y limo 0-5 cm, 1 km",
        "url": "https://soilgrids.org",
        "licencia": "CC BY 4.0",
        "metodo": "centro de celda transformado a Homolosine",
    }
    cols.extend([
        escribir_columna(run, "arcilla_gkg", sg["arcilla"], {**meta_sg, "unidad": "g/kg"}),
        escribir_columna(run, "limo_gkg", sg["limo"], {**meta_sg, "unidad": "g/kg"}),
        escribir_columna(run, "suelo_fino_pct", sg["fino"], {
            **meta_sg, "unidad": "%", "metodo": "(arcilla + limo) g/kg / 10; " + meta_sg["metodo"]}),
    ])
    qi = a["qi"]
    puntos = {
        "Sahara (Erg Chech)": (24.5, -2.5),
        "Deccan (basalto)": (19.0, 75.5),
        "Meseta de Lut": (30.3, 59.0),
        "Lago Superior": (47.7, -87.5),
    }
    vals = {k: {"qi": valor_en(ipix, qi, *v), "mi": valor_en(ipix, a["mi"], *v)} for k, v in puntos.items()}
    fallos = []
    emis = a["emis"]
    if np.nanmin(emis) < 0.5 or np.nanmax(emis) > 1:
        fallos.append("emisividad fuera de 0.5-1")
    if not vals["Sahara (Erg Chech)"]["qi"] > vals["Deccan (basalto)"]["qi"]:
        fallos.append("el índice de cuarzo del Sahara no supera al del basalto del Deccan")
    if not np.isnan(vals["Lago Superior"]["qi"]):
        fallos.append(f"Lago Superior tiene aster_qi finito: {vals['Lago Superior']['qi']}")
    r = {"puntos": vals, "fallos": fallos, "segundos": round(time.time() - t0, 1)}
    (run / "columns" / "e09.json").write_text(json.dumps({**r, "columnas": cols}, indent=2, ensure_ascii=False),
                                               encoding="utf-8")
    print(json.dumps(r, indent=2, ensure_ascii=False))
    for c in cols:
        print(f"{c['columna']}: cobertura {c['cobertura_pct']} %, p1 {c['p1']}, p50 {c['p50']}, p99 {c['p99']}")
    return 1 if fallos else 0


if __name__ == "__main__":
    sys.exit(main())
