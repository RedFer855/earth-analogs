# Data sources

Open datasets the pipeline reads. Raw files are kept outside the repository under `$DATOS` and never enter git.
Each entry lists product and version, where it comes from and its license.

## Earth

| Data | Product and version | Source | License |
| :-- | :-- | :-- | :-- |
| Elevation and water mask | Copernicus DEM GLO-90, release 2024_1 | AWS Open Data `copernicus-dem-90m` | Copernicus DEM license |
| Emissivity / silica | ASTER GED AG1km V003 | NASA Earthdata (LP DAAC) | NASA open data |
| Land surface temperature | MODIS Aqua MYD11C3 V061, monthly, 2013–2022 | NASA Earthdata (LP DAAC) | NASA open data |
| Vegetation | MODIS MOD13C1 V061 (NDVI), 2013–2022 | NASA Earthdata (LP DAAC) | NASA open data |
| Wind (friction velocity, air density) | MERRA-2 `M2T1NXFLX` | NASA GES DISC | NASA open data |
| Dust emission | MERRA-2 `M2TMNXADG` (`DUEM001`–`DUEM005`) | NASA GES DISC | NASA open data |
| Dust storm frequency | `MODFDS_MON_GLB_L3` v1 | NASA GES DISC | NASA open data |
| Aridity | Global Aridity Index and PET v3.1 | Figshare 7504448 | CC BY 4.0 (non-commercial use stated) |
| Permafrost | Obu et al. 2018, mean annual ground temperature | ESA CCI / PANGAEA | CC BY 3.0 |
| Lithology | GLiM v1.0, 0.5° grid | Hartmann & Moosdorf 2012 | CC BY 3.0 |
| Minerals | EMIT `EMITL3ASA` V002 (0.5°) | NASA Earthdata | NASA open data |
| Surface water | JRC Global Surface Water v1.5 | global-surface-water.appspot.com | Copernicus open license |
| Wetlands and lakes | GLWD v2 | Figshare | CC BY 4.0 |
| Dunes and sand | GSDP30 and GSDS30 | Zenodo 10.5281/zenodo.13907012, 10.5281/zenodo.10441041 | CC BY 4.0 |
| Lava tubes | Pyroduct Digital Catalog v3.0 | Zenodo 10.5281/zenodo.14535885 | CC BY 4.0 |
| Ground ice | Karjalainen et al. 2022 v1.1 | Zenodo 10.5281/zenodo.7009875 | CC BY 4.0 |
| Sky-view factor | Li et al. 2024 | ESSD | CC BY 4.0 |
| Soil fine fraction | SoilGrids 2.0 (clay, silt), 1 km | ISRIC | CC BY 4.0 |

## Moon (south pole)

| Data | Product and version | Source | License |
| :-- | :-- | :-- | :-- |
| Elevation | LOLA `LDEM_80S_20M` V2.1 | PDS Geosciences Node | NASA open data |
| Temperature | Diviner GDR L3 polar, `dgdr_tbol_avg_pols`; Paige et al. 2010 PRP | PDS Geosciences Node | NASA open data |
| Thermal inertia (context) | Diviner H-parameter, Hayne et al. 2017 | PDS Geosciences Node | NASA open data |
| Silica | Diviner Christiansen Feature, Lucey et al. 2021 | Zenodo 10.5281/zenodo.4558194 | CC BY 4.0 |
| Local slopes at 5 m | LOLA site DEMs, Barker et al. 2021 | NASA PGDA | NASA open data |
| Illumination | LOLA polar illumination and permanent shadow, Mazarico et al. 2011 | NASA PGDA | NASA open data |
| Radar roughness (context) | LRO Mini-RF CDR mosaic V1.0 | PDS Geosciences Node | NASA open data |
| Artemis candidate regions | USGS, DOI 10.5066/P1MEQ6UK | USGS | Public domain |

## Mars

| Data | Product and version | Source | License |
| :-- | :-- | :-- | :-- |
| Elevation | HRSC-MOLA blended DEM v2 | USGS Astrogeology | Public domain |
| Local elevation | CTX and HiRISE DTMs | USGS STAC | Public domain |
| Minerals | TES global mineral maps, Bandfield 2002 | tes.asu.edu | NASA open data |
| Thermal inertia | THEMIS global thermal inertia; TES, Putzig & Mellon 2007 | USGS Astrogeology / PDS | Public domain |
| Dust (MDAD) | Mars Dust Activity Database v1.1 | Zenodo 10.5281/zenodo.7480334 | CC BY 4.0 |
| Atmospheric dust | Montabone dust climatology v2 (MY24–MY36) | LMD | CC BY-SA 3.0 |
| Climate (local use only) | Mars Climate Database 6.2 | LMD | Scientific use; not redistributed |
| Caves | MGC³, Cushing 2015, doi:10.17189/1519222 | NASA PDS | Public domain |
