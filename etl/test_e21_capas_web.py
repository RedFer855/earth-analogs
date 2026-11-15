"""Pruebas de e21_capas_web.py: mediana y mínimo por padre, NaN, orden de ipix, bloques y tamaños."""

from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

import numpy as np

from e21_capas_web import agregar, generar, inicios_de_grupos, metodo_de

NAN = np.nan
META = {"unidad": "u", "fuente": "f", "url": "https://ejemplo.org", "licencia": "CC BY 4.0"}


def _hijas(padre: int, k: int) -> list[int]:
    return [(padre << 10) + i * 3 for i in range(k)]


class TestAgregar(unittest.TestCase):
    def test_metodo_por_nombre(self) -> None:
        self.assertEqual(metodo_de("cueva_dist_km"), "minimo")
        self.assertEqual(metodo_de("dist_crater_km"), "minimo")
        self.assertEqual(metodo_de("dist_playa_km"), "minimo")
        self.assertEqual(metodo_de("slope_mean_deg"), "mediana")
        self.assertEqual(metodo_de("roca_volcanica_frac"), "mediana")

    def test_mediana_minimo_y_nan(self) -> None:
        padres = np.array([1, 1, 1, 2, 2, 2, 2, 3, 3])
        v = np.array([5, NAN, 1, 4, 2, 8, 6, NAN, NAN], dtype=np.float32)
        ini = inicios_de_grupos(padres)
        self.assertEqual(ini.tolist(), [0, 3, 7])
        med = agregar(v, ini, "mediana")
        np.testing.assert_array_equal(med[:2], [3.0, 5.0])  # impar sin NaN -> (1+5)/2; par -> (4+6)/2
        self.assertTrue(np.isnan(med[2]))
        mn = agregar(v, ini, "minimo")
        np.testing.assert_array_equal(mn[:2], [1.0, 2.0])
        self.assertTrue(np.isnan(mn[2]))
        self.assertEqual(med.dtype, np.float32)

    def test_mediana_coincide_con_numpy(self) -> None:
        rng = np.random.default_rng(7)
        padres = np.sort(rng.integers(0, 50, size=3000))
        v = rng.normal(size=3000).astype(np.float32)
        v[rng.random(3000) < 0.2] = NAN
        ini = inicios_de_grupos(padres)
        med = agregar(v, ini, "mediana")
        for k, g in enumerate(np.unique(padres)):
            x = v[padres == g]
            x = x[np.isfinite(x)]
            esperado = np.median(x.astype(np.float64)) if x.size else NAN
            np.testing.assert_allclose(med[k], esperado, rtol=1e-6, equal_nan=True)


class TestGenerar(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        raiz = Path(self.tmp.name)
        self.run, self.puntos = raiz / "run", raiz / "puntos"
        # padres 3 (4 hijas), 5 (1 hija), 9 (3 hijas), 200 (2 hijas)
        ipix = _hijas(3, 4) + _hijas(5, 1) + _hijas(9, 3) + _hijas(200, 2)
        self.ipix = np.array(ipix, dtype=np.uint32)
        n = self.ipix.size
        for d in (self.run, self.puntos):
            (d / "grid").mkdir(parents=True)
            (d / "columns").mkdir()
            self.ipix.tofile(d / "grid" / "ipix.u32")
        self.slope = np.array([1, 2, 3, 10, 7, NAN, NAN, NAN, 4, 6], dtype=np.float32)
        self.cueva = np.array([50, 40, NAN, 60, 7, 9, 8, NAN, 30, 20], dtype=np.float32)
        self.crater = np.arange(n, 0, -1).astype(np.float32)
        self.slope.tofile(self.run / "columns" / "slope_mean_deg.f32")
        self.cueva.tofile(self.run / "columns" / "cueva_dist_km.f32")
        (self.run / "columns" / "cueva_dist_km.json").write_text(json.dumps({**META, "local_only": False}))
        self.crater.tofile(self.puntos / "columns" / "dist_crater_km.f32")
        (self.puntos / "columns" / "dist_crater_km.json").write_text(json.dumps(META))
        self.manifiesto = {"n_celdas": n, "generado": "x", "local_only": [],
                           "columnas": {"slope_mean_deg": {**META, "unidad": "grados"}}}
        self._manifiesto()
        self.cols = ["slope_mean_deg", "cueva_dist_km", "dist_crater_km"]

    def _manifiesto(self) -> None:
        (self.run / "manifest.json").write_text(json.dumps(self.manifiesto), encoding="utf-8")

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def _leer(self, nombre: str, dtype) -> np.ndarray:
        return np.fromfile(self.run / "web" / "capas7" / nombre, dtype=dtype)

    def test_salida_completa(self) -> None:
        for bloque in (3, 4, 1 << 22):  # bloques chicos parten grupos y obligan a cortar o extender
            with self.subTest(bloque=bloque):
                s = generar(self.run, self.puntos, self.cols, bloque=bloque)
                np.testing.assert_array_equal(self._leer("ipix.u32", np.uint32), [3, 5, 9, 200])
                np.testing.assert_array_equal(self._leer("n_hijas.u16", np.uint16), [4, 1, 3, 2])
                np.testing.assert_array_equal(self._leer("slope_mean_deg.f32", np.float32), [2.5, 7, NAN, 5])
                np.testing.assert_array_equal(self._leer("cueva_dist_km.f32", np.float32), [40, 7, 8, 20])
                np.testing.assert_array_equal(self._leer("dist_crater_km.f32", np.float32), [7, 6, 3, 1])
                self.assertEqual(s["n_celdas"], 4)
                self.assertEqual(s["nivel"], 7)
                c = s["columnas"]
                self.assertEqual(c["slope_mean_deg"]["metodo"], "mediana")
                self.assertEqual(c["slope_mean_deg"]["unidad"], "grados")
                self.assertEqual(c["dist_crater_km"]["metodo"], "minimo")
                self.assertEqual(c["slope_mean_deg"]["cobertura_pct"], 75.0)
                self.assertEqual(c["cueva_dist_km"]["p50"], 14.0)
                for v in c.values():
                    self.assertEqual(set(META) - set(v), set())

    def test_tamanos(self) -> None:
        s = generar(self.run, self.puntos, self.cols)
        d = self.run / "web" / "capas7"
        self.assertEqual((d / "ipix.u32").stat().st_size, 4 * 4)
        self.assertEqual((d / "n_hijas.u16").stat().st_size, 2 * 4)
        for c in self.cols:
            self.assertEqual((d / f"{c}.f32").stat().st_size, 4 * 4)
        self.assertEqual(s["bytes_binarios"], 16 + 8 + 3 * 16)
        leido = json.loads((d / "capas7.json").read_text(encoding="utf-8"))
        self.assertEqual(leido["n_celdas"], 4)

    def test_ipix_desordenado_falla(self) -> None:
        self.ipix[[1, 2]] = self.ipix[[2, 1]]
        self.ipix.tofile(self.run / "grid" / "ipix.u32")
        with self.assertRaises(SystemExit):
            generar(self.run, None, ["slope_mean_deg"])

    def test_falta_columna_de_puntos(self) -> None:
        with self.assertRaises(SystemExit):
            generar(self.run, None, self.cols)

    def test_malla_distinta_falla(self) -> None:
        otra = self.ipix.copy()
        otra[-1] += 1
        otra.tofile(self.puntos / "grid" / "ipix.u32")
        with self.assertRaises(SystemExit):
            generar(self.run, self.puntos, self.cols)

    def test_local_only_no_se_sirve(self) -> None:
        self.manifiesto["columnas"]["slope_mean_deg"]["local_only"] = True
        self._manifiesto()
        with self.assertRaises(SystemExit):
            generar(self.run, self.puntos, self.cols)


if __name__ == "__main__":
    unittest.main()
