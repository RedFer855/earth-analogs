"""Pruebas de la caché por columna de E-13: solo se relee lo que cambió y el resultado es el de una pasada completa."""

import json
import os
import tempfile
import unittest
from pathlib import Path

import numpy as np

from comun_tabla import cargar_malla
from e13_manifiesto import _pixel, revisar_columnas

N = 12


def _columna(run: Path, nombre: str, valores, mtime_ns: int | None = None) -> None:
    f32 = run / "columns" / f"{nombre}.f32"
    np.asarray(valores, dtype=np.float32).tofile(f32)
    (run / "columns" / f"{nombre}.json").write_text(json.dumps({"columna": nombre}), encoding="utf-8")
    if mtime_ns is not None:
        os.utime(f32, ns=(mtime_ns, mtime_ns))


class CacheE13(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.run = Path(self.tmp.name)
        (self.run / "grid").mkdir()
        (self.run / "columns").mkdir()
        np.arange(N, dtype=np.uint32).tofile(self.run / "grid" / "ipix.u32")
        np.linspace(-60, 60, N, dtype=np.float32).tofile(self.run / "grid" / "lat.f32")
        np.linspace(-170, 170, N, dtype=np.float32).tofile(self.run / "grid" / "lon.f32")
        _columna(self.run, "a", np.arange(N))
        _columna(self.run, "b", np.where(np.arange(N) == 3, np.inf, 1.0))
        _columna(self.run, "c", np.full(N, np.nan))
        self.malla = cargar_malla(self.run)

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def test_segunda_pasada_no_relee(self) -> None:
        col1, fal1, rel1 = revisar_columnas(self.run, *self.malla)
        col2, fal2, rel2 = revisar_columnas(self.run, *self.malla)
        self.assertEqual(rel1, 3)
        self.assertEqual(rel2, 0)
        self.assertEqual(col1, col2)
        self.assertEqual(fal1, fal2)
        self.assertIn("b: tiene infinitos", fal2)
        self.assertEqual(col2["a"]["maximo_en"]["valor"], N - 1)
        self.assertNotIn("maximo_en", col2["c"])

    def test_columna_cambiada_se_relee_sola(self) -> None:
        revisar_columnas(self.run, *self.malla)
        st = (self.run / "columns" / "a.f32").stat()
        _columna(self.run, "a", np.arange(N)[::-1], mtime_ns=st.st_mtime_ns + 10**9)
        col, _, rel = revisar_columnas(self.run, *self.malla)
        self.assertEqual(rel, 1)
        completa, _, rel_c = revisar_columnas(self.run, *self.malla, completo=True)
        self.assertEqual(rel_c, 3)
        self.assertEqual(col, completa)
        self.assertEqual(col["a"]["maximo_en"]["lat"], -60.0)

    def test_columna_de_largo_incorrecto_falla(self) -> None:
        np.zeros(N - 1, dtype=np.float32).tofile(self.run / "columns" / "a.f32")
        col, fallos, _ = revisar_columnas(self.run, *self.malla)
        self.assertNotIn("a", col)
        self.assertTrue(any(f.startswith("a: ") and "se esperaban" in f for f in fallos))

    def test_cache_rota_se_ignora(self) -> None:
        revisar_columnas(self.run, *self.malla)
        (self.run / "cache" / "e13_columnas.json").write_text("{roto", encoding="utf-8")
        _, _, rel = revisar_columnas(self.run, *self.malla)
        self.assertEqual(rel, 3)


class PixelDatasetAbierto(unittest.TestCase):
    def test_ruta_y_dataset_dan_lo_mismo(self) -> None:
        from osgeo import gdal

        with tempfile.TemporaryDirectory() as tmp:
            ruta = str(Path(tmp) / "t.tif")
            ds = gdal.GetDriverByName("GTiff").Create(ruta, 10, 10, 1, gdal.GDT_UInt16)
            ds.SetGeoTransform((0.0, 1.0, 0.0, 10.0, 0.0, -1.0))
            ds.GetRasterBand(1).WriteArray(np.arange(100, dtype=np.uint16).reshape(10, 10))
            ds = None
            abierto = gdal.Open(ruta)
            for lat, lon in ((9.5, 0.5), (0.5, 9.5), (5.5, 3.5)):
                self.assertEqual(_pixel(ruta, lat, lon, "<H"), _pixel(abierto, lat, lon, "<H"))
            self.assertIsNone(_pixel(abierto, 20.0, 0.5, "<H"))
            self.assertEqual(_pixel(abierto, 9.5, 0.5, "<H"), 0)
            abierto = None  # Windows no borra la carpeta temporal con el archivo abierto


if __name__ == "__main__":
    unittest.main()
