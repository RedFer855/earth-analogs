import unittest

import numpy as np

from e03_extras import (
    AREA_CELDA_M2,
    BLOQUE_M,
    CLAVES,
    ESPERADOS_POR_CELDA,
    UMBRAL_PEND,
    UMBRAL_VALIDEZ,
    _caja,
    cuantil,
    por_celda,
    ventana,
)
from e03_terreno import horn


class PruebasHorn(unittest.TestCase):
    def test_centro_de_agua_es_nan(self):
        z = np.array([[1.0, 2.0, 3.0], [1.0, np.nan, 3.0], [1.0, 2.0, 3.0]])
        p = horn(z, np.ones((1, 1)), np.ones((1, 1)))
        self.assertTrue(np.isnan(p[0, 0]))

    def test_plano_inclinado(self):
        z = np.tile(np.arange(4.0), (4, 1))  # sube 1 m por metro hacia el este
        p = horn(z, np.ones((2, 1)), np.ones((2, 1)))
        np.testing.assert_allclose(p, 45.0)

    def test_plano_inclinado_espaciado_escalar_200m(self):
        z = np.tile(np.arange(4.0) * 200.0, (4, 1))
        p = horn(z, 200.0, 200.0)
        np.testing.assert_allclose(p, 45.0)


class PruebasConstantesEscala(unittest.TestCase):
    def test_escala_200m_y_claves(self):
        self.assertEqual(BLOQUE_M, 200.0)
        self.assertEqual(UMBRAL_VALIDEZ, 0.999)
        self.assertEqual(UMBRAL_PEND, 15)
        self.assertAlmostEqual(ESPERADOS_POR_CELDA, AREA_CELDA_M2 / 40_000.0, places=6)
        for clave in ("n", "media", "desv", "esperados", "rug_media", "rel_media"):
            self.assertIn(clave, CLAVES)


class PruebasVentana(unittest.TestCase):
    def test_caja_igual_a_fuerza_bruta(self):
        a = np.random.default_rng(3).normal(size=(9, 11))
        s = _caja(a, 5)
        p = np.pad(a, 2)
        esperado = np.array([[p[i:i + 5, j:j + 5].sum() for j in range(11)] for i in range(9)])
        np.testing.assert_allclose(s, esperado)

    def test_rugosidad_y_relieve_por_fuerza_bruta(self):
        rng = np.random.default_rng(7)
        z = 3000 + rng.normal(scale=20, size=(12, 12))
        z[3, 4] = np.nan
        z[0:2, 9:12] = np.nan
        rug, rel = ventana(z)
        p = np.pad(z, 2, constant_values=np.nan)
        for i in range(12):
            for j in range(12):
                w = p[i:i + 5, j:j + 5]
                w = w[np.isfinite(w)]
                if np.isfinite(z[i, j]) and w.size >= 19:
                    self.assertAlmostEqual(rug[i, j], np.std(w), places=6)
                    self.assertAlmostEqual(rel[i, j], w.max() - w.min(), places=6)
                else:
                    self.assertTrue(np.isnan(rug[i, j]) and np.isnan(rel[i, j]))


class PruebasCuantiles(unittest.TestCase):
    def test_cuantil_lineal_como_numpy(self):
        rng = np.random.default_rng(5)
        grupos = [np.sort(rng.normal(size=n)) for n in (1, 2, 7, 78)]
        x = np.concatenate(grupos)
        cuenta = np.array([g.size for g in grupos])
        inicio = np.r_[0, np.cumsum(cuenta)[:-1]]
        for q in (0.9, 0.99):
            np.testing.assert_allclose(cuantil(x, inicio, cuenta, q), [np.quantile(g, q) for g in grupos])

    def test_por_celda_ignora_nan_y_alinea(self):
        celdas = np.array([4, 4, 4, 9, 9, 12])
        v = np.array([1.0, np.nan, 3.0, np.nan, np.nan, 5.0])
        media, p90 = por_celda(celdas, v, np.array([4, 9, 12]))
        np.testing.assert_allclose(media, [2.0, np.nan, 5.0])
        np.testing.assert_allclose(p90, [np.quantile([1.0, 3.0], 0.9), np.nan, 5.0])


if __name__ == "__main__":
    unittest.main()
