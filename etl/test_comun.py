import unittest

import numpy as np

from comun import NPIX, autalica_a_geodesica, geodesica_a_autalica, nombre_tesela_glo90


class PruebasLatitud(unittest.TestCase):
    def test_ida_y_vuelta(self):
        phi = np.linspace(-89.9, 89.9, 2001)
        vuelta = autalica_a_geodesica(geodesica_a_autalica(phi))
        self.assertLess(np.max(np.abs(vuelta - phi)), 1e-6)

    def test_ecuador_y_polos(self):
        self.assertAlmostEqual(float(autalica_a_geodesica(0.0)), 0.0, places=12)
        self.assertAlmostEqual(float(autalica_a_geodesica(90.0)), 90.0, places=9)

    def test_diferencia_maxima_cerca_de_45(self):
        # La diferencia autálica-geodésica en WGS84 ronda 0.128° cerca de 45°.
        d = float(autalica_a_geodesica(45.0) - 45.0)
        self.assertTrue(0.12 < d < 0.135, d)


class PruebasMalla(unittest.TestCase):
    def test_npix(self):
        self.assertEqual(NPIX, 201_326_592)
        self.assertLess(NPIX, 2**32)

    def test_nombre_tesela(self):
        self.assertEqual(nombre_tesela_glo90(-12, -77), "Copernicus_DSM_COG_30_S12_00_W077_00")
        self.assertEqual(nombre_tesela_glo90(5, 6), "Copernicus_DSM_COG_30_N05_00_E006_00")


if __name__ == "__main__":
    unittest.main()
