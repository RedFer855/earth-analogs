"""Pruebas unitarias para objetivos_comun.py (parches, resumen y muestreo circular)."""

from __future__ import annotations

import math
import unittest

import numpy as np

from objetivos_comun import parches, puntos_circulo, resumen, resumir_parches


def _distancia_gran_circulo(lat1: float, lon1: float, lat2: np.ndarray, lon2: np.ndarray, radio: float) -> np.ndarray:
    p1, l1 = math.radians(lat1), math.radians(lon1)
    p2, l2 = np.radians(lat2), np.radians(lon2)
    a = np.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * np.cos(p2) * np.sin((l2 - l1) / 2) ** 2
    return 2 * radio * np.arcsin(np.minimum(1.0, np.sqrt(a)))


class TestObjetivosComun(unittest.TestCase):
    def test_plano_inclinado_misma_pendiente_y_mad_nula(self) -> None:
        paso = 200.0
        filas, cols = 42, 42  # interior 40x40 -> 5x5 parches de 8x8
        yy, xx = np.mgrid[0:filas, 0:cols]
        gx, gy = 0.20, 0.10
        z = gx * (xx * paso) + gy * (yy * paso)
        sx = np.full((filas, 1), paso)
        mascara = np.ones((filas, cols), dtype=bool)

        ps = parches(z, sx, paso, mascara, tam_m=1600.0)
        self.assertEqual(len(ps), 25)
        pend_esp = math.degrees(math.atan(math.hypot(gx, gy)))
        for p in ps:
            self.assertAlmostEqual(p["slope_mean_deg"], pend_esp, places=9)
            self.assertAlmostEqual(p["slope_p90_deg"], pend_esp, places=9)
            self.assertAlmostEqual(p["slope_p99_deg"], pend_esp, places=9)
            self.assertAlmostEqual(p["slope_std_deg"], 0.0, places=9)
            self.assertEqual(p["slope_frac_gt15"], 0.0)
            self.assertEqual(p["frac_valida"], 1.0)

        res = resumir_parches(ps)
        self.assertIsNotNone(res["slope_mean_deg"])
        self.assertAlmostEqual(res["slope_mean_deg"]["mediana"], pend_esp, places=9)
        self.assertAlmostEqual(res["slope_mean_deg"]["mad"], 0.0, places=9)
        self.assertEqual(res["slope_mean_deg"]["n_parches"], 25)

    def test_parches_omiten_centro_fuera_y_pocos_datos(self) -> None:
        paso = 200.0
        filas, cols = 18, 18  # interior 16x16 -> 2x2 parches de 8x8
        z = np.zeros((filas, cols), dtype=np.float64)
        # Cada cuadrante de z lleva una elevación distinta para identificar qué parches entran
        z[:9, :9] = 10.0
        z[:9, 9:] = 20.0
        z[9:, :9] = 30.0
        z[9:, 9:] = 40.0

        mascara = np.ones((filas, cols), dtype=bool)
        # En el parche superior derecho (interior cols 8..16, centro interior col 12 -> z col 13), quitar centro
        mascara[5, 13] = False
        # En el parche inferior izquierdo, dejar sin dato suficiente (> mitad de Horn en NaN)
        z[9:15, 1:9] = np.nan

        ps = parches(z, np.full((filas, 1), paso), paso, mascara, tam_m=1600.0)
        elevs = sorted(round(p["elev_mean_m"]) for p in ps)
        # Solo entran el parche superior izquierdo (10 m) y el inferior derecho (40 m)
        self.assertEqual(elevs, [10, 40])

    def test_parches_sx_por_fila(self) -> None:
        filas, cols = 22, 26
        yy, xx = np.mgrid[0:filas, 0:cols]
        sy = 200.0
        sx = np.linspace(150.0, 170.0, filas)[:, None]
        z = 0.05 * (yy * sy)
        mascara = np.ones((filas, cols), dtype=bool)
        ps = parches(z, sx, sy, mascara, tam_m=1600.0)
        self.assertGreater(len(ps), 0)
        pend_esp = math.degrees(math.atan(0.05))
        for p in ps:
            self.assertAlmostEqual(p["slope_mean_deg"], pend_esp, places=8)

    def test_resumen_valores_conocidos(self) -> None:
        r = resumen([10.0, 20.0, 30.0, 40.0, 50.0, np.nan, np.inf])
        self.assertIsNotNone(r)
        self.assertEqual(r["n_parches"], 5)
        self.assertAlmostEqual(r["mediana"], 30.0)
        self.assertAlmostEqual(r["media"], 30.0)
        self.assertAlmostEqual(r["mad"], 14.826)
        self.assertAlmostEqual(r["p10"], 14.0)
        self.assertAlmostEqual(r["p90"], 46.0)

        self.assertIsNone(resumen([]))
        self.assertIsNone(resumen([np.nan, -np.inf]))

    def test_puntos_circulo_conteo_y_radio(self) -> None:
        lat0, lon0 = 20.0, 77.5
        radio_m = 50_000.0
        radio_marte = 3_396_190.0
        paso_m = 200.0

        lats, lons = puntos_circulo(lat0, lon0, radio_m, radio_marte, paso_m)
        esperado = math.pi * (radio_m / paso_m) ** 2
        self.assertAlmostEqual(lats.size, esperado, delta=esperado * 0.02)

        dist = _distancia_gran_circulo(lat0, lon0, lats, lons, radio_marte)
        self.assertTrue(np.all(dist <= radio_m + 1e-6))


if __name__ == "__main__":
    unittest.main()
