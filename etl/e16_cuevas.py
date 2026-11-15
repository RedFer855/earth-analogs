"""Paso E-16: catalogar tubos de lava verificados de Pyroduct v3.0 sobre la malla HEALPix.

Lee `etl/sitios/cuevas-pyroduct-coordenadas.json`, verifica el archivo comprimido de
Pyroduct en `$DATOS/tierra/cuevas-pyroduct-v3/*.zip` sin `openpyxl` y produce:
- `cueva_n_tubos`: conteo de sistemas volcánicos verificados por celda (`NaN` fuera)
- `cueva_dist_km`: distancia geodésica esférica mínima (km) al tubo verificado más cercano
"""

from __future__ import annotations

import hashlib
import json
import math
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

import numpy as np

from comun import ruta_env
from comun_tabla import cargar_malla, celda_de, escribir_columna, valor_en

RADIO_TIERRA_KM = 6371.0072
SUBDIR_DATOS = Path("tierra") / "cuevas-pyroduct-v3"
JSON_DEFECTO = Path(__file__).resolve().parent / "sitios" / "cuevas-pyroduct-coordenadas.json"
NS_XML = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"

LICENCIA_RESUMEN = (
    "CC BY 4.0 (Pyroduct v3.0 10.5281/zenodo.14535885, García et al. 2021, "
    "Martínez et al. 2026, Nicolosi et al., Bell et al. 2022 DRUM); "
    "ODbL 1.0 (© colaboradores de OpenStreetMap); CC0 1.0 (Wikidata y Plazi)"
)


def sha256_archivo(ruta: Path) -> str:
    h = hashlib.sha256()
    with ruta.open("rb") as f:
        while chunk := f.read(1 << 20):
            h.update(chunk)
    return h.hexdigest()


def _extraer_texto_celda(celda: ET.Element, compartidas: list[str]) -> str:
    tipo = celda.attrib.get("t", "")
    if tipo == "inlineStr":
        return "".join(celda.itertext()).strip()
    v = celda.find(f"{NS_XML}v")
    if v is None or v.text is None:
        return ""
    if tipo == "s":
        return compartidas[int(v.text)].strip()
    return v.text.strip()


def leer_codigos_zip(ruta_zip: Path) -> set[str]:
    """Extrae los códigos del índice en la columna A del XLSX dentro del ZIP."""
    with zipfile.ZipFile(ruta_zip) as zf:
        xlsx = next((n for n in zf.namelist() if n.lower().endswith(".xlsx")), None)
        if not xlsx:
            raise FileNotFoundError(f"No hay hoja .xlsx dentro de {ruta_zip}")
        with zf.open(xlsx) as fx, zipfile.ZipFile(fx) as zxl:
            compartidas: list[str] = []
            if "xl/sharedStrings.xml" in zxl.namelist():
                sr = ET.fromstring(zxl.read("xl/sharedStrings.xml"))
                compartidas = ["".join(si.itertext()) for si in sr.findall(f"{NS_XML}si")]
            hoja = ET.fromstring(zxl.read("xl/worksheets/sheet1.xml"))
            codigos: set[str] = set()
            for fila in hoja.findall(f".//{NS_XML}row"):
                primera = fila.find(f"{NS_XML}c")
                if primera is None or not primera.attrib.get("r", "").startswith("A"):
                    continue
                val = _extraer_texto_celda(primera, compartidas)
                if val and "." in val and val != "NOTES:":
                    codigos.add(val)
    if not codigos:
        raise ValueError(f"No se encontraron códigos Pyroduct en {ruta_zip}")
    return codigos


def cargar_cuevas_verificadas(
    ruta_json: Path,
    codigos_zip: set[str] | None = None,
) -> tuple[dict, list[dict]]:
    """Carga el JSON curado, valida códigos/coordenadas y agrupa sistemas duplicados."""
    data = json.loads(ruta_json.read_text(encoding="utf-8"))
    cuevas = data.get("cuevas", [])
    if not cuevas:
        raise ValueError(f"Sin registros en {ruta_json}")

    por_grupo: dict[str, dict] = {}
    for rec in cuevas:
        if rec.get("estado") != "verificado":
            if rec.get("lat") is not None or rec.get("lon") is not None:
                raise ValueError(f"Registro no verificado {rec.get('codigo')} con coordenadas")
            continue
        codigo = rec["codigo"]
        if codigos_zip is not None and codigo not in codigos_zip:
            raise ValueError(f"Código curado {codigo} no aparece en el ZIP de Pyroduct")
        lat, lon = float(rec["lat"]), float(rec["lon"])
        if not (-90.0 <= lat <= 90.0 and -180.0 <= lon <= 180.0):
            raise ValueError(f"Coordenada fuera de rango en {codigo}: {(lat, lon)}")
        grupo = rec.get("grupo_sistema") or codigo
        if grupo not in por_grupo:
            por_grupo[grupo] = {
                "grupo_sistema": grupo,
                "codigos": [codigo],
                "lat": lat,
                "lon": lon,
                "nombre": rec["nombre"],
                "pais": rec["pais"],
            }
        else:
            prev = por_grupo[grupo]
            if abs(prev["lat"] - lat) > 1e-4 or abs(prev["lon"] - lon) > 1e-4:
                raise ValueError(f"Grupo {grupo} tiene coordenadas distintas: {prev} vs {rec}")
            prev["codigos"].append(codigo)
    return data, list(por_grupo.values())


def agregar_tubos_en_malla(
    ipix_malla: np.ndarray,
    lats: np.ndarray,
    lons: np.ndarray,
) -> tuple[np.ndarray, np.ndarray, list[int]]:
    """Cuenta sistemas de tubos de lava por celda HEALPix (`NaN` si no hay ninguno)."""
    n_tubos = np.full(ipix_malla.size, np.nan, dtype=np.float32)
    celdas = celda_de(np.asarray(lats, dtype=np.float64), np.asarray(lons, dtype=np.float64))
    idx = np.searchsorted(ipix_malla, celdas)
    dentro = (idx < ipix_malla.size) & (ipix_malla[np.minimum(idx, ipix_malla.size - 1)] == celdas)
    conteo = np.zeros(ipix_malla.size, dtype=np.int32)
    np.add.at(conteo, idx[dentro], 1)
    hay = conteo > 0
    n_tubos[hay] = conteo[hay].astype(np.float32)
    fuera = [int(i) for i in np.flatnonzero(~dentro)]
    return n_tubos, celdas, fuera


def distancia_minima_km(
    lat_malla: np.ndarray,
    lon_malla: np.ndarray,
    lats_cueva: np.ndarray,
    lons_cueva: np.ndarray,
    lote: int = 1_000_000,
) -> np.ndarray:
    """Calcula distancia esférica mínima (km) por cuerda 3D en bloques de memoria acotada."""
    lats_c = np.radians(np.asarray(lats_cueva, dtype=np.float64))
    lons_c = np.radians(np.asarray(lons_cueva, dtype=np.float64))
    if lats_c.size == 0:
        raise ValueError("Se requiere al menos una cueva verificada para calcular distancias")
    cx = np.cos(lats_c) * np.cos(lons_c)
    cy = np.cos(lats_c) * np.sin(lons_c)
    cz = np.sin(lats_c)

    out = np.empty(lat_malla.size, dtype=np.float32)
    for ini in range(0, lat_malla.size, lote):
        fin = min(ini + lote, lat_malla.size)
        phi = np.radians(lat_malla[ini:fin].astype(np.float64))
        lam = np.radians(lon_malla[ini:fin].astype(np.float64))
        cos_p = np.cos(phi)
        dx = (cos_p * np.cos(lam))[:, None] - cx[None, :]
        dy = (cos_p * np.sin(lam))[:, None] - cy[None, :]
        dz = np.sin(phi)[:, None] - cz[None, :]
        cuerda = np.sqrt(np.min(dx * dx + dy * dy + dz * dz, axis=1))
        out[ini:fin] = (2.0 * RADIO_TIERRA_KM * np.arcsin(np.minimum(1.0, 0.5 * cuerda))).astype(
            np.float32
        )
    return out


def comprobar_puntos(
    ipix: np.ndarray,
    n_tubos: np.ndarray,
    dist_km: np.ndarray,
) -> list[dict]:
    """Verifica sitios de control dentro y fuera del catálogo curado."""
    casos = [
        ("Cueva de los Verdes (Lanzarote)", 29.160423, -13.439365, "dentro", 1),
        ("Lava River Cave (Oregón)", 43.894851, -121.369544, "dentro", 1),
        ("Lava Beds Ship/Skull Cave (CA)", 41.731167, -121.506075, "dentro", 2),
        ("Sahara central (fuera catálogo)", 23.0, 12.0, "fuera", None),
    ]
    resultados = []
    for nombre, lat_p, lon_p, esperado, minimo in casos:
        v_n = valor_en(ipix, n_tubos, lat_p, lon_p)
        v_d = valor_en(ipix, dist_km, lat_p, lon_p)
        if esperado == "dentro":
            ok = (not math.isnan(v_n)) and (v_n >= minimo) and (not math.isnan(v_d)) and (v_d < 2.0)
        else:
            ok = math.isnan(v_n) and (not math.isnan(v_d)) and (v_d > 1000.0)
        resultados.append({
            "sitio": nombre,
            "lat": lat_p,
            "lon": lon_p,
            "cueva_n_tubos": None if math.isnan(v_n) else v_n,
            "cueva_dist_km": None if math.isnan(v_d) else round(v_d, 4),
            "ok": ok,
        })
        if not ok:
            raise RuntimeError(f"Comprobación fallida en {nombre}: n={v_n}, dist={v_d}")
    return resultados


def correr(run: Path, datos: Path, ruta_json: Path = JSON_DEFECTO) -> dict:
    carpeta_zip = datos / SUBDIR_DATOS
    zips = sorted(carpeta_zip.glob("*.zip"))
    if not zips:
        raise FileNotFoundError(f"No hay ZIP de Pyroduct en {carpeta_zip}")
    ruta_zip = zips[0]
    zip_sha = sha256_archivo(ruta_zip)
    codigos_zip = leer_codigos_zip(ruta_zip)

    data_json, sistemas = cargar_cuevas_verificadas(ruta_json, codigos_zip=codigos_zip)
    ipix, lat_malla, lon_malla = cargar_malla(run)

    lats_s = np.array([s["lat"] for s in sistemas], dtype=np.float64)
    lons_s = np.array([s["lon"] for s in sistemas], dtype=np.float64)
    n_tubos, _, fuera_idx = agregar_tubos_en_malla(ipix, lats_s, lons_s)
    dist_km = distancia_minima_km(lat_malla, lon_malla, lats_s, lons_s)

    for arr, nombre in ((n_tubos, "cueva_n_tubos"), (dist_km, "cueva_dist_km")):
        if np.isinf(arr).any():
            raise ValueError(f"{nombre} contiene valores infinitos")

    fuera_codigos = [sistemas[i]["grupo_sistema"] for i in fuera_idx]
    advertencias = [
        f"Catálogo parcial: solo {len(sistemas)} sistemas únicos de los {len(data_json['cuevas'])} tubos de Pyroduct v3.0 tienen boca georreferenciada abierta y verificable.",
        "Las celdas sin registro en cueva_n_tubos quedan en NaN (no significa ausencia física de tubos de lava).",
    ]
    if fuera_codigos:
        advertencias.append(f"Cuevas fuera de la máscara de tierra de la malla: {', '.join(fuera_codigos)}.")

    meta_base = {
        "fuente": "Pyroduct Digital Catalog v3.0 + fuentes abiertas georreferenciadas",
        "url": "https://doi.org/10.5281/zenodo.14535885",
        "licencia": LICENCIA_RESUMEN,
        "local_only": False,
        "advertencias": advertencias,
    }
    res_n = escribir_columna(run, "cueva_n_tubos", n_tubos, {
        **meta_base,
        "unidad": "tubos",
        "metodo": "Conteo de sistemas únicos verificados de Pyroduct v3.0 por celda HEALPix nivel 12 (celda_de); NaN en celdas sin tubo verificado.",
    })
    res_d = escribir_columna(run, "cueva_dist_km", dist_km, {
        **meta_base,
        "unidad": "km",
        "metodo": f"Distancia geodésica esférica mínima (R={RADIO_TIERRA_KM} km) desde el centro de cada celda hasta el tubo verificado más cercano.",
    })

    checks = comprobar_puntos(ipix, n_tubos, dist_km)
    resumen = {
        "paso": "E-16",
        "catalogo_zip": str(ruta_zip.name),
        "catalogo_sha256": zip_sha,
        "n_codigos_zip": len(codigos_zip),
        "n_tubos_json": len(data_json["cuevas"]),
        "n_sistemas_verificados": len(sistemas),
        "n_celdas_con_cueva": int(np.sum(~np.isnan(n_tubos))),
        "fuera_de_malla": fuera_codigos,
        "columnas": {"cueva_n_tubos": res_n, "cueva_dist_km": res_d},
        "comprobaciones": checks,
        "advertencias": advertencias,
    }
    out_json = run / "columns" / "e16.json"
    out_json.write_text(json.dumps(resumen, indent=2, ensure_ascii=False), encoding="utf-8")
    return resumen


if __name__ == "__main__":
    r = correr(ruta_env("RUN"), ruta_env("DATOS"))
    print(json.dumps({
        "n_sistemas_verificados": r["n_sistemas_verificados"],
        "n_celdas_con_cueva": r["n_celdas_con_cueva"],
        "fuera_de_malla": r["fuera_de_malla"],
    }, ensure_ascii=False))
