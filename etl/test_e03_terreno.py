import unittest

import numpy as np

from e03_terreno import _metros_por_grado


class PruebasMetros(unittest.TestCase):
    def test_ecuador(self):
        m, n = _metros_por_grado(np.array([0.0]))
        self.assertAlmostEqual(float(m[0]), 110574, delta=2)
        self.assertAlmostEqual(float(n[0]), 111320, delta=2)

    def test_60_grados(self):
        m, n = _metros_por_grado(np.array([60.0]))
        self.assertAlmostEqual(float(n[0]), 55800, delta=50)


if __name__ == "__main__":
    unittest.main()
