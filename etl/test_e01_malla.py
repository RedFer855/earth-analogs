import unittest

from e01_malla import esquina_tesela


class PruebasTesela(unittest.TestCase):
    def test_norte_este(self):
        self.assertEqual(esquina_tesela("Copernicus_DSM_COG_30_N56_00_E094_00_WBM.tif"), (56, 94))

    def test_sur_oeste(self):
        self.assertEqual(esquina_tesela("Copernicus_DSM_COG_30_S12_00_W077_00_WBM.tif"), (-12, -77))


if __name__ == "__main__":
    unittest.main()
