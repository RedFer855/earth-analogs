"""E-19: exporta los pines de E-16 (tubos verificados) y E-17 (cráteres y playas) a GeoJSON para el visor.

Salida: $RUN/export/puntos.geojson (FeatureCollection, un Point por pin, con fuente, licencia y atribución).
El visor lo carga tal cual; ningún dato crudo pasa a la web (regla 3).

Uso:  pixi run python e19_export.py [ruta de cuevas-pyroduct-coordenadas.json]
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from comun import ruta_env

ATRIBUCION = {
    "crater_impacto": "Datos de Wikidata (CC0)",
    "tubo_lava": "Pyroduct Digital Catalog v3.0, Romio et al. 2026 (CC BY 4.0); boca verificada (ver fuente)",
    "playa_salar": "Natural Earth (dominio público)",
}


# Tubos de E-16: solo los de estado "verificado" y con coordenada
TUBOS = Path(__file__).resolve().parent / "sitios" / "cuevas-pyroduct-coordenadas.json"


def tubos_verificados(ruta: Path = TUBOS) -> list[dict]:
    if not ruta.exists():
        return []
    out = []
    for c in json.loads(ruta.read_text(encoding="utf-8"))["cuevas"]:
        if c.get("estado") != "verificado" or c.get("lat") is None or c.get("lon") is None:
            continue
        out.append({
            "id": f"tubo-{c['codigo']}", "tipo": "tubo_lava", "nombre": c["nombre"], "lat": c["lat"], "lon": c["lon"],
            "pais": c.get("pais"), "zona": c.get("area"), "fuente": c.get("fuente_nombre"), "url": c.get("fuente_url"),
            "licencia": c.get("fuente_licencia"),
        })
    return out


def a_geojson(puntos: list[dict]) -> dict:
    feats = []
    for p in puntos:
        props = {k: v for k, v in p.items() if k not in ("lat", "lon")}
        props["atribucion"] = ATRIBUCION.get(p["tipo"], p.get("fuente"))
        feats.append({
            "type": "Feature",
            "id": p["id"],
            "geometry": {"type": "Point", "coordinates": [round(p["lon"], 6), round(p["lat"], 6)]},
            "properties": props,
        })
    return {"type": "FeatureCollection", "features": feats}


def main() -> None:
    run: Path = ruta_env("RUN")
    puntos = json.loads((run / "puntos" / "puntos-tierra.json").read_text(encoding="utf-8"))["puntos"]
    # Mientras E-16 no esté en main, se puede pasar la ruta del JSON de tubos como argumento
    puntos += tubos_verificados(Path(sys.argv[1])) if len(sys.argv) > 1 else tubos_verificados()
    sal = run / "export"
    sal.mkdir(parents=True, exist_ok=True)
    (sal / "puntos.geojson").write_text(json.dumps(a_geojson(puntos), ensure_ascii=False), encoding="utf-8")
    print(f"E-19: {len(puntos)} pines en export/puntos.geojson")


if __name__ == "__main__":
    main()
