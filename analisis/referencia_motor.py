"""Referencia independiente del núcleo del motor: calcula S y las notas por variable con numpy, a partir de la fórmula de ADR-010.

Escribe filas sintéticas (semilla fija, sin datos de ninguna tabla) en el formato que lee la prueba
`motor/nucleo/tests/referencia_numpy.rs`. Si la fórmula cambia, se cambia aquí y en `perfil.rs`, y se regenera:

  pixi run --manifest-path etl/pixi.toml python -I analisis/referencia_motor.py > motor/nucleo/tests/referencia_numpy.txt

Fórmula, para las variables presentes de la celda (todas las obligatorias tienen que estar):
  z_i = (x_i - y_i) / s_i;  con tolerancia, u_i = z_i / (1 + (z_i / t_i)^2)^(1/4), t_i = tau_i / s_i
  R_s = (1 - lambda) R + lambda I;  M = W^(1/2) R_s^(-1) W^(1/2), pesos iguales repartidos entre las presentes
  D2 = u' M u;  S = exp(-gamma D2);  nota_i = exp(-gamma (R_s^(-1/2) W^(1/2) u)_i^2)
"""

from __future__ import annotations

import numpy as np

SEMILLA = 20261115
K = 6
OBLIGATORIAS = 4  # las primeras cuatro
GAMMA = 0.5
LAMBDA = 0.3


def correlacion_aleatoria(rng: np.random.Generator, k: int) -> np.ndarray:
    b = rng.uniform(-1, 1, size=(k, k))
    a = b @ b.T + np.eye(k)
    d = np.sqrt(np.diag(a))
    r = a / np.outer(d, d)
    np.fill_diagonal(r, 1.0)
    return r


def puntuar(x, y, tau, s, r, tolerante: bool):
    presentes = np.flatnonzero(np.isfinite(x))
    m = presentes.size
    z = (x[presentes] - y[presentes]) / s[presentes]
    if tolerante:
        t = tau[presentes] / s[presentes]
        u = np.where(t > 0, z / np.sqrt(np.sqrt(1 + (z / np.where(t > 0, t, 1)) ** 2)), z)
    else:
        u = z
    rs = (1 - LAMBDA) * r[np.ix_(presentes, presentes)] + LAMBDA * np.eye(m)
    raiz_w = np.full(m, np.sqrt(1.0 / m))
    mm = np.outer(raiz_w, raiz_w) * np.linalg.inv(rs)
    d2 = max(float(u @ mm @ u), 0.0)
    w, v = np.linalg.eigh(rs)
    raiz_inv = v @ np.diag(1 / np.sqrt(w)) @ v.T
    zc = raiz_inv @ (raiz_w * u)
    notas = np.full(K, np.nan)
    notas[presentes] = np.exp(-GAMMA * zc**2)
    return float(np.exp(-GAMMA * d2)), notas


def main() -> None:
    rng = np.random.default_rng(SEMILLA)
    y = rng.uniform(1, 50, K)
    tau = rng.uniform(0.0, 0.3, K) * y
    tau[K - 1] = 0.0  # una variable sin tolerancia
    s = rng.uniform(0.2, 0.6, K) * y
    r = correlacion_aleatoria(rng, K)
    filas = [y.copy()]
    for distancia in (0.05, 0.2, 0.5, 1.0, 2.0, 4.0):
        filas.append(y + rng.normal(size=K) * s * distancia)
    con_hueco = y + rng.normal(size=K) * s * 0.7
    con_hueco[K - 1] = np.nan
    filas.append(con_hueco)

    def num(v) -> str:
        return " ".join(repr(float(a)) for a in v)

    print(f"# Generado por analisis/referencia_motor.py: datos sintéticos, semilla {SEMILLA}, numpy {np.__version__}.")
    print("# fila: x (f32) | S con tolerancia, S sin tolerancia | nota por variable (nan si falta)")
    print(f"gamma {GAMMA}\nlambda {LAMBDA}\nobligatorias {OBLIGATORIAS}")
    print(f"objetivo {num(y)}\ntolerancia {num(tau)}\nescala {num(s)}\ncorrelacion {num(r.ravel())}")
    for f in filas:
        x = np.asarray(f, dtype=np.float32).astype(np.float64)  # el motor lee columnas f32
        s_tol, notas = puntuar(x, y, tau, s, r, True)
        s_ex, _ = puntuar(x, y, tau, s, r, False)
        print(f"fila {num(x)} | {s_tol!r} {s_ex!r} | {num(notas)}")


if __name__ == "__main__":
    main()
