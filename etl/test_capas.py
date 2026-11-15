"""Pruebas sintéticas de las funciones puras agregadas en E-04, E-07, E-08 y E-09."""

import unittest

import numpy as np

from e04_temperatura import _bits, _valido, medias_mensuales, resumir_temperatura
from e07_permafrost import limpiar_magt, normalizar_perprob
from e08_viento_polvo import esfuerzo_cortante, nombre_tau
from e09_material import indices_aster, recortar_tesela_aster


class PruebasTemperatura(unittest.TestCase):
    def test_bits_bitwise_count(self):
        arr = np.array([0, 0b1011, 0x80000001, 0xFFFFFFFF], dtype=np.uint32)
        out = _bits(arr)
        self.assertEqual(out.dtype, np.uint8)
        self.assertEqual(out.tolist(), [0, 3, 2, 32])

    def test_valido_filtra_porcentaje_tierra(self):
        lst = np.array([[15000, 15000, 15000]], dtype=np.uint16)  # 300 K
        qc = np.zeros_like(lst, dtype=np.uint8)
        desp = np.full_like(lst, 0b111, dtype=np.uint32)
        tierra = np.array([[49, 50, 100]], dtype=np.uint8)
        out = _valido(lst, qc, desp, tierra)
        self.assertTrue(np.isnan(out[0, 0]))
        self.assertAlmostEqual(float(out[0, 1]), 300.0, places=4)
        self.assertAlmostEqual(float(out[0, 2]), 300.0, places=4)

    def test_medias_mensuales_empareja_dia_y_noche(self):
        pares = [
            (np.array([[300.0]], np.float32), np.array([[np.nan]], np.float32)),
            (np.array([[np.nan]], np.float32), np.array([[270.0]], np.float32)),
            (np.array([[310.0]], np.float32), np.array([[290.0]], np.float32)),
        ]
        dm, nm, rm = medias_mensuales(pares)
        self.assertAlmostEqual(float(dm[0, 0]), 305.0, places=5)
        self.assertAlmostEqual(float(nm[0, 0]), 280.0, places=5)
        # Solo el tercer año tiene día y noche válidos: DTR = 310 - 290 = 20 (no 305 - 280 = 25).
        self.assertAlmostEqual(float(rm[0, 0]), 20.0, places=5)

    def test_medias_mensuales_sin_par_valido_da_nan(self):
        pares = [
            (np.array([[300.0]], np.float32), np.array([[np.nan]], np.float32)),
            (np.array([[np.nan]], np.float32), np.array([[280.0]], np.float32)),
        ]
        dm, nm, rm = medias_mensuales(pares)
        self.assertAlmostEqual(float(dm[0, 0]), 300.0, places=5)
        self.assertAlmostEqual(float(nm[0, 0]), 280.0, places=5)
        self.assertTrue(np.isnan(rm[0, 0]))

    def test_regla_once_meses_y_minimos_independientes(self):
        # Celda 0: 11 meses emparejados (mes 11 falta) -> todo anual y extremo válido.
        # Celda 1: 11 días y 11 noches, pero solo 10 coinciden en el mismo mes -> solo extremos independientes válidos.
        # Celda 2: 6 meses emparejados -> solo medias de 6 meses válidas; anuales y extremos NaN.
        D = np.full((12, 3), np.nan, np.float32)
        N = np.full((12, 3), np.nan, np.float32)
        DTR = np.full((12, 3), np.nan, np.float32)

        D[:11, 0] = np.linspace(290.0, 310.0, 11)
        N[:11, 0] = np.linspace(270.0, 280.0, 11)
        DTR[:11, 0] = D[:11, 0] - N[:11, 0]

        D[:11, 1] = 300.0
        N[1:, 1] = 280.0
        DTR[1:11, 1] = 15.0  # 10 meses emparejados

        D[:6, 2] = 305.0
        N[:6, 2] = 285.0
        DTR[:6, 2] = 20.0

        res = resumir_temperatura(D, N, DTR)
        self.assertAlmostEqual(float(res["amp_anual_k"][0]), 15.0, places=4)
        self.assertAlmostEqual(float(res["lst_media_k"][0]), 287.5, places=4)
        self.assertAlmostEqual(float(res["lst_dia_max_k"][0]), 310.0, places=4)
        self.assertAlmostEqual(float(res["lst_noche_min_k"][0]), 270.0, places=4)
        self.assertAlmostEqual(float(res["dtr_max_k"][0]), 30.0, places=4)
        self.assertEqual(float(res["lst_n_meses"][0]), 11.0)

        # Celda 1: nd=11, nn=11, pero nb=10 y nr=10.
        self.assertAlmostEqual(float(res["lst_dia_max_k"][1]), 300.0, places=4)
        self.assertAlmostEqual(float(res["lst_noche_min_k"][1]), 280.0, places=4)
        self.assertTrue(np.isnan(res["amp_anual_k"][1]))
        self.assertTrue(np.isnan(res["lst_media_k"][1]))
        self.assertTrue(np.isnan(res["dtr_max_k"][1]))
        self.assertAlmostEqual(float(res["rango_diurno_k"][1]), 15.0, places=4)
        self.assertEqual(float(res["lst_n_meses"][1]), 10.0)

        # Celda 2: 6 meses bastan para lst_dia_k, lst_noche_k y rango_diurno_k.
        self.assertAlmostEqual(float(res["lst_dia_k"][2]), 305.0, places=4)
        self.assertAlmostEqual(float(res["lst_noche_k"][2]), 285.0, places=4)
        self.assertAlmostEqual(float(res["rango_diurno_k"][2]), 20.0, places=4)
        self.assertTrue(np.isnan(res["lst_dia_max_k"][2]))
        self.assertTrue(np.isnan(res["amp_anual_k"][2]))
        self.assertEqual(float(res["lst_n_meses"][2]), 6.0)


class PruebasPermafrostYViento(unittest.TestCase):
    def test_limpiar_magt(self):
        v = np.array([-100.0, -5.5, 100.0, -100.1, 100.1, -9999.0, np.inf], np.float32)
        out = limpiar_magt(v)
        self.assertEqual(out[:3].tolist(), [-100.0, -5.5, 100.0])
        self.assertTrue(np.isnan(out[3:]).all())

    def test_normalizar_perprob(self):
        pct = np.array([0.0, 50.0, 100.0, np.nan], np.float32)
        self.assertEqual(normalizar_perprob(pct)[:3].tolist(), [0.0, 0.5, 1.0])
        frac = np.array([0.0, 0.4, 1.0], np.float32)
        np.testing.assert_allclose(normalizar_perprob(frac), frac)
        solo_nan = np.array([np.nan], np.float32)
        self.assertTrue(np.isnan(normalizar_perprob(solo_nan)).all())

    def test_nombre_tau_dos_decimales(self):
        self.assertEqual(nombre_tau(0.02), "viento_frac_tau_gt_0p02")
        self.assertEqual(nombre_tau(0.05), "viento_frac_tau_gt_0p05")
        self.assertEqual(nombre_tau(0.10), "viento_frac_tau_gt_0p10")
        self.assertEqual(nombre_tau(0.20), "viento_frac_tau_gt_0p20")

    def test_esfuerzo_cortante(self):
        rho = np.array([1.2, 1.2, np.nan], np.float32)
        ustar = np.array([0.5, 20.0, 0.5], np.float32)
        tau = esfuerzo_cortante(rho, ustar)
        self.assertAlmostEqual(float(tau[0]), 0.3, places=5)
        self.assertTrue(np.isnan(tau[1]))  # > 100 Pa descartado
        self.assertTrue(np.isnan(tau[2]))


class PruebasAster(unittest.TestCase):
    def test_recorte_borde_y_mascara_agua(self):
        e = np.full((5, 4, 4), 950, dtype=np.int16)
        e[:, 0, 0] = 400  # fuera de 0.5-1 (0.4) -> NaN
        la = np.arange(16, dtype=np.float32).reshape(4, 4)
        lo = np.arange(16, dtype=np.float32).reshape(4, 4)
        lw = np.zeros((4, 4), dtype=np.int16)
        lw[1, 1] = 1       # agua -> NaN
        lw[2, 2] = -9999   # relleno -> NaN

        er, lar, lor = recortar_tesela_aster(e, la, lo, lw)
        self.assertEqual(er.shape, (5, 3, 3))
        self.assertEqual(lar.shape, (3, 3))
        self.assertEqual(lor.shape, (3, 3))
        self.assertTrue(np.isnan(er[:, 0, 0]).all())
        self.assertTrue(np.isnan(er[:, 1, 1]).all())
        self.assertTrue(np.isnan(er[:, 2, 2]).all())
        self.assertAlmostEqual(float(er[0, 0, 1]), 0.95, places=5)

    def test_indices_aster_incluye_ci_y_hereda_nan(self):
        e = np.full((5, 2, 2), 0.9, dtype=np.float32)
        e[0, 0, 0] = 0.8
        e[1, 0, 0] = 0.9
        e[2, 0, 0] = 0.85
        e[3, 0, 0] = 0.96
        e[4, 0, 0] = 0.80
        e[:, 1, 1] = np.nan

        idx = indices_aster(e)
        self.assertAlmostEqual(float(idx["ci"][0, 0]), 0.96 / 0.80, places=5)
        self.assertAlmostEqual(float(idx["mi"][0, 0]), 0.85 / 0.96, places=5)
        self.assertAlmostEqual(float(idx["qi"][0, 0]), (0.9 * 0.9) / (0.8 * 0.85), places=5)
        self.assertTrue(all(np.isnan(idx[k][1, 1]) for k in ("emis", "qi", "mi", "ci")))


if __name__ == "__main__":
    unittest.main()
