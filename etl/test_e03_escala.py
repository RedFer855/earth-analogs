import tempfile
import unittest
from pathlib import Path

import numpy as np
from cdshealpix.nested import healpix_to_lonlat
from osgeo import gdal, osr

from comun import NIVEL, autalica_a_geodesica, nombre_tesela_glo90
from comun_tabla import cargar_npz, celda_de
import e03_extras
import e03_terreno
from objetivos_comun import parches

gdal.UseExceptions()


def _laea_tr(lat_c: float, lon_c: float) -> tuple[osr.CoordinateTransformation, osr.SpatialReference]:
    wgs84 = osr.SpatialReference()
    wgs84.ImportFromEPSG(4326)
    wgs84.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    laea = osr.SpatialReference()
    laea.ImportFromProj4(f"+proj=laea +lat_0={lat_c} +lon_0={lon_c} +datum=WGS84")
    laea.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    return osr.CoordinateTransformation(wgs84, laea), wgs84


def _escribir_geotiff(
    ruta: Path,
    arr: np.ndarray,
    x0: float,
    dx: float,
    y0: float,
    dy: float,
    srs_wkt: str,
    gdal_tipo: int,
    nodata: float | int | None = None,
) -> None:
    ruta.parent.mkdir(parents=True, exist_ok=True)
    ds = gdal.GetDriverByName("GTiff").Create(str(ruta), arr.shape[1], arr.shape[0], 1, gdal_tipo)
    ds.SetGeoTransform((x0, dx, 0.0, y0, 0.0, dy))
    ds.SetProjection(srs_wkt)
    band = ds.GetRasterBand(1)
    if nodata is not None:
        band.SetNoDataValue(nodata)
    band.WriteArray(arr)
    ds.FlushCache()
    ds = None


def _crear_tesela_sintetica(
    datos_dir: Path,
    lat0: int,
    lon0: int,
    fn_z,
    dx_deg: float,
    dy_deg: float,
    semi_lat: float,
    semi_lon: float,
) -> Path:
    lat_c, lon_c = lat0 + 0.5, lon0 + 0.5
    nx = int(round(2.0 * semi_lon / dx_deg))
    ny = int(round(2.0 * semi_lat / dy_deg))
    x0 = lon_c - semi_lon
    y0 = lat_c + semi_lat
    lons = x0 + (np.arange(nx) + 0.5) * dx_deg
    lats = y0 - (np.arange(ny) + 0.5) * dy_deg
    lo_g, la_g = np.meshgrid(lons, lats)

    tr, wgs84 = _laea_tr(lat_c, lon_c)
    pts = np.asarray(
        tr.TransformPoints(list(zip(lo_g.ravel().tolist(), la_g.ravel().tolist()))),
        dtype=np.float64,
    )
    xm = pts[:, 0].reshape(lo_g.shape)
    ym = pts[:, 1].reshape(lo_g.shape)
    z = fn_z(xm, ym).astype(np.float32)
    wbm = np.zeros(z.shape, dtype=np.uint8)

    nombre = nombre_tesela_glo90(lat0, lon0)
    ruta_dem = datos_dir / "tierra" / "glo90" / "dem" / f"{nombre}_DEM.tif"
    ruta_wbm = datos_dir / "tierra" / "glo90" / "wbm" / f"{nombre}_WBM.tif"
    wkt = wgs84.ExportToWkt()
    _escribir_geotiff(ruta_dem, z, x0, dx_deg, y0, -dy_deg, wkt, gdal.GDT_Float32, float("nan"))
    _escribir_geotiff(ruta_wbm, wbm, x0, dx_deg, y0, -dy_deg, wkt, gdal.GDT_Byte, 255)
    return ruta_dem


class PruebasEscala200m(unittest.TestCase):
    def test_plano_10_grados_en_tres_latitudes(self):
        tan10 = float(np.tan(np.radians(10.0)))
        fn_z = lambda x, y: 500.0 + (0.8 * x + 0.6 * y) * tan10  # noqa: E731
        prev_datos, prev_gsw = e03_terreno._DATOS, e03_terreno._GSW
        try:
            with tempfile.TemporaryDirectory() as tmp:
                raiz = Path(tmp)
                salida = raiz / "celdas"
                salida.mkdir()
                e03_extras._iniciar(str(raiz), "")
                for lat0, dx_deg in ((0, 1.0 / 1200.0), (45, 1.0 / 1200.0), (70, 1.0 / 600.0)):
                    lon0 = 10
                    ruta_dem = _crear_tesela_sintetica(
                        raiz, lat0, lon0, fn_z, dx_deg, 1.0 / 1200.0, 0.06, 0.16,
                    )
                    n_celdas = e03_extras.tesela(str(ruta_dem), str(salida))
                    self.assertGreater(n_celdas, 0)
                    q = cargar_npz(salida / f"{ruta_dem.stem}.npz")
                    ip_c = int(celda_de(np.array([lat0 + 0.5]), np.array([lon0 + 0.5]), hilos=1)[0])
                    idx = np.flatnonzero(q["ipix"] == ip_c)
                    self.assertEqual(idx.size, 1, f"falta celda central en lat0={lat0}")
                    pend_media = float(q["media"][idx[0]])
                    self.assertAlmostEqual(pend_media, 10.0, delta=0.2, msg=f"lat0={lat0}")
        finally:
            e03_terreno._DATOS, e03_terreno._GSW = prev_datos, prev_gsw

    def test_paridad_con_objetivos_comun_parches(self):
        lat0, lon0 = 45, 10
        lat_c, lon_c = lat0 + 0.5, lon0 + 0.5
        fn_z = (
            lambda x, y: 1000.0
            + 0.08 * x
            + 60.0 * np.sin(2.0 * np.pi * x / 3000.0) * np.cos(2.0 * np.pi * y / 3000.0)
            + 30.0 * np.cos(2.0 * np.pi * (x - y) / 2500.0)
        )
        prev_datos, prev_gsw = e03_terreno._DATOS, e03_terreno._GSW
        try:
            with tempfile.TemporaryDirectory() as tmp:
                raiz = Path(tmp)
                salida = raiz / "celdas"
                salida.mkdir()
                e03_extras._iniciar(str(raiz), "")
                ruta_dem = _crear_tesela_sintetica(
                    raiz, lat0, lon0, fn_z, 1.0 / 1200.0, 1.0 / 1200.0, 0.2, 0.28,
                )
                n_celdas = e03_extras.tesela(str(ruta_dem), str(salida))
                self.assertGreater(n_celdas, 0)
                q = cargar_npz(salida / f"{ruta_dem.stem}.npz")

                lon_u, beta_u = healpix_to_lonlat(q["ipix"].astype(np.uint64), NIVEL, num_threads=1)
                lat_u = autalica_a_geodesica(beta_u.deg)
                lon_u = ((lon_u.deg + 180.0) % 360.0) - 180.0
                tr, _ = _laea_tr(lat_c, lon_c)
                pts = np.asarray(
                    tr.TransformPoints(list(zip(lon_u.tolist(), lat_u.tolist()))),
                    dtype=np.float64,
                )
                # Misma área amplia para los dos: con pocas muestras de una superficie periódica el promedio cambia
                # ±3 % solo por el área elegida, y eso no es diferencia de método.
                lado = 15000.0
                en = (np.abs(pts[:, 0]) <= lado) & (np.abs(pts[:, 1]) <= lado)
                self.assertGreaterEqual(int(en.sum()), 300)
                earth_slope = float(np.mean(q["media"][en]))
                earth_rel = float(np.mean(q["rel_media"][en]))

                # El objetivo se arma como en la Luna (E-11): bloques de 10x10 píxeles de 20 m promediados a 200 m.
                fino = np.arange(-lado - 2190.0, lado + 2191.0, 20.0)
                xf, yf = np.meshgrid(fino, -fino)
                k = 10
                n = fino.size // k * k
                z_200 = fn_z(xf, yf)[:n, :n].reshape(n // k, k, n // k, k).mean(axis=(1, 3))
                centros = fino[:n].reshape(-1, k).mean(axis=1)
                xg, yg = np.meshgrid(centros, -centros)
                masc = (np.abs(xg) <= lado) & (np.abs(yg) <= lado)
                ps = parches(z_200, 200.0, 200.0, masc)
                self.assertGreaterEqual(len(ps), 300)
                target_slope = float(np.mean([p["slope_mean_deg"] for p in ps]))
                target_rel = float(np.mean([p["relieve_mean_m"] for p in ps]))

                self.assertLessEqual(abs(earth_slope - target_slope) / target_slope, 0.02)
                self.assertLessEqual(abs(earth_rel - target_rel) / target_rel, 0.02)
        finally:
            e03_terreno._DATOS, e03_terreno._GSW = prev_datos, prev_gsw


if __name__ == "__main__":
    unittest.main()
