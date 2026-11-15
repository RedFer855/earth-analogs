"""E-02: comprobación de fuentes antes de cualquier capa.

Para cada fuente de docs/data-sources.md: existe, cuántos archivos y bytes tiene, y se abre una muestra (primero, medio
y último) con el lector que corresponde. Las series mensuales se comprueban por meses distintos, no por archivos.
También mide el espacio libre de $DATOS y $RUN.

Salida: $RUN/fuentes/e02.json. Sale con código 1 si una fuente falta, no se abre o no tiene los periodos esperados.

Uso: python e02_fuentes.py
"""

from __future__ import annotations

import gzip
import json
import re
import shutil
import sys
import zipfile
from pathlib import Path

from osgeo import gdal

from comun import ruta_env

gdal.UseExceptions()

# (nombre, carpeta bajo $DATOS, patrón, periodos esperados o None, regex de periodo)
FUENTES = [
    ("GLO-90 DEM", "tierra/glo90/dem", "*_DEM.tif", None, None),
    ("GLO-90 WBM", "tierra/glo90/wbm", "*_WBM.tif", None, None),
    ("JRC GSW v1.5", "tierra/agua-jrc-gsw-v1_5", "*.tif", None, None),
    ("ASTER GED", "tierra/silice-aster-ged-ag1km", "*.h5", None, None),
    # 12 meses x 10 años
    ("MYD11C3 LST", "tierra/temperatura-myd11c3-2013-2022", "*.hdf", 120, r"\.A(\d{7})\."),
    # 23 periodos de 16 días x 10 años
    ("MOD13C1 NDVI", "tierra/vegetacion-mod13c1-2013-2022", "*.hdf", 230, r"\.A(\d{7})\."),
    ("MERRA-2 viento", "tierra/merra2-viento-1de5-2013-2022", "*.nc4", None, None),
    ("MERRA-2 u*", "tierra/merra2-ustar-horario", "*.nc4", None, None),
    ("MERRA-2 polvo", "tierra/merra2-polvo-mensual", "*.nc4", 120, r"\.(\d{6})\."),
    ("MODFDS", "tierra/modfds-tormentas-polvo", "*.nc", None, None),
    ("Global Aridity Index", "tierra/aridez-global-ai-v3_1", "*.zip", None, None),
    ("Obu permafrost", "tierra/permafrost-obu-2018", "*.zip", None, None),
    ("GLiM", "tierra/litologia-glim-05", "*.zip", None, None),
    ("EMIT L3 ASA", "tierra/mineral-emit-l3asa", "*.nc", None, None),
    ("GLWD v2", "tierra/glwd-v2", "*.zip", None, None),
    ("GSDP30", "tierra/dunas-gsdp30", "*.zip", None, None),
    ("GSDS30", "tierra/dunas-gsds30", "*.zip", None, None),
    ("Pyroduct", "tierra/cuevas-pyroduct-v3", "*.zip", None, None),
    ("Cráteres Wikidata", "tierra/crateres-wikidata", "*.json", None, None),
    ("Natural Earth Playas", "tierra/playas-natural-earth", "*.zip", None, None),
    ("Karjalainen", "tierra/hielo-karjalainen-2022", "*.tif", None, None),
    ("Li 2024 cielo visible", "tierra/iluminacion-li-2024", "*.nc", None, None),
    ("SoilGrids", "tierra/soilgrids-1km", "*.tif", None, None),
    ("LOLA LDEM_80S_20M", "luna/lola-ldem-80s-20m", "*.lbl", None, None),
    ("LOLA Barker 5 m", "luna/lola-5m-barker", "*.tif", None, None),
    ("Mazarico iluminación", "luna/iluminacion-mazarico", "*.TIF", None, None),
    ("Diviner L3 polar", "luna/diviner-gdr-l3-tbol-polar-sur", "*.lbl", None, None),
    ("Diviner PRP", "luna/diviner-prp-polo-sur", "*.zip", None, None),
    ("Diviner H", "luna/diviner-h-hayne-2017", "*.fits", None, None),
    ("Diviner CF", "luna/diviner-cf-lucey-2021", "*.tiff", None, None),
    ("Mini-RF", "luna/minirf-lromrf-0005", "*.lbl", None, None),
    ("HRSC-MOLA 200 m", "marte/hrsc-mola-blend-200m", "*.tif", None, None),
    ("CTX/HiRISE DTM", "marte/dtm-ctx-hirise-sitios", "*.tif", None, None),
    ("THEMIS TI", "marte/themis-ti-100m", "*.tif", None, None),
    ("TES inercia", "marte/tes-inercia-putzig-mellon", "*.zip", None, None),
    ("TES minerales", "marte/tes-minerales-bandfield-2002", "*.hdr", None, None),
    ("MDAD", "marte/mdad-v1_1", "*.gz", None, None),
    ("Montabone polvo", "marte/polvo-montabone-v2", "*.gz", None, None),
    ("MCD 6.2", "marte/mcd-6.2", "*.gz", None, None),
    ("MGC3", "marte/mgc3", "*.csv", None, None),
]


def abrir(ruta: Path) -> str:
    """Abre un archivo con el lector que le corresponde y devuelve una descripción corta."""
    suf = ruta.suffix.lower()
    if suf == ".zip":
        with zipfile.ZipFile(ruta) as z:
            return f"zip con {len(z.namelist())} entradas"
    if suf == ".gz":
        with gzip.open(ruta, "rb") as g:
            return f"gzip legible ({len(g.read(1 << 20))} B leídos)"
    if suf == ".json":
        with ruta.open(encoding="utf-8") as f:
            d = json.load(f)
        n = len(d["results"]["bindings"]) if isinstance(d, dict) and "results" in d else len(d)
        return f"json con {n} registros"
    if suf == ".csv":
        with ruta.open(encoding="utf-8", errors="replace") as f:
            return f"csv, cabecera: {f.readline().strip()[:60]}"
    if suf == ".fits":
        from astropy.io import fits

        with fits.open(ruta, memmap=True) as h:
            return f"fits, {len(h)} HDU, {h[0].header.get('NAXIS1')}x{h[0].header.get('NAXIS2')}"
    if suf == ".hdr":
        ruta = ruta.with_suffix("")
    ds = gdal.Open(str(ruta))
    subs = ds.GetSubDatasets()
    if subs and ds.RasterCount == 0:
        return f"{ds.GetDriver().ShortName}, {len(subs)} subdatasets"
    return f"{ds.GetDriver().ShortName}, {ds.RasterXSize}x{ds.RasterYSize}x{ds.RasterCount}"


def comprobar(datos: Path, nombre, carpeta, patron, esperados, rx) -> dict:
    d = datos / carpeta
    r = {"fuente": nombre, "carpeta": carpeta, "ok": True, "errores": []}
    archivos = sorted(d.rglob(patron)) if d.is_dir() else []
    r["archivos"] = len(archivos)
    r["bytes"] = sum(a.stat().st_size for a in d.rglob("*") if a.is_file()) if d.is_dir() else 0
    if not archivos:
        r["ok"] = False
        r["errores"].append("sin archivos")
        return r
    muestra = {archivos[0], archivos[len(archivos) // 2], archivos[-1]}
    r["muestra"] = {}
    for a in sorted(muestra):
        try:
            r["muestra"][a.name] = abrir(a)
        except Exception as e:  # noqa: BLE001 - se informa cualquier fallo de lectura
            r["ok"] = False
            r["errores"].append(f"{a.name}: {e}")
    if esperados is not None:
        periodos = {m.group(1) for a in archivos if (m := re.search(rx, a.name))}
        r["periodos"] = len(periodos)
        r["duplicados"] = len(archivos) - len(periodos)
        if len(periodos) != esperados:
            r["ok"] = False
            r["errores"].append(f"{len(periodos)} periodos distintos; se esperaban {esperados}")
    return r


def main() -> int:
    datos, run = ruta_env("DATOS"), ruta_env("RUN")
    run.mkdir(parents=True, exist_ok=True)
    resultados = [comprobar(datos, *f) for f in FUENTES]
    disco = {
        "datos_libre_gb": round(shutil.disk_usage(datos).free / 1e9, 1),
        "run_libre_gb": round(shutil.disk_usage(run).free / 1e9, 1),
    }
    malas = [r["fuente"] for r in resultados if not r["ok"]]
    salida = run / "fuentes"
    salida.mkdir(exist_ok=True)
    informe = {"fuentes": resultados, "disco": disco, "fallan": malas}
    (salida / "e02.json").write_text(json.dumps(informe, indent=2, ensure_ascii=False), encoding="utf-8")
    for r in resultados:
        estado = "ok   " if r["ok"] else "FALLA"
        extra = f" periodos={r['periodos']} duplicados={r['duplicados']}" if "periodos" in r else ""
        print(f"{estado} {r['fuente']:<24} {r['archivos']:>6} archivos {r['bytes'] / 1e9:8.2f} GB{extra}")
        for e in r["errores"]:
            print(f"      {e}")
    print(f"disco: {disco}")
    print(f"fallan: {malas or 'ninguna'}")
    return 1 if malas else 0


if __name__ == "__main__":
    sys.exit(main())
