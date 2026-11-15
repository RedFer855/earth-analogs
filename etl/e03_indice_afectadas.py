"""Índice de las teselas de E-03 terreno cuyo resultado cambia con la máscara del centro de Horn (P-009).

Horn no usa el bloque central: antes del arreglo, un bloque sin dato rodeado de bloques con dato recibía pendiente.
Los bloques de 2x2 se alinean con el borde de la tesela (el halo es de 8 píxeles), así que un bloque central sin dato
solo puede venir de un píxel enmascarado o sin dato **dentro de la propia tesela**. Una tesela cambia si:

- su WBM tiene algún píxel distinto de 0 (mar, lago o río; el filtro de GSW solo puede quitar máscara, así que
  marcarla es conservador), o
- su DEM tiene algún píxel sin dato, o
- toca el antimeridiano (lon 179 o -180), donde cambió el halo.

Las teselas que no cumplen nada dan el mismo resultado con y sin la máscara del centro de Horn: sus sumas se pueden
reutilizar. El índice se valida comparando, en una corrida completa, las sumas nuevas y viejas de las no marcadas.

Solo vale para P-009 y para el método de bloques de 2x2 píxeles GLO-90. Con los bloques de 200 m en LAEA (ADR-005)
los bloques ya no se alinean con el borde de la tesela: ese cambio exige una corrida completa de E-03, no este índice.

Salida: $RUN/terreno/indice_mascara_horn.json (afectadas, sanas y motivo por tesela).
Uso: python e03_indice_afectadas.py [procesos]
"""

from __future__ import annotations

import json
import sys
import time
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

import numpy as np
from osgeo import gdal

from comun import ruta_env
from e01_malla import esquina_tesela
from e03_terreno import LIMITE_POLAR

gdal.UseExceptions()


def motivo(ruta_dem: str) -> str | None:
    """Por qué cambia la tesela, o None si no cambia."""
    lat0, lon0 = esquina_tesela(Path(ruta_dem).name)
    if lon0 in (179, -180):
        return "antimeridiano"
    ruta_wbm = ruta_dem.replace("_DEM.tif", "_WBM.tif").replace("\\dem\\", "\\wbm\\").replace("/dem/", "/wbm/")
    if not Path(ruta_wbm).exists():
        return "sin WBM"
    ds_w = gdal.Open(ruta_wbm)  # el dataset tiene que seguir vivo mientras se lee la banda
    if np.any(ds_w.GetRasterBand(1).ReadAsArray() != 0):
        return "agua"
    ds_d = gdal.Open(ruta_dem)
    b = ds_d.GetRasterBand(1)
    a = b.ReadAsArray()
    nd = b.GetNoDataValue()
    if not np.all(np.isfinite(a)) or (nd is not None and np.any(a == nd)):
        return "dem sin dato"
    return None


def main() -> int:
    procesos = int(sys.argv[1]) if len(sys.argv) > 1 else 4
    datos, run = ruta_env("DATOS"), ruta_env("RUN")
    t0 = time.time()
    dems = sorted((datos / "tierra" / "glo90" / "dem").glob("*_DEM.tif"))
    todas = [str(d) for d in dems if abs(esquina_tesela(d.name)[0] + 0.5) < LIMITE_POLAR]
    with ProcessPoolExecutor(procesos) as pool:
        motivos = list(pool.map(motivo, todas, chunksize=64))
    afectadas = {Path(d).stem: m for d, m in zip(todas, motivos) if m}
    sanas = [Path(d).stem for d, m in zip(todas, motivos) if not m]
    conteo: dict[str, int] = {}
    for m in afectadas.values():
        conteo[m] = conteo.get(m, 0) + 1
    r = {"paso": "E-03 terreno", "deuda": "P-009", "teselas": len(todas), "afectadas": len(afectadas),
         "sanas": len(sanas), "por_motivo": conteo, "segundos": round(time.time() - t0, 1),
         "lista_afectadas": afectadas, "lista_sanas": sanas}
    (run / "terreno" / "indice_mascara_horn.json").write_text(json.dumps(r, ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps({k: v for k, v in r.items() if not k.startswith("lista")}, ensure_ascii=False, indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main())
