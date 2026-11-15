"""Pruebas unitarias para la integración de MCD 6.2 en e12_marte.py."""

from __future__ import annotations

import math
import unittest
from pathlib import Path
from unittest.mock import patch

import numpy as np

import e12_marte
from e12_marte import (
    ADVERTENCIA_MCD_TSURF,
    CAMPOS_MCD_LOCAL,
    G_MARTE,
    GEO_MCD,
    R_GAS_MARTE,
    _leer_temp_nivel_bajo_netcdf,
    corregir_ps_hidrostatica,
    interpolar_campo_mcd,
    interpolar_mcd_sitio,
    resumir_mcd_sitio,
    validar_mcd_sitios,
)


def _sitio_valido(tsurf_media: float = 210.0, ps_media: float = 650.0, elev_m: float | None = None) -> dict:
    sitio = {
        "mcd_tsurf_media_k": tsurf_media,
        "mcd_rango_diurno_k": 40.0,
        "mcd_amp_anual_k": 30.0,
        "mcd_tsurf_max_k": tsurf_media + 35.0,
        "mcd_tsurf_min_k": tsurf_media - 35.0,
        "mcd_ps_media_pa": ps_media,
    }
    if elev_m is not None:
        sitio["terreno"] = {"elev_mean_m": {"mediana": elev_m}}
    return sitio


class TestMarteMcd(unittest.TestCase):
    def test_interpolacion_en_nodo_devuelve_valor_exacto(self) -> None:
        bandas, lats, lons = np.ogrid[0:12, 0:49, 0:64]
        t_grid = 150.0 + bandas + 0.5 * lats + 0.25 * lons
        p_grid = 400.0 + 2.0 * bandas + 3.0 * lats + lons
        # Vecino con NaN no debe contaminar la lectura exacta en el nodo (10, 16)
        t_grid[:, 10, 17] = np.nan

        # Nodo (fila=10, col=16): lat = 90 - 10*3.75 = 52.5, lon = -180 + 16*5.625 = -90.0 (270.0 E)
        t_neg, p_neg = interpolar_mcd_sitio(t_grid, p_grid, 52.5, -90.0, GEO_MCD)
        t_pos, p_pos = interpolar_mcd_sitio(t_grid, p_grid, 52.5, 270.0, GEO_MCD)
        np.testing.assert_allclose(t_neg, t_grid[:, 10, 16], rtol=0.0, atol=1e-12)
        np.testing.assert_allclose(p_neg, p_grid[:, 10, 16], rtol=0.0, atol=1e-12)
        np.testing.assert_allclose(t_pos, t_grid[:, 10, 16], rtol=0.0, atol=1e-12)
        np.testing.assert_allclose(p_pos, p_grid[:, 10, 16], rtol=0.0, atol=1e-12)

        # Polos y borde 180/-180
        t_pn, _ = interpolar_mcd_sitio(t_grid, p_grid, 90.0, 180.0, GEO_MCD)
        t_ps, _ = interpolar_mcd_sitio(t_grid, p_grid, -90.0, 0.0, GEO_MCD)
        np.testing.assert_allclose(t_pn, t_grid[:, 0, 0], rtol=0.0, atol=1e-12)
        np.testing.assert_allclose(t_ps, t_grid[:, 48, 32], rtol=0.0, atol=1e-12)

    def test_interpolacion_envuelve_longitud_en_180(self) -> None:
        t_grid = np.zeros((12, 49, 64), dtype=np.float64)
        p_grid = np.zeros((12, 49, 64), dtype=np.float64)
        # col 63 está en 174.375° E; col 0 está en -180° (== +180° E)
        t_grid[:, 23, 63] = 180.0
        t_grid[:, 23, 0] = 220.0
        t_grid[:, 24, 63] = 200.0
        t_grid[:, 24, 0] = 240.0
        p_grid[:, 24, 63] = 500.0
        p_grid[:, 24, 0] = 700.0

        # Punto medio exacto en longitud (177.1875° E y -182.8125° E) sobre la fila 24 (lat = 0°)
        t_mid, p_mid = interpolar_mcd_sitio(t_grid, p_grid, 0.0, 177.1875, GEO_MCD)
        t_mid_wrap, p_mid_wrap = interpolar_mcd_sitio(t_grid, p_grid, 0.0, -182.8125, GEO_MCD)
        np.testing.assert_allclose(t_mid, 220.0, rtol=0.0, atol=1e-12)
        np.testing.assert_allclose(p_mid, 600.0, rtol=0.0, atol=1e-12)
        np.testing.assert_allclose(t_mid_wrap, 220.0, rtol=0.0, atol=1e-12)
        np.testing.assert_allclose(p_mid_wrap, 600.0, rtol=0.0, atol=1e-12)

        # Mezcla bilineal entre filas 23 (3.75°) y 24 (0.0°) a 1/4 entre 174.375° y 180.0° (175.78125°)
        t_bil, _ = interpolar_mcd_sitio(t_grid, p_grid, 1.875, 175.78125, GEO_MCD)
        np.testing.assert_allclose(t_bil, 200.0, rtol=0.0, atol=1e-12)

    def test_formulas_rango_diurno_y_amplitud_anual(self) -> None:
        t_full = np.full((12, 12, 49, 64), np.nan, dtype=np.float64)
        p_full = np.full((12, 12, 49, 64), np.nan, dtype=np.float64)
        # Nodo (fila=20, col=10): lat = 90 - 20*3.75 = 15.0, lon = -180 + 10*5.625 = -123.75 (236.25 E)
        for m in range(12):
            base_m = 180.0 + 4.0 * m
            delta_m = 10.0 + m
            t_full[m, :, 20, 10] = base_m + np.linspace(-delta_m, delta_m, 12)
            p_full[m, :, 20, 10] = 600.0 + m

        t_sitio, p_sitio = interpolar_mcd_sitio(t_full, p_full, 15.0, 236.25, GEO_MCD)
        ps_corr = p_sitio * 1.1
        res = resumir_mcd_sitio(t_sitio, p_sitio, ps_corr, z_gcm_m=-1200.0, z_sitio_m=-2200.0)

        self.assertEqual(tuple(res.keys()), CAMPOS_MCD_LOCAL)
        self.assertIn("mcd_ps_grid_media_pa", CAMPOS_MCD_LOCAL)
        self.assertIn("mcd_z_gcm_m", CAMPOS_MCD_LOCAL)
        self.assertIn("mcd_dz_m", CAMPOS_MCD_LOCAL)
        self.assertIn("tsurf", ADVERTENCIA_MCD_TSURF)
        self.assertAlmostEqual(res["mcd_tsurf_media_k"], 202.0, places=12)
        self.assertAlmostEqual(res["mcd_rango_diurno_k"], 31.0, places=12)
        self.assertAlmostEqual(res["mcd_amp_anual_k"], 44.0, places=12)
        self.assertAlmostEqual(res["mcd_tsurf_min_k"], 170.0, places=12)
        self.assertAlmostEqual(res["mcd_tsurf_max_k"], 245.0, places=12)
        self.assertAlmostEqual(res["mcd_ps_grid_media_pa"], 605.5, places=12)
        self.assertAlmostEqual(res["mcd_ps_media_pa"], 605.5 * 1.1, places=12)
        self.assertAlmostEqual(res["mcd_z_gcm_m"], -1200.0, places=12)
        self.assertAlmostEqual(res["mcd_dz_m"], -1000.0, places=12)

    def test_correccion_hidrostatica_dz_cero_y_escala(self) -> None:
        ps_grid = np.full((12, 12), 700.0, dtype=np.float64)
        t1 = np.full((12, 12), 200.0, dtype=np.float64)
        h = (R_GAS_MARTE * 200.0) / G_MARTE

        # dz = 0 deja ps sin cambios
        ps_dz0 = corregir_ps_hidrostatica(ps_grid, t1, z_sitio_m=-2500.0, z_gcm_m=-2500.0)
        np.testing.assert_allclose(ps_dz0, ps_grid, rtol=0.0, atol=1e-12)

        # dz = +H da ps / e
        ps_dz_h = corregir_ps_hidrostatica(ps_grid, t1, z_sitio_m=-2500.0 + h, z_gcm_m=-2500.0)
        np.testing.assert_allclose(ps_dz_h, ps_grid / math.e, rtol=1e-12, atol=1e-12)

        # Sitio más bajo que el modelo (dz < 0) aumenta ps; también verifica orografía 2D
        orog = np.zeros((49, 64), dtype=np.float64)
        orog[24, 32] = -2000.0
        z_gcm = float(interpolar_campo_mcd(orog, 0.0, 0.0, GEO_MCD))
        self.assertAlmostEqual(z_gcm, -2000.0, places=12)
        ps_bajo = corregir_ps_hidrostatica(ps_grid, t1, z_sitio_m=-4500.0, z_gcm_m=z_gcm)
        self.assertTrue(np.all(ps_bajo > ps_grid))

    def test_datos_faltantes_devuelven_nan(self) -> None:
        res_vacio = resumir_mcd_sitio(None, None)
        for campo in CAMPOS_MCD_LOCAL:
            self.assertTrue(math.isnan(res_vacio[campo]), msg=f"{campo} debería ser NaN")

        t_ok = np.full((12, 12), 210.0, dtype=np.float64)
        p_malo = np.full((12, 12), 600.0, dtype=np.float64)
        p_malo[3, 5] = np.nan
        res_parcial = resumir_mcd_sitio(t_ok, p_malo)
        self.assertAlmostEqual(res_parcial["mcd_tsurf_media_k"], 210.0, places=12)
        self.assertTrue(math.isnan(res_parcial["mcd_ps_media_pa"]))
        self.assertTrue(math.isnan(res_parcial["mcd_ps_grid_media_pa"]))

        # Sin elevación del sitio: ps corregida y dz quedan NaN, ps_grid y z_gcm se conservan
        p_ok = np.full((12, 12), 620.0, dtype=np.float64)
        ps_sin_elev = corregir_ps_hidrostatica(p_ok, t_ok, z_sitio_m=None, z_gcm_m=-1800.0)
        self.assertTrue(np.all(np.isnan(ps_sin_elev)))
        res_sin_elev = resumir_mcd_sitio(t_ok, p_ok, ps_sin_elev, z_gcm_m=-1800.0, z_sitio_m=None)
        self.assertAlmostEqual(res_sin_elev["mcd_ps_grid_media_pa"], 620.0, places=12)
        self.assertAlmostEqual(res_sin_elev["mcd_z_gcm_m"], -1800.0, places=12)
        self.assertTrue(math.isnan(res_sin_elev["mcd_ps_media_pa"]))
        self.assertTrue(math.isnan(res_sin_elev["mcd_dz_m"]))

    def test_validaciones_mcd_y_elevacion(self) -> None:
        sitios_ok = {
            "BAJO": _sitio_valido(215.0, 850.0, elev_m=-4000.0),
            "ALTO": _sitio_valido(195.0, 420.0, elev_m=3000.0),
        }
        fallos, avisos = validar_mcd_sitios(sitios_ok)
        self.assertEqual(fallos, [])
        self.assertEqual(avisos, [])

        sitios_inv = {
            "BAJO": _sitio_valido(215.0, 400.0, elev_m=-4000.0),
            "ALTO": _sitio_valido(195.0, 700.0, elev_m=3000.0),
        }
        fallos_inv, _ = validar_mcd_sitios(sitios_inv)
        self.assertEqual(len(fallos_inv), 1)

        sitios_sin_elev = {
            "A": _sitio_valido(210.0, 650.0),
            "B": _sitio_valido(205.0, 600.0),
        }
        fallos_se, avisos_se = validar_mcd_sitios(sitios_sin_elev)
        self.assertEqual(fallos_se, [])
        self.assertEqual(len(avisos_se), 1)

        sitio_malo = {
            "MAL": {
                "mcd_tsurf_media_k": 115.0,
                "mcd_rango_diurno_k": 0.0,
                "mcd_amp_anual_k": 10.0,
                "mcd_tsurf_max_k": 340.0,
                "mcd_tsurf_min_k": 110.0,
                "mcd_ps_media_pa": 1600.0,
            }
        }
        fallos_malo, _ = validar_mcd_sitios(sitio_malo)
        self.assertGreaterEqual(len(fallos_malo), 5)

    def test_regla_pares_desnivel_1500m(self) -> None:
        # El más bajo (-4500) tiene mayor ps que el más alto (3000), pero un par intermedio
        # con desnivel de 2000 m (> 1500 m) está invertido y debe hacer fallar la validación.
        sitios_par_inv = {
            "GALE": _sitio_valido(215.0, 900.0, elev_m=-4500.0),
            "MEDIO_BAJO": _sitio_valido(210.0, 620.0, elev_m=-2500.0),
            "MEDIO_ALTO": _sitio_valido(205.0, 680.0, elev_m=-500.0),
            "ALTO": _sitio_valido(190.0, 350.0, elev_m=3000.0),
        }
        fallos, _ = validar_mcd_sitios(sitios_par_inv)
        self.assertEqual(len(fallos), 1)
        self.assertIn("MEDIO_BAJO", fallos[0])
        self.assertIn("MEDIO_ALTO", fallos[0])

        # Si el desnivel entre dos sitios intermedios es <= 1500 m, la regla de pares no falla
        sitios_desnivel_menor = {
            "GALE": _sitio_valido(215.0, 900.0, elev_m=-4500.0),
            "PAR_A": _sitio_valido(210.0, 640.0, elev_m=-2000.0),
            "PAR_B": _sitio_valido(208.0, 660.0, elev_m=-800.0),
            "ALTO": _sitio_valido(190.0, 350.0, elev_m=3000.0),
        }
        fallos_ok, _ = validar_mcd_sitios(sitios_desnivel_menor)
        self.assertEqual(fallos_ok, [])

    def test_leer_temp_nivel_bajo_selecciona_por_metadatos(self) -> None:
        class _BandaFalsa:
            def __init__(self, alt: float, tiempo: float, val: float) -> None:
                self._meta = {
                    "NETCDF_DIM_altitude": str(alt),
                    "NETCDF_DIM_Time": str(tiempo),
                }
                self._arr = np.full((49, 64), val, dtype=np.float32)

            def GetMetadata(self) -> dict[str, str]:
                return self._meta

            def GetNoDataValue(self) -> None:
                return None

            def ReadAsArray(self) -> np.ndarray:
                return self._arr

        class _DsFalso:
            def __init__(self) -> None:
                # Orden desordenado: primero nivel alto, y tiempos desordenados (10 antes de 2)
                tiempos = [10, 0, 22, 2, 18, 4, 14, 6, 20, 8, 16, 12]
                self._bandas = [
                    *(_BandaFalsa(0.05, float(t), 150.0 + t) for t in tiempos),
                    *(_BandaFalsa(0.0045, float(t), 200.0 + t) for t in tiempos),
                ]
                self.RasterCount = len(self._bandas)

            def GetRasterBand(self, idx: int) -> _BandaFalsa:
                return self._bandas[idx - 1]

            def GetGeoTransform(self) -> tuple[float, ...]:
                return GEO_MCD

        with patch.object(e12_marte.gdal, "Open", return_value=_DsFalso()):
            temp, geo = _leer_temp_nivel_bajo_netcdf(Path("clim_01_me.nc"))

        self.assertEqual(geo, GEO_MCD)
        self.assertEqual(temp.shape, (12, 49, 64))
        esperados = np.array([200.0 + 2 * i for i in range(12)], dtype=np.float64)
        np.testing.assert_allclose(temp[:, 0, 0], esperados, rtol=0.0, atol=1e-6)


if __name__ == "__main__":
    unittest.main()
