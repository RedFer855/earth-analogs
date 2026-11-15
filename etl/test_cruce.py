"""Pruebas sintéticas de etl/cruce.py (cruce por coordenada frente a ipix-a-ipix, P-010)."""

from __future__ import annotations

import unittest

import numpy as np
from astropy import units as u
from cdshealpix.nested import lonlat_to_healpix

from comun import NIVEL
from comun_tabla import celda_de
from cruce import cruzar_por_coordenada


class PruebasCruce(unittest.TestCase):
    def test_desfase_ipix_geodesico_frente_a_autalico(self) -> None:
        lat, lon = 45.0, 10.0
        ipix_nuestro = int(celda_de(np.array([lat]), np.array([lon]))[0])
        ipix_geod_esfera = int(lonlat_to_healpix(np.array([lon]) * u.deg, np.array([lat]) * u.deg, NIVEL)[0])
        self.assertNotEqual(ipix_nuestro, ipix_geod_esfera)

        ipix_malla = np.sort(np.array([ipix_nuestro, ipix_geod_esfera], dtype=np.uint32))
        out = cruzar_por_coordenada(
            ipix_malla,
            np.array([lat]),
            np.array([lon]),
            np.array([123.5]),
        )
        i_nuestro = int(np.searchsorted(ipix_malla, ipix_nuestro))
        i_otro = int(np.searchsorted(ipix_malla, ipix_geod_esfera))
        self.assertAlmostEqual(float(out[i_nuestro]), 123.5, places=4)
        self.assertTrue(np.isnan(out[i_otro]))

    def test_sin_coincidencia_y_conservacion_de_cero(self) -> None:
        lats = np.array([0.0, 20.0, -30.0])
        lons = np.array([0.0, 40.0, -60.0])
        ipix_celdas = celda_de(lats, lons)
        orden = np.argsort(ipix_celdas)
        ipix_malla = ipix_celdas[orden]

        # Origen: celda 0 con valor 0.0 real, celda 2 con NaN, y un punto fuera de nuestra malla
        out = cruzar_por_coordenada(
            ipix_malla,
            np.array([lats[orden[0]], lats[orden[2]], 60.0]),
            np.array([lons[orden[0]], lons[orden[2]], 120.0]),
            np.array([0.0, np.nan, 99.0]),
        )
        self.assertEqual(float(out[0]), 0.0)
        self.assertTrue(np.isnan(out[1]))
        self.assertTrue(np.isnan(out[2]))

    def test_promedia_multiples_filas_en_misma_celda(self) -> None:
        ipix_malla = celda_de(np.array([15.0]), np.array([-25.0]))
        out = cruzar_por_coordenada(
            ipix_malla,
            np.array([15.0, 15.0, 15.0]),
            np.array([-25.0, -25.0, -25.0]),
            np.array([10.0, 20.0, np.nan]),
        )
        self.assertAlmostEqual(float(out[0]), 15.0, places=5)

    def test_validaciones_y_vacios(self) -> None:
        ipix_malla = celda_de(np.array([10.0]), np.array([10.0]))
        out_nan = cruzar_por_coordenada(
            ipix_malla,
            np.array([np.nan, 95.0]),
            np.array([10.0, 10.0]),
            np.array([5.0, 6.0]),
        )
        self.assertTrue(np.isnan(out_nan[0]))

        self.assertEqual(
            cruzar_por_coordenada(np.empty(0, np.uint32), np.array([10.0]), np.array([10.0]), np.array([1.0])).size,
            0,
        )
        self.assertTrue(
            np.isnan(
                cruzar_por_coordenada(ipix_malla, np.empty(0), np.empty(0), np.empty(0))[0]
            )
        )

        with self.assertRaises(ValueError):
            cruzar_por_coordenada(np.array([5, 5], dtype=np.uint32), np.array([0.0]), np.array([0.0]), np.array([1.0]))
        with self.assertRaises(ValueError):
            cruzar_por_coordenada(ipix_malla, np.array([0.0, 1.0]), np.array([0.0]), np.array([1.0]))


if __name__ == "__main__":
    unittest.main()
