"""E-03 (columnas extra): percentiles de pendiente, fracción sobre 15°, elevación y relieve por celda.

Mismo método que e03_terreno.py (halo, agua a 90 m, bloques de 2x2, Horn), pero cada celda la calcula entera una sola
tesela: la que contiene su centro. La tesela lee un halo de 0.05° de latitud (y 0.05° / cos(lat) de longitud) para
cubrir la celda completa, así los percentiles son exactos sin juntar trozos entre teselas.

Columnas: slope_p90_deg, slope_p99_deg, slope_frac_gt15, elev_mean_m, elev_std_m, relieve_m (máximo - mínimo de los
bloques de ~180 m). Comprobación: la pendiente media recalculada debe coincidir con slope_mean_deg (ya verificada).

Uso: python e03_extras.py [procesos]
"""

from __future__ import annotations

import json
import sys
import time
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path

import numpy as np
from cdshealpix.nested import healpix_to_lonlat
from osgeo import gdal

from comun import NIVEL, autalica_a_geodesica, ruta_env
from comun_tabla import cargar_malla, cargar_npz, celda_de, escribir_columna, valor_en
from e01_malla import esquina_tesela
from e03_terreno import LIMITE_POLAR, UMBRAL_GSW, _metros_por_grado, _vecinas, _ventana
import e03_terreno

gdal.UseExceptions()
gdal.SetCacheMax(256 * 1024 * 1024)
HALO_LAT = 0.05


def _iniciar(datos: str, gsw_vrt: str) -> None:
    e03_terreno._iniciar(datos, gsw_vrt)


def tesela(ruta_dem: str, salida: str) -> int:
    lat0, lon0 = esquina_tesela(Path(ruta_dem).name)
    ds = gdal.Open(ruta_dem)
    dx_nat, dy_nat = ds.GetGeoTransform()[1], -ds.GetGeoTransform()[5]
    ds = None
    hx_deg = min(HALO_LAT / max(np.cos(np.radians(max(abs(lat0), abs(lat0 + 1)))), 0.05), 0.5)
    # halo en un número par de píxeles: los bloques de 2x2 quedan alineados igual que en e03_terreno.py
    hy = int(np.ceil(HALO_LAT / dy_nat / 2)) * 2 * dy_nat
    hx = int(np.ceil(hx_deg / dx_nat / 2)) * 2 * dx_nat
    limites = (lon0 - hx, lat0 - hy, lon0 + 1 + hx, lat0 + 1 + hy)
    dem = _ventana(_vecinas("dem", lat0, lon0), limites, dx_nat, dy_nat, "bilinear", gdal.GDT_Float32, np.nan)
    wbm = _ventana(_vecinas("wbm", lat0, lon0), limites, dx_nat, dy_nat, "near", gdal.GDT_Byte, 255)
    mar = wbm == 1
    lago_rio = np.isin(wbm, (2, 3))
    if lago_rio.any():
        gsw = _ventana([e03_terreno._GSW], limites, dx_nat, dy_nat, "average", gdal.GDT_Float32, np.nan)
        lago_rio &= ~np.isfinite(gsw) | (gsw >= UMBRAL_GSW)
    dem = np.where(mar | lago_rio | (wbm == 255), np.nan, dem)
    f, c = (dem.shape[0] // 2) * 2, (dem.shape[1] // 2) * 2
    b = dem[:f, :c].reshape(f // 2, 2, c // 2, 2)
    z = np.where(np.isfinite(b).all(axis=(1, 3)), b.mean(axis=(1, 3)), np.nan)
    dxg, dyg = 2 * dx_nat, 2 * dy_nat
    lat_fila = limites[3] - (np.arange(z.shape[0]) + 0.5) * dyg
    lon_col = limites[0] + (np.arange(z.shape[1]) + 0.5) * dxg
    m, n = _metros_por_grado(lat_fila)
    sx, sy = (n * dxg)[1:-1, None], (m * dyg)[1:-1, None]
    a_, b_, c_ = z[:-2, :-2], z[:-2, 1:-1], z[:-2, 2:]
    d_, f_ = z[1:-1, :-2], z[1:-1, 2:]
    g_, h_, i_ = z[2:, :-2], z[2:, 1:-1], z[2:, 2:]
    dzdx = ((c_ + 2 * f_ + i_) - (a_ + 2 * d_ + g_)) / (8 * sx)
    dzdy = ((g_ + 2 * h_ + i_) - (a_ + 2 * b_ + c_)) / (8 * sy)
    pend = np.degrees(np.arctan(np.hypot(dzdx, dzdy)))
    zc = z[1:-1, 1:-1]
    la = np.broadcast_to(lat_fila[1:-1, None], pend.shape)
    lo = np.broadcast_to(lon_col[None, 1:-1], pend.shape)
    ok = np.isfinite(pend)
    p, zv, la, lo = pend[ok], zc[ok], la[ok], lo[ok]
    if not p.size:
        return 0
    lo = ((lo + 180) % 360) - 180
    celdas = celda_de(la, lo, hilos=1)
    uc = np.unique(celdas)
    lon_c, beta_c = healpix_to_lonlat(uc.astype(np.uint64), NIVEL, num_threads=1)
    lat_c = autalica_a_geodesica(beta_c.deg)
    lon_c = ((lon_c.deg + 180) % 360) - 180
    propias = uc[(np.floor(lat_c) == lat0) & (np.floor(lon_c) == lon0)]
    sel = np.isin(celdas, propias)
    if not sel.any():
        return 0
    celdas, p, zv = celdas[sel], p[sel], zv[sel]
    orden = np.lexsort((p, celdas))
    celdas, p = celdas[orden], p[orden]
    zv = zv[orden]
    inicio = np.flatnonzero(np.r_[True, celdas[1:] != celdas[:-1]])
    cuenta = np.diff(np.r_[inicio, celdas.size])
    ip = celdas[inicio]

    def rango(q):
        return p[inicio + np.floor(q * (cuenta - 1)).astype(np.int64)]

    s = np.add.reduceat(p, inicio)
    s2 = np.add.reduceat(p * p, inicio)
    zs = np.add.reduceat(zv, inicio)
    zs2 = np.add.reduceat(zv * zv, inicio)
    np.savez(
        Path(salida) / f"{Path(ruta_dem).stem}.npz",
        ipix=ip, n=cuenta.astype(np.uint32),
        media=s / cuenta, desv=np.sqrt(np.maximum(s2 / cuenta - (s / cuenta) ** 2, 0)),
        p90=rango(0.90), p99=rango(0.99), f15=np.add.reduceat((p > 15).astype(np.float64), inicio) / cuenta,
        zmedia=zs / cuenta, zdesv=np.sqrt(np.maximum(zs2 / cuenta - (zs / cuenta) ** 2, 0)),
        zmin=np.minimum.reduceat(zv, inicio), zmax=np.maximum.reduceat(zv, inicio),
    )
    return int(ip.size)


def main() -> int:
    procesos = int(sys.argv[1]) if len(sys.argv) > 1 else 10
    datos, run = ruta_env("DATOS"), ruta_env("RUN")
    t0 = time.time()
    salida = run / "terreno" / "extras"
    salida.mkdir(parents=True, exist_ok=True)
    gsw_vrt = run / "terreno" / "gsw_occurrence.vrt"
    dems = sorted((datos / "tierra" / "glo90" / "dem").glob("*_DEM.tif"))
    hechas = set()
    for q in salida.glob("*.npz"):
        try:
            cargar_npz(q)
            hechas.add(q.stem)
        except Exception:  # noqa: BLE001 - un archivo cortado se rehace
            q.unlink()
    todas = [d for d in dems if abs(esquina_tesela(d.name)[0] + 0.5) < LIMITE_POLAR]
    pendientes = [d for d in todas if d.stem not in hechas]
    errores = []
    with ProcessPoolExecutor(procesos, initializer=_iniciar, initargs=(str(datos), str(gsw_vrt))) as pool:
        fut = {pool.submit(tesela, str(d), str(salida)): d.name for d in pendientes}
        for i, f in enumerate(as_completed(fut), 1):
            try:
                f.result()
            except Exception as e:  # noqa: BLE001 - toda tesela que falle hace fallar el paso
                errores.append(f"{fut[f]}: {e}")
            if i % 2000 == 0:
                print(f"  {i}/{len(pendientes)} teselas, {time.time() - t0:.0f} s", flush=True)
    print(f"teselas: {len(todas)}, procesadas ahora {len(pendientes)}, errores {len(errores)}")
    if errores:
        print("\n".join(errores[:20]))
        return 1
    ipix_m, lat, lon = cargar_malla(run)
    partes = [cargar_npz(q) for q in sorted(salida.glob("*.npz"))]
    ip = np.concatenate([q["ipix"] for q in partes])
    fallos = []
    if np.unique(ip).size != ip.size:
        fallos.append("una celda quedó en más de una tesela")
    pos = np.searchsorted(ipix_m, ip)
    en = (pos < ipix_m.size) & (ipix_m[np.minimum(pos, ipix_m.size - 1)] == ip)
    col = {}
    for k in ("media", "p90", "p99", "f15", "zmedia", "zdesv", "zmin", "zmax"):
        v = np.full(ipix_m.size, np.nan, np.float32)
        v[pos[en]] = np.concatenate([q[k] for q in partes])[en]
        col[k] = v
    ref = np.fromfile(run / "columns" / "slope_mean_deg.f32", dtype=np.float32)
    ambos = np.isfinite(ref) & np.isfinite(col["media"])
    dif = np.abs(ref[ambos] - col["media"][ambos])
    consistencia = {"celdas": int(ambos.sum()), "dif_mediana": float(np.median(dif)), "dif_p99": float(np.percentile(dif, 99)),
                    "cobertura_ref": float(np.isfinite(ref).mean()), "cobertura_nueva": float(np.isfinite(col["media"]).mean())}
    if consistencia["dif_mediana"] > 0.01:
        fallos.append(f"la pendiente media recalculada difiere de slope_mean_deg: mediana {consistencia['dif_mediana']}")
    meta = {"fuente": "Copernicus DEM GLO-90 release 2024_1 (DEM y WBM); JRC GSW v1.5 occurrence",
            "url": "https://registry.opendata.aws/copernicus-dem/", "licencia": "Copernicus DEM license",
            "metodo": "como E-03; cada celda entera en la tesela de su centro, con halo de 0.05° de latitud",
            "advertencias": ["GLO-90 es un DSM: bosque y edificios agregan rugosidad"]}
    cols = [
        escribir_columna(run, "slope_p90_deg", col["p90"], {**meta, "unidad": "grados"}),
        escribir_columna(run, "slope_p99_deg", col["p99"], {**meta, "unidad": "grados"}),
        escribir_columna(run, "slope_frac_gt15", col["f15"], {**meta, "unidad": "fracción de bloques de ~180 m"}),
        escribir_columna(run, "elev_mean_m", col["zmedia"], {**meta, "unidad": "m (EGM2008)"}),
        escribir_columna(run, "elev_std_m", col["zdesv"], {**meta, "unidad": "m", "advertencias": meta["advertencias"] + ["rugosidad para la ficha: no puntúa la semejanza"]}),
        escribir_columna(run, "relieve_m", col["zmax"] - col["zmin"], {**meta, "unidad": "m", "advertencias": meta["advertencias"] + ["relieve para la ficha: no puntúa la semejanza"]}),
    ]
    ok = np.isfinite(col["p90"]) & np.isfinite(ref)
    if np.any(col["p99"][ok] < col["p90"][ok]) or np.any(col["p90"][ok] < 0):
        fallos.append("percentiles fuera de orden")
    puntos = {"Everest": (27.988, 86.925), "Mar Muerto (orilla oeste)": (31.45, 35.38), "Uyuni (centro)": (-20.2, -67.6)}
    vals = {k: {"elev": valor_en(ipix_m, col["zmedia"], *v), "relieve": valor_en(ipix_m, col["zmax"] - col["zmin"], *v)}
            for k, v in puntos.items()}
    if not vals["Everest"]["elev"] > 6000:
        fallos.append(f"Everest con elevación baja: {vals['Everest']['elev']}")
    if not vals["Mar Muerto (orilla oeste)"]["elev"] < 0:
        fallos.append(f"la orilla del Mar Muerto no está bajo el nivel del mar: {vals['Mar Muerto (orilla oeste)']['elev']}")
    r = {"consistencia_slope_mean": consistencia, "puntos": vals, "fallos": fallos, "segundos": round(time.time() - t0, 1)}
    (run / "columns" / "e03_extras.json").write_text(json.dumps({**r, "columnas": cols}, indent=2, ensure_ascii=False),
                                                      encoding="utf-8")
    print(json.dumps(r, indent=2, ensure_ascii=False))
    for c in cols:
        print(f"{c['columna']}: cobertura {c['cobertura_pct']} %, p1 {c['p1']}, p50 {c['p50']}, p99 {c['p99']}")
    return 1 if fallos else 0


if __name__ == "__main__":
    sys.exit(main())
