"""Pruebas sintéticas de agregación por tesela/bloques y reglas NaN vs 0 para E-15."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

import numpy as np
from cdshealpix.nested import healpix_to_lonlat
from osgeo import gdal, osr

from comun import A_WGS84, NIVEL, autalica_a_geodesica
from comun_tabla import celda_de, juntar_sumas
from e15_capas_30m import (
    _ya_hecha,
    agregar_ventana,
    clasificar_glwd,
    clasificar_gsdp30,
    clasificar_gsds30,
    clasificar_gsw,
    combinar_parciales,
    mercator_a_lonlat,
    procesar_glwd,
    procesar_tesela,
    validar_resultados,
)

gdal.UseExceptions()


def _centro_celda(lat: float, lon: float) -> tuple[int, float, float]:
    """Devuelve (ipix, lat_centro, lon_centro) para la celda HEALPix que contiene (lat, lon)."""
    ipix = int(celda_de(np.array([lat]), np.array([lon]), hilos=1)[0])
    lon_c, beta_c = healpix_to_lonlat(np.array([ipix], dtype=np.uint64), NIVEL)
    lon_deg = float(((lon_c.deg[0] + 180.0) % 360.0) - 180.0)
    lat_deg = float(autalica_a_geodesica(beta_c.deg)[0])
    return ipix, lat_deg, lon_deg


def _escribir_tif(ruta: Path, arr: np.ndarray, geo: tuple, epsg: int, nodata: float | None = None) -> None:
    h, w = arr.shape
    ds = gdal.GetDriverByName("GTiff").Create(str(ruta), w, h, 1, gdal.GDT_Byte)
    ds.SetGeoTransform(geo)
    srs = osr.SpatialReference()
    srs.ImportFromEPSG(epsg)
    ds.SetSpatialRef(srs)
    b = ds.GetRasterBand(1)
    if nodata is not None:
        b.SetNoDataValue(nodata)
    b.WriteArray(arr)
    ds.FlushCache()
    ds = None


class PruebasClasificadores(unittest.TestCase):
    def test_clasificar_gsw(self):
        arr = np.array([[0, 50, 100, 255]], dtype=np.uint8)
        valid, vars_arr = clasificar_gsw(arr)
        self.assertEqual(valid.tolist(), [[True, True, True, False]])
        self.assertEqual(vars_arr["agua_ocurrencia_media_pct"].tolist(), [[0, 50, 100, 0]])
        self.assertEqual(vars_arr["agua_frac_ocurrencia_gt0"].tolist(), [[False, True, True, False]])

    def test_clasificar_gsdp30_duna_vs_manto_y_otros(self):
        # 0-7 y 10 = dunas; 8 = manto de arena (no duna, válido -> 0); 9 = otros (no arena, válido -> 0); 255 = nodata
        arr = np.array([list(range(11)) + [255]], dtype=np.uint8)
        valid, vars_arr = clasificar_gsdp30(arr)
        self.assertEqual(valid[0, :11].tolist(), [True] * 11)
        self.assertFalse(bool(valid[0, 11]))
        esperado_duna = [True] * 8 + [False, False, True, False]
        self.assertEqual(vars_arr["dunas_frac"][0].tolist(), esperado_duna)

    def test_clasificar_gsds30_arena_vs_otros_y_nodata(self):
        # 1 = arena móvil, 2 = semifija/fija, 3 = otros (-> 0); 0 y 255 = fuera/sin dato (-> NaN)
        arr = np.array([[0, 1, 2, 3, 255]], dtype=np.uint8)
        valid, vars_arr = clasificar_gsds30(arr)
        self.assertEqual(valid[0].tolist(), [False, True, True, True, False])
        self.assertEqual(vars_arr["arena_frac"][0].tolist(), [False, True, True, False, False])

    def test_clasificar_glwd(self):
        arr = np.array([[0, 35, 100, 255]], dtype=np.uint8)
        valid, vars_arr = clasificar_glwd(arr)
        self.assertEqual(valid[0].tolist(), [True, True, True, False])
        self.assertEqual(vars_arr["agua_humedal_area_pct"][0].tolist(), [0, 35, 100, 0])


class PruebasMercatorYAggregacion(unittest.TestCase):
    def test_mercator_a_lonlat_origen_y_redondeo(self):
        lat0, lon0 = mercator_a_lonlat(np.array([0.0]), np.array([0.0]))
        self.assertAlmostEqual(float(lat0[0]), 0.0, places=9)
        self.assertAlmostEqual(float(lon0[0]), 0.0, places=9)

        lat_ref = np.array([-35.0, 20.0, 60.0])
        lon_ref = np.array([-100.0, 50.0, 179.5])
        x = A_WGS84 * np.radians(lon_ref)
        y = A_WGS84 * np.log(np.tan(np.pi / 4.0 + np.radians(lat_ref) / 2.0))
        lat_out, lon_out = mercator_a_lonlat(x, y)
        np.testing.assert_allclose(lat_out, lat_ref, atol=1e-9)
        np.testing.assert_allclose(lon_out, lon_ref, atol=1e-9)

    def test_ponderacion_por_pixeles_validos_en_bloques_y_bordes(self):
        # Bloque 0 (5x5): 5 píxeles válidos con 100 %, 20 nodata (255).
        # Bloque 1 (5x5, dentro de la misma celda HEALPix): 25 píxeles válidos con 0 %.
        # Más borde sobrante (fila 5, columna 0) con 1 píxel válido de 40 %.
        # Media ponderada por píxel válido = (5*100 + 25*0 + 1*40) / 31 = 540 / 31.
        arr = np.full((6, 11), 255, dtype=np.uint8)
        arr[0, :5] = 100
        arr[:5, 5:10] = 0
        arr[5, 0] = 40

        celda_esperada, lat_c, lon_c = _centro_celda(20.0, 10.0)
        dx = 0.0001  # ~11 m; la ventana 6x11 (~66x121 m) queda centrada bien adentro de la celda (~1.6 km)
        geo = (lon_c - 5.5 * dx, dx, 0.0, lat_c + 3.0 * dx, 0.0, -dx)
        parcial = agregar_ventana(arr, clasificar_gsw, geo, fila_inicio=0, bloque=5, es_mercator=False, hilos=1)
        self.assertIsNotNone(parcial)
        self.assertEqual(parcial["ipix"].size, 1)
        self.assertEqual(int(parcial["ipix"][0]), celda_esperada)
        self.assertEqual(int(parcial["agua_ocurrencia_media_pct_n"][0]), 31)
        self.assertAlmostEqual(float(parcial["agua_ocurrencia_media_pct_s"][0]), 540.0, places=6)
        self.assertAlmostEqual(float(parcial["agua_frac_ocurrencia_gt0_s"][0]), 6.0, places=6)

    def test_ventana_solo_nodata_devuelve_none(self):
        arr = np.full((10, 10), 255, dtype=np.uint8)
        geo = (0.0, 0.00025, 0.0, 10.0, 0.0, -0.00025)
        self.assertIsNone(agregar_ventana(arr, clasificar_gsdp30, geo, bloque=5, es_mercator=False, hilos=1))


class PruebasNaNvsCeroYResumible(unittest.TestCase):
    def test_nan_fuera_de_extension_y_cero_dentro_sin_rasgo(self):
        centros = [_centro_celda(la, lo) for la, lo in ((20.0, 50.0), (25.0, 50.0), (30.0, 50.0), (-3.5, -62.0))]
        ipix_p = np.array([c[0] for c in centros], dtype=np.uint32)
        ipix_malla = np.sort(ipix_p)

        with tempfile.TemporaryDirectory() as tmp:
            tdir = Path(tmp)
            sumas = tdir / "sumas"
            sumas.mkdir()

            # Celda 0: GSDP30 clase 2 (duna) -> dunas_frac = 1.0
            # Celda 1: GSDP30 clases 8 (manto) y 9 (otros) -> dunas_frac = 0.0 (cero real)
            # Celda 2: GSDP30 solo nodata 255 -> NaN
            # Celda 3: fuera de toda tesela -> NaN
            for idx, (_, la, lo), val in (
                ("a", centros[0], 2),
                ("b", centros[1], 8),
                ("c", centros[2], 255),
            ):
                x_c = A_WGS84 * np.radians(lo)
                y_c = A_WGS84 * np.log(np.tan(np.pi / 4.0 + np.radians(la) / 2.0))
                geo = (x_c - 75.0, 30.0, 0.0, y_c + 75.0, 0.0, -30.0)
                tif = tdir / f"gsdp_{idx}.tif"
                arr = np.full((5, 5), val, dtype=np.uint8)
                if idx == "b":
                    arr[0, :] = 9
                _escribir_tif(tif, arr, geo, 3857, nodata=255)
                procesar_tesela("gsdp30", str(tif), str(sumas / f"gsdp30__{idx}.npz"), bloque=5, filas_ventana=5)

            bueno = sumas / "gsdp30__a.npz"
            vacio = sumas / "gsdp30__c.npz"
            corrupto = sumas / "gsdp30__corrupto.npz"
            corrupto.write_bytes(b"basura")
            self.assertTrue(_ya_hecha(bueno, "dunas_frac_n"))
            self.assertTrue(_ya_hecha(vacio, "dunas_frac_n"))
            self.assertFalse(_ya_hecha(corrupto, "dunas_frac_n"))
            self.assertFalse(corrupto.exists())

            dunas = juntar_sumas(ipix_malla, sorted(sumas.glob("gsdp30__*.npz")), ["dunas_frac"])["dunas_frac"]
            pos = {int(ipix_p[i]): float(dunas[np.searchsorted(ipix_malla, ipix_p[i])]) for i in range(4)}

            self.assertAlmostEqual(pos[int(ipix_p[0])], 1.0, places=5)
            self.assertTrue(np.isfinite(pos[int(ipix_p[1])]))
            self.assertAlmostEqual(pos[int(ipix_p[1])], 0.0, places=5)
            self.assertTrue(np.isnan(pos[int(ipix_p[2])]))
            self.assertTrue(np.isnan(pos[int(ipix_p[3])]))

    def test_gsds30_cero_vs_tres_y_glwd_por_franjas(self):
        c_arena = _centro_celda(20.0, 50.0)
        c_otro = _centro_celda(25.0, 50.0)
        c_fuera = _centro_celda(30.0, 50.0)
        ipix_p = np.array([c_arena[0], c_otro[0], c_fuera[0]], dtype=np.uint32)
        ipix_malla = np.sort(ipix_p)

        with tempfile.TemporaryDirectory() as tmp:
            tdir = Path(tmp)
            sumas = tdir / "sumas"
            sumas.mkdir()

            # GSDS30: clases 1 y 2 (arena) -> 1.0; clase 3 (otros) -> 0.0; clase 0 (sin dato) -> NaN
            for idx, (_, la, lo), arr_fn in (
                ("1", c_arena, lambda: np.tile(np.array([1, 2, 1, 2, 1], np.uint8), (5, 1))),
                ("2", c_otro, lambda: np.full((5, 5), 3, np.uint8)),
                ("3", c_fuera, lambda: np.zeros((5, 5), np.uint8)),
            ):
                x_c = A_WGS84 * np.radians(lo)
                y_c = A_WGS84 * np.log(np.tan(np.pi / 4.0 + np.radians(la) / 2.0))
                geo = (x_c - 75.0, 30.0, 0.0, y_c + 75.0, 0.0, -30.0)
                tif = tdir / f"gsds_{idx}.tif"
                _escribir_tif(tif, arr_fn(), geo, 3857)
                procesar_tesela("gsds30", str(tif), str(sumas / f"gsds30__{idx}.npz"), bloque=5, filas_ventana=5)

            arena = juntar_sumas(ipix_malla, sorted(sumas.glob("gsds30__*.npz")), ["arena_frac"])["arena_frac"]
            val_arena = {int(ipix_p[i]): float(arena[np.searchsorted(ipix_malla, ipix_p[i])]) for i in range(3)}
            self.assertAlmostEqual(val_arena[int(ipix_p[0])], 1.0, places=5)
            self.assertAlmostEqual(val_arena[int(ipix_p[1])], 0.0, places=5)
            self.assertTrue(np.isnan(val_arena[int(ipix_p[2])]))

            # GLWD por franjas resumables: 4x4 centrado en c_arena con filas_por_npz=2, filas_ventana=1
            glwd_tif = tdir / "glwd.tif"
            glwd_arr = np.array(
                [
                    [0, 50, 255, 255],
                    [100, 0, 255, 255],
                    [255, 255, 255, 255],
                    [255, 255, 255, 255],
                ],
                dtype=np.uint8,
            )
            dx_g = 0.0005
            geo_glwd = (c_arena[2] - 2.0 * dx_g, dx_g, 0.0, c_arena[1] + 2.0 * dx_g, 0.0, -dx_g)
            _escribir_tif(glwd_tif, glwd_arr, geo_glwd, 4326, nodata=255)
            res = procesar_glwd(str(glwd_tif), sumas, filas_por_npz=2, filas_ventana=1)
            self.assertEqual(res["franjas_procesadas"], 2)
            res2 = procesar_glwd(str(glwd_tif), sumas, filas_por_npz=2, filas_ventana=1)
            self.assertEqual(res2["franjas_omitidas"], 2)
            self.assertEqual(res2["franjas_procesadas"], 0)

            hum = juntar_sumas(ipix_malla, sorted(sumas.glob("glwd__*.npz")), ["agua_humedal_area_pct"])["agua_humedal_area_pct"]
            v_hum = float(hum[np.searchsorted(ipix_malla, ipix_p[0])])
            self.assertAlmostEqual(v_hum, 37.5, places=5)  # (0 + 50 + 100 + 0) / 4


class PruebasValidacion(unittest.TestCase):
    def test_validar_resultados_detecta_fallos_y_pasa_con_puntos_validos(self):
        puntos = [
            (47.7, -87.5),   # Lago Superior
            (-1.0, 33.0),    # Lago Victoria
            (24.5, -2.5),    # Sahara Erg Chech
            (-23.5, -69.0),  # Atacama
            (20.0, 50.0),    # Rub' al Khali
            (39.0, 83.0),    # Taklamakán
            (30.5, 6.5),     # Gran Erg Oriental
            (-3.5, -62.0),   # Amazonía
            (-17.5, -57.0),  # Pantanal
            (-19.3, 22.9),   # Delta del Okavango
            (-60.0, -60.0),  # Sur de 57° S (debe quedar NaN en GLWD)
        ]
        celdas = np.array([int(celda_de(np.array([la]), np.array([lo]), hilos=1)[0]) for la, lo in puntos], np.uint32)
        lats = np.array([la for la, _ in puntos], np.float32)
        orden = np.argsort(celdas)
        ipix_malla = celdas[orden]
        lat_malla = lats[orden]

        cols = {
            k: np.full(ipix_malla.size, np.nan, np.float32)
            for k in (
                "agua_ocurrencia_media_pct",
                "agua_frac_ocurrencia_gt0",
                "dunas_frac",
                "arena_frac",
                "agua_humedal_area_pct",
            )
        }
        pos = {i: int(np.searchsorted(ipix_malla, celdas[i])) for i in range(len(puntos))}

        for idx in (0, 1):
            cols["agua_ocurrencia_media_pct"][pos[idx]] = 98.0
            cols["agua_frac_ocurrencia_gt0"][pos[idx]] = 1.0
        for idx in (2, 3):
            cols["agua_ocurrencia_media_pct"][pos[idx]] = 0.0
            cols["agua_frac_ocurrencia_gt0"][pos[idx]] = 0.0
        for idx in (4, 5, 6):
            cols["dunas_frac"][pos[idx]] = 0.85
            cols["arena_frac"][pos[idx]] = 0.90
        cols["dunas_frac"][pos[7]] = 0.0
        cols["arena_frac"][pos[7]] = 0.0
        cols["agua_humedal_area_pct"][pos[8]] = 55.0
        cols["agua_humedal_area_pct"][pos[9]] = 45.0
        cols["agua_humedal_area_pct"][pos[0]] = 99.0
        cols["agua_humedal_area_pct"][pos[3]] = 0.0

        _, fallos = validar_resultados(ipix_malla, lat_malla, cols)
        self.assertEqual(fallos, [])

        cols["dunas_frac"][pos[4]] = 1.2
        cols["agua_humedal_area_pct"][pos[10]] = 10.0
        _, fallos_mal = validar_resultados(ipix_malla, lat_malla, cols)
        self.assertTrue(any("dunas_frac" in f and "fuera de" in f for f in fallos_mal))
        self.assertTrue(any("57° S" in f for f in fallos_mal))

    def test_combinar_parciales_vacio(self):
        vacio = combinar_parciales([None], ["dunas_frac"])
        self.assertEqual(vacio["ipix"].size, 0)
        self.assertEqual(vacio["dunas_frac_s"].dtype, np.float64)
        self.assertEqual(vacio["dunas_frac_n"].dtype, np.uint32)


if __name__ == "__main__":
    unittest.main()
