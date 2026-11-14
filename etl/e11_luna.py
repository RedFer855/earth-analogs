"""E-11: valores objetivo de las 9 regiones de Artemis en el polo sur de la Luna.

Polígonos: paquete del USGS (doi 10.5066/P1MEQ6UK) en $DATOS/luna/artemis-regiones-usgs; sus vértices lon/lat se pasan
a la estereográfica polar de cada producto y el polígono se rasteriza sobre una ventana del producto.
  Relieve:      LOLA LDEM_80S_20M V2.1 (km sobre 1737.4 km) -> bloques de 10x10 (200 m) -> pendiente de Horn;
                media y desviación dentro del polígono (misma escala que la Tierra, ADR-005).
  Temperatura:  Diviner GDR L3 polar tbol (240 m): `d` = 6-18 h y `n` = 18-6 h locales; media de todos los periodos
                por píxel, luego media en el polígono. rango_diurno_k = media de (d - n).
Comprobación: en casi todos los píxeles con dato el día es más cálido que la noche.

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


def pendiente_lola(ds, xy):
    c0, f0, w, h, geo = _ventana(ds, xy)
    z = ds.GetRasterBand(1).ReadAsArray(c0, f0, w, h).astype(np.float64) * 1000  # km -> m
    k = 10
    h2, w2 = (h // k) * k, (w // k) * k
    z = z[:h2, :w2].reshape(h2 // k, k, w2 // k, k).mean(axis=(1, 3))
    paso = geo[1] * k
    a_, b_, c_ = z[:-2, :-2], z[:-2, 1:-1], z[:-2, 2:]
    d_, f_ = z[1:-1, :-2], z[1:-1, 2:]
    g_, hh, i_ = z[2:, :-2], z[2:, 1:-1], z[2:, 2:]
    dzdx = ((c_ + 2 * f_ + i_) - (a_ + 2 * d_ + g_)) / (8 * paso)
    dzdy = ((g_ + 2 * hh + i_) - (a_ + 2 * b_ + c_)) / (8 * paso)
    pend = np.degrees(np.arctan(np.hypot(dzdx, dzdy)))
    geo_g = (geo[0] + paso, paso, 0, geo[3] - paso, 0, -paso)
    m = _mascara(xy, pend.shape[1], pend.shape[0], geo_g, ds.GetProjection())
    p = pend[m]
    return float(np.mean(p)), float(np.std(p)), int(p.size)


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
        sm, ss, n = pendiente_lola(lola, xy)
        regiones[k] = {"nombre": p["Region"], "area_km2": p["Area_km2"], "slope_mean_deg": sm, "slope_std_deg": ss,
                       "pixeles_200m": n}
        xy_div[k] = _proyectar(div_ref, anillo)
        print(f"  {k}: pendiente {sm:.2f} ± {ss:.2f}° ({n} px)", flush=True)
    temp, frac_dia, frac_regiones = temperatura_diviner(rutas_d, rutas_n, xy_div)
    for k, v in temp.items():
        regiones[k].update(v)
    # La comprobación de lectura (d = día, n = noche) se hace en el mapa completo. Cerca del polo la hora local deja
    # de separar día y noche (sol rasante), y la fracción dentro de las regiones se informa como advertencia.
    if frac_dia < 0.95:
        fallos.append(f"mapa completo: el día es más cálido que la noche solo en el {100 * frac_dia:.1f} % de los píxeles")
    salida = run / "objetivos"
    salida.mkdir(parents=True, exist_ok=True)
    r = {
        "cuerpo": "luna",
        "fuentes": {
            "regiones": "USGS doi 10.5066/P1MEQ6UK, A3_9regions-lonlat-simplified",
            "relieve": "LOLA LDEM_80S_20M FLOAT V2.1, PDS Geosciences Node",
            "temperatura": f"Diviner GDR L3 polar tbol avg, {len(rutas_d)} periodos de día y {len(rutas_n)} de noche",
        },
        "metodo": "pendiente a 200 m (bloques 10x10 de 20 m, Horn); temperatura media por píxel y luego por polígono",
        "ausentes": ["agua y aridez", "hielo en el suelo (sin columna comparable)", "viento y polvo (sin atmósfera)",
                     "amplitud anual (sin estaciones comparables)"],
        "fraccion_dia_mayor_que_noche_mapa": frac_dia,
        "fraccion_dia_mayor_que_noche_regiones": frac_regiones,
        "advertencias": ["cerca del polo la hora local no separa bien día y noche: el rango diurno de las regiones "
                         "refleja sobre todo la geometría de iluminación"],
        "regiones": regiones,
        "fallos": fallos,
        "segundos": round(time.time() - t0, 1),
    }
    (salida / "objetivos_luna.json").write_text(json.dumps(r, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps({k: v for k, v in r.items() if k != "regiones"}, indent=2, ensure_ascii=False))
    for k, v in regiones.items():
        print(f"{k}: pend {v['slope_mean_deg']:.2f}  día {v.get('lst_dia_k', float('nan')):.1f} K  "
              f"noche {v.get('lst_noche_k', float('nan')):.1f} K  DTR {v.get('rango_diurno_k', float('nan')):.1f} K")
    return 1 if fallos else 0


if __name__ == "__main__":
    sys.exit(main())
