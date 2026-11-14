---
title: "Sensores y datasets de la Luna (polo sur y bases permanentes)"
type: referencia
status: vigente
date: 2026-11-03
updated: 2026-11-13
summary: "Producto, formato, proyección, resolución y escala de datasets lunares (LOLA, Diviner, LROC, M3 y Mini-RF)."
autor: fernando
consultado: 2026-11-13
vence: 2027-02-01
fuentes:
  - url: https://imbrium.mit.edu/DATA/LOLA_GDR/
    nivel: O
    fecha: 2026-11-04
  - url: https://pgda.gsfc.nasa.gov/products/78
    nivel: O
    fecha: 2026-11-04
  - url: https://pgda.gsfc.nasa.gov/products/69
    nivel: O
    fecha: 2026-11-04
  - url: https://pds-geosciences.wustl.edu/lro/urn-nasa-pds-lro_diviner_derived1/data_derived_gdr_l2/
    nivel: O
    fecha: 2026-11-04
  - url: https://pds-geosciences.wustl.edu/lro/urn-nasa-pds-lro_diviner_derived1/data_derived_gdr_l3/
    nivel: O
    fecha: 2026-11-10
  - url: https://pds-geosciences.wustl.edu/lro/urn-nasa-pds-lro_diviner_derived1/data_derived_prp/
    nivel: O
    fecha: 2026-11-10
  - url: https://pds-geosciences.wustl.edu/lunar/urn-nasa-pds-chang_e_microwave_processed/miscellaneous/hpar_global_128ppd.xml
    nivel: O
    fecha: 2026-11-10
  - url: https://pds-geosciences.wustl.edu/lro/lro-l-mrflro-4-cdr-v1/lromrf_0005/catalog/mrflro_5_cdr_mosaic_v1_0_ds.cat
    nivel: O
    fecha: 2026-11-13
  - url: https://ode.rsl.wustl.edu/moon/pagehelp/Content/Missions_Instruments/ISRO_Chandrayaan-1/M3/Intro.htm
    nivel: O
    fecha: 2026-11-04
  - url: https://lroc.im-ldi.com/images/downloads
    nivel: O
    fecha: 2026-11-04
  - url: https://doi.org/10.5066/P1MEQ6UK
    nivel: O
    fecha: 2026-11-05
  - url: https://gdal.org/en/stable/drivers/raster/pds.html
    nivel: O
    fecha: 2026-11-04
---

# Sensores y datasets de la Luna (polo sur y bases permanentes)

Compendio de lo investigado en [[I-05-datasets-planetarios-formato-y-procesamiento]]. Sistema de referencia común:
marco MOON_ME (DE421), latitud planetocéntrica, esfera de **1737.4 km** (`IAU_2015:30100`; polar sur `30135`).

## El dato

| Variable | Producto | Formato | Proyección y resolución | Escala, NoData y preprocesamiento |
| :-- | :-- | :-- | :-- | :-- |
| Relieve global | LOLA GDR `LDEM_128` … `LDEM_1024` (V3.0) y SLDEM2015 (60°S-60°N, 512 ppd) | PDS3 `.IMG` + `.LBL` (GDAL: driver PDS, abrir el `.lbl`) | Simple cilíndrica; 128 ppd = 236.9 m/px | Entero 16 bits: altura = DN × 0.5 m sobre 1737.4 km. GDAL no aplica la escala: `gdal_translate -ot Float32 -unscale`. Sin `MISSING_CONSTANT`. |
| Relieve polo sur | LOLA `LDEM_80S_20M` (20 m, 80-90°S) y `LDEM_875S_5M` (5 m); sitios de Barker et al. 2021 (5 m, GeoTIFF en metros) | PDS3 `.IMG`; versión `LDEM_80S_20M_FLOAT` (V2.1) en el PDS Geosciences Node; sitios PGDA en GeoTIFF | Estereográfica polar sur; 30 400 × 30 400 px | Entero: escala 0.5 m. FLOAT: 32 bits en **kilómetros** sobre 1737.4 km (× 1000). Existen mapas de conteo y de error que identifican zonas interpoladas. |
| Pendiente | SLDEM2015 slope (hasta 512 ppd); sitios polo sur `*_slp.tif` (5 m, grados) | `.IMG`, `.JP2`, GeoTIFF | Según producto | La pendiente cambia con la línea base: depende de la resolución. |
| Iluminación y PSR | LOLA Polar Illumination y Permanent Shadow (Mazarico et al. 2011) | `.IMG`, `.TIF` y COG | Estereográfica polar; 240, 120 y 60 m/px | Las vistas reducidas (overviews) del COG no sirven para medir. El PSR de LOLA omite cráteres pequeños (<100-200 m). |
| Temperatura e inercia térmica | Diviner GDR L2 (bundle PDS4 `lro_diviner_derived1`, 2009-07 a 2016-10) y **parámetro H** (Hayne et al. 2017) | `.IMG` entero 16 bits + `.LBL` (GDAL: driver PDS) | Simple cilíndrica 128 ppd (236.9 m/px); polar estereográfica 240 m/px de 75° al polo | `MISSING_CONSTANT = -32768`; escala y offset propios de cada capa (`-unscale`). Offset de puntería de ±3.4 mrad antes y después de 2016-12. |
| Temperatura polar | Diviner GDR **nivel 3** polar: `dgdr_tbol_avg_pols_<AAAAMMDD><d\|n>_240_img` (temperatura bolométrica media por periodo de unas 4 semanas; `d` = hora local de 6 a 18 h y `n` = de 18 a 6 h, leído en `LRO:DLRE_CLOCTIME_MIN/MAX` de cada `.lbl` el 2026-11-10; 210 mapas en el polo sur, 2009-07 a 2016) y el Polar Resource Product (`LRO-L-DLRE-5-PRP-V2.0`, Paige et al. 2010) | GDR: PDS3 `.IMG` + `.LBL`, 29 MB c/u, entero 16 bits: K = DN × 0.02, sin dato −32768. PRP: tabla ASCII de 2 880 000 triángulos (`dlre_prp_south.tab`, 605 MB; zip de 117 MB en `extras/prp/`), columnas en `label/dlre_prp.fmt` | GDR: estereográfica polar, 240 m/px. PRP: malla de triángulos sobre el DEM de Kaguya, de 80° S al polo | No hay una capa de máximo y mínimo: el máximo y el mínimo salen de la serie de mapas (máximo de los de día, mínimo de los de noche). La hora local deriva a lo largo de cada mapa (la órbita avanza de 180° a −180° de longitud), así que `d` y `n` son rangos de hora, no una hora fija. El PRP trae T máxima anual en superficie, T media anual a 2 cm y profundidad del hielo estable (−999 si pasa de 2.87 m), salidas de modelo y del primer año de mapeo; **no trae mínimo**. |
| Inercia térmica | Parámetro H de Hayne et al. 2017 (`hpar_global_128ppd.fits`), copia PDS4 en el bundle `chang_e_microwave_processed`, colección `miscellaneous` | FITS 32 bits, 1.65 GB | Simple cilíndrica, 128 ppd, **70° S a 70° N** | H es la escala de densidad del regolito, inversa de la inercia térmica; ajuste al canal 7 de Diviner (25-41 µm). Ni la etiqueta ni la cabecera FITS declaran la unidad: enteros de 16 bits con `BSCALE` 1.5259e-5 y `BZERO` ~0.5 (valores de 0 a 1, sin dato −32768). La unidad es **metros**: el pie de la figura del mapa global de Hayne et al. 2017 dice que la escala de color indica el parámetro H «in meters» (arXiv:1711.00977, pág. 15; consultado el 2026-11-13). No cubre latitudes polares por encima de 70° S (solo sirve de contexto fuera del polo). |
| Imagen y modelo WAC | LROC WAC GLD100 (100 m, 79°S-79°N) y mosaico global 643 nm | ISIS `.cub` (GDAL: driver ISIS3) | Equirectangular y polar | GLD100 no cubre los polos: ahí se dispone de LOLA. |
| Imagen NAC | Mosaico polar sur NAC (1 m) | `.cub` (189 GB) y GeoTIFF de 8 bits en Moon Trek | Polar sur | Imágenes sin co-registro entre sí: solo para visualización, no para medir. |
| Mineralogía | M3 Nivel 2 (`CH1M3_0004`, reflectancia `*_RFL.IMG`) | PDS3 `.IMG` + `.HDR` ENVI | Sin proyectar: geolocalizar con `*LOC.IMG`. 140 m/px en modo Global y 70 m/px en Target | Ya viene con corrección fotométrica y térmica. Bandas reportadas: 85 (Global) y 260 (Target), sin confirmar en el SIS. |
| Contornos de las 9 regiones candidatas de Artemis (2024) | USGS data release "Down Selected Artemis III Candidate Landing Site Navigational Grids" (DOI 10.5066/P1MEQ6UK, 2024-12-05); archivo `A3_9regions-lonlat-simplified` | Shapefile y GeoJSON | Latitud y longitud en `GCS_Moon_2000` (esfera de 1737.4 km); 9 polígonos de 4 vértices | Cuadrados definidos en estereográfica polar sur. Mons Mouton y Nobile Rim 1 se tocan y caen en el borde de Mons Mouton Plateau. Centros en [[I-17-sitios-objetivo-luna-y-marte]]. |
| Radar polar | LRO Mini-RF (`LRO-L-MRFLRO-5-CDR-MOSAIC-V1.0`, `lromrf_0005`), mosaico polar sur CPR (`lsz_xxxxx_3cp_piu_90s000_v1.img`) | PDS `.IMG` (`428 158 864` B a `256 ppd`; versión `32 ppd` = `6 697 744` B; E/W `512 ppd` = `1 712 469 924` B c/u) | Estereográfica polar sur, banda S (`12,6 cm`), polarización circular híbrida | Sin equivalente SAR global terrestre comparable (ver [[sensores-tierra]]). Según `mrflro_5_cdr_mosaic_v1_0_ds.cat` (consultado el `2026-11-13`), el transmisor dejó de emitir RF el `2010-12-26` (fin de datos `2011-01-11`). Un CPR alto en PSR no distingue hielo de rugosidad de bloques: solo como *proxy* de rugosidad centimétrica donde tenga cobertura. |

Licencia: dominio público de NASA para todos (el data release del USGS de los contornos es dominio público de USGS; la página de ScienceBase no se pudo leer); se cita el artículo de cada producto (lista en [[I-05-datasets-planetarios-formato-y-procesamiento]]).

## Relaciones

- [[sensores-tierra]] — sus equivalentes terrestres
- [[I-05-datasets-planetarios-formato-y-procesamiento]] — fuentes de cada dato
- [[I-07-armonizar-tierra-luna-marte]] — pendiente, rugosidad y variables entre cuerpos
