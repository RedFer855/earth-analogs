"""Utilidades compartidas del ETL: rutas, malla HEALPix y conversión de latitud.

La malla HEALPix vive en una esfera. La Tierra es un elipsoide (WGS84), así que la latitud de la esfera se toma
como latitud autálica (la que conserva áreas) y se pasa a latitud geodésica para leer los rasters.
"""

from __future__ import annotations

import os
from pathlib import Path

import numpy as np

NIVEL = 12
NSIDE = 2**NIVEL
NPIX = 12 * NSIDE * NSIDE

# WGS84
A_WGS84 = 6378137.0
F_WGS84 = 1 / 298.257223563
E2 = F_WGS84 * (2 - F_WGS84)
RADIO_AUTALICO_KM = 6371.0072


def ruta_env(nombre: str) -> Path:
    """Devuelve la ruta de una variable de entorno obligatoria ($DATOS, $RUN)."""
    valor = os.environ.get(nombre)
    if not valor:
        raise SystemExit(f"falta la variable de entorno {nombre}")
    return Path(valor)


def autalica_a_geodesica(beta_deg: np.ndarray) -> np.ndarray:
    """Latitud autálica a geodésica (serie de Snyder 1987, ec. 3-18), en grados."""
    b = np.radians(np.asarray(beta_deg, dtype=np.float64))
    e2, e4, e6 = E2, E2**2, E2**3
    phi = (
        b
        + (e2 / 3 + 31 * e4 / 180 + 517 * e6 / 5040) * np.sin(2 * b)
        + (23 * e4 / 360 + 251 * e6 / 3780) * np.sin(4 * b)
        + (761 * e6 / 45360) * np.sin(6 * b)
    )
    return np.degrees(phi)


def geodesica_a_autalica(phi_deg: np.ndarray) -> np.ndarray:
    """Latitud geodésica a autálica, por la fórmula cerrada de q (Snyder 1987, ec. 3-11 y 3-12), en grados."""
    phi = np.radians(np.asarray(phi_deg, dtype=np.float64))
    e = np.sqrt(E2)

    def q(s):
        return (1 - E2) * (s / (1 - E2 * s * s) - np.log((1 - e * s) / (1 + e * s)) / (2 * e))

    qp = q(1.0)
    return np.degrees(np.arcsin(np.clip(q(np.sin(phi)) / qp, -1.0, 1.0)))


def nombre_tesela_glo90(lat_sur: int, lon_oeste: int) -> str:
    """Nombre de una tesela Copernicus GLO-90 por su esquina sur-oeste."""
    ns = "N" if lat_sur >= 0 else "S"
    ew = "E" if lon_oeste >= 0 else "W"
    return f"Copernicus_DSM_COG_30_{ns}{abs(lat_sur):02d}_00_{ew}{abs(lon_oeste):03d}_00"
