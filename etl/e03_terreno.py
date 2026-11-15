"""E-03: utilidades compartidas de terreno (el paso completo corre en e03_extras.py).

Mantiene los ayudantes compartidos por otros módulos (LIMITE_POLAR, horn, _metros_por_grado, _vecinas, _ventana)
y delega main() a e03_extras.main() para que ambos comandos sigan funcionando en una sola pasada sobre el DEM.

Uso: python e03_terreno.py [procesos] [--solo-unir]
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from osgeo import gdal

from comun import A_WGS84, E2
from e01_malla import esquina_tesela  # noqa: F401 - reexportado para compatibilidad

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


def _desplazada(ruta: str, dx: float):
    """La tesela vecina del otro lado del antimeridiano, corrida dx grados (VRT en memoria), para que el halo la use."""
    ds = gdal.Open(ruta)
    x0, px, _, y0, _, py = ds.GetGeoTransform()
    limites = [x0 + dx, y0, x0 + dx + px * ds.RasterXSize, y0 + py * ds.RasterYSize]
    return gdal.Translate("", ds, format="VRT", outputBounds=limites)


def _vecinas(tipo: str, lat: int, lon: int) -> list:
    rutas = []
    for dla in (-1, 0, 1):
        for dlo in (-1, 0, 1):
            lo = ((lon + dlo + 180) % 360) - 180
            r = _ruta(tipo, lat + dla, lo)
            if r.exists():
                corrimiento = (lon + dlo) - lo  # 0, o ±360 si la vecina está del otro lado del antimeridiano
                rutas.append(str(r) if corrimiento == 0 else _desplazada(str(r), corrimiento))
    return rutas


def horn(z: np.ndarray, sx: np.ndarray | float, sy: np.ndarray | float) -> np.ndarray:
    """Pendiente de Horn en grados para el interior de z (forma z.shape - 2).

    Horn solo usa los 8 vecinos; si el bloque central es agua o no tiene dato, la pendiente también es NaN.
    """
    a_, b_, c_ = z[:-2, :-2], z[:-2, 1:-1], z[:-2, 2:]
    d_, f_ = z[1:-1, :-2], z[1:-1, 2:]
    g_, h_, i_ = z[2:, :-2], z[2:, 1:-1], z[2:, 2:]
    dzdx = ((c_ + 2 * f_ + i_) - (a_ + 2 * d_ + g_)) / (8 * sx)
    dzdy = ((g_ + 2 * h_ + i_) - (a_ + 2 * b_ + c_)) / (8 * sy)
    pend = np.degrees(np.arctan(np.hypot(dzdx, dzdy)))
    pend[~np.isfinite(z[1:-1, 1:-1])] = np.nan
    return pend


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


def main() -> int:
    from e03_extras import main as extras_main
    return extras_main()


if __name__ == "__main__":
    sys.exit(main())
