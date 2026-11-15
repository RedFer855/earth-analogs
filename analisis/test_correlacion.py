"""Sanity tests for analisis/correlacion.py."""

from __future__ import annotations

import unittest

import numpy as np

import correlacion as c


class Pruebas(unittest.TestCase):
    def test_cliff_extremos_y_azar(self) -> None:
        self.assertEqual(c.cliff_delta(np.array([5.0, 6]), np.array([1.0, 2])), 1.0)
        self.assertEqual(c.cliff_delta(np.array([1.0, 2]), np.array([5.0, 6])), -1.0)
        rng = np.random.default_rng(0)
        self.assertLess(abs(c.cliff_delta(rng.normal(size=500), rng.normal(size=500))), 0.1)

    def test_holm(self) -> None:
        self.assertEqual(c.holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06])

    def test_celdas_cerca(self) -> None:
        lat = np.array([0.0, 0.0, 0.0])
        lon = np.array([0.0, 0.05, 1.0])  # 0, ~5.6 km, ~111 km
        self.assertEqual(c.celdas_cerca(lat, lon, 0.0, 0.0, 10.0).tolist(), [0, 1])


if __name__ == "__main__":
    unittest.main()
