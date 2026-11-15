"""Pruebas unitarias del paso E-16 (catálogo Pyroduct v3.0 y columnas de cuevas)."""

import json
import math
import tempfile
import unittest
import zipfile
from pathlib import Path

import numpy as np

from comun_tabla import celda_de
from e16_cuevas import (
    JSON_DEFECTO,
    agregar_tubos_en_malla,
    cargar_cuevas_verificadas,
    comprobar_puntos,
    distancia_minima_km,
    leer_codigos_zip,
)

ESTADOS_VALIDOS = {
    "verificado",
    "protegido_sin_coordenada",
    "futura_actualizacion",
    "no_encontrado",
}
LICENCIAS_ABIERTAS = {"ODbL 1.0", "CC0 1.0", "CC BY 4.0"}


class TestCatalogoCurado(unittest.TestCase):
    def test_integridad_json_real(self):
        data = json.loads(JSON_DEFECTO.read_text(encoding="utf-8"))
        cuevas = data["cuevas"]
        self.assertEqual(len(cuevas), 119)
        codigos = [c["codigo"] for c in cuevas]
        self.assertEqual(len(codigos), len(set(codigos)))

        verificados = 0
        for rec in cuevas:
            self.assertIn(rec["estado"], ESTADOS_VALIDOS)
            if rec["estado"] == "verificado":
                verificados += 1
                self.assertTrue(-90.0 <= rec["lat"] <= 90.0)
                self.assertTrue(-180.0 <= rec["lon"] <= 180.0)
                self.assertIn(rec["fuente_licencia"], LICENCIAS_ABIERTAS)
                self.assertTrue(rec["fuente_url"].startswith("https://"))
            else:
                self.assertIsNone(rec["lat"])
                self.assertIsNone(rec["lon"])
        self.assertGreaterEqual(verificados, 50)

        _, sistemas = cargar_cuevas_verificadas(JSON_DEFECTO)
        # Barkers Cave v1/v2 y Kazumura I/II comparten grupo_sistema
        self.assertEqual(len(sistemas), verificados - 2)


class TestAgregacionYDistancia(unittest.TestCase):
    def test_agregacion_nan_y_conteo(self):
        lats = np.array([29.160423, 41.731167, 41.731380], dtype=np.float64)
        lons = np.array([-13.439365, -121.506075, -121.510660], dtype=np.float64)
        celdas = celda_de(lats, lons)
        extra = int(celda_de(np.array([23.0]), np.array([12.0]))[0])
        ipix_malla = np.array(sorted(set(celdas.tolist() + [extra])), dtype=np.uint32)

        n_tubos, _, fuera = agregar_tubos_en_malla(ipix_malla, lats, lons)
        self.assertEqual(fuera, [])
        idx_sahara = int(np.searchsorted(ipix_malla, extra))
        self.assertTrue(math.isnan(float(n_tubos[idx_sahara])))
        self.assertAlmostEqual(float(np.nansum(n_tubos)), 3.0)

    def test_distancia_geodesica_conocida(self):
        # 1 grado en el ecuador ~ 111.195 km (con R = 6371.0072 km)
        dist = distancia_minima_km(
            np.array([0.0, 0.0], dtype=np.float32),
            np.array([0.0, 1.0], dtype=np.float32),
            np.array([0.0]),
            np.array([0.0]),
            lote=1,
        )
        self.assertAlmostEqual(float(dist[0]), 0.0, places=4)
        self.assertAlmostEqual(float(dist[1]), 111.195, delta=0.02)
        self.assertFalse(np.isinf(dist).any())

    def test_leer_codigos_zip_sintetico(self):
        sheet = (
            '<?xml version="1.0" encoding="UTF-8"?>'
            '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            "<sheetData>"
            '<row r="1"><c r="A1" t="s"><v>0</v></c></row>'
            '<row r="2"><c r="A2" t="s"><v>1</v></c></row>'
            '<row r="3"><c r="A3" t="inlineStr"><is><t>US.ORE.00</t></is></c></row>'
            "</sheetData></worksheet>"
        )
        shared = (
            '<?xml version="1.0" encoding="UTF-8"?>'
            '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            "<si><t>IT.SIC.00</t></si><si><t>NOTES:</t></si></sst>"
        )
        with tempfile.TemporaryDirectory() as tmp:
            t = Path(tmp)
            xlsx = t / "Index.xlsx"
            with zipfile.ZipFile(xlsx, "w") as zxl:
                zxl.writestr("xl/sharedStrings.xml", shared)
                zxl.writestr("xl/worksheets/sheet1.xml", sheet)
            zpath = t / "pyroduct.zip"
            with zipfile.ZipFile(zpath, "w") as zf:
                zf.write(xlsx, arcname="Pyroduct_Index.xlsx")
            codigos = leer_codigos_zip(zpath)
            self.assertEqual(codigos, {"IT.SIC.00", "US.ORE.00"})

    def test_comprobar_puntos_sintetico(self):
        pts = [
            (29.160423, -13.439365),
            (43.894851, -121.369544),
            (41.731167, -121.506075),
            (41.731380, -121.510660),
        ]
        lats_c = np.array([p[0] for p in pts], dtype=np.float64)
        lons_c = np.array([p[1] for p in pts], dtype=np.float64)
        celda_sah = int(celda_de(np.array([23.0]), np.array([12.0]))[0])
        lat_m = np.append(lats_c, 23.0).astype(np.float32)
        lon_m = np.append(lons_c, 12.0).astype(np.float32)
        ipix_raw = np.append(celda_de(lats_c, lons_c), celda_sah).astype(np.uint32)
        ipix, uniq_idx = np.unique(ipix_raw, return_index=True)
        n_tubos, _, _ = agregar_tubos_en_malla(ipix, lats_c, lons_c)
        dist = distancia_minima_km(lat_m[uniq_idx], lon_m[uniq_idx], lats_c, lons_c)
        res = comprobar_puntos(ipix, n_tubos, dist)
        self.assertTrue(all(item["ok"] for item in res))


if __name__ == "__main__":
    unittest.main()
