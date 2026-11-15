"""El terreno de Marte se mide en bloques cuadrados de 200 m sin importar la latitud (ADR-005)."""

import tempfile
import unittest
from pathlib import Path

import numpy as np
from osgeo import gdal

from e12_marte import R_MARTE, terreno_marte

gdal.UseExceptions()
WKT_MARTE = ('GEOGCS["GCS_Mars_2000_Sphere",DATUM["Mars_2000_(Sphere)",SPHEROID["Mars_2000_Sphere_IAU_IAG",3396190,0]],'
             'PRIMEM["Reference_Meridian",0],UNIT["degree",0.0174532925199433]]')
PASO = 0.003374120830641  # grados por píxel del DEM HRSC-MOLA (200 m de N a S)
RADIO_M = 10000.0


def _dem(carpeta: Path, lat: float, lon: float, fn) -> gdal.Dataset:
    """DEM sintético lat/lon como el de Marte; fn(x, y) recibe metros locales E-O y N-S desde el sitio."""
    medio = np.degrees((RADIO_M + 4000.0) * 1.5 / R_MARTE)
    lat_n, lon_o = lat + medio, lon - medio / np.cos(np.radians(lat))
    filas, cols = int(2 * medio / PASO), int(2 * medio / np.cos(np.radians(lat)) / PASO)
    la = lat_n - (np.arange(filas) + 0.5) * PASO
    lo = lon_o + (np.arange(cols) + 0.5) * PASO
    lo_g, la_g = np.meshgrid(lo, la)
    x = np.radians(lo_g - lon) * R_MARTE * np.cos(np.radians(la_g))
    y = np.radians(la_g - lat) * R_MARTE
    ruta = carpeta / f"dem_{lat:g}.tif"
    ds = gdal.GetDriverByName("GTiff").Create(str(ruta), cols, filas, 1, gdal.GDT_Float32)
    ds.SetGeoTransform((lon_o, PASO, 0.0, lat_n, 0.0, -PASO))
    ds.SetProjection(WKT_MARTE)
    ds.GetRasterBand(1).WriteArray(fn(x, y).astype(np.float32))
    ds.GetRasterBand(1).SetNoDataValue(-32768)
    ds = None
    return gdal.Open(str(ruta))


class BloquesMarte(unittest.TestCase):
    def test_plano_de_10_grados_a_0_y_60(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            for lat in (0.0, 60.0):
                ds = _dem(Path(tmp), lat, 30.0, lambda x, y: np.tan(np.radians(10.0)) * y)
                sm, _, n, _ = terreno_marte(ds, lat, 30.0, RADIO_M)
                ds = None
                self.assertAlmostEqual(sm, 10.0, delta=0.2, msg=f"lat {lat}")
                self.assertGreater(n, 7000)

    def test_relieve_este_oeste_no_depende_de_la_latitud(self) -> None:
        # varía solo de E a O: con bloques de 200·cos(lat) m la ventana de 5 bloques mediría 500 m a 60°
        rel = {}
        with tempfile.TemporaryDirectory() as tmp:
            for lat in (0.0, 60.0):
                ds = _dem(Path(tmp), lat, 30.0, lambda x, y: 80.0 * np.sin(2 * np.pi * x / 2400.0))
                _, _, _, terreno = terreno_marte(ds, lat, 30.0, RADIO_M)
                ds = None
                rel[lat] = terreno["relieve_mean_m"]["mediana"]
        self.assertLessEqual(abs(rel[60.0] - rel[0.0]) / rel[0.0], 0.03, msg=str(rel))


if __name__ == "__main__":
    unittest.main()
