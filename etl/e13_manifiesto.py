"""E-13: manifiesto y verificación independiente (ADR-008).

1. Comprobaciones de tabla: cada columna mide lo mismo que la malla, sin infinitos, ipix ascendente y único.
2. Relectura independiente: para una muestra aleatoria de celdas (semilla fija) se vuelve a leer la fuente por otro
   camino (lectura directa del píxel con ReadRaster, sin las funciones del ETL) y se compara con la columna.
3. Ubicación del máximo de cada columna.
4. manifest.json: malla, columnas con su entrada, fuentes de E-02, commit y fecha.

El paso 1 y el 3 se guardan por columna en $RUN/cache/e13_columnas.json: una columna se vuelve a leer solo si cambió
su .f32, su .json o la malla (tamaño y fecha de modificación). --completo ignora la caché.

Uso: python e13_manifiesto.py [muestra] [--completo]
"""

from __future__ import annotations

import json
import struct
import subprocess
import sys
import time
from pathlib import Path

import numpy as np
from osgeo import gdal

from comun import geodesica_a_autalica, ruta_env  # noqa: F401 - geodesica_a_autalica documenta la convención
from comun_tabla import cargar_malla

gdal.UseExceptions()
SEMILLA = 20261114
VERSION_CACHE = 1


def _huella(ruta: Path) -> list[int]:
    s = ruta.stat()
    return [s.st_size, s.st_mtime_ns]


def revisar_columnas(run: Path, ipix, lat, lon, completo: bool = False) -> tuple[dict, list[str], int]:
    """Comprueba cada columna (largo, infinitos) y ubica su máximo; reusa lo de la caché si nada cambió.

    Devuelve (entradas por columna, fallos, columnas que se leyeron del disco).
    """
    ruta_cache = run / "cache" / "e13_columnas.json"
    malla = _huella(run / "grid" / "ipix.u32") + _huella(run / "grid" / "lat.f32") + _huella(run / "grid" / "lon.f32")
    cache = {}
    if ruta_cache.exists() and not completo:
        try:
            previa = json.loads(ruta_cache.read_text(encoding="utf-8"))
            if previa.get("version") == VERSION_CACHE and previa.get("malla") == malla:
                cache = previa.get("columnas", {})
        except (json.JSONDecodeError, OSError):  # una caché rota se ignora y se rehace
            cache = {}
    columnas, fallos, nueva, releidas = {}, [], {}, 0
    for js in sorted((run / "columns").glob("*.json")):
        f32 = run / "columns" / f"{js.stem}.f32"
        if not f32.exists():
            continue
        e = json.loads(js.read_text(encoding="utf-8"))
        if f32.stat().st_size != ipix.size * 4:
            fallos.append(f"{js.stem}: {f32.stat().st_size} bytes; se esperaban {ipix.size * 4}")
            continue
        huella = _huella(f32) + _huella(js)
        previa = cache.get(js.stem)
        if previa is not None and previa.get("huella") == huella:
            r = previa
        else:
            v = np.fromfile(f32, dtype=np.float32)
            releidas += 1
            r = {"huella": huella, "infinitos": bool(np.isinf(v).any()), "maximo_en": None}
            if np.isfinite(v).any():
                i = int(np.nanargmax(v))
                r["maximo_en"] = {"lat": float(lat[i]), "lon": float(lon[i]), "valor": float(v[i])}
        if r["infinitos"]:
            fallos.append(f"{js.stem}: tiene infinitos")
        if r["maximo_en"] is not None:
            e["maximo_en"] = r["maximo_en"]
        columnas[js.stem] = e
        nueva[js.stem] = r
    ruta_cache.parent.mkdir(parents=True, exist_ok=True)
    tmp = ruta_cache.with_suffix(".tmp")
    tmp.write_text(json.dumps({"version": VERSION_CACHE, "malla": malla, "columnas": nueva}), encoding="utf-8")
    tmp.replace(ruta_cache)
    return columnas, fallos, releidas


def _pixel(ruta: str, lat: float, lon: float, tipo: str):
    """Lee un píxel con ReadRaster crudo: camino distinto del de los pasos del ETL."""
    ds = gdal.Open(ruta)
    x0, dx, _, y0, _, dy = ds.GetGeoTransform()
    c, f = int(np.floor((lon - x0) / dx)), int(np.floor((lat - y0) / dy))
    if not (0 <= c < ds.RasterXSize and 0 <= f < ds.RasterYSize):
        return None
    b = ds.GetRasterBand(1)
    crudo = b.ReadRaster(c, f, 1, 1)
    return struct.unpack(tipo, crudo)[0]


def releer_aridez(datos: Path, lat, lon, columna):
    z = f"/vsizip/{datos.as_posix()}/tierra/aridez-global-ai-v3_1/Global-AI_ET0__annual_v3_1.zip/Global-AI_ET0__annual_v3_1/ai_v31_yr.tif"
    dif = []
    for la, lo, v in zip(lat, lon, columna):
        if la >= 80:
            continue
        crudo = _pixel(z, float(la), float(lo), "<H")
        ref = np.nan if crudo in (None, 65535) else crudo / 10000
        if np.isfinite(ref) or np.isfinite(v):
            dif.append(abs(ref - v) if (np.isfinite(ref) and np.isfinite(v)) else np.inf)
    return dif


def releer_ndvi_un_periodo(datos: Path, lat, lon, columna):
    """El máximo nunca puede ser menor que el valor válido de un periodo cualquiera."""
    a = sorted((datos / "tierra" / "vegetacion-mod13c1-2013-2022").glob("*.hdf"))[115]
    sub = [s[0] for s in gdal.Open(str(a)).GetSubDatasets()]
    ndvi = [s for s in sub if s.endswith('"CMG 0.05 Deg 16 days NDVI"')][0]
    fiab = [s for s in sub if s.endswith('"CMG 0.05 Deg 16 days pixel reliability"')][0]
    viq = [s for s in sub if s.endswith('"CMG 0.05 Deg 16 days VI Quality"')][0]
    malos = 0
    revisados = 0
    for la, lo, v in zip(lat, lon, columna):
        n = _pixel(ndvi, float(la), float(lo), "<h")
        r = _pixel(fiab, float(la), float(lo), "<b")
        q = _pixel(viq, float(la), float(lo), "<H")
        # misma regla que E-05 (fiabilidad 0 o 1; VI Quality bits 11-13 en 1 tierra o 2 costa u orilla), escrita aparte
        # a propósito: si E-05 cambia la regla y esta no, la relectura lo marca
        tierra = q is not None and q != 65535 and ((q >> 11) & 0b111) in (1, 2)
        if n is None or r is None or r not in (0, 1) or not tierra or n <= -3000 or not np.isfinite(v):
            continue
        revisados += 1
        if n / 10000 > v + 1e-6:
            malos += 1
    return revisados, malos


def _pendiente_utm(datos: Path, lat: float, lon: float, ipix: int) -> float:
    """Pendiente media de la celda por otro camino: GLO-90 crudo -> UTM a 200 m (media) -> gdaldem slope (Horn).

    No usa el código de E-03 ni su máscara de agua: se llama solo para celdas sin agua (frac_tierra = 1).
    """
    from osgeo import osr

    from comun_tabla import celda_de

    rutas = []
    for dla in (-1, 0, 1):
        for dlo in (-1, 0, 1):
            a, b = int(np.floor(lat)) + dla, int(np.floor(lon)) + dlo
            ns, ew = ("N" if a >= 0 else "S"), ("E" if b >= 0 else "W")
            r = datos / "tierra" / "glo90" / "dem" / f"Copernicus_DSM_COG_30_{ns}{abs(a):02d}_00_{ew}{abs(b):03d}_00_DEM.tif"
            if r.exists():
                rutas.append(str(r))
    vrt = gdal.BuildVRT("", rutas)
    utm = osr.SpatialReference()
    utm.SetWellKnownGeogCS("WGS84")
    utm.SetUTM(int((lon + 180) // 6) + 1, lat >= 0)
    wgs = osr.SpatialReference(osr.SRS_WKT_WGS84_LAT_LONG)
    for s in (utm, wgs):
        s.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    ida = osr.CoordinateTransformation(wgs, utm)
    e = np.array(ida.TransformPoints([(lon + dx, lat + dy) for dx in (-0.06, 0.06) for dy in (-0.06, 0.06)]))
    w = gdal.Warp("", vrt, format="MEM", dstSRS=utm.ExportToWkt(), xRes=200, yRes=200, resampleAlg="average",
                  outputBounds=(e[:, 0].min(), e[:, 1].min(), e[:, 0].max(), e[:, 1].max()), dstNodata=-9999)
    p = gdal.DEMProcessing("", w, "slope", format="MEM", alg="Horn").ReadAsArray().astype(np.float64)
    gt = w.GetGeoTransform()
    f, c = np.indices(p.shape)
    xy = np.column_stack([(gt[0] + (c + 0.5) * gt[1]).ravel(), (gt[3] + (f + 0.5) * gt[5]).ravel()])
    ll = np.array(osr.CoordinateTransformation(utm, wgs).TransformPoints(xy))
    m = (celda_de(ll[:, 1], ll[:, 0]) == ipix) & (p.ravel() > -9000)
    return float(p.ravel()[m].mean()) if m.any() else float("nan")


def releer_pendiente(datos: Path, run: Path, ipix, lat, lon, n: int = 40) -> dict:
    sm = np.fromfile(run / "columns" / "slope_mean_deg.f32", dtype=np.float32)
    ruta_ft = run / "columns" / "frac_tierra.f32"
    ft = np.fromfile(ruta_ft, dtype=np.float32) if ruta_ft.exists() else np.ones_like(sm)
    rng = np.random.default_rng(SEMILLA + 1)
    cand = np.flatnonzero(np.isfinite(sm) & (ft >= 0.999) & (np.abs(lat) < 60))
    k = rng.choice(cand, size=min(n, cand.size), replace=False)
    ref = np.array([_pendiente_utm(datos, float(lat[i]), float(lon[i]), int(ipix[i])) for i in k])
    ok = np.isfinite(ref)
    d = np.abs(sm[k][ok] - ref[ok])
    return {"celdas": int(ok.sum()), "error_mediano_deg": float(np.median(d)), "error_p90_deg": float(np.percentile(d, 90))}


def main() -> int:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    muestra = int(args[0]) if args else 300
    datos, run = ruta_env("DATOS"), ruta_env("RUN")
    t0 = time.time()
    ipix, lat, lon = cargar_malla(run)
    fallos, avisos = [], []
    if not np.all(np.diff(ipix.astype(np.int64)) > 0):
        fallos.append("ipix no es ascendente y único")
    columnas, fallos_col, releidas = revisar_columnas(run, ipix, lat, lon, completo="--completo" in sys.argv)
    fallos += fallos_col
    print(f"columnas: {len(columnas)}, releídas {releidas}, tomadas de la caché {len(columnas) - releidas}", flush=True)
    rng = np.random.default_rng(SEMILLA)
    k = rng.choice(ipix.size, size=min(muestra, ipix.size), replace=False)
    relectura = {}
    if "aridez_ai" in columnas:
        ai = np.fromfile(run / "columns" / "aridez_ai.f32", dtype=np.float32)
        d = releer_aridez(datos, lat[k], lon[k], ai[k])
        malas = int(np.sum(np.array(d) > 1e-4))
        relectura["aridez_ai"] = {"comparadas": len(d), "distintas": malas}
        if malas:
            fallos.append(f"aridez_ai: {malas} de {len(d)} celdas no coinciden al releer la fuente")
    if "ndvi_max" in columnas:
        nd = np.fromfile(run / "columns" / "ndvi_max.f32", dtype=np.float32)
        rev, malos = releer_ndvi_un_periodo(datos, lat[k], lon[k], nd[k])
        relectura["ndvi_max"] = {"comparadas": rev, "periodo_mayor_que_maximo": malos}
        if malos:
            fallos.append(f"ndvi_max: {malos} celdas con un periodo mayor que el máximo")
    if "slope_mean_deg" in columnas:
        p = releer_pendiente(datos, run, ipix, lat, lon)
        relectura["slope_mean_deg"] = {**p, "metodo": "GLO-90 crudo a UTM 200 m y gdaldem slope, celdas sin agua"}
        if not p["error_mediano_deg"] < 0.5:
            fallos.append(f"slope_mean_deg: error mediano {p['error_mediano_deg']:.2f}° contra el método UTM")
    try:
        commit = subprocess.run(["git", "rev-parse", "HEAD"], capture_output=True, text=True, check=True).stdout.strip()
    except Exception:  # noqa: BLE001 - sin git el manifiesto lo dice
        commit = "no disponible"
    try:  # el manifiesto dice si el código que corrió tenía cambios sin commit
        arbol_limpio = subprocess.run(["git", "status", "--porcelain", "--untracked-files=no"], capture_output=True,
                                      text=True, check=True).stdout.strip() == ""
    except Exception:  # noqa: BLE001
        arbol_limpio = None
    e02 = run / "fuentes" / "e02.json"
    malla = json.loads((run / "grid" / "grid.json").read_text(encoding="utf-8"))
    objetivos = {c: (json.loads((run / "objetivos" / f"objetivos_{c}.json").read_text(encoding="utf-8"))
                     if (run / "objetivos" / f"objetivos_{c}.json").exists() else "no disponible")
                 for c in ("luna", "marte")}
    # campos de licencia restringida (ADR-007, regla 6): no salen en ningún archivo público
    local_only = sorted({f"objetivos.{c}.{campo}" for c, o in objetivos.items() if isinstance(o, dict)
                         for campo in o.get("local_only", [])})
    manifiesto = {
        "generado": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "commit": commit,
        "arbol_limpio": arbol_limpio,
        "nivel_healpix": malla.get("nivel"),
        "n_celdas": malla.get("celdas"),
        "malla": malla,
        "fuentes_e02": json.loads(e02.read_text(encoding="utf-8"))["fuentes"] if e02.exists() else "no disponible",
        "columnas": columnas,
        "relectura_independiente": relectura,
        "objetivos": objetivos,
        "indicadores": {
            "cobertura_por_columna": {k: v["cobertura_pct"] for k, v in columnas.items()},
            "acuerdo_con_analogos_documentados": "no medido (requiere el motor)",
        },
        "local_only": local_only,
        "avisos": avisos,
        "fallos": fallos,
    }
    (run / "manifest.json").write_text(json.dumps(manifiesto, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"columnas: {len(columnas)}")
    for c, e in columnas.items():
        m = e.get("maximo_en", {})
        print(f"  {c:<24} cobertura {e['cobertura_pct']:>7} %  máx {m.get('valor')} en ({m.get('lat')}, {m.get('lon')})")
    print(json.dumps({"relectura": relectura, "fallos": fallos, "segundos": round(time.time() - t0, 1)},
                     indent=2, ensure_ascii=False))
    return 1 if fallos else 0


if __name__ == "__main__":
    sys.exit(main())
