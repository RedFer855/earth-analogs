import unittest
from unittest.mock import patch

import numpy as np

import e03_terreno
from e03_terreno import LIMITE_POLAR, _metros_por_grado, horn


class PruebasMetros(unittest.TestCase):
    def test_ecuador(self):
        m, n = _metros_por_grado(np.array([0.0]))
        self.assertAlmostEqual(float(m[0]), 110574, delta=2)
        self.assertAlmostEqual(float(n[0]), 111320, delta=2)

    def test_60_grados(self):
        m, n = _metros_por_grado(np.array([60.0]))
        self.assertAlmostEqual(float(n[0]), 55800, delta=50)


class PruebasCompatibilidad(unittest.TestCase):
    def test_exporta_simbolos_y_delega_main(self):
        self.assertEqual(LIMITE_POLAR, 88)
        self.assertTrue(callable(horn))
        with patch("e03_extras.main", return_value=7) as mock_main:
            self.assertEqual(e03_terreno.main(), 7)
            mock_main.assert_called_once_with()


if __name__ == "__main__":
    unittest.main()
