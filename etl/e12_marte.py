"""E-12: valores objetivo de 12 sitios de Marte (etl/sitios/objetivos-marte.json), en círculos de 50 km de radio.

  Relieve:     HRSC-MOLA blended DEM v2, 200 m (Int16, sin dato -32768; se lee por ventanas) -> parches de ~1.6 km
               con pendiente de Horn (espaciado métrico por fila en esfera de 3396.19 km), cuantiles lineales,
               rugosidad y relieve en ventana 5x5; resumen por sitio con mediana y MAD (escala de celda terrestre).
  Minerales:   TES Bandfield 2002, 4 ppd; el .hdr no trae georreferencia: se asigna (-180, 0.25, 90, -0.25).
               Capas en el orden de la lista de ASU; sin dato -1. Se guardan las 13 capas en el círculo.
  Inercia térmica (contexto): THEMIS Quantitative 100 m (solo 60° S a 60° N), muestreo regular cada 200 m en todo el
               círculo y todos los cuadros que lo cubran; resumen con mediana y MAD, o None si no hay cobertura.
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
from objetivos_comun import parches, puntos_circulo, resumen, resumir_parches

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


def terreno_marte(ds, lat, lon, radio_m):
    """Calcula métricas de terreno en parches de ~1.6 km dentro del círculo de radio_m."""
    geo = ds.GetGeoTransform()
    (c0, f0, w, h), m, lats = _circulo(lat, lon, radio_m, geo, (ds.RasterYSize, ds.RasterXSize))
    z = ds.GetRasterBand(1).ReadAsArray(c0, f0, w, h).astype(np.float64)
    z[z == -32768] = np.nan
    sy = np.radians(-geo[5]) * R_MARTE
    sx = (np.radians(geo[1]) * R_MARTE * np.cos(np.radians(lats)))[:, None]
    ps = parches(z, sx, sy, m)
    terreno = resumir_parches(ps)
    sm = terreno["slope_mean_deg"]["mediana"] if terreno["slope_mean_deg"] else None
    ss = terreno["slope_std_deg"]["mediana"] if terreno["slope_std_deg"] else None
    return sm, ss, int(m.sum()), terreno


def tes(datos: Path):
    ds = gdal.Open(str(datos / "marte" / "tes-minerales-bandfield-2002" / "TES_mineral_maps_4_ppd.envi"))
    a = ds.ReadAsArray().astype(np.float32)  # 13 x 720 x 1440
    a[a == -1] = np.nan
    return a, (-180.0, 0.25, 0.0, 90.0, 0.0, -0.25)


def themis(datos: Path, lat: float, lon_e: float, radio_m: float):
    """Muestrea THEMIS cada 200 m en todo el círculo sobre todos los cuadros y devuelve resumen y lista de cuadros."""
    lats_p, lons_p = puntos_circulo(lat, lon_e, radio_m, R_MARTE, 200.0)
    vals = np.full(lats_p.size, np.nan, dtype=np.float64)
    cuadros: list[str] = []
    for r in sorted((datos / "marte" / "themis-ti-100m").glob("*.tif")):
        if not np.isnan(vals).any():
            break
        ds = gdal.Open(str(r))
        srs = osr.SpatialReference(wkt=ds.GetProjection())
        srs.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
        geo_cs = srs.CloneGeogCS()
        geo_cs.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
        tr = osr.CoordinateTransformation(geo_cs, srs)
        x0, dx, _, y0, _, dy = ds.GetGeoTransform()
        rx, ry = ds.RasterXSize, ds.RasterYSize
        b = ds.GetRasterBand(1)
        nodata = b.GetNoDataValue()
        for usar_180 in (True, False):
            faltan = np.isnan(vals)
            if not faltan.any():
                break
            lons_cand = _lon180_arr(lons_p[faltan]) if usar_180 else (lons_p[faltan] % 360)
            pts = np.column_stack([lons_cand, lats_p[faltan]])
            xy = np.asarray(tr.TransformPoints(pts.tolist()), dtype=np.float64)
            finito = np.isfinite(xy[:, 0]) & np.isfinite(xy[:, 1])
            if not finito.any():
                continue
            c = np.full(xy.shape[0], -1, dtype=np.int64)
            f = np.full(xy.shape[0], -1, dtype=np.int64)
            c[finito] = np.floor((xy[finito, 0] - x0) / dx).astype(np.int64)
            f[finito] = np.floor((xy[finito, 1] - y0) / dy).astype(np.int64)
            en = (c >= 0) & (c < rx) & (f >= 0) & (f < ry)
            if not en.any():
                continue
            c_en, f_en = c[en], f[en]
            c0, c1 = int(c_en.min()), int(c_en.max()) + 1
            f0, f1 = int(f_en.min()), int(f_en.max()) + 1
            arr = b.ReadAsArray(c0, f0, c1 - c0, f1 - f0).astype(np.float64)
            if nodata is not None:
                arr[arr == nodata] = np.nan
            arr[~np.isfinite(arr) | (arr <= 0)] = np.nan
            muestra = arr[f_en - f0, c_en - c0]
            validas = np.isfinite(muestra)
            if validas.any():
                idx_faltan = np.flatnonzero(faltan)[en][validas]
                vals[idx_faltan] = muestra[validas]
                if r.name not in cuadros:
                    cuadros.append(r.name)
    res = resumen(vals)
    return (res, cuadros) if res is not None else (None, None)


def _lon180_arr(lons: np.ndarray) -> np.ndarray:
    return ((lons + 180) % 360) - 180


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
        sm, ss, n, terreno = terreno_marte(dem, s["lat"], lon, radio_m)
        (cc0, ff0, w, h), m, _ = _circulo(s["lat"], lon, radio_m, geo_tes, a_tes.shape[1:])
        minerales = {}
        for idx, nombre in enumerate(CAPAS_TES):
            v = a_tes[idx, ff0:ff0 + h, cc0:cc0 + w][m]
            minerales[f"tes_{nombre}"] = float(np.nanmean(v)) if np.isfinite(v).any() else None
        ti, cuadros = themis(datos, s["lat"], s["lon_e"], radio_m)
        sitios[s["codigo"]] = {"nombre": s["nombre"], "lat": s["lat"], "lon_e": s["lon_e"], "slope_mean_deg": sm,
                               "slope_std_deg": ss, "pixeles_200m": n, "terreno": terreno, **minerales,
                               "themis_ti": ti, "themis_cuadros": cuadros}
        sm_txt = f"{sm:.2f}" if sm is not None else "nan"
        ss_txt = f"{ss:.2f}" if ss is not None else "nan"
        print(f"  {s['codigo']}: pendiente {sm_txt} ± {ss_txt}° ({n} px), hematita {minerales['tes_hematita']}",
              flush=True)
    salida = run / "objetivos"
    salida.mkdir(parents=True, exist_ok=True)
    r = {
        "cuerpo": "marte",
        "fuentes": {"relieve": "HRSC-MOLA blended DEM global 200 m v2 (USGS)", "minerales": "TES Bandfield 2002, 4 ppd",
                    "inercia_termica": "THEMIS global TI mosaic, Quantitative 100 m (contexto)"},
        "metodo": (f"círculo de {lista['radio_km']} km; parches de ~1.6 km a 200 m (Horn, cuantiles lineales, "
                   "ventana 5x5) resumidos con mediana y MAD; medias de las 13 capas TES en el círculo; "
                   "THEMIS muestreado cada 200 m en todo el círculo"),
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
