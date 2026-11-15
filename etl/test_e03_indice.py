"""Pruebas del índice de teselas afectadas por P-009 (e03_indice_afectadas.motivo) con teselas sintéticas."""

import tempfile
import unittest
from pathlib import Path

import numpy as np
from osgeo import gdal

from e03_indice_afectadas import motivo

gdal.UseExceptions()


def _tif(ruta: Path, arr: np.ndarray, tipo, nodata=None) -> None:
    ds = gdal.GetDriverByName("GTiff").Create(str(ruta), arr.shape[1], arr.shape[0], 1, tipo)
    b = ds.GetRasterBand(1)
    if nodata is not None:
        b.SetNoDataValue(nodata)
    b.WriteArray(arr)
    ds = None


class IndiceAfectadas(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        base = Path(self.tmp.name)
        (base / "dem").mkdir()
        (base / "wbm").mkdir()
        self.base = base

    def tearDown(self):
        self.tmp.cleanup()

    def _tesela(self, nombre: str, wbm: np.ndarray, dem: np.ndarray | None = None) -> str:
        ruta_dem = self.base / "dem" / f"Copernicus_DSM_COG_30_{nombre}_DEM.tif"
        _tif(ruta_dem, np.ones(wbm.shape, np.float32) * 100 if dem is None else dem, gdal.GDT_Float32, -32767.0)
        _tif(self.base / "wbm" / f"Copernicus_DSM_COG_30_{nombre}_WBM.tif", wbm, gdal.GDT_Byte)
        return str(ruta_dem)

    def test_tierra_seca_no_cambia(self):
        self.assertIsNone(motivo(self._tesela("N10_00_E010_00", np.zeros((8, 8), np.uint8))))

    def test_un_pixel_de_agua_cambia(self):
        w = np.zeros((8, 8), np.uint8)
        w[3, 4] = 2  # lago
        self.assertEqual(motivo(self._tesela("N10_00_E011_00", w)), "agua")

    def test_dem_sin_dato_cambia(self):
        d = np.ones((8, 8), np.float32) * 100
        d[0, 0] = -32767.0
        self.assertEqual(motivo(self._tesela("N10_00_E012_00", np.zeros((8, 8), np.uint8), d)), "dem sin dato")

    def test_antimeridiano_cambia_aunque_sea_seca(self):
        self.assertEqual(motivo(self._tesela("N65_00_E179_00", np.zeros((8, 8), np.uint8))), "antimeridiano")
        self.assertEqual(motivo(self._tesela("N65_00_W180_00", np.zeros((8, 8), np.uint8))), "antimeridiano")

    def test_sin_wbm_se_marca(self):
        ruta = self._tesela("N10_00_E013_00", np.zeros((8, 8), np.uint8))
        (self.base / "wbm" / "Copernicus_DSM_COG_30_N10_00_E013_00_WBM.tif").unlink()
        self.assertEqual(motivo(ruta), "sin WBM")


if __name__ == "__main__":
    unittest.main()
