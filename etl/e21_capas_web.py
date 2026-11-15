"""E-21: capas ligeras para el visor web ($RUN/web/capas7/), agregadas a HEALPix nivel 7 nested.

Cada celda de nivel 7 (unos 2600 km², 1024 hijas de nivel 12) junta a sus hijas de tierra: padre = ipix >> 10.
- Variables continuas: mediana de las hijas con dato.
- Distancias (`*_dist_km`, `dist_*_km`): mínimo de las hijas con dato, para no alejar un sitio que sí está cerca.
- NaN si ninguna hija tiene dato. `n_hijas.u16` guarda cuántas hijas de tierra tiene cada padre.

Lee $RUN/columns/ y, para las columnas de puntos que viven en otra corrida (E-17, E-18), una segunda carpeta
(`--puntos` o $RUN_PUNTOS) con la misma malla. Los metadatos salen del manifiesto de E-13 o del JSON de la columna.
Nada `local_only` (ADR-007 regla 6). Lee por bloques con memmap: nunca carga 58.8 M x 12 a la vez.

Uso:  RUN=... RUN_PUNTOS=... pixi run python e21_capas_web.py
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path

import numpy as np

from comun import ruta_env

NIVEL_ORIGEN = 12
NIVEL = 7
DESPLAZAMIENTO = 2 * (NIVEL_ORIGEN - NIVEL)  # 10 bits: 1024 hijas por padre
COLUMNAS = [
    "slope_mean_deg",
    "slope_std_deg",
    "rug_rms_mean_m",
    "relieve_mean_m",
    "aridez_ai",
    "ndvi_max_clim",
    "rango_diurno_k",
    "roca_volcanica_frac",
    "roca_evaporita_frac",
    "cueva_dist_km",
    "dist_crater_km",
    "dist_playa_km",
    # minerales y suelo para la ficha del visor (no puntúan; se comparan con el resto de la Tierra)
    "aster_ci",
    "aster_mi",
    "aster_qi",
    "arcilla_gkg",
    "arena_frac",
    "limo_gkg",
    "emit_calcite",
    "emit_chlorite",
    "emit_dolomite",
    "emit_goethite",
    "emit_gypsum",
    "emit_hematite",
    "emit_illite_muscovite",
    "emit_kaolinite",
    "emit_montmorillonite",
    "emit_quartz_feldspar",
    "emit_vermiculite",
]
BLOQUE = 1 << 22  # celdas de nivel 12 por bloque (~4.2 M)
CAMPOS_META = ("unidad", "fuente", "url", "licencia")


def metodo_de(nombre: str) -> str:
    """Mínimo para distancias, mediana para lo demás."""
    if nombre.endswith("_dist_km") or (nombre.startswith("dist_") and nombre.endswith("_km")):
        return "minimo"
    return "mediana"


def inicios_de_grupos(padres: np.ndarray) -> np.ndarray:
    """Índices donde empieza cada grupo de padres iguales (padres ordenado ascendente)."""
    if padres.size == 0:
        return np.zeros(0, dtype=np.int64)
    return np.flatnonzero(np.r_[True, padres[1:] != padres[:-1]])


def agregar(valores: np.ndarray, inicios: np.ndarray, metodo: str) -> np.ndarray:
    """Una fila por grupo: mediana o mínimo de los valores finitos del grupo; NaN si no hay ninguno."""
    n_grupos = inicios.size
    v = np.asarray(valores, dtype=np.float64)
    if n_grupos == 0:
        return np.zeros(0, dtype=np.float32)
    if metodo == "minimo":
        v = np.where(np.isfinite(v), v, np.nan)
        return np.fmin.reduceat(v, inicios).astype(np.float32)
    if metodo != "mediana":
        raise ValueError(f"método desconocido: {metodo}")
    grupo = np.repeat(np.arange(n_grupos), np.diff(np.r_[inicios, v.size]))
    ok = np.isfinite(v)
    g, x = grupo[ok], v[ok]
    x = x[np.lexsort((x, g))]  # g ya viene ordenado: ordena dentro de cada grupo
    cuenta = np.bincount(g, minlength=n_grupos)
    ini = np.r_[0, np.cumsum(cuenta)[:-1]]
    out = np.full(n_grupos, np.nan)
    hay = cuenta > 0
    bajo = ini[hay] + (cuenta[hay] - 1) // 2
    alto = ini[hay] + cuenta[hay] // 2
    out[hay] = (x[bajo] + x[alto]) / 2
    return out.astype(np.float32)


def leer_json(ruta: Path) -> dict:
    return json.loads(ruta.read_text(encoding="utf-8"))


def misma_malla(ipix_a: Path, ipix_b: Path, bloque: int = BLOQUE) -> bool:
    """Compara dos grid/ipix.u32 por bloques."""
    a = np.memmap(ipix_a, dtype=np.uint32, mode="r")
    b = np.memmap(ipix_b, dtype=np.uint32, mode="r")
    if a.size != b.size:
        return False
    return all(np.array_equal(a[i:i + bloque], b[i:i + bloque]) for i in range(0, a.size, bloque))


def ubicar_columnas(run: Path, puntos: Path | None, nombres: list[str]) -> dict[str, Path]:
    """Carpeta columns/ donde vive cada columna: primero $RUN, luego la corrida de puntos."""
    carpetas = [run / "columns"] + ([puntos / "columns"] if puntos else [])
    rutas, faltan = {}, []
    for nombre in nombres:
        hallada = next((c for c in carpetas if (c / f"{nombre}.f32").is_file()), None)
        if hallada is None:
            faltan.append(nombre)
        else:
            rutas[nombre] = hallada
    if faltan:
        pista = "" if puntos else " (¿falta RUN_PUNTOS o --puntos?)"
        raise SystemExit(f"faltan columnas {faltan} en {[str(c) for c in carpetas]}{pista}")
    return rutas


def metadatos(nombre: str, manifiesto: dict, carpeta: Path) -> dict:
    """unidad, fuente, url y licencia desde el manifiesto o, si no está ahí, desde el JSON de la columna."""
    entrada = (manifiesto.get("columnas") or {}).get(nombre)
    if entrada is None:
        ruta = carpeta / f"{nombre}.json"
        if not ruta.is_file():
            raise SystemExit(f"{nombre}: no está en el manifiesto ni tiene {ruta.name}")
        entrada = leer_json(ruta)
    if entrada.get("local_only") or f"columnas.{nombre}" in (manifiesto.get("local_only") or []):
        raise SystemExit(f"{nombre} es local_only: no puede servirse en la web (ADR-007 regla 6)")
    faltan = [c for c in CAMPOS_META if not entrada.get(c)]
    if faltan:
        raise SystemExit(f"{nombre}: faltan {faltan} en sus metadatos")
    return {c: entrada[c] for c in CAMPOS_META}


def resumen(valores: np.ndarray) -> dict:
    """Cobertura y p1/p50/p99 del agregado."""
    finitos = valores[np.isfinite(valores)].astype(np.float64)
    cob = round(100.0 * finitos.size / valores.size, 3) if valores.size else 0.0
    if finitos.size == 0:
        return {"cobertura_pct": cob, "p1": None, "p50": None, "p99": None}
    p1, p50, p99 = np.percentile(finitos, [1, 50, 99])
    return {"cobertura_pct": cob, "p1": round(float(p1), 6), "p50": round(float(p50), 6), "p99": round(float(p99), 6)}


def escribir(ruta: Path, arreglo: np.ndarray) -> int:
    tmp = ruta.with_name(ruta.name + ".tmp")
    arreglo.tofile(tmp)
    tmp.replace(ruta)
    return ruta.stat().st_size


def generar(run: Path, puntos: Path | None, columnas: list[str] = COLUMNAS, bloque: int = BLOQUE) -> dict:
    """Agrega las columnas a nivel 7 y escribe $RUN/web/capas7/. Devuelve el contenido de capas7.json."""
    t0 = time.time()
    manifiesto = leer_json(run / "manifest.json")
    n = int(manifiesto["n_celdas"])
    ipix = np.memmap(run / "grid" / "ipix.u32", dtype=np.uint32, mode="r")
    if ipix.size != n:
        raise SystemExit(f"grid/ipix.u32 tiene {ipix.size} celdas y el manifiesto dice {n}")
    rutas = ubicar_columnas(run, puntos, columnas)
    if puntos and any(c == puntos / "columns" for c in rutas.values()):
        if not misma_malla(run / "grid" / "ipix.u32", puntos / "grid" / "ipix.u32", bloque):
            raise SystemExit(f"{puntos} no usa la misma malla que {run}")
    meta = {c: metadatos(c, manifiesto, rutas[c]) for c in columnas}
    datos = {}
    for c in columnas:
        datos[c] = np.memmap(rutas[c] / f"{c}.f32", dtype=np.float32, mode="r")
        if datos[c].size != n:
            raise SystemExit(f"{c}: {datos[c].size} celdas y el manifiesto dice {n}")

    padres, hijas = [], []
    partes: dict[str, list[np.ndarray]] = {c: [] for c in columnas}
    a, ultimo_ipix = 0, -1
    while a < n:
        b = min(a + bloque, n)
        bloque_ipix = np.asarray(ipix[a:b], dtype=np.int64)
        if bloque_ipix[0] <= ultimo_ipix or np.any(np.diff(bloque_ipix) <= 0):
            raise SystemExit("grid/ipix.u32 no está en orden ascendente estricto")
        p = bloque_ipix >> DESPLAZAMIENTO
        if b < n and (int(ipix[b]) >> DESPLAZAMIENTO) == p[-1]:  # no partir un grupo entre dos bloques
            corte = int(np.searchsorted(p, p[-1], side="left"))
            if corte > 0:
                b, p, bloque_ipix = a + corte, p[:corte], bloque_ipix[:corte]
            else:  # el bloque entero es un solo padre: se extiende hasta el final del grupo
                while b < n and (int(ipix[b]) >> DESPLAZAMIENTO) == p[-1]:
                    b += 1
                bloque_ipix = np.asarray(ipix[a:b], dtype=np.int64)
                if np.any(np.diff(bloque_ipix) <= 0):
                    raise SystemExit("grid/ipix.u32 no está en orden ascendente estricto")
                p = bloque_ipix >> DESPLAZAMIENTO
        inicios = inicios_de_grupos(p)
        padres.append(p[inicios].astype(np.uint32))
        hijas.append(np.diff(np.r_[inicios, p.size]).astype(np.uint16))
        for c in columnas:
            partes[c].append(agregar(datos[c][a:b], inicios, metodo_de(c)))
        ultimo_ipix = int(bloque_ipix[-1])
        a = b

    destino = run / "web" / "capas7"
    destino.mkdir(parents=True, exist_ok=True)
    ipix7 = np.concatenate(padres)
    n_hijas = np.concatenate(hijas)
    tamanos = {"ipix.u32": escribir(destino / "ipix.u32", ipix7),
               "n_hijas.u16": escribir(destino / "n_hijas.u16", n_hijas)}
    salida_cols = {}
    for c in columnas:
        valores = np.concatenate(partes[c])
        tamanos[f"{c}.f32"] = escribir(destino / f"{c}.f32", valores)
        salida_cols[c] = {"archivo": f"{c}.f32", **meta[c], "metodo": metodo_de(c), **resumen(valores)}

    salida = {
        "generado": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "nivel": NIVEL,
        "nside": 2**NIVEL,
        "esquema": "nested",
        "nivel_origen": NIVEL_ORIGEN,
        "hijas_por_padre": 1 << DESPLAZAMIENTO,
        "n_celdas": int(ipix7.size),
        "formato": "binario little-endian; ipix.u32 ascendente; n_hijas.u16 = hijas de tierra; "
                   "<columna>.f32 en el orden de ipix.u32, NaN = sin dato",
        "metodo": "E-21: padre = ipix >> 10; mediana de las hijas con dato; mínimo para distancias",
        "maestro": {"n_celdas": n, "generado": manifiesto.get("generado")},
        "archivos": {"ipix": "ipix.u32", "n_hijas": "n_hijas.u16"},
        "columnas": salida_cols,
        "bytes_binarios": int(sum(tamanos.values())),
    }
    ruta_json = destino / "capas7.json"
    tmp = ruta_json.with_name(ruta_json.name + ".tmp")
    tmp.write_text(json.dumps(salida, indent=1, ensure_ascii=False), encoding="utf-8")
    tmp.replace(ruta_json)
    total = salida["bytes_binarios"] + ruta_json.stat().st_size
    print(f"E-21: {ipix7.size} celdas de nivel {NIVEL}, {len(columnas)} columnas, "
          f"{total / 1e6:.2f} MB en {destino}, {time.time() - t0:.1f} s")
    return salida


def main(argv: list[str] | None = None) -> None:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--puntos", default=os.environ.get("RUN_PUNTOS"),
                    help="corrida con las columnas de puntos (por defecto $RUN_PUNTOS)")
    args = ap.parse_args(argv)
    run = ruta_env("RUN")
    salida = generar(run, Path(args.puntos) if args.puntos else None)
    if salida["n_celdas"] == 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
