import unittest

import numpy as np

from comun_tabla import indices_en_rejilla, sumas_por_celda
from e04_temperatura import _bits


class PruebasPasos(unittest.TestCase):
    def test_bits_cuenta_dias(self):
        self.assertEqual(int(_bits(np.array([0b1011], dtype=np.uint32))[0]), 3)
        self.assertEqual(int(_bits(np.array([0xFFFFFFFF], dtype=np.uint32))[0]), 32)

    def test_rejilla_centro_y_borde(self):
        geo = (-180.0, 0.5, 0.0, 90.0, 0.0, -0.5)
        f, c, dentro = indices_en_rejilla(np.array([89.9, -89.9, 0.1]), np.array([-179.9, 179.9, 0.1]), geo, (360, 720))
        self.assertEqual(f.tolist(), [0, 359, 179])
        self.assertEqual(c.tolist(), [0, 719, 360])
        self.assertTrue(dentro.all())

    def test_sumas_ignoran_nan(self):
        s = sumas_por_celda(np.array([5, 5, 7]), {"x": np.array([1.0, np.nan, 3.0])})
        self.assertEqual(s["ipix"].tolist(), [5, 7])
        self.assertEqual(s["x_s"].tolist(), [1.0, 3.0])
        self.assertEqual(s["x_n"].tolist(), [1, 1])


if __name__ == "__main__":
    unittest.main()
