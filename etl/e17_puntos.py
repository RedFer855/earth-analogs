"""E-17: capas de puntos de la Tierra (cráteres de impacto y playas) y distancia al más cercano.

Lo que es un punto no se promedia por celda: se guarda como pin y cada celda recibe la distancia al más cercano.
Las distancias NO entran al puntaje de similitud (ADR-009); sirven de filtro y de dato para el visor.

Columnas que escribe en $RUN/columns/:
  dist_crater_km          distancia de gran círculo al centro del cráter de impacto más cercano (Wikidata)
  crater_diam_km_cercano  diámetro de ese cráter; NaN si Wikidata no lo trae
  dentro_crater           1 si la celda cae dentro del radio de algún cráter con diámetro conocido, 0 si no
  dist_playa_km           distancia a la playa o salar más cercano (Natural Earth); 0 dentro del polígono

Y $RUN/puntos/puntos-tierra.json con todos los pines (id, tipo, nombre, lat, lon, atributos, fuente, licencia).

Los tubos de lava van aparte, en E-16 (`e16_cuevas.py`, `cueva_dist_km`), con coordenadas verificadas una a una.

Uso:  pixi run python e17_puntos.py
Entradas: $DATOS/tierra/crateres-wikidata/*.json, $DATOS/tierra/playas-natural-earth/ne_10m_playas.zip
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from osgeo import gdal, ogr
from scipy.spatial import cKDTree

from comun import RADIO_AUTALICO_KM, ruta_env
from comun_tabla import cargar_malla, escribir_columna, muestrear

gdal.UseExceptions()

R = RADIO_AUTALICO_KM

# Unidades de Wikidata para P2386 (diámetro)
UNIDAD_KM = {
    "http://www.wikidata.org/entity/Q828224": 1.0,  # kilómetro
    "http://www.wikidata.org/entity/Q11573": 1e-3,  # metro
    "http://www.wikidata.org/entity/Q253276": 1.609344,  # milla
}

# Entradas de Wikidata que no son cráteres de impacto confirmados en la Tierra: se publican como pin con
# confirmado=false y no cuentan para las distancias.
NO_CONFIRMADOS = {
    "Gusev crater",  # está en Marte; en Wikidata le falta el cuerpo celeste
    "Shiva crater",
    "Wilkes Land crater",
    "Bedout",
    "Mahuika crater",
    "Massive Australian Precambrian/Cambrian Impact Structure",
    "Burckle Crater",
    "Mount Babel",
    "Rodder Maar",
    "Ullapool bolide impact",
    "Mien",
}


def a_xyz(lat, lon) -> np.ndarray:
    """Coordenadas cartesianas sobre la esfera de radio autálico (km)."""
    la = np.radians(np.asarray(lat, dtype=np.float64))
    lo = np.radians(np.asarray(lon, dtype=np.float64))
    c = np.cos(la)
    return np.column_stack([R * c * np.cos(lo), R * c * np.sin(lo), R * np.sin(la)])


def cuerda_a_arco(c: np.ndarray) -> np.ndarray:
    """Distancia de cuerda a distancia de gran círculo, en km."""
    return 2 * R * np.arcsin(np.clip(np.asarray(c) / (2 * R), 0.0, 1.0))


def arco_a_cuerda(d_km: float) -> float:
    return float(2 * R * np.sin(min(d_km, np.pi * R) / (2 * R)))


def mas_cercano(lat_c, lon_c, lat_p, lon_p, bloque: int = 4_000_000) -> tuple[np.ndarray, np.ndarray]:
    """Distancia (km) e índice del punto más cercano para cada celda, por bloques para no llenar la memoria."""
    arbol = cKDTree(a_xyz(lat_p, lon_p))
    n = np.asarray(lat_c).size
    dist = np.empty(n, np.float32)
    idx = np.empty(n, np.int32)
    for i in range(0, n, bloque):
        d, k = arbol.query(a_xyz(lat_c[i : i + bloque], lon_c[i : i + bloque]), k=1, workers=-1)
        dist[i : i + bloque] = cuerda_a_arco(d)
        idx[i : i + bloque] = k
    return dist, idx


# Media diagonal de una celda de nivel 12 (2.53 km²): una celda "toca" un círculo si su centro está a menos de
# radio + MEDIA_CELDA_KM. Sin esto, los cráteres más chicos que una celda nunca marcarían ninguna.
MEDIA_CELDA_KM = 1.13


def dentro_de_radios(lat_c, lon_c, lat_p, lon_p, radio_km, margen_km: float = 0.0) -> np.ndarray:
    """1 si la celda cae a menos de radio + margen de algún punto, 0 si no."""
    lat_c = np.asarray(lat_c)
    lon_c = np.asarray(lon_c)
    out = np.zeros(lat_c.size, np.float32)
    for la, lo, r in zip(lat_p, lon_p, radio_km):
        if not (np.isfinite(r) and r > 0):
            continue
        r = r + margen_km
        # Franja de latitud primero (barato), distancia exacta solo ahí
        dlat = np.degrees(r / R)
        k = np.flatnonzero(np.abs(lat_c - la) <= dlat)
        if not k.size:
            continue
        c = np.linalg.norm(a_xyz(lat_c[k], lon_c[k]) - a_xyz([la], [lo])[0], axis=1)
        out[k[cuerda_a_arco(c) <= r]] = 1
    return out


def leer_crateres(ruta: Path) -> list[dict]:
    filas = json.loads(ruta.read_text(encoding="utf-8"))["results"]["bindings"]
    por_id: dict[str, dict] = {}
    for b in filas:
        qid = b["c"]["value"].rsplit("/", 1)[-1]
        nombre = b["cLabel"]["value"]
        diam = None
        if "diam" in b and b.get("unit", {}).get("value") in UNIDAD_KM:
            diam = float(b["diam"]["value"]) * UNIDAD_KM[b["unit"]["value"]]
        p = por_id.setdefault(qid, {
            "id": f"crater-{qid}", "tipo": "crater_impacto", "nombre": nombre,
            "lat": float(b["lat"]["value"]), "lon": float(b["lon"]["value"]),
            "diametro_km": None, "confirmado": nombre not in NO_CONFIRMADOS and not nombre.startswith("Q"),
            "fuente": f"Wikidata {qid}", "url": f"https://www.wikidata.org/wiki/{qid}", "licencia": "CC0 1.0",
        })
        # Wikidata puede traer varios diámetros: se queda el mayor (borde exterior de la estructura)
        if diam is not None and (p["diametro_km"] is None or diam > p["diametro_km"]):
            p["diametro_km"] = round(diam, 3)
    return list(por_id.values())



def leer_playas(ruta_zip: Path, paso_km: float = 2.0) -> tuple[list[dict], np.ndarray, np.ndarray]:
    """Pines (centroide) de cada playa y puntos del borde densificados cada ~paso_km."""
    ds = ogr.Open(f"/vsizip/{ruta_zip.as_posix()}/ne_10m_playas.shp")
    capa = ds.GetLayer(0)
    pines, bla, blo = [], [], []
    for i, f in enumerate(capa):
        g = f.GetGeometryRef()
        c = g.Centroid()
        nombre = f.GetField("name") if f.GetFieldIndex("name") >= 0 else None
        pines.append({
            "id": f"playa-{i:03d}", "tipo": "playa_salar", "nombre": nombre or f"playa {i}",
            "lat": round(c.GetY(), 5), "lon": round(c.GetX(), 5),
            "fuente": "Natural Earth 1:10m Playas", "url": "https://www.naturalearthdata.com/downloads/10m-physical-vectors/",
            "licencia": "Dominio público",
        })
        d = g.Clone()
        d.Segmentize(paso_km / 111.0)
        for anillo in _anillos(d):
            pts = np.array(anillo.GetPoints())
            bla.append(pts[:, 1])
            blo.append(pts[:, 0])
    return pines, np.concatenate(bla), np.concatenate(blo)


def _anillos(g):
    if g.GetGeometryType() in (ogr.wkbLineString, ogr.wkbLinearRing, ogr.wkbLineString25D):
        yield g
        return
    for i in range(g.GetGeometryCount()):
        yield from _anillos(g.GetGeometryRef(i))


def dentro_de_playas(ruta_zip: Path, lat, lon, res: float = 0.02) -> np.ndarray:
    """1 si el centro de la celda cae dentro de un polígono de playa (rasterizado a res grados)."""
    ancho, alto = int(360 / res), int(180 / res)
    mem = gdal.GetDriverByName("MEM").Create("", ancho, alto, 1, gdal.GDT_Byte)
    geo = (-180.0, res, 0.0, 90.0, 0.0, -res)
    mem.SetGeoTransform(geo)
    src = ogr.Open(f"/vsizip/{ruta_zip.as_posix()}/ne_10m_playas.shp")
    gdal.RasterizeLayer(mem, [1], src.GetLayer(0), burn_values=[1])
    a = mem.ReadAsArray().astype(np.float32)
    v = muestrear(a, lat, lon, geo)
    return np.nan_to_num(v, nan=0.0)


def main() -> None:
    datos, run = ruta_env("DATOS"), ruta_env("RUN")
    _, lat, lon = cargar_malla(run)
    lat = lat.astype(np.float64)
    lon = lon.astype(np.float64)

    crat = leer_crateres(sorted((datos / "tierra" / "crateres-wikidata").glob("*.json"))[-1])
    zip_playas = datos / "tierra" / "playas-natural-earth" / "ne_10m_playas.zip"
    playas, bla, blo = leer_playas(zip_playas)

    ok = [c for c in crat if c["confirmado"]]
    cla = np.array([c["lat"] for c in ok])
    clo = np.array([c["lon"] for c in ok])
    cdi = np.array([c["diametro_km"] if c["diametro_km"] is not None else np.nan for c in ok])
    d, k = mas_cercano(lat, lon, cla, clo)
    escribir_columna(run, "dist_crater_km", d, {
        "fuente": "Wikidata, cráteres de impacto en la Tierra (P31/P279* Q55818, globo Q2)",
        "url": "https://query.wikidata.org/", "licencia": "CC0 1.0", "unidad": "km",
        "metodo": f"gran círculo al centro más cercano; {len(ok)} cráteres confirmados de {len(crat)}",
        "advertencias": ["el centro de Wikidata puede diferir del centro geológico", "no puntúa (ADR-009)"]})
    escribir_columna(run, "crater_diam_km_cercano", cdi[k].astype(np.float32), {
        "fuente": "Wikidata P2386", "url": "https://query.wikidata.org/", "licencia": "CC0 1.0", "unidad": "km",
        "metodo": "diámetro del cráter más cercano; NaN si Wikidata no lo trae"})
    escribir_columna(run, "dentro_crater", dentro_de_radios(lat, lon, cla, clo, cdi / 2, MEDIA_CELDA_KM), {
        "fuente": "Wikidata P625 y P2386", "url": "https://query.wikidata.org/", "licencia": "CC0 1.0",
        "unidad": "0/1", "metodo": "1 si la celda toca el cráter: centro a menos de radio + 1.13 km (media diagonal de la celda)",
        "advertencias": [f"solo {int(np.isfinite(cdi).sum())} cráteres traen diámetro; el resto no marca celdas"]})
    del d, k

    d, _ = mas_cercano(lat, lon, bla, blo)
    d[dentro_de_playas(zip_playas, lat, lon) > 0] = 0.0
    escribir_columna(run, "dist_playa_km", d, {
        "fuente": "Natural Earth 1:10m Playas", "url": "https://www.naturalearthdata.com/downloads/10m-physical-vectors/",
        "licencia": "Dominio público", "unidad": "km",
        "metodo": "gran círculo al borde densificado cada 2 km; 0 dentro del polígono (rasterizado a 0.02°)",
        "advertencias": ["Natural Earth es una muestra de playas grandes, no un inventario completo"]})

    sal = run / "puntos"
    sal.mkdir(parents=True, exist_ok=True)
    (sal / "puntos-tierra.json").write_text(
        json.dumps({"version": 1, "puntos": crat + playas}, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"E-17: {len(crat)} cráteres ({len(ok)} confirmados), {len(playas)} playas")


if __name__ == "__main__":
    main()
