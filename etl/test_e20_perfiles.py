"""Pruebas de e20_perfiles.py: escala robusta, correlación, acotado al rango de la Tierra y armado del perfil."""

from __future__ import annotations

import unittest

import numpy as np

from e20_perfiles import VARIABLES, acotar, correlacion, escala_robusta, perfil_de_sitio, sitios_de


def _tierra() -> dict:
    return {v: {"p1": 0.0, "p99_9": 30.0, "escala": 2.0} for v in VARIABLES}


def _sitio(**extra) -> dict:
    t = {v: {"mediana": 5.0, "mad": 1.0} for v in VARIABLES}
    return {"nombre": "Prueba", "terreno": t, **extra}


class TestE20(unittest.TestCase):
    def test_escala_toma_el_mayor_de_mad_e_interdecil(self) -> None:
        # mitad en 0 y mitad en 10: MAD = 5 -> 7.413; (P90 - P10) / 2.56 = 3.906
        x = np.r_[np.zeros(500), np.full(500, 10.0)].astype(np.float32)
        self.assertAlmostEqual(escala_robusta(x), 1.4826 * 5.0, places=4)
        # casi todo en 0: MAD = 0, manda el interdecil
        y = np.r_[np.zeros(850), np.linspace(1, 10, 150)].astype(np.float32)
        p10, p90 = np.percentile(y, [10, 90])
        self.assertAlmostEqual(escala_robusta(y), (p90 - p10) / 2.56, places=5)
        # constante: piso de 0.01; NaN no cuenta
        self.assertEqual(escala_robusta(np.array([3.0, 3.0, np.nan], dtype=np.float32)), 0.01)

    def test_correlacion_simetrica_con_diagonal_uno(self) -> None:
        rng = np.random.default_rng(1)
        a = rng.normal(size=5000).astype(np.float32)
        b = (2 * a + rng.normal(scale=0.1, size=5000)).astype(np.float32)
        c = rng.normal(size=5000).astype(np.float32)
        r = correlacion([a, b, c], np.arange(5000))
        self.assertEqual([r[i][i] for i in range(3)], [1.0, 1.0, 1.0])
        self.assertEqual(r[0][1], r[1][0])
        self.assertGreater(r[0][1], 0.99)
        self.assertLess(abs(r[0][2]), 0.05)
        with self.assertRaises(ValueError):
            correlacion([a, np.ones(5000, dtype=np.float32)], np.arange(5000))

    def test_acotar_guarda_el_valor_real(self) -> None:
        self.assertEqual(acotar(5.0, 0.0, 30.0), (5.0, None))
        self.assertEqual(acotar(45.0, 0.0, 30.0), (30.0, 45.0))
        self.assertEqual(acotar(-1.0, 0.0, 30.0), (0.0, -1.0))

    def test_perfil_luna_con_diagnostico_y_contraccion(self) -> None:
        corr = np.eye(4).tolist()
        p = perfil_de_sitio(_sitio(rango_diurno_k=250.0), "luna", _tierra(), corr)
        self.assertEqual(p["variables"], VARIABLES)
        self.assertEqual(p["objetivo"]["slope_mean_deg"], 5.0)
        self.assertEqual(p["tolerancia"]["relieve_mean_m"], 1.0)
        self.assertEqual(p["lambda_contraccion"], 0.85)
        self.assertEqual(p["diagnostico"], {"rango_diurno_k": 250.0})
        self.assertNotIn("rango_diurno_k", p["variables"])

    def test_perfil_marte_lee_las_claves_del_mcd(self) -> None:
        s = _sitio(mcd_rango_diurno_k=80.0, mcd_amp_anual_k=60.0)
        s["terreno"]["slope_mean_deg"]["mediana"] = 40.0
        p = perfil_de_sitio(s, "marte", _tierra(), np.eye(4).tolist())
        self.assertEqual(p["lambda_contraccion"], 0.50)
        self.assertEqual(p["diagnostico"], {"rango_diurno_k": 80.0, "amp_anual_k": 60.0})
        self.assertEqual(p["objetivo"]["slope_mean_deg"], 30.0)
        self.assertEqual(p["fuera_del_alcance_de_la_tierra"], {"slope_mean_deg": {"objetivo_real": 40.0}})

    def test_sitio_sin_terreno_se_omite(self) -> None:
        s = _sitio()
        s["terreno"]["rug_rms_mean_m"]["mediana"] = float("nan")
        self.assertIsNone(perfil_de_sitio(s, "luna", _tierra(), np.eye(4).tolist()))
        self.assertIsNone(perfil_de_sitio({"nombre": "x"}, "marte", _tierra(), np.eye(4).tolist()))

    def test_sitios_de_lee_regiones_o_sitios(self) -> None:
        self.assertEqual(sitios_de({"regiones": {"A": 1}}), {"A": 1})
        self.assertEqual(sitios_de({"sitios": {"B": 2}}), {"B": 2})


if __name__ == "__main__":
    unittest.main()
