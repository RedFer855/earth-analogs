"""E-03: pendiente media y desviación de la pendiente por celda (ADR-005).

Por tesela GLO-90: se arma una ventana con un halo de las teselas vecinas, se enmascara el agua a 90 m (mar siempre;
lago o río de la WBM solo si la ocurrencia de JRC GSW es >= 50 % o no hay dato de GSW), se promedia a unos 180 m
(bloques de 2x2 completos), se calcula la pendiente de Horn con el espaciado métrico de cada fila y se suman los
píxeles de la tesela (sin halo) por celda HEALPix. Una segunda fase junta las sumas de todas las teselas.

Entradas: $DATOS/tierra/glo90/{dem,wbm}, $DATOS/tierra/agua-jrc-gsw-v1_5/occurrence
Salidas:  $RUN/terreno/sumas/*.npz, $RUN/columns/slope_mean_deg.f32, slope_std_deg.f32, terreno_n_px.f32

Uso: python e03_terreno.py [procesos] [--solo-unir]
"""

from __future__ import annotations

import json
import sys
import time
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path

import numpy as np
from osgeo import gdal

from comun import A_WGS84, E2, ruta_env
from comun_tabla import cargar_malla, cargar_npz, celda_de, escribir_columna, valor_en
from e01_malla import esquina_tesela

gdal.UseExceptions()
gdal.SetCacheMax(256 * 1024 * 1024)
LIMITE_POLAR = 88  # teselas a menos de 2° de los polos: fuera de alcance
UMBRAL_GSW = 50
HALO_PX = 4

_DATOS: Path | None = None
_GSW: str | None = None


def _iniciar(datos: str, gsw_vrt: str) -> None:
    global _DATOS, _GSW
    _DATOS, _GSW = Path(datos), gsw_vrt


def _ruta(tipo: str, lat: int, lon: int) -> Path:
    ns, ew = ("N" if lat >= 0 else "S"), ("E" if lon >= 0 else "W")
    nombre = f"Copernicus_DSM_COG_30_{ns}{abs(lat):02d}_00_{ew}{abs(lon):03d}_00_{tipo.upper()}.tif"
    return _DATOS / "tierra" / "glo90" / tipo / nombre


def _vecinas(tipo: str, lat: int, lon: int) -> list[str]:
    rutas = []
    for dla in (-1, 0, 1):
        for dlo in (-1, 0, 1):
            lo = ((lon + dlo + 180) % 360) - 180
            r = _ruta(tipo, lat + dla, lo)
            if r.exists():
                rutas.append(str(r))
    return rutas


def _ventana(fuentes, limites, dx, dy, alg, tipo, nodata):
    ds = gdal.Warp(
        "", fuentes, format="MEM", outputBounds=limites, xRes=dx, yRes=dy, resampleAlg=alg,
        outputType=tipo, dstNodata=nodata, multithread=False,
    )
    return ds.GetRasterBand(1).ReadAsArray()


def _metros_por_grado(lat_deg: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    s = np.sin(np.radians(lat_deg))
    w = np.sqrt(1 - E2 * s * s)
    m = A_WGS84 * (1 - E2) / w**3 * np.pi / 180
    n = A_WGS84 / w * np.cos(np.radians(lat_deg)) * np.pi / 180
    return m, n


def procesar_tesela(ruta_dem: str, salida: str) -> dict:
    lat0, lon0 = esquina_tesela(Path(ruta_dem).name)
    ds = gdal.Open(ruta_dem)
    dx_nat = ds.GetGeoTransform()[1]
    dy_nat = -ds.GetGeoTransform()[5]
    ds = None
    hx, hy = HALO_PX * 2 * dx_nat, HALO_PX * 2 * dy_nat
    limites = (lon0 - hx, lat0 - hy, lon0 + 1 + hx, lat0 + 1 + hy)
    dem = _ventana(_vecinas("dem", lat0, lon0), limites, dx_nat, dy_nat, "bilinear", gdal.GDT_Float32, np.nan)
    wbm = _ventana(_vecinas("wbm", lat0, lon0), limites, dx_nat, dy_nat, "near", gdal.GDT_Byte, 255)
    mar = wbm == 1
    lago_rio = np.isin(wbm, (2, 3))
    if lago_rio.any():  # GSW solo hace falta donde la WBM marca lago o río
        gsw = _ventana([_GSW], limites, dx_nat, dy_nat, "average", gdal.GDT_Float32, np.nan)
        lago_rio &= ~np.isfinite(gsw) | (gsw >= UMBRAL_GSW)
    dem = np.where(mar | lago_rio | (wbm == 255), np.nan, dem)

    # bloques de 2x2 completos, a unos 180 m
    f, c = (dem.shape[0] // 2) * 2, (dem.shape[1] // 2) * 2
    b = dem[:f, :c].reshape(f // 2, 2, c // 2, 2)
    z = np.where(np.isfinite(b).all(axis=(1, 3)), b.mean(axis=(1, 3)), np.nan)
    dxg, dyg = 2 * dx_nat, 2 * dy_nat
    lat_fila = limites[3] - (np.arange(z.shape[0]) + 0.5) * dyg
    lon_col = limites[0] + (np.arange(z.shape[1]) + 0.5) * dxg
    m, n = _metros_por_grado(lat_fila)
    sx = (n * dxg)[1:-1, None]
    sy = (m * dyg)[1:-1, None]
    a_, b_, c_ = z[:-2, :-2], z[:-2, 1:-1], z[:-2, 2:]
    d_, f_ = z[1:-1, :-2], z[1:-1, 2:]
    g_, h_, i_ = z[2:, :-2], z[2:, 1:-1], z[2:, 2:]
    dzdx = ((c_ + 2 * f_ + i_) - (a_ + 2 * d_ + g_)) / (8 * sx)
    dzdy = ((g_ + 2 * h_ + i_) - (a_ + 2 * b_ + c_)) / (8 * sy)
    pend = np.degrees(np.arctan(np.hypot(dzdx, dzdy)))
    la = lat_fila[1:-1, None] * np.ones((1, pend.shape[1]))
    lo = lon_col[None, 1:-1] * np.ones((pend.shape[0], 1))
    dentro = (la >= lat0) & (la < lat0 + 1) & (lo >= lon0) & (lo < lon0 + 1) & np.isfinite(pend)
    p, la, lo = pend[dentro], la[dentro], lo[dentro]
    nombre = Path(ruta_dem).stem
    if p.size:
        celdas = celda_de(la, lo, hilos=1)
        u_, inv = np.unique(celdas, return_inverse=True)
        np.savez(
            Path(salida) / f"{nombre}.npz",
            ipix=u_,
            n=np.bincount(inv).astype(np.uint32),
            s=np.bincount(inv, weights=p),
            s2=np.bincount(inv, weights=p * p),
        )
    return {"tesela": nombre, "pixeles": int(p.size)}


def unir(run: Path, sumas: Path) -> dict:
    ipix_m, lat_m, lon_m = cargar_malla(run)
    partes = [cargar_npz(a) for a in sorted(sumas.glob("*.npz"))]
    ip = np.concatenate([q["ipix"] for q in partes])
    n = np.concatenate([q["n"] for q in partes]).astype(np.float64)
    s = np.concatenate([q["s"] for q in partes])
    s2 = np.concatenate([q["s2"] for q in partes])
    u_, inv = np.unique(ip, return_inverse=True)
    n, s, s2 = (np.bincount(inv, weights=x) for x in (n, s, s2))
    pos = np.searchsorted(ipix_m, u_)
    en_malla = (pos < ipix_m.size) & (ipix_m[np.minimum(pos, ipix_m.size - 1)] == u_)
    media = np.full(ipix_m.size, np.nan)
    desv = np.full(ipix_m.size, np.nan)
    cuenta = np.zeros(ipix_m.size)
    k = pos[en_malla]
    cuenta[k] = n[en_malla]
    media[k] = s[en_malla] / n[en_malla]
    var = np.maximum(s2[en_malla] / n[en_malla] - media[k] ** 2, 0)
    desv[k] = np.sqrt(var)
    meta = {
        "fuente": "Copernicus DEM GLO-90 release 2024_1 (DEM y WBM); JRC GSW v1.5 occurrence",
        "url": "https://registry.opendata.aws/copernicus-dem/",
        "licencia": "Copernicus DEM license; JRC GSW: Copernicus open license",
        "metodo": "halo de vecinas, agua a 90 m (mar; lago o río si GSW >= 50 % o sin dato), bloques 2x2 completos "
        "(~180 m), pendiente de Horn con espaciado métrico por fila, agregado por celda",
        "advertencias": [
            "teselas a menos de 2° de los polos no se calculan",
            "el halo no cruza el antimeridiano",
            "GLO-90 es un DSM: bosque y edificios agregan rugosidad",
        ],
    }
    entradas = [
        escribir_columna(run, "slope_mean_deg", media, {**meta, "unidad": "grados"}),
        escribir_columna(run, "slope_std_deg", desv, {**meta, "unidad": "grados"}),
        escribir_columna(run, "terreno_n_px", np.where(cuenta > 0, cuenta, np.nan), {**meta, "unidad": "píxeles de ~180 m"}),
    ]
    fuera = int((~en_malla).sum())
    puntos = {
        "Everest": (27.988, 86.925),
        "Mar Muerto (orilla oeste)": (31.45, 35.38),
        "Uyuni (centro)": (-20.2, -67.6),
        "Lut": (30.3, 59.0),
        "Lago Superior (centro)": (47.7, -87.5),
        "Titicaca (centro)": (-15.9, -69.4),
        "Sahara llano (Erg Chech)": (24.5, -2.5),
    }
    valores = {k: valor_en(ipix_m, media, *v) for k, v in puntos.items()}
    fallos = []
    if not valores["Everest"] > 15:
        fallos.append(f"Everest con pendiente baja: {valores['Everest']}")
    if not (np.isfinite(valores["Uyuni (centro)"]) and valores["Uyuni (centro)"] < 1.5):
        fallos.append(f"Uyuni debe tener pendiente casi nula: {valores['Uyuni (centro)']}")
    for lago in ("Lago Superior (centro)", "Titicaca (centro)"):
        if np.isfinite(valores[lago]):
            fallos.append(f"{lago} debe ser NaN: {valores[lago]}")
    for k in ("Lut", "Mar Muerto (orilla oeste)", "Sahara llano (Erg Chech)"):
        if not np.isfinite(valores[k]):
            fallos.append(f"{k} sin dato")
    return {"teselas_con_datos": len(partes), "celdas_fuera_de_malla": fuera, "puntos": valores,
            "columnas": entradas, "fallos": fallos}


def main() -> int:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    procesos = int(args[0]) if args else 10
    datos, run = ruta_env("DATOS"), ruta_env("RUN")
    sumas = run / "terreno" / "sumas"
    sumas.mkdir(parents=True, exist_ok=True)
    t0 = time.time()
    if "--solo-unir" not in sys.argv:
        gsw_vrt = str(run / "terreno" / "gsw_occurrence.vrt")
        tifs = sorted(str(p) for p in (datos / "tierra" / "agua-jrc-gsw-v1_5" / "occurrence").glob("*.tif"))
        gdal.BuildVRT(gsw_vrt, tifs, srcNodata=255, VRTNodata=255)
        dems = sorted((datos / "tierra" / "glo90" / "dem").glob("*_DEM.tif"))
        hechas = set()
        for p in sumas.glob("*.npz"):
            try:
                np.load(p)["s2"]
                hechas.add(p.stem)
            except Exception:  # noqa: BLE001 - un archivo cortado se borra y se rehace
                p.unlink()
        todas = [d for d in dems if abs(esquina_tesela(d.name)[0] + 0.5) < LIMITE_POLAR]
        pendientes = [d for d in todas if d.stem not in hechas]
        errores = []
        with ProcessPoolExecutor(procesos, initializer=_iniciar, initargs=(str(datos), gsw_vrt)) as pool:
            fut = {pool.submit(procesar_tesela, str(d), str(sumas)): d.name for d in pendientes}
            for i, f in enumerate(as_completed(fut), 1):
                try:
                    f.result()
                except Exception as e:  # noqa: BLE001 - toda tesela que falle se informa y hace fallar el paso
                    errores.append(f"{fut[f]}: {e}")
                if i % 2000 == 0:
                    print(f"  {i}/{len(pendientes)} teselas, {time.time() - t0:.0f} s", flush=True)
        polares = len(dems) - len(todas)
        print(f"teselas: {len(dems)} total, {polares} polares fuera de alcance, {len(pendientes)} procesadas ahora, "
              f"{len(errores)} errores")
        if errores:
            (run / "terreno" / "errores.txt").write_text("\n".join(errores), encoding="utf-8")
            print("\n".join(errores[:20]))
            return 1
    r = unir(run, sumas)
    r["segundos"] = round(time.time() - t0, 1)
    (run / "terreno" / "e03.json").write_text(json.dumps(r, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps({k: v for k, v in r.items() if k != "columnas"}, indent=2, ensure_ascii=False))
    for c in r["columnas"]:
        print(f"{c['columna']}: cobertura {c['cobertura_pct']} %, p50 {c['p50']}, p99 {c['p99']}")
    return 1 if r["fallos"] else 0


if __name__ == "__main__":
    sys.exit(main())
