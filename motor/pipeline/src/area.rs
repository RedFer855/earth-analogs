//! Búsqueda restringida a un área (`GeoJSON` o caja lat/lon en coordenadas WGS84).
//!
//! El área se pasa a rangos de filas de la tabla con la cobertura de `HEALPix` (latitud autálica, ver `geo`).
//! Como un área chica deja pocas regiones, el radio de exclusión se acota a `k * sqrt(área de tierra elegible)` y
//! se exige un área mínima; ambos valores son provisionales y se pueden cambiar por línea de comandos.

use std::collections::BTreeMap;
use std::f64::consts::PI;
use std::ops::Range;
use std::path::Path;

use anyhow::{bail, ensure, Context, Result};
use cdshealpix::nested::bmoc::BMOC;
use rayon::prelude::*;
use serde_json::Value;

use crate::barrido::FILAS_POR_TAREA;
use crate::geo::{geodesica_a_autalica, RADIO_TIERRA_KM};

pub const K_AREA_DEFECTO: f64 = 0.15;

pub const MIN_REGIONES_AREA: usize = 4;

pub const MIN_AREA_TIERRA_KM2: f64 = 40_000.0;

type Anillo = Vec<(f64, f64)>;

#[derive(Debug, Clone)]
pub enum Area {
    Poligonos(Vec<Anillo>),
    Bbox {
        lat_min: f64,
        lon_min: f64,
        lat_max: f64,
        lon_max: f64,
    },
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct ResumenArea {
    pub celdas_en_area: u64,
    pub regiones_con_tierra: usize,
    pub sin_celdas_por_ndvi: u64,
    pub area_tierra_km2: f64,
}

impl ResumenArea {
    pub fn exigir_minimo_km2(self, min_km2: f64) -> Result<()> {
        ensure!(
            self.area_tierra_km2 >= min_km2,
            "área demasiado pequeña: {:.0} km² de tierra elegible, se requieren al menos {min_km2:.0} km² (--min-area-km2)",
            self.area_tierra_km2
        );
        Ok(())
    }

    #[must_use]
    pub fn tope_radio_km(self, k: f64) -> f64 {
        k * self.area_tierra_km2.sqrt()
    }
}

#[must_use]
pub fn radio_efectivo(radio_km: f64, area_tierra_km2: f64, k: f64) -> f64 {
    radio_km.min(k * area_tierra_km2.sqrt())
}

#[must_use]
pub fn area_celda_km2(nivel_celda: u32) -> f64 {
    let n_celdas = 12.0 * 4.0_f64.powi(i32::try_from(nivel_celda).unwrap_or(12));
    4.0 * PI * RADIO_TIERRA_KM * RADIO_TIERRA_KM / n_celdas
}

pub fn validar_k_area(k: Option<f64>) -> Result<f64> {
    let val = k.unwrap_or(K_AREA_DEFECTO);
    ensure!(
        val.is_finite() && val > 0.0 && val <= 1.0,
        "--k-area debe estar en (0, 1]"
    );
    Ok(val)
}

pub fn validar_min_area_km2(min: Option<f64>) -> Result<f64> {
    let val = min.unwrap_or(MIN_AREA_TIERRA_KM2);
    ensure!(
        val.is_finite() && val >= 0.0,
        "--min-area-km2 debe ser un número >= 0"
    );
    Ok(val)
}

pub fn parsear_bbox(texto: &str) -> Result<[f64; 4]> {
    let partes: Vec<&str> = texto.split(',').map(str::trim).collect();
    ensure!(
        partes.len() == 4,
        "--bbox debe tener 4 números separados por coma: lat1,lon1,lat2,lon2"
    );
    let mut vals = [0.0_f64; 4];
    for (dst, s) in vals.iter_mut().zip(partes) {
        *dst = s
            .parse::<f64>()
            .with_context(|| format!("--bbox: número inválido `{s}`"))?;
    }
    validar_bbox(vals)?;
    Ok(vals)
}

fn validar_bbox([lat1, lon1, lat2, lon2]: [f64; 4]) -> Result<()> {
    ensure!(
        lat1.is_finite()
            && lat2.is_finite()
            && (-90.0..=90.0).contains(&lat1)
            && (-90.0..=90.0).contains(&lat2),
        "--bbox: las latitudes deben estar en [-90, 90]"
    );
    ensure!(lat1 < lat2, "--bbox requiere lat1 < lat2");
    ensure!(
        lon1.is_finite()
            && lon2.is_finite()
            && (-180.0..=180.0).contains(&lon1)
            && (-180.0..=180.0).contains(&lon2),
        "--bbox: las longitudes deben estar en [-180, 180]"
    );
    ensure!(
        (lon1 - lon2).abs() > 1e-12,
        "--bbox: lon1 y lon2 no pueden ser iguales"
    );
    Ok(())
}

pub fn cargar_area(region: Option<&Path>, bbox: Option<[f64; 4]>) -> Result<Option<Area>> {
    match (region, bbox) {
        (Some(_), Some(_)) => bail!("--region y --bbox son mutuamente excluyentes"),
        (None, None) => Ok(None),
        (Some(ruta), None) => Ok(Some(Area::desde_geojson_archivo(ruta)?)),
        (None, Some(b)) => {
            validar_bbox(b)?;
            Ok(Some(Area::Bbox {
                lat_min: b[0],
                lon_min: b[1],
                lat_max: b[2],
                lon_max: b[3],
            }))
        }
    }
}

impl Area {
    pub fn desde_geojson_archivo(ruta: &Path) -> Result<Self> {
        let texto = std::fs::read_to_string(ruta)
            .with_context(|| format!("no se pudo leer {}", ruta.display()))?;
        Self::desde_geojson(&texto).with_context(|| {
            format!(
                "{} no es un GeoJSON válido de Polygon/MultiPolygon",
                ruta.display()
            )
        })
    }

    pub fn desde_geojson(texto: &str) -> Result<Self> {
        let raiz: Value = serde_json::from_str(texto).context("JSON inválido")?;
        let mut poligonos = Vec::new();
        let mut huecos = 0usize;
        recolectar_geometria(&raiz, &mut poligonos, &mut huecos)?;
        ensure!(
            !poligonos.is_empty(),
            "el GeoJSON no contiene ningún Polygon o MultiPolygon"
        );
        if huecos > 0 {
            eprintln!(
                "aviso: el GeoJSON trae {huecos} anillo(s) interior(es) (huecos) que se ignoran"
            );
        }
        Ok(Self::Poligonos(poligonos))
    }

    #[must_use]
    pub fn rangos_ipix(&self, nivel_celda: u8) -> Vec<Range<u64>> {
        let mut rangos = Vec::new();
        match self {
            Self::Poligonos(polis) => {
                for anillo in polis {
                    let vertices: Vec<(f64, f64)> = anillo
                        .iter()
                        .map(|&(lon, lat)| {
                            (lon.to_radians(), geodesica_a_autalica(lat).to_radians())
                        })
                        .collect();
                    let bmoc = cdshealpix::nested::polygon_coverage(nivel_celda, &vertices, true);
                    agregar_bmoc(&bmoc, nivel_celda, &mut rangos);
                }
            }
            Self::Bbox {
                lat_min,
                lon_min,
                lat_max,
                lon_max,
            } => {
                let lon_ini = lon_min.rem_euclid(360.0).to_radians();
                let fin = lon_max.rem_euclid(360.0);
                let lon_fin = if fin == 0.0 { 360.0 } else { fin }.to_radians();
                let bmoc = cdshealpix::nested::zone_coverage(
                    nivel_celda,
                    lon_ini,
                    geodesica_a_autalica(*lat_min).to_radians(),
                    lon_fin,
                    geodesica_a_autalica(*lat_max).to_radians(),
                );
                agregar_bmoc(&bmoc, nivel_celda, &mut rangos);
            }
        }
        fusionar_rangos(rangos)
    }

    pub fn rangos_filas(&self, ipix: &[u32], nivel_celda: u8) -> Result<Vec<Range<usize>>> {
        ensure!(
            ipix.is_sorted(),
            "la columna `ipix` no viene ordenada ascendente"
        );
        let rangos_pix = self.rangos_ipix(nivel_celda);
        let mut filas: Vec<Range<usize>> = Vec::new();
        for r in rangos_pix {
            let a = ipix.partition_point(|&p| u64::from(p) < r.start);
            let b = a + ipix
                .get(a..)
                .unwrap_or(&[])
                .partition_point(|&p| u64::from(p) < r.end);
            if a < b {
                if let Some(ult) = filas.last_mut().filter(|u| u.end == a) {
                    ult.end = b;
                } else {
                    filas.push(a..b);
                }
            }
        }
        Ok(filas)
    }
}

type Parcial = (u64, u64, Vec<(u32, u64)>);

#[expect(
    clippy::too_many_arguments,
    reason = "parámetros directos de la tabla y niveles sin armar un struct intermedio de un solo uso"
)]
pub fn evaluar_y_validar_area(
    rangos: &[Range<usize>],
    ipix: &[u32],
    ndvi: &[f32],
    obligatorias: &[&[f32]],
    ndvi_max: f32,
    nivel_region: u32,
    nivel_celda: u32,
    min_celdas_region: u64,
) -> Result<ResumenArea> {
    let desplazamiento = 2 * (nivel_celda - nivel_region);
    let trozos: Vec<Range<usize>> = rangos
        .iter()
        .flat_map(|r| {
            (r.start..r.end)
                .step_by(FILAS_POR_TAREA)
                .map(|a| a..(a + FILAS_POR_TAREA).min(r.end))
        })
        .collect();
    let parciales: Vec<Parcial> = trozos
        .par_iter()
        .map(|r| {
            contar_trozo(
                r.clone(),
                ipix,
                ndvi,
                obligatorias,
                ndvi_max,
                desplazamiento,
            )
        })
        .collect();
    let mut celdas_en_area = 0u64;
    let mut sin_celdas_por_ndvi = 0u64;
    let mut por_region: BTreeMap<u32, u64> = BTreeMap::new();
    for (el, sn, regs) in parciales {
        celdas_en_area += el;
        sin_celdas_por_ndvi += sn;
        for (reg, c) in regs {
            *por_region.entry(reg).or_default() += c;
        }
    }
    let min_reg = min_celdas_region.max(1);
    let regiones_con_tierra = por_region.values().filter(|&&c| c >= min_reg).count();

    if celdas_en_area == 0 {
        if sin_celdas_por_ndvi > 0 {
            bail!(
                "el área no tiene celdas de tierra elegibles (¿cae en el mar o fuera de la tabla?); {sin_celdas_por_ndvi} celdas con terreno superan el corte de NDVI"
            );
        }
        bail!("el área no tiene celdas de tierra elegibles (¿cae en el mar o fuera de la tabla?)");
    }
    if regiones_con_tierra < MIN_REGIONES_AREA {
        bail!(
            "área demasiado pequeña: se requieren al menos {MIN_REGIONES_AREA} regiones con tierra (>= {min_reg} celdas elegibles cada una), pero se encontraron {regiones_con_tierra} ({celdas_en_area} celdas elegibles)"
        );
    }

    #[expect(
        clippy::cast_precision_loss,
        reason = "el conteo de celdas en nivel 12 (<= 201M) entra exacto en f64"
    )]
    let area_tierra_km2 = (celdas_en_area as f64) * area_celda_km2(nivel_celda);
    Ok(ResumenArea {
        celdas_en_area,
        regiones_con_tierra,
        sin_celdas_por_ndvi,
        area_tierra_km2,
    })
}

fn contar_trozo(
    r: Range<usize>,
    ipix: &[u32],
    ndvi: &[f32],
    obligatorias: &[&[f32]],
    ndvi_max: f32,
    desplazamiento: u32,
) -> (u64, u64, Vec<(u32, u64)>) {
    let mut elegibles = 0u64;
    let mut sin_ndvi = 0u64;
    let mut por_region: Vec<(u32, u64)> = Vec::new();
    for i in r {
        let Some(&v_ndvi) = ndvi.get(i) else {
            continue;
        };
        let tiene_terreno = !obligatorias.is_empty()
            && obligatorias
                .iter()
                .all(|col| col.get(i).is_some_and(|x| x.is_finite()));
        if !tiene_terreno {
            continue;
        }
        if v_ndvi.is_nan() || v_ndvi > ndvi_max {
            sin_ndvi += 1;
            continue;
        }
        let Some(&pix) = ipix.get(i) else {
            continue;
        };
        elegibles += 1;
        let reg = pix >> desplazamiento;
        if let Some(ult) = por_region.last_mut().filter(|(id, _)| *id == reg) {
            ult.1 += 1;
        } else {
            por_region.push((reg, 1));
        }
    }
    (elegibles, sin_ndvi, por_region)
}

fn agregar_bmoc(bmoc: &BMOC, nivel_celda: u8, out: &mut Vec<Range<u64>>) {
    for c in bmoc {
        let shift = 2 * (nivel_celda - c.depth);
        let start = c.hash << shift;
        let end = (c.hash + 1) << shift;
        out.push(start..end);
    }
}

fn fusionar_rangos(mut rangos: Vec<Range<u64>>) -> Vec<Range<u64>> {
    if rangos.is_empty() {
        return rangos;
    }
    rangos.sort_unstable_by(|a, b| a.start.cmp(&b.start).then(a.end.cmp(&b.end)));
    let mut out: Vec<Range<u64>> = Vec::with_capacity(rangos.len());
    for r in rangos {
        if r.is_empty() {
            continue;
        }
        if let Some(ult) = out.last_mut().filter(|u| r.start <= u.end) {
            ult.end = ult.end.max(r.end);
        } else {
            out.push(r);
        }
    }
    out
}

fn recolectar_geometria(v: &Value, out: &mut Vec<Anillo>, huecos: &mut usize) -> Result<()> {
    let tipo = v
        .get("type")
        .and_then(Value::as_str)
        .context("falta el campo `type` en el GeoJSON")?;
    match tipo {
        "FeatureCollection" => {
            let feats = v
                .get("features")
                .and_then(Value::as_array)
                .context("`FeatureCollection` sin arreglo `features`")?;
            for f in feats {
                if let Some(g) = f.get("geometry").filter(|g| !g.is_null()) {
                    recolectar_geometria(g, out, huecos)?;
                }
            }
        }
        "Feature" => {
            let g = v
                .get("geometry")
                .filter(|g| !g.is_null())
                .context("`Feature` sin `geometry`")?;
            recolectar_geometria(g, out, huecos)?;
        }
        "Polygon" => {
            let coords = v
                .get("coordinates")
                .and_then(Value::as_array)
                .context("`Polygon` sin `coordinates`")?;
            out.push(parsear_poligono(coords, huecos)?);
        }
        "MultiPolygon" => {
            let polys = v
                .get("coordinates")
                .and_then(Value::as_array)
                .context("`MultiPolygon` sin `coordinates`")?;
            for p in polys {
                let rings = p
                    .as_array()
                    .context("elemento de `MultiPolygon` no es un arreglo de anillos")?;
                out.push(parsear_poligono(rings, huecos)?);
            }
        }
        otro => bail!(
            "tipo GeoJSON no soportado: `{otro}` (solo Polygon, MultiPolygon, Feature o FeatureCollection)"
        ),
    }
    Ok(())
}

fn parsear_poligono(anillos: &[Value], huecos: &mut usize) -> Result<Anillo> {
    let ext = anillos
        .first()
        .and_then(Value::as_array)
        .context("polígono sin anillo exterior")?;
    if anillos.len() > 1 {
        *huecos += anillos.len() - 1;
    }
    let mut pts = Vec::with_capacity(ext.len());
    for punto in ext {
        let arr = punto
            .as_array()
            .filter(|a| a.len() >= 2)
            .context("cada vértice debe ser `[lon, lat]`")?;
        let lon = arr
            .first()
            .and_then(Value::as_f64)
            .context("longitud inválida")?;
        let lat = arr
            .get(1)
            .and_then(Value::as_f64)
            .context("latitud inválida")?;
        ensure!(
            lon.is_finite() && (-360.0..=360.0).contains(&lon),
            "longitud fuera de [-360, 360]: {lon}"
        );
        ensure!(
            lat.is_finite() && (-90.0..=90.0).contains(&lat),
            "latitud fuera de [-90, 90]: {lat}"
        );
        pts.push((lon, lat));
    }
    if pts.len() >= 2 && pts.first() == pts.last() {
        pts.pop();
    }
    ensure!(
        pts.len() >= 3,
        "un polígono necesita al menos 3 vértices distintos"
    );
    Ok(pts)
}

#[cfg(test)]
mod pruebas {
    use super::*;

    #[test]
    fn radio_efectivo_ejemplo_40000_km2() {
        assert!((radio_efectivo(100.0, 40_000.0, 0.1) - 20.0).abs() < 1e-12);
        assert!((radio_efectivo(10.0, 40_000.0, 0.1) - 10.0).abs() < 1e-12);
    }

    #[test]
    fn valida_k_area_y_bbox() {
        assert!(validar_k_area(None).is_ok());
        assert!(validar_k_area(Some(0.15)).is_ok());
        assert!(validar_k_area(Some(1.0)).is_ok());
        assert!(validar_k_area(Some(0.0)).is_err());
        assert!(validar_k_area(Some(1.1)).is_err());
        assert!(validar_k_area(Some(f64::NAN)).is_err());

        assert!(parsear_bbox("-25,-70,-21,-66").is_ok());
        assert!(parsear_bbox("-2,178,2,-178").is_ok());
        assert!(parsear_bbox("10,0,5,10").is_err());
        assert!(parsear_bbox("0,10,5,10").is_err());
        assert!(parsear_bbox("0,10,5").is_err());
    }
}
