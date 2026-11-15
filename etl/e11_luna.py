"""E-11: valores objetivo de las 9 regiones de Artemis en el polo sur de la Luna.

Polígonos: paquete del USGS (doi 10.5066/P1MEQ6UK) en $DATOS/luna/artemis-regiones-usgs; sus vértices lon/lat se pasan
a la estereográfica polar de cada producto y el polígono se rasteriza sobre una ventana del producto.
  Relieve:      LOLA LDEM_80S_20M V2.1 (km sobre 1737.4 km; sin dato y |z| > 20 km -> NaN) -> bloques de 10x10
                (200 m, media si >= 50/100 píxeles válidos) -> parches de ~1.6 km (8x8) con pendiente de Horn,
                cuantiles lineales, rugosidad y relieve en ventana 5x5; resumen por región con mediana y MAD
                (misma escala que la celda terrestre, ADR-005).
  Temperatura:  Diviner GDR L3 polar tbol (240 m): `d` = 6-18 h y `n` = 18-6 h locales; media de todos los periodos
                por píxel, luego media en el polígono. rango_diurno_k = media de (d - n).
  Iluminación:  Mazarico et al. 2011 AVGVISIB y LPSR (85S 60 m donde cabe el polígono con 2 km de margen, si no
                75S 120 m), leídos a resolución nativa (sin sobrevistas). Int16 con nodata -32768 -> NaN:
                AVGVISIB (escala 4e-05, offset 0) -> mediana, MAD y p90 de fracción visible;
                LPSR (escala 2.5e-05, offset 0.5) -> binario 0/1 -> fracción de PSR (media).
  Radar CPR:    Mini-RF LRO-L-MRFLRO-5-CDR-MOSAIC-V1.0 (lsz_xxxxx_3cp_piu_90s000_v1, 118.45 m, 1 banda Float32 = CPR);
                nodata ISIS (-3.4028226550889045e+38), negativos y no finitos -> NaN; mediana, MAD y p90 (sin
                recortar CPR > 1).
Comprobación: en casi todos los píxeles con dato el día es más cálido que la noche; iluminación y fracción PSR en [0, 1].

Salida: $RUN/objetivos/objetivos_luna.json

Uso: python e11_luna.py
"""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path

import numpy as np
from osgeo import gdal, ogr, osr

from comun import ruta_env
from objetivos_comun import parches, resumir_parches

gdal.UseExceptions()
MARGEN_M = 2000


def _proyectar(ds, anillo):
    srs = osr.SpatialReference(wkt=ds.GetProjection())
    srs.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    geo = srs.CloneGeogCS()
    geo.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    tr = osr.CoordinateTransformation(geo, srs)
    return np.array(tr.TransformPoints([(x, y) for x, y in anillo]))[:, :2]


def _ventana(ds, xy):
    x0, dx, _, y0, _, dy = ds.GetGeoTransform()
    xmin, xmax = xy[:, 0].min() - MARGEN_M, xy[:, 0].max() + MARGEN_M
    ymin, ymax = xy[:, 1].min() - MARGEN_M, xy[:, 1].max() + MARGEN_M
    c0, c1 = int((xmin - x0) / dx), int(np.ceil((xmax - x0) / dx))
    f0, f1 = int((ymax - y0) / dy), int(np.ceil((ymin - y0) / dy))
    c0, f0 = max(c0, 0), max(f0, 0)
    c1, f1 = min(c1, ds.RasterXSize), min(f1, ds.RasterYSize)
    return c0, f0, c1 - c0, f1 - f0, (x0 + c0 * dx, dx, 0, y0 + f0 * dy, 0, dy)


def _mascara(xy, ancho, alto, geo, srs_wkt):
    mem = gdal.GetDriverByName("MEM").Create("", ancho, alto, 1, gdal.GDT_Byte)
    mem.SetGeoTransform(geo)
    mem.SetProjection(srs_wkt)
    drv = ogr.GetDriverByName("Memory").CreateDataSource("")
    capa = drv.CreateLayer("p", srs=osr.SpatialReference(wkt=srs_wkt))
    anillo = ogr.Geometry(ogr.wkbLinearRing)
    for x, y in xy:
        anillo.AddPoint_2D(float(x), float(y))
    pol = ogr.Geometry(ogr.wkbPolygon)
    pol.AddGeometry(anillo)
    f = ogr.Feature(capa.GetLayerDefn())
    f.SetGeometry(pol)
    capa.CreateFeature(f)
    gdal.RasterizeLayer(mem, [1], capa, burn_values=[1])
    return mem.ReadAsArray().astype(bool)


def terreno_lola(ds, xy):
    """Calcula métricas de terreno en parches de ~1.6 km sobre bloques de 10x10 (200 m) de LOLA."""
    c0, f0, w, h, geo = _ventana(ds, xy)
    banda = ds.GetRasterBand(1)
    nodata = banda.GetNoDataValue()
    z_km = banda.ReadAsArray(c0, f0, w, h).astype(np.float64)
    if nodata is not None:
        z_km[z_km == nodata] = np.nan
    z_km[~np.isfinite(z_km) | (np.abs(z_km) > 20.0)] = np.nan
    z_m = z_km * 1000.0
    k = 10
    h2, w2 = (h // k) * k, (w // k) * k
    b = z_m[:h2, :w2].reshape(h2 // k, k, w2 // k, k)
    ok = np.isfinite(b)
    cnt = ok.sum(axis=(1, 3))
    suma = np.where(ok, b, 0.0).sum(axis=(1, 3))
    z = np.where(cnt >= 50, suma / np.maximum(cnt, 1), np.nan)
    geo_g = (geo[0], geo[1] * k, 0, geo[3], 0, geo[5] * k)
    m = _mascara(xy, z.shape[1], z.shape[0], geo_g, ds.GetProjection())
    ps = parches(z, abs(geo[1] * k), abs(geo[5] * k), m)
    terreno = resumir_parches(ps)
    sm = terreno["slope_mean_deg"]["mediana"] if terreno["slope_mean_deg"] else None
    ss = terreno["slope_std_deg"]["mediana"] if terreno["slope_std_deg"] else None
    return sm, ss, int(m.sum()), terreno


def temperatura_diviner(rutas_d, rutas_n, xy_por_region):
    ref = gdal.Open(str(rutas_d[0]))
    res = {}
    sumas = {}
    for codigo, xy in xy_por_region.items():
        c0, f0, w, h, geo = _ventana(ref, xy)
        m = _mascara(xy, w, h, geo, ref.GetProjection())
        sumas[codigo] = {"win": (c0, f0, w, h), "m": m}
    global_ = {}
    for tipo, rutas in (("d", rutas_d), ("n", rutas_n)):
        acc = {k: [np.zeros(v["m"].shape), np.zeros(v["m"].shape)] for k, v in sumas.items()}
        gs = gc = None
        for r in rutas:
            ds = gdal.Open(str(r))
            b = ds.GetRasterBand(1)
            todo = b.ReadAsArray().astype(np.float64)
            okt = todo != -32768
            gs = np.where(okt, todo * 0.02, 0) if gs is None else gs + np.where(okt, todo * 0.02, 0)
            gc = okt.astype(np.int32) if gc is None else gc + okt
            for k, v in sumas.items():
                a = b.ReadAsArray(*v["win"]).astype(np.float64)
                ok = a != -32768
                acc[k][0] += np.where(ok, a * 0.02, 0)
                acc[k][1] += ok
        for k in sumas:
            with np.errstate(invalid="ignore", divide="ignore"):
                res.setdefault(k, {})[tipo] = acc[k][0] / acc[k][1]
        global_[tipo] = np.where(gc > 0, gs / np.maximum(gc, 1), np.nan)
    okg = np.isfinite(global_["d"]) & np.isfinite(global_["n"])
    frac_global = float(np.mean(global_["d"][okg] > global_["n"][okg]))
    out, dia_mayor, total = {}, 0, 0
    for k, v in sumas.items():
        d, n = res[k]["d"], res[k]["n"]
        ok = v["m"] & np.isfinite(d) & np.isfinite(n)
        dia_mayor += int(np.sum(d[ok] > n[ok]))
        total += int(ok.sum())
        out[k] = {"lst_dia_k": float(np.mean(d[ok])), "lst_noche_k": float(np.mean(n[ok])),
                  "rango_diurno_k": float(np.mean(d[ok] - n[ok])), "pixeles": int(ok.sum())}
    return out, frac_global, dia_mayor / max(total, 1)


NODATA_MAZARICO = -32768
ESCALA_AVGVISIB = 4e-5
OFFSET_AVGVISIB = 0.0
ESCALA_LPSR = 2.5e-5
OFFSET_LPSR = 0.5


def decodificar_escala(
    raw: np.ndarray,
    nodata: float | None,
    escala: float = 1.0,
    offset: float = 0.0,
) -> np.ndarray:
    """Convierte arreglo crudo a float64 aplicando escala/offset y pasando nodata o no finitos a NaN."""
    arr = np.asarray(raw, dtype=np.float64)
    if nodata is not None:
        arr = np.where(arr == nodata, np.nan, arr)
    return np.where(np.isfinite(arr), arr * escala + offset, np.nan)


def _cabe_en_mapa(ds, xy: np.ndarray, margen_m: float = MARGEN_M) -> bool:
    """True si el polígono proyectado más un margen cabe completo dentro del raster."""
    x0, dx, _, y0, _, dy = ds.GetGeoTransform()
    xmin_r = min(x0, x0 + dx * ds.RasterXSize)
    xmax_r = max(x0, x0 + dx * ds.RasterXSize)
    ymin_r = min(y0, y0 + dy * ds.RasterYSize)
    ymax_r = max(y0, y0 + dy * ds.RasterYSize)
    return bool(
        xy[:, 0].min() - margen_m >= xmin_r
        and xy[:, 0].max() + margen_m <= xmax_r
        and xy[:, 1].min() - margen_m >= ymin_r
        and xy[:, 1].max() + margen_m <= ymax_r
    )


def _leer_ventana_escala(ds, xy: np.ndarray, nodata_def: float, escala_def: float, offset_def: float):
    """Lee una ventana a resolución nativa (sin sobrevistas), decodifica y devuelve (valores, mascara)."""
    c0, f0, w, h, geo = _ventana(ds, xy)
    b = ds.GetRasterBand(1)
    raw = b.ReadAsArray(c0, f0, w, h)
    nd = nodata_def if b.GetNoDataValue() is None else b.GetNoDataValue()
    escala = escala_def if b.GetScale() is None else float(b.GetScale())
    offset = offset_def if b.GetOffset() is None else float(b.GetOffset())
    vals = decodificar_escala(raw, nd, escala, offset)
    m = _mascara(xy, w, h, geo, ds.GetProjection())
    return vals, m


def _resumen_med_mad_p90(valores: np.ndarray, mascara: np.ndarray) -> tuple[float | None, float | None, float | None, int]:
    """Mediana, MAD normalizada (1.4826 * MAD), p90 y conteo de píxeles finitos dentro de `mascara`."""
    v = np.asarray(valores, dtype=np.float64)[np.asarray(mascara, dtype=bool)]
    ok = v[np.isfinite(v)]
    if not ok.size:
        return None, None, None, 0
    med = float(np.median(ok))
    mad = float(1.4826 * np.median(np.abs(ok - med)))
    p90 = float(np.percentile(ok, 90))
    return med, mad, p90, int(ok.size)


def resumir_iluminacion(
    visib: np.ndarray,
    lpsr: np.ndarray,
    mascara_vis: np.ndarray,
    mascara_lpsr: np.ndarray | None = None,
) -> dict[str, float | int | None]:
    """Resume visibilidad solar (mediana, MAD, p90) y fracción de PSR (media de LPSR) dentro de la máscara."""
    m_v = np.asarray(mascara_vis, dtype=bool)
    m_p = m_v if mascara_lpsr is None else np.asarray(mascara_lpsr, dtype=bool)
    med, mad, p90, n_v = _resumen_med_mad_p90(visib, m_v)
    p = np.asarray(lpsr, dtype=np.float64)[m_p]
    p_ok = p[np.isfinite(p)]
    psr_frac = float(np.mean(p_ok)) if p_ok.size else None
    return {
        "iluminacion_mediana": med,
        "iluminacion_mad": mad,
        "iluminacion_p90": p90,
        "psr_frac": psr_frac,
        "pixeles_iluminacion": n_v,
        "pixeles_psr": int(p_ok.size),
    }


def iluminacion_mazarico(
    avg_85,
    lpsr_85,
    avg_75,
    lpsr_75,
    anillo: list,
) -> dict[str, float | int | str | None]:
    """Calcula iluminación solar (AVGVISIB) y fracción PSR (LPSR) usando 85S 60 m si cabe, si no 75S 120 m."""
    xy_v85 = _proyectar(avg_85, anillo)
    xy_p85 = _proyectar(lpsr_85, anillo)
    if _cabe_en_mapa(avg_85, xy_v85) and _cabe_en_mapa(lpsr_85, xy_p85):
        mapa = "85S_60M"
        ds_v, ds_p, xy_v, xy_p = avg_85, lpsr_85, xy_v85, xy_p85
    else:
        mapa = "75S_120M"
        ds_v, ds_p = avg_75, lpsr_75
        xy_v, xy_p = _proyectar(ds_v, anillo), _proyectar(ds_p, anillo)
    visib, m_v = _leer_ventana_escala(ds_v, xy_v, NODATA_MAZARICO, ESCALA_AVGVISIB, OFFSET_AVGVISIB)
    lpsr, m_p = _leer_ventana_escala(ds_p, xy_p, NODATA_MAZARICO, ESCALA_LPSR, OFFSET_LPSR)
    res = resumir_iluminacion(visib, lpsr, m_v, m_p)
    return {"iluminacion_mapa": mapa, **res}


def limpiar_minirf_cpr(arr: np.ndarray, nodata: float | None = None) -> np.ndarray:
    """Pasa nodata, negativos y no finitos de Mini-RF CPR a NaN; conserva CPR > 1 sin recortar."""
    cpr = np.asarray(arr, dtype=np.float64).copy()
    if nodata is not None:
        cpr[cpr == nodata] = np.nan
    cpr[~np.isfinite(cpr) | (cpr < 0.0)] = np.nan
    return cpr


def resumir_cpr(cpr: np.ndarray, mascara: np.ndarray) -> dict[str, float | int | None]:
    """Resume Mini-RF CPR con mediana, MAD, p90 y fracción válida dentro de `mascara`."""
    m = np.asarray(mascara, dtype=bool)
    med, mad, p90, n_ok = _resumen_med_mad_p90(cpr, m)
    return {
        "minirf_cpr_mediana": med,
        "minirf_cpr_mad": mad,
        "minirf_cpr_p90": p90,
        "pixeles_minirf": n_ok,
        "minirf_frac_valida": float(n_ok / m.sum()) if m.any() else 0.0,
    }


def radar_minirf(ds_mrf, anillo: list) -> dict[str, float | int | None]:
    """Lee la ventana de Mini-RF CPR para un polígono y devuelve sus estadísticos."""
    xy = _proyectar(ds_mrf, anillo)
    c0, f0, w, h, geo = _ventana(ds_mrf, xy)
    if w <= 0 or h <= 0:
        return resumir_cpr(np.empty((0, 0), dtype=np.float64), np.empty((0, 0), dtype=bool))
    b = ds_mrf.GetRasterBand(1)
    cpr = limpiar_minirf_cpr(b.ReadAsArray(c0, f0, w, h), b.GetNoDataValue())
    m = _mascara(xy, w, h, geo, ds_mrf.GetProjection())
    return resumir_cpr(cpr, m)


def validar_metricas_luna(regiones: dict[str, dict]) -> list[str]:
    """Comprueba rangos físicos de iluminación, fracción PSR y Mini-RF CPR por región."""
    fallos: list[str] = []
    for k, r in regiones.items():
        med_i, p90_i = r.get("iluminacion_mediana"), r.get("iluminacion_p90")
        if med_i is None or p90_i is None:
            fallos.append(f"{k}: sin datos de iluminación AVGVISIB")
        elif not (0.0 <= med_i <= p90_i <= 1.0):
            fallos.append(f"{k}: iluminación fuera de [0, 1] (med={med_i}, p90={p90_i})")

        psr = r.get("psr_frac")
        if psr is None:
            fallos.append(f"{k}: sin datos de fracción PSR (LPSR)")
        elif not (0.0 <= psr <= 1.0):
            fallos.append(f"{k}: fracción PSR fuera de [0, 1]: {psr}")

        cpr_med, cpr_p90 = r.get("minirf_cpr_mediana"), r.get("minirf_cpr_p90")
        if cpr_med is not None and cpr_p90 is not None:
            if not (np.isfinite(cpr_med) and np.isfinite(cpr_p90) and 0.0 <= cpr_med <= cpr_p90):
                fallos.append(f"{k}: Mini-RF CPR inválido (med={cpr_med}, p90={cpr_p90})")
    return fallos


def main() -> int:
    datos, run = ruta_env("DATOS"), ruta_env("RUN")
    t0 = time.time()
    g = json.loads((datos / "luna" / "artemis-regiones-usgs" / "artemis-9-regiones-2024.geojson").read_text(encoding="utf-8"))
    ref = json.loads((Path(__file__).parent / "sitios" / "objetivos-luna.json").read_text(encoding="utf-8"))
    codigos_ref = {r["codigo"]: r for r in ref["regiones"]}
    fallos = []
    if len(g["features"]) != 9 or {f["properties"]["RegionCode"] for f in g["features"]} != set(codigos_ref):
        fallos.append("el paquete del USGS no trae las 9 regiones de la lista")
    lola = gdal.Open(str(datos / "luna" / "lola-ldem-80s-20m" / "ldem_80s_20m_float.lbl"))
    div = datos / "luna" / "diviner-gdr-l3-tbol-polar-sur"
    rutas_d = sorted(div.rglob("*d_240_img.lbl"))
    rutas_n = sorted(div.rglob("*n_240_img.lbl"))
    div_ref = gdal.Open(str(rutas_d[0]))

    dir_maz = datos / "luna" / "iluminacion-mazarico"
    avg_85 = gdal.Open(str(dir_maz / "AVGVISIB_85S_060M_201608.TIF"))
    avg_75 = gdal.Open(str(dir_maz / "AVGVISIB_75S_120M_201608.TIF"))
    lpsr_85 = gdal.Open(str(dir_maz / "LPSR_85S_060M_201608.TIF"))
    lpsr_75 = gdal.Open(str(dir_maz / "LPSR_75S_120M_201608.TIF"))

    ruta_mrf = datos / "luna" / "minirf-lromrf-0005" / "lsz_xxxxx_3cp_piu_90s000_v1.lbl"
    etiq_mrf = ruta_mrf.read_text(encoding="utf-8", errors="replace")
    mrf = gdal.Open(str(ruta_mrf))
    mrf_es_cpr = mrf.RasterCount == 1 and "Circular Polarization Ratio" in etiq_mrf and "CPR = SC / OS" in etiq_mrf
    if not mrf_es_cpr:
        desc_bandas = [mrf.GetRasterBand(i).GetDescription() for i in range(1, mrf.RasterCount + 1)]
        fallos.append(f"Mini-RF no confirma 1 banda CPR en la etiqueta (bandas={mrf.RasterCount}: {desc_bandas})")

    regiones = {}
    xy_div = {}
    for f in g["features"]:
        p = f["properties"]
        anillo = f["geometry"]["coordinates"][0]
        k = p["RegionCode"]
        lon_c = float(np.mean([v[0] for v in anillo[:-1]])) % 360
        lat_c = float(np.mean([v[1] for v in anillo[:-1]]))
        r = codigos_ref.get(k, {})
        if r and (abs(lat_c - r["lat"]) > 0.5):
            fallos.append(f"{k}: centro del polígono ({lat_c:.3f}) lejos del centroide de referencia ({r['lat']})")
        xy = _proyectar(lola, anillo)
        sm, ss, n, terreno = terreno_lola(lola, xy)
        ilum = iluminacion_mazarico(avg_85, lpsr_85, avg_75, lpsr_75, anillo)
        cpr = radar_minirf(mrf, anillo) if mrf_es_cpr else {}
        regiones[k] = {
            "nombre": p["Region"],
            "area_km2": p["Area_km2"],
            "slope_mean_deg": sm,
            "slope_std_deg": ss,
            "pixeles_200m": n,
            "terreno": terreno,
            **ilum,
            **cpr,
        }
        xy_div[k] = _proyectar(div_ref, anillo)
        sm_txt = f"{sm:.2f}" if sm is not None else "nan"
        ss_txt = f"{ss:.2f}" if ss is not None else "nan"
        cpr_med = cpr.get("minirf_cpr_mediana")
        cpr_txt = f"{cpr_med:.2f}" if cpr_med is not None else "nan"
        ilum_med = ilum["iluminacion_mediana"]
        ilum_txt = f"{ilum_med:.3f}" if ilum_med is not None else "nan"
        psr_f = ilum["psr_frac"]
        psr_txt = f"{100 * psr_f:.1f}%" if psr_f is not None else "nan"
        print(
            f"  {k}: pendiente {sm_txt} ± {ss_txt}° ({n} px) | "
            f"ilum {ilum_txt} ({ilum['iluminacion_mapa']}) | "
            f"PSR {psr_txt} | CPR {cpr_txt}",
            flush=True,
        )
    temp, frac_dia, frac_regiones = temperatura_diviner(rutas_d, rutas_n, xy_div)
    for k, v in temp.items():
        regiones[k].update(v)
    # La comprobación de lectura (d = día, n = noche) se hace en el mapa completo. Cerca del polo la hora local deja
    # de separar día y noche (sol rasante), y la fracción dentro de las regiones se informa como advertencia.
    if frac_dia < 0.95:
        fallos.append(f"mapa completo: el día es más cálido que la noche solo en el {100 * frac_dia:.1f} % de los píxeles")
    fallos.extend(validar_metricas_luna(regiones))
    salida = run / "objetivos"
    salida.mkdir(parents=True, exist_ok=True)
    r = {
        "cuerpo": "luna",
        "fuentes": {
            "regiones": "USGS doi 10.5066/P1MEQ6UK, A3_9regions-lonlat-simplified",
            "relieve": "LOLA LDEM_80S_20M FLOAT V2.1, PDS Geosciences Node",
            "temperatura": f"Diviner GDR L3 polar tbol avg, {len(rutas_d)} periodos de día y {len(rutas_n)} de noche",
            "iluminacion": "LOLA Polar Illumination y LPSR (Mazarico et al. 2011), 85S 60 m y 75S 120 m",
            "radar_cpr": "LRO Mini-RF LRO-L-MRFLRO-5-CDR-MOSAIC-V1.0 (lsz_xxxxx_3cp_piu_90s000_v1, 256 ppd / 118.45 m)",
        },
        "metodo": ("bloques 10x10 de 20 m (200 m, >= 50/100 válidos, sin dato y |z|>20 km a NaN) -> parches de ~1.6 km "
                   "(Horn, cuantiles lineales, ventana 5x5) resumidos con mediana y MAD; temperatura media por píxel "
                   "y luego por polígono; iluminación Mazarico AVGVISIB (mediana, MAD y p90) y LPSR (fracción PSR) a "
                   "resolución nativa (85S 60 m si cabe con 2 km de margen, si no 75S 120 m); Mini-RF CPR (mediana, MAD "
                   "y p90, nodata ISIS y <0 a NaN, sin recortar >1)"),
        "ausentes": [
            "agua y aridez",
            "hielo en el suelo (sin columna comparable)",
            "viento y polvo (sin atmósfera)",
            "amplitud anual (sin estaciones comparables)",
            "iluminación solar y PSR (sin equivalente global terrestre con horizonte de relieve)",
            "radar CPR banda S circular híbrida (sin equivalente SAR global terrestre comparable)",
        ],
        "fraccion_dia_mayor_que_noche_mapa": frac_dia,
        "fraccion_dia_mayor_que_noche_regiones": frac_regiones,
        "advertencias": [
            "cerca del polo la hora local no separa bien día y noche: el rango diurno de las regiones "
            "refleja sobre todo la geometría de iluminación",
            "iluminación (AVGVISIB/LPSR) y radar CPR (Mini-RF) son solo contexto del sitio objetivo: no tienen "
            "equivalente directo en la tabla terrestre ni puntúan la semejanza",
            "Mini-RF CPR tiene cobertura parcial (76.8 % de píxeles válidos en el mosaico polar sur, medido el "
            "2026-11-14); valores de CPR > 1 se conservan sin recortar (rugosidad centimétrica o hielo)",
        ],
        "regiones": regiones,
        "fallos": fallos,
        "segundos": round(time.time() - t0, 1),
    }
    (salida / "objetivos_luna.json").write_text(json.dumps(r, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps({k: v for k, v in r.items() if k != "regiones"}, indent=2, ensure_ascii=False))
    for k, v in regiones.items():
        pend_txt = f"{v['slope_mean_deg']:.2f}" if v["slope_mean_deg"] is not None else "nan"
        print(f"{k}: pend {pend_txt}  día {v.get('lst_dia_k', float('nan')):.1f} K  "
              f"noche {v.get('lst_noche_k', float('nan')):.1f} K  DTR {v.get('rango_diurno_k', float('nan')):.1f} K")
    return 1 if fallos else 0


if __name__ == "__main__":
    sys.exit(main())
