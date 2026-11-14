"""E-12: valores objetivo de 12 sitios de Marte (etl/sitios/objetivos-marte.json), en círculos de 50 km de radio.

  Relieve:     HRSC-MOLA blended DEM v2, 200 m (Int16, sin dato -32768; se lee por ventanas) -> pendiente de Horn con
               el espaciado métrico de cada fila en la esfera de 3396.19 km; media y desviación en el círculo.
  Minerales:   TES Bandfield 2002, 4 ppd; el .hdr no trae georreferencia: se asigna (-180, 0.25, 90, -0.25).
               Capas en el orden de la lista de ASU; sin dato -1. Se guarda la hematita y el cuarzo.
  Inercia térmica (contexto): THEMIS Quantitative 100 m, solo entre 60° S y 60° N; si el sitio no cae en un cuadro
               bajado, queda sin dato.
Comprobación: el máximo de hematita de TES entre 60° S y 60° N cae en Meridiani.

Salida: $RUN/objetivos/objetivos_marte.json

Uso: python e12_marte.py
"""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path

import numpy as np
from osgeo import gdal, osr

from comun import ruta_env

gdal.UseExceptions()
R_MARTE = 3396190.0
CAPAS_TES = ["cuarzo", "feldespato_k", "plagioclasa", "anfibol", "piroxeno_bajo_ca", "piroxeno_alto_ca", "olivino",
             "hematita", "sulfatos", "carbonatos", "silicatos_lamina_vidrio", "polvo_superficial", "error_rms"]


def _lon180(lon_e: float) -> float:
    return ((lon_e + 180) % 360) - 180


def _circulo(lat, lon, radio_m, geo, forma):
    """Ventana (c0, f0, w, h) y máscara de un círculo en una rejilla lat/lon, con distancia de gran círculo."""
    x0, dx, _, y0, _, dy = geo
    dlat = np.degrees(radio_m / R_MARTE)
    dlon = dlat / max(np.cos(np.radians(lat)), 0.05)
    c0 = int((lon - dlon - x0) / dx)
    c1 = int(np.ceil((lon + dlon - x0) / dx))
    f0 = int((lat + dlat - y0) / dy)
    f1 = int(np.ceil((lat - dlat - y0) / dy))
    c0, f0 = max(c0, 0), max(f0, 0)
    c1, f1 = min(c1, forma[1]), min(f1, forma[0])
    lats = y0 + (np.arange(f0, f1) + 0.5) * dy
    lons = x0 + (np.arange(c0, c1) + 0.5) * dx
    la, lo = np.meshgrid(np.radians(lats), np.radians(lons), indexing="ij")
    p1, l1 = np.radians(lat), np.radians(lon)
    d = 2 * np.arcsin(np.sqrt(np.sin((la - p1) / 2) ** 2 + np.cos(p1) * np.cos(la) * np.sin((lo - l1) / 2) ** 2))
    return (c0, f0, c1 - c0, f1 - f0), d * R_MARTE <= radio_m, lats


def pendiente(ds, lat, lon, radio_m):
    geo = ds.GetGeoTransform()
    (c0, f0, w, h), m, lats = _circulo(lat, lon, radio_m, geo, (ds.RasterYSize, ds.RasterXSize))
    z = ds.GetRasterBand(1).ReadAsArray(c0, f0, w, h).astype(np.float64)
    z[z == -32768] = np.nan
    sy = np.radians(-geo[5]) * R_MARTE
    sx = (np.radians(geo[1]) * R_MARTE * np.cos(np.radians(lats)))[1:-1, None]
    a_, b_, c_ = z[:-2, :-2], z[:-2, 1:-1], z[:-2, 2:]
    d_, f_ = z[1:-1, :-2], z[1:-1, 2:]
    g_, hh, i_ = z[2:, :-2], z[2:, 1:-1], z[2:, 2:]
    dzdx = ((c_ + 2 * f_ + i_) - (a_ + 2 * d_ + g_)) / (8 * sx)
    dzdy = ((g_ + 2 * hh + i_) - (a_ + 2 * b_ + c_)) / (8 * sy)
    p = np.degrees(np.arctan(np.hypot(dzdx, dzdy)))[m[1:-1, 1:-1]]
    p = p[np.isfinite(p)]
    return float(np.mean(p)), float(np.std(p)), int(p.size)


def tes(datos: Path):
    ds = gdal.Open(str(datos / "marte" / "tes-minerales-bandfield-2002" / "TES_mineral_maps_4_ppd.envi"))
    a = ds.ReadAsArray().astype(np.float32)  # 13 x 720 x 1440
    a[a == -1] = np.nan
    return a, (-180.0, 0.25, 0.0, 90.0, 0.0, -0.25)


def themis(datos: Path, lat, lon_e):
    """Mediana de 11x11 píxeles de 100 m alrededor del sitio, si algún cuadro bajado lo cubre."""
    for r in sorted((datos / "marte" / "themis-ti-100m").glob("*.tif")):
        ds = gdal.Open(str(r))
        srs = osr.SpatialReference(wkt=ds.GetProjection())
        srs.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
        geo_cs = srs.CloneGeogCS()
        geo_cs.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
        tr = osr.CoordinateTransformation(geo_cs, srs)
        x0, dx, _, y0, _, dy = ds.GetGeoTransform()
        for lon in (_lon180(lon_e), lon_e):
            x, y, _ = tr.TransformPoint(lon, lat)
            c, f = int((x - x0) / dx), int((y - y0) / dy)
            if 5 <= c < ds.RasterXSize - 5 and 5 <= f < ds.RasterYSize - 5:
                b = ds.GetRasterBand(1)
                v = b.ReadAsArray(c - 5, f - 5, 11, 11).astype(np.float64)
                if b.GetNoDataValue() is not None:
                    v[v == b.GetNoDataValue()] = np.nan
                v[v <= 0] = np.nan
                return (float(np.nanmedian(v)) if np.isfinite(v).any() else None), r.name
    return None, None


def main() -> int:
    datos, run = ruta_env("DATOS"), ruta_env("RUN")
    t0 = time.time()
    lista = json.loads((Path(__file__).parent / "sitios" / "objetivos-marte.json").read_text(encoding="utf-8"))
    radio_m = lista["radio_km"] * 1000
    dem = gdal.Open(str(datos / "marte" / "hrsc-mola-blend-200m" / "Mars_HRSC_MOLA_BlendDEM_Global_200mp_v2.tif"))
    a_tes, geo_tes = tes(datos)
    fallos = []
    # máximo de hematita entre 60° S y 60° N
    hem = a_tes[CAPAS_TES.index("hematita")]
    f60 = slice(int((90 - 60) / 0.25), int((90 + 60) / 0.25))
    sub = hem[f60]
    f, c = np.unravel_index(np.nanargmax(sub), sub.shape)
    lat_max = 90 - (f60.start + f + 0.5) * 0.25
    lon_max = -180 + (c + 0.5) * 0.25
    meridiani = abs(lat_max - (-2)) < 5 and abs(lon_max - (-5)) < 10
    if not meridiani:
        fallos.append(f"el máximo de hematita cae en ({lat_max}, {lon_max}), no en Meridiani")
    sitios = {}
    for s in lista["sitios"]:
        lon = _lon180(s["lon_e"])
        sm, ss, n = pendiente(dem, s["lat"], lon, radio_m)
        (cc0, ff0, w, h), m, _ = _circulo(s["lat"], lon, radio_m, geo_tes, a_tes.shape[1:])
        minerales = {}
        for nombre in ("hematita", "cuarzo", "olivino", "polvo_superficial"):
            v = a_tes[CAPAS_TES.index(nombre), ff0:ff0 + h, cc0:cc0 + w][m]
            minerales[f"tes_{nombre}"] = float(np.nanmean(v)) if np.isfinite(v).any() else None
        ti, cuadro = themis(datos, s["lat"], s["lon_e"])
        sitios[s["codigo"]] = {"nombre": s["nombre"], "lat": s["lat"], "lon_e": s["lon_e"], "slope_mean_deg": sm,
                               "slope_std_deg": ss, "pixeles_200m": n, **minerales, "themis_ti_mediana": ti,
                               "themis_cuadro": cuadro}
        print(f"  {s['codigo']}: pendiente {sm:.2f} ± {ss:.2f}° ({n} px), hematita {minerales['tes_hematita']}", flush=True)
    salida = run / "objetivos"
    salida.mkdir(parents=True, exist_ok=True)
    r = {
        "cuerpo": "marte",
        "fuentes": {"relieve": "HRSC-MOLA blended DEM global 200 m v2 (USGS)", "minerales": "TES Bandfield 2002, 4 ppd",
                    "inercia_termica": "THEMIS global TI mosaic, Quantitative 100 m (contexto)"},
        "metodo": f"círculo de {lista['radio_km']} km; pendiente de Horn a 200 m; medias de TES en el círculo",
        "ausentes": ["temperatura, presión y viento (Mars Climate Database: uso local, pendiente)",
                     "agua y aridez (no comparables)"],
        "hematita_maxima_60S_60N": {"lat": lat_max, "lon": lon_max, "en_meridiani": bool(meridiani)},
        "sitios": sitios,
        "fallos": fallos,
        "segundos": round(time.time() - t0, 1),
    }
    (salida / "objetivos_marte.json").write_text(json.dumps(r, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps({k: v for k, v in r.items() if k != "sitios"}, indent=2, ensure_ascii=False))
    return 1 if fallos else 0


if __name__ == "__main__":
    sys.exit(main())
