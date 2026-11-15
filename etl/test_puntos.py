"""Pruebas sintéticas de E-17 (distancias a puntos y lectura de catálogos)."""

from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

import numpy as np

import e17_puntos as e


class PruebasDistancia(unittest.TestCase):
    def test_un_grado_en_el_ecuador(self) -> None:
        d, k = e.mas_cercano(np.array([0.0]), np.array([1.0]), np.array([0.0, 50.0]), np.array([0.0, 50.0]))
        self.assertAlmostEqual(float(d[0]), np.radians(1) * e.R, delta=0.01)
        self.assertEqual(int(k[0]), 0)

    def test_cruza_el_antimeridiano(self) -> None:
        d, _ = e.mas_cercano(np.array([0.0]), np.array([179.5]), np.array([0.0]), np.array([-179.5]))
        self.assertAlmostEqual(float(d[0]), np.radians(1) * e.R, delta=0.01)

    def test_bloques_igual_que_sin_bloques(self) -> None:
        rng = np.random.default_rng(1)
        la, lo = rng.uniform(-80, 80, 1000), rng.uniform(-180, 180, 1000)
        pla, plo = rng.uniform(-80, 80, 20), rng.uniform(-180, 180, 20)
        a, _ = e.mas_cercano(la, lo, pla, plo)
        b, _ = e.mas_cercano(la, lo, pla, plo, bloque=7)
        np.testing.assert_allclose(a, b)

    def test_dentro_de_radio(self) -> None:
        # Meteor Crater, 1.2 km de diámetro: centro dentro, 5 km al norte fuera
        lat = np.array([35.0274, 35.0274 + 5 / 111.2])
        lon = np.array([-111.0228, -111.0228])
        out = e.dentro_de_radios(lat, lon, [35.0274], [-111.0228], [0.6])
        np.testing.assert_array_equal(out, [1, 0])

    def test_crater_mas_chico_que_la_celda_marca_con_margen(self) -> None:
        # Centro de celda a 0.6 km del centro de un cráter de 1.2 km: sin margen no marca, con margen sí
        lat = np.array([35.0274 + 0.65 / 111.2])
        lon = np.array([-111.0228])
        self.assertEqual(float(e.dentro_de_radios(lat, lon, [35.0274], [-111.0228], [0.6])[0]), 0.0)
        self.assertEqual(float(e.dentro_de_radios(lat, lon, [35.0274], [-111.0228], [0.6], e.MEDIA_CELDA_KM)[0]), 1.0)

    def test_radio_desconocido_no_marca(self) -> None:
        out = e.dentro_de_radios(np.array([0.0]), np.array([0.0]), [0.0], [0.0], [np.nan])
        self.assertEqual(float(out[0]), 0.0)


class PruebasLectura(unittest.TestCase):
    def test_crateres_unidades_y_no_confirmados(self) -> None:
        def fila(q, nombre, diam=None, unidad=None):
            b = {"c": {"value": f"http://www.wikidata.org/entity/{q}"}, "cLabel": {"value": nombre},
                 "lat": {"value": "10"}, "lon": {"value": "20"}}
            if diam is not None:
                b["diam"] = {"value": str(diam)}
                b["unit"] = {"value": unidad}
            return b

        filas = [
            fila("Q1", "A", 1200, "http://www.wikidata.org/entity/Q11573"),
            fila("Q1", "A", 1.5, "http://www.wikidata.org/entity/Q828224"),
            fila("Q2", "Gusev crater"),
            fila("Q3", "Q3"),
        ]
        with tempfile.TemporaryDirectory() as t:
            p = Path(t) / "c.json"
            p.write_text(json.dumps({"results": {"bindings": filas}}), encoding="utf-8")
            c = {x["id"]: x for x in e.leer_crateres(p)}
        self.assertEqual(c["crater-Q1"]["diametro_km"], 1.5)
        self.assertTrue(c["crater-Q1"]["confirmado"])
        self.assertFalse(c["crater-Q2"]["confirmado"])
        self.assertFalse(c["crater-Q3"]["confirmado"])



if __name__ == "__main__":
    unittest.main()
