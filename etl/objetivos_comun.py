"""Utilidades compartidas para E-11 (Luna) y E-12 (Marte): parches a escala de celda, resumen y muestreo circular.

Reutiliza los estimadores de la Tierra (`horn` en e03_terreno y `ventana`, `cuantil` en e03_extras) para calcular
las métricas de relieve en parches de ~1.6 km y resumir cada sitio con mediana y MAD.
"""

from __future__ import annotations

import numpy as np

from e03_extras import UMBRAL_PEND, cuantil, ventana
from e03_terreno import horn

METRICAS_TERRENO = (
    "slope_mean_deg",
    "slope_std_deg",
    "slope_p90_deg",
    "slope_p99_deg",
    "slope_frac_gt15",
    "rug_rms_mean_m",
    "rug_rms_p90_m",
    "relieve_mean_m",
    "relieve_p90_m",
    "elev_mean_m",
    "frac_valida",
)


def _cuantil_1d(ordenados: np.ndarray, q: float) -> float:
    """Cuantil lineal (tipo 7) de un arreglo 1D ya ordenado y no vacío."""
    inicio = np.array([0], dtype=np.int64)
    cuenta = np.array([ordenados.size], dtype=np.int64)
    return float(cuantil(ordenados, inicio, cuenta, q)[0])


def _resumen_metrica_parche(valores: np.ndarray) -> tuple[float, float]:
    """Media y percentil 90 de los valores finitos de un parche, o (NaN, NaN) si no hay."""
    v = np.sort(valores[np.isfinite(valores)])
    if not v.size:
        return float("nan"), float("nan")
    return float(v.mean()), _cuantil_1d(v, 0.90)


def parches(
    z: np.ndarray,
    sx: np.ndarray | float,
    sy: float,
    mascara: np.ndarray,
    tam_m: float = 1600.0,
) -> list[dict[str, float]]:
    """Corta la rejilla de elevación en parches de ~tam_m x tam_m y calcula métricas de terreno por parche.

    z: elevación en metros (~200 m por píxel; NaN = sin dato).
    sx: espaciado en x en metros por fila (forma (filas, 1)) o escalar.
    sy: espaciado escalar en y en metros.
    mascara: máscara booleana del sitio, misma forma que z.
    """
    z = np.asarray(z, dtype=np.float64)
    mascara = np.asarray(mascara, dtype=bool)
    if z.ndim != 2 or z.shape != mascara.shape or z.shape[0] < 3 or z.shape[1] < 3 or not mascara.any():
        return []

    sx_arr = np.asarray(sx, dtype=np.float64)
    if sx_arr.ndim == 0:
        sx_2d = np.full((z.shape[0], 1), float(sx_arr), dtype=np.float64)
    elif sx_arr.ndim == 1:
        sx_2d = sx_arr[:, None]
    else:
        sx_2d = sx_arr

    sy_f = float(sy)
    pend = horn(z, sx_2d[1:-1], sy_f)
    rug_full, rel_full = ventana(z)
    rug = rug_full[1:-1, 1:-1]
    rel = rel_full[1:-1, 1:-1]
    zc = z[1:-1, 1:-1]
    masc = mascara[1:-1, 1:-1]

    sx_med = float(np.median(np.broadcast_to(sx_2d, z.shape)[mascara]))
    ny = max(1, round(tam_m / sy_f))
    nx = max(1, round(tam_m / sx_med))
    cy, cx = ny // 2, nx // 2
    area = ny * nx

    salida: list[dict[str, float]] = []
    n_filas, n_cols = pend.shape[0] // ny, pend.shape[1] // nx
    for i in range(n_filas):
        r0 = i * ny
        for j in range(n_cols):
            c0 = j * nx
            if not masc[r0 + cy, c0 + cx]:
                continue
            p_sub = pend[r0 : r0 + ny, c0 : c0 + nx]
            ok = np.isfinite(p_sub)
            n_ok = int(ok.sum())
            if n_ok * 2 < area:
                continue

            pv = np.sort(p_sub[ok])
            zv = zc[r0 : r0 + ny, c0 : c0 + nx][ok]
            rug_m, rug_p90 = _resumen_metrica_parche(rug[r0 : r0 + ny, c0 : c0 + nx])
            rel_m, rel_p90 = _resumen_metrica_parche(rel[r0 : r0 + ny, c0 : c0 + nx])
            salida.append(
                {
                    "slope_mean_deg": float(pv.mean()),
                    "slope_std_deg": float(np.std(pv)),
                    "slope_p90_deg": _cuantil_1d(pv, 0.90),
                    "slope_p99_deg": _cuantil_1d(pv, 0.99),
                    "slope_frac_gt15": float(np.mean(pv > UMBRAL_PEND)),
                    "rug_rms_mean_m": rug_m,
                    "rug_rms_p90_m": rug_p90,
                    "relieve_mean_m": rel_m,
                    "relieve_p90_m": rel_p90,
                    "elev_mean_m": float(zv.mean()),
                    "frac_valida": float(n_ok / area),
                }
            )
    return salida


def resumen(valores) -> dict[str, float | int] | None:
    """Resume los valores finitos con mediana, MAD normalizada (1.4826 * MAD), media, p10, p90 y n_parches."""
    arr = np.asarray(valores, dtype=np.float64)
    arr = np.sort(arr[np.isfinite(arr)])
    if not arr.size:
        return None
    med = float(np.median(arr))
    mad = float(1.4826 * np.median(np.abs(arr - med)))
    return {
        "mediana": med,
        "mad": mad,
        "media": float(arr.mean()),
        "p10": _cuantil_1d(arr, 0.10),
        "p90": _cuantil_1d(arr, 0.90),
        "n_parches": int(arr.size),
    }


def resumir_parches(lista_parches: list[dict[str, float]]) -> dict[str, dict[str, float | int] | None]:
    """Aplica `resumen` a cada métrica de terreno sobre una lista de parches."""
    return {m: resumen([p[m] for p in lista_parches]) for m in METRICAS_TERRENO}


def puntos_circulo(
    lat: float,
    lon: float,
    radio_m: float,
    radio_cuerpo_m: float,
    paso_m: float,
) -> tuple[np.ndarray, np.ndarray]:
    """Coordenadas (lat, lon) de puntos regulares dentro de un círculo (distancia de gran círculo)."""
    if radio_m <= 0 or paso_m <= 0 or radio_cuerpo_m <= 0:
        return np.empty(0, dtype=np.float64), np.empty(0, dtype=np.float64)
    dlat = np.degrees(paso_m / radio_cuerpo_m)
    dlon = dlat / max(np.cos(np.radians(lat)), 0.05)
    n_pasos = int(np.ceil(radio_m / paso_m))
    lats_1d = lat + np.arange(-n_pasos, n_pasos + 1) * dlat
    lats_1d = lats_1d[(lats_1d >= -90.0) & (lats_1d <= 90.0)]
    lons_1d = lon + np.arange(-n_pasos, n_pasos + 1) * dlon
    la_g, lo_g = np.meshgrid(lats_1d, lons_1d, indexing="ij")

    la_r, lo_r = np.radians(la_g), np.radians(lo_g)
    p1, l1 = np.radians(lat), np.radians(lon)
    termino = np.sin((la_r - p1) / 2) ** 2 + np.cos(p1) * np.cos(la_r) * np.sin((lo_r - l1) / 2) ** 2
    d = 2 * np.arcsin(np.minimum(1.0, np.sqrt(termino)))
    dentro = (d * radio_cuerpo_m) <= radio_m
    return la_g[dentro], lo_g[dentro]
