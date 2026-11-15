"""E-03 (columnas por celda): percentiles de pendiente, elevación, rugosidad, relieve y fracción válida.

Mismo método que e03_terreno.py (halo, agua a 90 m, bloques de 2x2 de unos 180 m, Horn), pero cada celda la calcula
entera una sola tesela: la que contiene su centro. La tesela lee un halo de 0.05° de latitud (y 0.05° / cos(lat) de
longitud) para cubrir la celda completa, así los percentiles son exactos sin juntar trozos entre teselas.

Un bloque entra si tiene pendiente y él mismo tiene elevación (Horn solo mira los 8 vecinos: un bloque de agua rodeado
de tierra no tiene pendiente). Rugosidad y relieve en una ventana de 5x5 bloques (unos 900 m) con al menos 19
bloques válidos (los objetivos de la Luna y Marte deben usar el mismo estimador): rugosidad = desviación RMS respecto de la media de la ventana; relieve = máximo -
mínimo de la ventana. Los percentiles son lineales (Hyndman-Fan tipo 7).

Columnas: slope_p90_deg, slope_p99_deg, slope_frac_gt15, elev_mean_m, elev_std_m, relieve_m (máximo - mínimo de los
bloques de la celda), rug_rms_mean_m, rug_rms_p90_m, relieve_mean_m, relieve_p90_m (de la ventana de 5x5) y
frac_valida (bloques válidos / bloques que caben en la celda). Ninguna celda se anula por cobertura (ADR-006): la
fracción válida queda en su columna. Comprobación: la pendiente media recalculada coincide con slope_mean_deg.

Salidas intermedias: $RUN/terreno/celdas/*.npz (una por tesela).

Uso: python e03_extras.py [procesos]
"""

from __future__ import annotations

import json
import sys
import time
import zipfile
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path

import numpy as np
from cdshealpix.nested import healpix_to_lonlat
from numpy.lib.stride_tricks import sliding_window_view
from osgeo import gdal

from comun import NIVEL, NPIX, RADIO_AUTALICO_KM, autalica_a_geodesica, ruta_env
from comun_tabla import cargar_malla, cargar_npz, celda_de, escribir_columna, valor_en
from e01_malla import esquina_tesela
from e03_terreno import LIMITE_POLAR, UMBRAL_GSW, _metros_por_grado, _vecinas, _ventana, horn
import e03_terreno

gdal.UseExceptions()
gdal.SetCacheMax(256 * 1024 * 1024)
HALO_LAT = 0.05
VENTANA = 5
MIN_VALIDOS_VENTANA = 19  # de 25: unos tres cuartos de la ventana
UMBRAL_PEND = 15
AREA_CELDA_M2 = 4 * np.pi * (RADIO_AUTALICO_KM * 1000) ** 2 / NPIX
CLAVES = ("n", "media", "desv", "p90", "p99", "f15", "zmedia", "zdesv", "zmin", "zmax", "esperados",
          "rug_media", "rug_p90", "rel_media", "rel_p90")


def _iniciar(datos: str, gsw_vrt: str) -> None:
    e03_terreno._iniciar(datos, gsw_vrt)


def _caja(a: np.ndarray, k: int) -> np.ndarray:
    """Suma en una ventana de k x k centrada en cada píxel; fuera del arreglo cuenta como 0."""
    r = k // 2
    c = np.pad(np.pad(a, r).cumsum(0).cumsum(1), ((1, 0), (1, 0)))
    return c[k:, k:] - c[:-k, k:] - c[k:, :-k] + c[:-k, :-k]


def ventana(z: np.ndarray, k: int = VENTANA, min_validos: int = MIN_VALIDOS_VENTANA) -> tuple[np.ndarray, np.ndarray]:
    """Rugosidad (desviación RMS respecto de la media de la ventana) y relieve (máximo - mínimo) en k x k.

    NaN si el bloque central no tiene dato o la ventana tiene menos de min_validos bloques válidos.
    """
    v = np.isfinite(z)
    ref = float(np.mean(z[v])) if v.any() else 0.0  # restar una referencia evita perder precisión en z^2
    z0 = np.where(v, z - ref, 0.0).astype(np.float64)
    n = _caja(v.astype(np.float64), k)
    s1, s2 = _caja(z0, k), _caja(z0 * z0, k)
    with np.errstate(invalid="ignore", divide="ignore"):
        m = s1 / n
        var = np.maximum(s2 / n - m * m, 0.0)
    ok = v & (n >= min_validos - 0.5)
    r = k // 2
    zmax = sliding_window_view(np.pad(np.where(v, z, -np.inf), r, constant_values=-np.inf), (k, k)).max(axis=(2, 3))
    zmin = sliding_window_view(np.pad(np.where(v, z, np.inf), r, constant_values=np.inf), (k, k)).min(axis=(2, 3))
    return np.where(ok, np.sqrt(var), np.nan), np.where(ok, zmax - zmin, np.nan)


def cuantil(ordenados: np.ndarray, inicio: np.ndarray, cuenta: np.ndarray, q: float) -> np.ndarray:
    """Cuantil lineal (tipo 7) de cada grupo de valores ya ordenados dentro del grupo."""
    pos = (cuenta - 1) * q
    lo = np.floor(pos).astype(np.int64)
    hi = np.minimum(lo + 1, cuenta - 1)
    w = pos - lo
    return ordenados[inicio + lo] * (1 - w) + ordenados[inicio + hi] * w


def por_celda(celdas: np.ndarray, v: np.ndarray, ip: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Media y percentil 90 de los valores finitos de v por celda, alineados a ip (celdas ordenadas)."""
    media, p90 = np.full(ip.size, np.nan), np.full(ip.size, np.nan)
    k = np.isfinite(v)
    if not k.any():
        return media, p90
    c, x = celdas[k], v[k]
    o = np.lexsort((x, c))
    c, x = c[o], x[o]
    ini = np.flatnonzero(np.r_[True, c[1:] != c[:-1]])
    cnt = np.diff(np.r_[ini, c.size])
    pos = np.searchsorted(ip, c[ini])
    media[pos] = np.add.reduceat(x, ini) / cnt
    p90[pos] = cuantil(x, ini, cnt, 0.90)
    return media, p90


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
    pend = horn(z, (n * dxg)[1:-1, None], (m * dyg)[1:-1, None])
    rug, rel = (a[1:-1, 1:-1] for a in ventana(z))
    zc = z[1:-1, 1:-1]
    la = np.broadcast_to(lat_fila[1:-1, None], pend.shape)
    lo = np.broadcast_to(lon_col[None, 1:-1], pend.shape)
    ok = np.isfinite(pend) & np.isfinite(zc)
    p, zv, rug, rel, la, lo = pend[ok], zc[ok], rug[ok], rel[ok], la[ok], lo[ok]
    if not p.size:
        return 0
    lo = ((lo + 180) % 360) - 180
    celdas = celda_de(la, lo, hilos=1)
    uc = np.unique(celdas)
    lon_c, beta_c = healpix_to_lonlat(uc.astype(np.uint64), NIVEL, num_threads=1)
    lat_c = autalica_a_geodesica(beta_c.deg)
    lon_c = ((lon_c.deg + 180) % 360) - 180
    dentro = (np.floor(lat_c) == lat0) & (np.floor(lon_c) == lon0)
    propias, lat_propias = uc[dentro], lat_c[dentro]
    sel = np.isin(celdas, propias)
    if not sel.any():
        return 0
    celdas, p, zv, rug, rel = celdas[sel], p[sel], zv[sel], rug[sel], rel[sel]
    orden = np.lexsort((p, celdas))
    celdas, p, zv = celdas[orden], p[orden], zv[orden]
    inicio = np.flatnonzero(np.r_[True, celdas[1:] != celdas[:-1]])
    cuenta = np.diff(np.r_[inicio, celdas.size])
    ip = celdas[inicio]
    # bloques que caben en la celda: área de la celda / área de un bloque a la latitud de su centro
    mc, nc = _metros_por_grado(lat_propias[np.searchsorted(propias, ip)])
    esperados = AREA_CELDA_M2 / ((mc * dyg) * (nc * dxg))
    s, s2 = np.add.reduceat(p, inicio), np.add.reduceat(p * p, inicio)
    zs, zs2 = np.add.reduceat(zv, inicio), np.add.reduceat(zv * zv, inicio)
    rug_media, rug_p90 = por_celda(celdas, rug[orden], ip)
    rel_media, rel_p90 = por_celda(celdas, rel[orden], ip)
    np.savez(
        Path(salida) / f"{Path(ruta_dem).stem}.npz",
        ipix=ip, n=cuenta.astype(np.uint32),
        media=s / cuenta, desv=np.sqrt(np.maximum(s2 / cuenta - (s / cuenta) ** 2, 0)),
        p90=cuantil(p, inicio, cuenta, 0.90), p99=cuantil(p, inicio, cuenta, 0.99),
        f15=np.add.reduceat((p > UMBRAL_PEND).astype(np.float64), inicio) / cuenta,
        zmedia=zs / cuenta, zdesv=np.sqrt(np.maximum(zs2 / cuenta - (zs / cuenta) ** 2, 0)),
        zmin=np.minimum.reduceat(zv, inicio), zmax=np.maximum.reduceat(zv, inicio), esperados=esperados,
        rug_media=rug_media, rug_p90=rug_p90, rel_media=rel_media, rel_p90=rel_p90,
    )
    return int(ip.size)


def main() -> int:
    procesos = int(sys.argv[1]) if len(sys.argv) > 1 else 8
    datos, run = ruta_env("DATOS"), ruta_env("RUN")
    t0 = time.time()
    salida = run / "terreno" / "celdas"
    salida.mkdir(parents=True, exist_ok=True)
    gsw_vrt = run / "terreno" / "gsw_occurrence.vrt"
    dems = sorted((datos / "tierra" / "glo90" / "dem").glob("*_DEM.tif"))
    hechas = set()
    for q in salida.glob("*.npz"):
        # Un corte deja archivos a medio escribir: se valida el zip sin abrirlo con numpy (que lo deja abierto al
        # fallar y Windows no deja borrarlo).
        if zipfile.is_zipfile(q):
            try:
                if set(CLAVES) <= set(cargar_npz(q)):
                    hechas.add(q.stem)
                    continue
            except Exception:  # noqa: BLE001 - un archivo cortado se rehace
                pass
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
    for k in CLAVES:
        v = np.full(ipix_m.size, np.nan, np.float32)
        v[pos[en]] = np.concatenate([q[k] for q in partes])[en]
        col[k] = v
    col["frac_valida"] = np.where(np.isfinite(col["n"]), np.minimum(col["n"] / col["esperados"], 1), 0).astype(np.float32)
    ref = np.fromfile(run / "columns" / "slope_mean_deg.f32", dtype=np.float32)
    ambos = np.isfinite(ref) & np.isfinite(col["media"])
    dif = np.abs(ref[ambos] - col["media"][ambos])
    consistencia = {"celdas": int(ambos.sum()), "dif_mediana": float(np.median(dif)), "dif_p99": float(np.percentile(dif, 99)),
                    "frac_dif_mayor_0p1": float(np.mean(dif > 0.1)),
                    "cobertura_ref": float(np.isfinite(ref).mean()), "cobertura_nueva": float(np.isfinite(col["media"]).mean())}
    if consistencia["dif_mediana"] > 0.01:
        fallos.append(f"la pendiente media recalculada difiere de slope_mean_deg: mediana {consistencia['dif_mediana']}")
    fv = col["frac_valida"]
    con_dato = np.isfinite(col["media"])
    distribucion_fv = {f"frac_valida<{u}": float(np.mean(fv[con_dato] < u)) for u in (0.1, 0.25, 0.5, 0.9)}
    meta = {"fuente": "Copernicus DEM GLO-90 release 2024_1 (DEM y WBM); JRC GSW v1.5 occurrence",
            "url": "https://registry.opendata.aws/copernicus-dem/", "licencia": "Copernicus DEM license",
            "metodo": "como E-03; cada celda entera en la tesela de su centro, con halo de 0.05° de latitud; "
                      "bloques con pendiente y elevación propia; percentiles lineales",
            "advertencias": ["GLO-90 es un DSM: bosque y edificios agregan rugosidad",
                             "celdas con poca fracción válida (costa, lagos) se conservan: ver frac_valida"]}
    ficha = meta["advertencias"] + ["para la ficha: no puntúa la semejanza (ADR-005)"]
    met_v = meta["metodo"] + f"; ventana de {VENTANA}x{VENTANA} bloques (~900 m) con >= {MIN_VALIDOS_VENTANA} válidos"
    cols = [
        escribir_columna(run, "slope_p90_deg", col["p90"], {**meta, "unidad": "grados"}),
        escribir_columna(run, "slope_p99_deg", col["p99"], {**meta, "unidad": "grados"}),
        escribir_columna(run, "slope_frac_gt15", col["f15"], {**meta, "unidad": "fracción de bloques de ~180 m"}),
        escribir_columna(run, "elev_mean_m", col["zmedia"], {**meta, "unidad": "m (EGM2008)"}),
        escribir_columna(run, "elev_std_m", col["zdesv"], {**meta, "unidad": "m", "advertencias": ficha}),
        escribir_columna(run, "relieve_m", col["zmax"] - col["zmin"], {**meta, "unidad": "m", "advertencias": ficha}),
        escribir_columna(run, "rug_rms_mean_m", col["rug_media"], {**meta, "metodo": met_v, "unidad": "m", "advertencias": ficha}),
        escribir_columna(run, "rug_rms_p90_m", col["rug_p90"], {**meta, "metodo": met_v, "unidad": "m", "advertencias": ficha}),
        escribir_columna(run, "relieve_mean_m", col["rel_media"], {**meta, "metodo": met_v, "unidad": "m", "advertencias": ficha}),
        escribir_columna(run, "relieve_p90_m", col["rel_p90"], {**meta, "metodo": met_v, "unidad": "m", "advertencias": ficha}),
        escribir_columna(run, "frac_valida", fv, {
            **meta, "unidad": "fracción 0-1",
            "metodo": "bloques de ~180 m con pendiente / área de la celda en bloques a la latitud de su centro; 0 sin dato",
            "distribucion": distribucion_fv}),
    ]
    ok = np.isfinite(col["p90"]) & np.isfinite(ref)
    if np.any(col["p99"][ok] < col["p90"][ok]) or np.any(col["p90"][ok] < 0):
        fallos.append("percentiles fuera de orden")
    con_z = np.isfinite(col["media"]) & ~np.isfinite(col["zmedia"])
    if con_z.any():
        fallos.append(f"{int(con_z.sum())} celdas con pendiente y sin elevación")
    r_ok = np.isfinite(col["rug_p90"]) & np.isfinite(col["rug_media"])
    if np.any(col["rug_media"][r_ok] < 0) or np.any(col["rel_media"][np.isfinite(col["rel_media"])] < 0):
        fallos.append("rugosidad o relieve negativos")
    puntos = {"Everest": (27.988, 86.925), "Mar Muerto (orilla oeste)": (31.45, 35.38), "Uyuni (centro)": (-20.2, -67.6)}
    vals = {k: {"elev": valor_en(ipix_m, col["zmedia"], *v), "relieve": valor_en(ipix_m, col["zmax"] - col["zmin"], *v),
                "rug": valor_en(ipix_m, col["rug_media"], *v), "frac_valida": valor_en(ipix_m, fv, *v)}
            for k, v in puntos.items()}
    if not vals["Everest"]["elev"] > 6000:
        fallos.append(f"Everest con elevación baja: {vals['Everest']['elev']}")
    if not vals["Mar Muerto (orilla oeste)"]["elev"] < 0:
        fallos.append(f"la orilla del Mar Muerto no está bajo el nivel del mar: {vals['Mar Muerto (orilla oeste)']['elev']}")
    if not vals["Everest"]["rug"] > 10 * vals["Uyuni (centro)"]["rug"]:
        fallos.append(f"la rugosidad del Everest no supera 10 veces la de Uyuni: {vals['Everest']['rug']} y {vals['Uyuni (centro)']['rug']}")
    r = {"consistencia_slope_mean": consistencia, "frac_valida": distribucion_fv, "puntos": vals, "fallos": fallos,
         "segundos": round(time.time() - t0, 1)}
    (run / "columns" / "e03_extras.json").write_text(json.dumps({**r, "columnas": cols}, indent=2, ensure_ascii=False),
                                                      encoding="utf-8")
    print(json.dumps(r, indent=2, ensure_ascii=False))
    for c in cols:
        print(f"{c['columna']}: cobertura {c['cobertura_pct']} %, p1 {c['p1']}, p50 {c['p50']}, p99 {c['p99']}")
    return 1 if fallos else 0


if __name__ == "__main__":
    sys.exit(main())
