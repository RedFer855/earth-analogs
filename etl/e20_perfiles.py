"""E-20: perfiles de búsqueda para el motor ($RUN/perfiles.json), uno por sitio objetivo de la Luna y de Marte.

Lee lo que ya dejó el ETL en $RUN: los objetivos de E-11 y E-12, el manifiesto de E-13 y las columnas de la Tierra.
Cada perfil dice, por variable, qué valor buscar (objetivo), cuánto se acepta como "coincide" (tolerancia), con qué
escala se mide la diferencia en la Tierra (escala_tierra) y cómo se relacionan las variables entre sí (correlacion).

Reglas (ADR-010):
- Solo puntúan las cuatro variables de terreno, medidas igual en los tres cuerpos (Horn a 200 m, ADR-005).
- El rango térmico diario y la amplitud anual no puntúan: la atmósfera de la Tierra los limita muy por debajo de la
  Luna y de Marte. Van en `diagnostico` para que el resultado diga cuánto difieren.
- Objetivo = mediana de los parches del sitio; tolerancia = MAD de esos parches (lo que varía dentro del sitio).
- Escala = max(1.4826 MAD, (P90 - P10) / 2.56, 0.01) sobre las celdas de la Tierra elegibles.
- Correlación de Pearson entre las variables, en una muestra fija de celdas elegibles de la Tierra.
- Contracción de la correlación hacia la identidad según el cuerpo: Luna 0.85, Marte 0.50.
- Si el objetivo cae fuera de lo que mide la Tierra (P1 a P99.9), se busca el borde y se guarda el valor real.

Uso:  RUN=... pixi run python e20_perfiles.py
"""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path

import numpy as np

from comun import ruta_env

VARIABLES = ["slope_mean_deg", "slope_std_deg", "rug_rms_mean_m", "relieve_mean_m"]
# variable de la Tierra -> clave del objetivo, por cuerpo (E-11 guarda la Luna con el nombre de la Tierra)
DIAGNOSTICO = {
    "luna": {"rango_diurno_k": "rango_diurno_k"},
    "marte": {"rango_diurno_k": "mcd_rango_diurno_k", "amp_anual_k": "mcd_amp_anual_k"},
}
LAMBDA_POR_CUERPO = {"luna": 0.85, "marte": 0.50}
PARAMETROS = {
    "gamma": 0.5,
    "lambda_contraccion": 0.10,  # solo se usa si un perfil no trae la suya
    "ndvi_max_principal": 0.20,  # suelo desnudo (ADR-010)
    "s_coincide": 0.5,
    "nivel_region": 6,
    "radio_documentado_km": 50.0,
    "min_celdas_region": 30,
}
MUESTRA_CORRELACION = 2_000_000
SEMILLA = 20261115


def escala_robusta(x: np.ndarray) -> float:
    """max(1.4826 MAD, (P90 - P10) / 2.56, 0.01) de los valores finitos de x."""
    x = x[np.isfinite(x)].astype(np.float64)
    if x.size == 0:
        raise ValueError("sin valores para la escala")
    med = np.median(x)
    mad = 1.4826 * np.median(np.abs(x - med))
    p10, p90 = np.percentile(x, [10, 90])
    return float(max(mad, (p90 - p10) / 2.56, 0.01))


def correlacion(columnas: list[np.ndarray], filas: np.ndarray) -> list[list[float]]:
    """Pearson entre columnas en las filas dadas (todas finitas). Devuelve una matriz simétrica con diagonal 1."""
    m = np.vstack([c[filas].astype(np.float64) for c in columnas])
    r = np.corrcoef(m)
    if not np.all(np.isfinite(r)):
        raise ValueError("correlación no definida: alguna variable no varía en la muestra")
    r = (r + r.T) / 2
    np.fill_diagonal(r, 1.0)
    return [[round(float(v), 6) for v in fila] for fila in r]


def acotar(valor: float, p_bajo: float, p_alto: float) -> tuple[float, float | None]:
    """Lleva el objetivo al rango que mide la Tierra. Devuelve (valor usado, valor real si se movió)."""
    if valor > p_alto:
        return p_alto, valor
    if valor < p_bajo:
        return p_bajo, valor
    return valor, None


def sitios_de(objetivos: dict) -> dict:
    """E-11 guarda la Luna en `regiones` y E-12 guarda Marte en `sitios`."""
    return objetivos.get("regiones") or objetivos.get("sitios") or {}


def perfil_de_sitio(sitio: dict, cuerpo: str, tierra: dict, corr: list[list[float]]) -> dict | None:
    """Arma el perfil `terreno` de un sitio, o None si al sitio le falta una variable de terreno."""
    terreno = sitio.get("terreno") or {}
    objetivo, tolerancia, fuera = {}, {}, {}
    for v in VARIABLES:
        t = terreno.get(v) or {}
        med, mad = t.get("mediana"), t.get("mad")
        if med is None or mad is None or not np.isfinite(med) or not np.isfinite(mad):
            return None
        usado, real = acotar(float(med), tierra[v]["p1"], tierra[v]["p99_9"])
        objetivo[v] = round(usado, 6)
        tolerancia[v] = round(float(mad), 6)
        if real is not None:
            fuera[v] = {"objetivo_real": round(real, 6)}
    diagnostico = {}
    for col, clave in DIAGNOSTICO[cuerpo].items():
        valor = sitio.get(clave)
        if valor is not None and np.isfinite(valor):
            diagnostico[col] = round(float(valor), 4)
    return {
        "variables": VARIABLES,
        "objetivo": objetivo,
        "tolerancia": tolerancia,
        "escala_tierra": {v: tierra[v]["escala"] for v in VARIABLES},
        "correlacion": corr,
        "lambda_contraccion": LAMBDA_POR_CUERPO[cuerpo],
        "fuera_del_alcance_de_la_tierra": fuera,
        "diagnostico": diagnostico,
    }


def main() -> None:
    t0 = time.time()
    run: Path = ruta_env("RUN")
    manifiesto = json.loads((run / "manifest.json").read_text(encoding="utf-8"))
    n = int(manifiesto["n_celdas"])

    def columna(nombre: str) -> np.ndarray:
        c = np.memmap(run / "columns" / f"{nombre}.f32", dtype=np.float32, mode="r")
        if c.size != n:
            raise SystemExit(f"{nombre}: {c.size} celdas y el manifiesto dice {n}")
        return c

    ndvi = columna("ndvi_max_clim")
    elegible = np.isfinite(ndvi) & (ndvi <= PARAMETROS["ndvi_max_principal"])
    cols = [columna(v) for v in VARIABLES]
    completas = elegible.copy()
    for c in cols:
        completas &= np.isfinite(c)
    filas = np.flatnonzero(completas)
    if filas.size < 1000:
        raise SystemExit(f"solo {filas.size} celdas elegibles con las cuatro variables")
    rng = np.random.default_rng(SEMILLA)
    muestra = np.sort(rng.choice(filas, size=min(MUESTRA_CORRELACION, filas.size), replace=False))
    corr = correlacion(cols, muestra)

    tierra = {}
    for v, c in zip(VARIABLES, cols):
        e = manifiesto["columnas"][v]
        tierra[v] = {"p1": float(e["p1"]), "p99_9": float(e["p99_9"]),
                     "escala": round(escala_robusta(np.asarray(c[elegible])), 6)}

    objetivos, omitidos = {}, []
    for cuerpo in ("luna", "marte"):
        ruta = run / "objetivos" / f"objetivos_{cuerpo}.json"
        if not ruta.exists():
            raise SystemExit(f"falta {ruta.name}: corre antes E-11 y E-12")
        datos = json.loads(ruta.read_text(encoding="utf-8"))
        for codigo, sitio in sitios_de(datos).items():
            p = perfil_de_sitio(sitio, cuerpo, tierra, corr)
            if p is None:
                omitidos.append(codigo)
                continue
            objetivos[codigo] = {"nombre": sitio.get("nombre", codigo), "cuerpo": cuerpo, "perfiles": {"terreno": p}}

    salida = {
        "generado": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "metodo": "E-20: objetivo = mediana del sitio, tolerancia = MAD del sitio, escala = max(1.4826 MAD, "
                  "(P90-P10)/2.56, 0.01) en la Tierra elegible, Pearson en una muestra fija (ADR-010)",
        "parametros": PARAMETROS,
        "maestro": {"n_celdas": n, "generado": manifiesto.get("generado")},
        "tierra": {"celdas_elegibles": int(elegible.sum()), "celdas_completas": int(filas.size),
                   "muestra_correlacion": int(muestra.size), "semilla": SEMILLA},
        "omitidos_por_falta_de_terreno": omitidos,
        "objetivos": objetivos,
    }
    destino = run / "perfiles.json"
    tmp = destino.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(salida, indent=1, ensure_ascii=False), encoding="utf-8")
    tmp.replace(destino)
    print(f"E-20: {len(objetivos)} perfiles, {len(omitidos)} omitidos {omitidos}, "
          f"{filas.size} celdas completas, {time.time() - t0:.1f} s")
    if not objetivos:
        sys.exit(1)


if __name__ == "__main__":
    main()
