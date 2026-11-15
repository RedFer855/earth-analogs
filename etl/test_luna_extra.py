"""Pruebas sintéticas para las adiciones de E-11 (Mazarico/Mini-RF) y E-05 (máscara VI Quality)."""

from __future__ import annotations

import unittest

import numpy as np

from e05_ndvi import VI_QUALITY_NODATA, CurvaClimatologica, anio_y_dia, es_tierra_vi_quality, filtrar_ndvi
from e11_luna import (
    ESCALA_AVGVISIB,
    ESCALA_LPSR,
    NODATA_MAZARICO,
    OFFSET_AVGVISIB,
    OFFSET_LPSR,
    decodificar_escala,
    limpiar_minirf_cpr,
    resumir_cpr,
    resumir_iluminacion,
    validar_metricas_luna,
)


class PruebasMazaricoYMiniRF(unittest.TestCase):
    def test_decodificar_avgvisib_y_lpsr(self) -> None:
        raw_vis = np.array([[0, 10000, 22396, NODATA_MAZARICO]], dtype=np.int16)
        vis = decodificar_escala(raw_vis, NODATA_MAZARICO, ESCALA_AVGVISIB, OFFSET_AVGVISIB)
        self.assertAlmostEqual(float(vis[0, 0]), 0.0, places=7)
        self.assertAlmostEqual(float(vis[0, 1]), 0.4, places=7)
        self.assertAlmostEqual(float(vis[0, 2]), 0.89584, places=7)
        self.assertTrue(np.isnan(vis[0, 3]))

        raw_psr = np.array([[-20000, 20000, NODATA_MAZARICO]], dtype=np.int16)
        psr = decodificar_escala(raw_psr, NODATA_MAZARICO, ESCALA_LPSR, OFFSET_LPSR)
        self.assertAlmostEqual(float(psr[0, 0]), 0.0, places=7)
        self.assertAlmostEqual(float(psr[0, 1]), 1.0, places=7)
        self.assertTrue(np.isnan(psr[0, 2]))

    def test_resumir_iluminacion_y_fraccion_psr(self) -> None:
        visib = np.array([[0.1, 0.2, 0.3, 0.9], [0.4, np.nan, 0.8, 0.95]], dtype=np.float64)
        lpsr = np.array([[0.0, 1.0, 0.0, 1.0], [1.0, np.nan, 0.0, 1.0]], dtype=np.float64)
        mascara = np.array([[True, True, True, False], [True, True, True, False]], dtype=bool)

        r = resumir_iluminacion(visib, lpsr, mascara)
        self.assertEqual(r["pixeles_iluminacion"], 5)
        self.assertEqual(r["pixeles_psr"], 5)
        self.assertAlmostEqual(r["iluminacion_mediana"], 0.3, places=7)
        self.assertAlmostEqual(r["iluminacion_mad"], 0.14826, places=7)
        self.assertAlmostEqual(r["iluminacion_p90"], 0.64, places=7)
        self.assertAlmostEqual(r["psr_frac"], 0.4, places=7)

        vacio = resumir_iluminacion(np.full((2, 2), np.nan), np.full((2, 2), np.nan), np.ones((2, 2), dtype=bool))
        self.assertIsNone(vacio["iluminacion_mediana"])
        self.assertIsNone(vacio["psr_frac"])
        self.assertEqual(vacio["pixeles_iluminacion"], 0)
        self.assertEqual(vacio["pixeles_psr"], 0)

    def test_limpiar_minirf_cpr_y_resumen(self) -> None:
        nodata_isis = -3.4028226550889045e38
        arr = np.array(
            [[0.011, 0.48, 1.35, 2.51], [nodata_isis, -0.05, np.nan, np.inf]],
            dtype=np.float32,
        )
        cpr = limpiar_minirf_cpr(arr, nodata_isis)
        self.assertTrue(np.isfinite(cpr[0]).all())
        self.assertAlmostEqual(float(cpr[0, 2]), 1.35, places=5)
        self.assertAlmostEqual(float(cpr[0, 3]), 2.51, places=5)
        self.assertTrue(np.isnan(cpr[1]).all())

        datos = np.array([[0.2, 0.4, 1.4], [nodata_isis, 0.6, -1.0]], dtype=np.float32)
        cpr2 = limpiar_minirf_cpr(datos, nodata_isis)
        res = resumir_cpr(cpr2, np.ones((2, 3), dtype=bool))
        self.assertEqual(res["pixeles_minirf"], 4)
        self.assertAlmostEqual(res["minirf_frac_valida"], 4.0 / 6.0, places=6)
        self.assertAlmostEqual(res["minirf_cpr_mediana"], 0.5, places=5)
        self.assertAlmostEqual(res["minirf_cpr_mad"], 1.4826 * 0.2, places=5)
        self.assertAlmostEqual(res["minirf_cpr_p90"], 1.16, places=5)

    def test_validar_metricas_luna(self) -> None:
        base = {
            "R1": {
                "iluminacion_mediana": 0.22,
                "iluminacion_p90": 0.65,
                "psr_frac": 0.15,
                "minirf_cpr_mediana": 0.48,
                "minirf_cpr_p90": 1.45,
            }
        }
        self.assertEqual(validar_metricas_luna(base), [])
        self.assertEqual(
            validar_metricas_luna({"R1": {**base["R1"], "minirf_cpr_mediana": None, "minirf_cpr_p90": None}}),
            [],
        )
        self.assertTrue(validar_metricas_luna({"R1": {**base["R1"], "psr_frac": 1.2}}))
        self.assertTrue(validar_metricas_luna({"R1": {**base["R1"], "iluminacion_p90": 1.05}}))
        self.assertTrue(validar_metricas_luna({"R1": {**base["R1"], "minirf_cpr_mediana": -0.1}}))


class PruebasMod13c1ViQuality(unittest.TestCase):
    def test_bits_11_a_13_aceptan_tierra_y_costa(self) -> None:
        ruido_otros_bits = 0xC555  # bits 11-13 en 0, resto con 1s mezclados
        codigos = np.array([0, 1, 2, 3, 4, 5, 6, 7], dtype=np.uint16)
        viq = np.append((codigos << 11) | ruido_otros_bits, np.uint16(VI_QUALITY_NODATA))

        tierra = es_tierra_vi_quality(viq)
        self.assertEqual(tierra.tolist(), [False, True, True, False, False, False, False, False, False])

    def test_filtrar_ndvi_con_mascara_y_fiabilidad(self) -> None:
        # 6 píxeles: tierra buena, costa (2), agua interior somera (3), océano profundo (7), tierra con nube (fiab=3),
        # tierra relleno (-3000)
        ndvi = np.array([5000, 5000, 5000, 5000, 5000, -3000], dtype=np.int16)
        fiab = np.array([0, 1, 0, 0, 3, 0], dtype=np.int8)
        viq = np.array([1 << 11, 2 << 11, 3 << 11, 7 << 11, 1 << 11, 1 << 11], dtype=np.uint16)

        out = filtrar_ndvi(ndvi, fiab, viq)
        self.assertAlmostEqual(float(out[0]), 0.5, places=5)
        self.assertAlmostEqual(float(out[1]), 0.5, places=5)
        self.assertTrue(np.isnan(out[2:]).all())


class PruebasCurvaClimatologica(unittest.TestCase):
    def test_maximo_de_la_media_por_dia_del_anio(self) -> None:
        # 3 píxeles, 2 años, 4 días del año. Píxel 0: la media por día sube y baja; píxel 1: solo 2 días con dato;
        # píxel 2: un año sin dato en el pico (la media de ese día usa solo el año con dato).
        nan = np.nan
        datos = {  # día -> (año 1, año 2)
            1: ([0.1, 0.2, 0.1], [0.3, nan, 0.1]),
            17: ([0.5, 0.4, 0.2], [0.7, nan, 0.4]),
            33: ([0.4, nan, 0.9], [0.2, nan, nan]),
            49: ([0.1, nan, 0.3], [0.1, nan, 0.3]),
        }
        curva = CurvaClimatologica()
        for dia, anios in datos.items():
            for v in anios:
                curva.agregar(dia, np.array(v, dtype=np.float32))
        r = curva.resultado()
        self.assertAlmostEqual(float(r[0]), 0.6, places=5)  # media del día 17
        self.assertTrue(np.isnan(r[1]))  # 2 días con dato < 3
        self.assertAlmostEqual(float(r[2]), 0.9, places=5)  # día 33, solo un año con dato
        self.assertEqual(curva.n_periodos.tolist(), [4, 2, 4])

    def test_anio_y_dia_del_nombre(self) -> None:
        self.assertEqual(anio_y_dia("MOD13C1.A2018353.061.2021313104545.hdf"), (2018, 353))


if __name__ == "__main__":
    unittest.main()
