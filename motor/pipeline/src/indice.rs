//! Exclusión por índice: deja fuera las celdas a menos de cierto radio de análogos ya conocidos o ya hallados,
//! para buscar sitios nuevos. Clasifica cada región de `HEALPix` una vez (fuera, dentro o cerca) y solo mide
//! distancias celda a celda en las regiones que quedan cerca de alguna entrada.

use std::collections::{HashMap, HashSet};
use std::f64::consts::PI;
use std::path::Path;

use anyhow::{bail, ensure, Context, Result};
use rayon::prelude::*;
use serde::{Deserialize, Serialize};

use crate::geo::{
    autalica_a_geodesica, centro_celda, haversine_km, normalizar_lon, vector_unitario,
    RADIO_TIERRA_KM,
};

const LIMITE_REGIONES_DENSAS: usize = 65_536;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum EstadoIndice {
    Documentado,
    VerificadoRemoto,
    VerificadoCampo,
}

#[derive(Debug, Clone, PartialEq, Deserialize, Serialize)]
pub struct EntradaIndice {
    pub id: String,
    pub lat: f64,
    pub lon: f64,
    pub radio_km: f64,
    pub estado: EstadoIndice,
    pub fuente: String,
    pub fecha: String,
}

#[derive(Debug, Clone)]
struct EntradaInterna {
    lat: f64,
    lon: f64,
    radio_km: f64,
    u: [f64; 3],
}

#[derive(Debug, Clone)]
pub struct IndiceExclusion {
    entradas: Vec<EntradaInterna>,
}

impl IndiceExclusion {
    pub fn cargar(ruta: &Path) -> Result<Self> {
        let texto = std::fs::read_to_string(ruta)
            .with_context(|| format!("no se pudo leer {}", ruta.display()))?;
        Self::desde_json(&texto).with_context(|| {
            format!(
                "{} no tiene el formato de índice esperado (arreglo JSON con id, lat, lon, radio_km, estado, fuente y fecha)",
                ruta.display()
            )
        })
    }

    pub fn desde_json(texto: &str) -> Result<Self> {
        let entradas: Vec<EntradaIndice> = serde_json::from_str(texto)?;
        Self::desde_entradas(entradas)
    }

    pub fn desde_entradas(entradas: Vec<EntradaIndice>) -> Result<Self> {
        let mut ids = HashSet::with_capacity(entradas.len());
        let mut internas = Vec::with_capacity(entradas.len());
        for (i, e) in entradas.into_iter().enumerate() {
            ensure!(
                !e.id.trim().is_empty(),
                "la entrada #{i} del índice tiene `id` vacío"
            );
            ensure!(
                ids.insert(e.id.clone()),
                "id repetido en el índice: `{}`",
                e.id
            );
            ensure!(
                e.lat.is_finite() && (-90.0..=90.0).contains(&e.lat),
                "{}: latitud fuera de [-90, 90] ({})",
                e.id,
                e.lat
            );
            ensure!(
                e.lon.is_finite() && (-180.0..=180.0).contains(&e.lon),
                "{}: longitud fuera de [-180, 180] ({})",
                e.id,
                e.lon
            );
            ensure!(
                e.radio_km.is_finite() && e.radio_km > 0.0,
                "{}: `radio_km` debe ser mayor que 0 ({})",
                e.id,
                e.radio_km
            );
            internas.push(EntradaInterna {
                lat: e.lat,
                lon: e.lon,
                radio_km: e.radio_km,
                u: vector_unitario(e.lat, e.lon),
            });
        }
        Ok(Self { entradas: internas })
    }

    #[must_use]
    pub fn len(&self) -> usize {
        self.entradas.len()
    }

    #[must_use]
    pub fn is_empty(&self) -> bool {
        self.entradas.is_empty()
    }
}

pub fn validar_distancia_km(valor: Option<f64>, nombre: &str) -> Result<()> {
    if let Some(km) = valor {
        ensure!(
            km.is_finite() && km >= 0.0,
            "{nombre} debe ser finito y >= 0"
        );
    }
    Ok(())
}

pub fn cargar_y_validar(
    indice: Option<&Path>,
    excluir_km: Option<f64>,
    separacion_km: Option<f64>,
) -> Result<Option<IndiceExclusion>> {
    if excluir_km.is_some() {
        ensure!(indice.is_some(), "--excluir-km requiere --indice");
    }
    validar_distancia_km(excluir_km, "--excluir-km")?;
    validar_distancia_km(separacion_km, "--separacion-km")?;
    indice.map(IndiceExclusion::cargar).transpose()
}

#[derive(Debug, Clone, Copy)]
enum EstadoRegion {
    Libre,
    Excluida,
    Parcial(usize, usize),
}

enum Clasificacion {
    Libre,
    Excluida,
    Parcial(Vec<usize>),
}

enum MapaRegiones {
    Denso(Vec<EstadoRegion>),
    Disperso(HashMap<u32, EstadoRegion>),
}

pub struct FiltroIndice<'a> {
    indice: &'a IndiceExclusion,
    excluir_km: Option<f64>,
    tope_radio_km: Option<f64>,
    nivel_celda: u8,
    desplazamiento: u32,
    regiones: MapaRegiones,
    cercanas: Vec<usize>,
}

fn radio_entrada(excluir_km: Option<f64>, tope_radio_km: Option<f64>, radio_base: f64) -> f64 {
    let radio = excluir_km.unwrap_or(radio_base);
    match tope_radio_km {
        Some(tope) => radio.min(tope),
        None => radio,
    }
}

fn clasificar_region(
    nivel_region: u8,
    region: u32,
    entradas: &[EntradaInterna],
    excluir_km: Option<f64>,
    tope_radio_km: Option<f64>,
) -> Clasificacion {
    let (clat, clon) = centro_celda(nivel_region, region);
    let u_reg = vector_unitario(clat, clon);

    let r_max = cdshealpix::nested::vertices(nivel_region, u64::from(region))
        .into_iter()
        .map(|(lon_v, lat_v)| {
            haversine_km(
                clat,
                clon,
                autalica_a_geodesica(lat_v.to_degrees()),
                normalizar_lon(lon_v.to_degrees()),
            )
        })
        .fold(0.0_f64, f64::max)
        * 1.25
        + 1.0;

    let mut cercanas = Vec::new();
    for (idx, ent) in entradas.iter().enumerate() {
        let radio = radio_entrada(excluir_km, tope_radio_km, ent.radio_km);
        if radio <= 0.0 {
            continue;
        }
        let dot = u_reg[0] * ent.u[0] + u_reg[1] * ent.u[1] + u_reg[2] * ent.u[2];
        if radio > r_max {
            let umbral_in = ((radio - r_max) / RADIO_TIERRA_KM).min(PI).cos() + 1e-12;
            if dot >= umbral_in {
                return Clasificacion::Excluida;
            }
        }
        let suma = radio + r_max;
        if suma >= PI * RADIO_TIERRA_KM || dot >= (suma / RADIO_TIERRA_KM).cos() - 1e-12 {
            cercanas.push(idx);
        }
    }
    if cercanas.is_empty() {
        Clasificacion::Libre
    } else {
        Clasificacion::Parcial(cercanas)
    }
}

fn registrar(c: Clasificacion, cercanas: &mut Vec<usize>) -> EstadoRegion {
    match c {
        Clasificacion::Libre => EstadoRegion::Libre,
        Clasificacion::Excluida => EstadoRegion::Excluida,
        Clasificacion::Parcial(lista) => {
            let inicio = cercanas.len();
            cercanas.extend(lista);
            EstadoRegion::Parcial(inicio, cercanas.len())
        }
    }
}

impl<'a> FiltroIndice<'a> {
    pub fn nuevo(
        indice: &'a IndiceExclusion,
        nivel_region: u32,
        nivel_celda: u32,
        ipix: &[u32],
        excluir_km: Option<f64>,
    ) -> Result<Self> {
        Self::nuevo_con_tope(indice, nivel_region, nivel_celda, ipix, excluir_km, None)
    }

    pub fn nuevo_con_tope(
        indice: &'a IndiceExclusion,
        nivel_region: u32,
        nivel_celda: u32,
        ipix: &[u32],
        excluir_km: Option<f64>,
        tope_radio_km: Option<f64>,
    ) -> Result<Self> {
        if let Some(km) = excluir_km {
            ensure!(
                km.is_finite() && km >= 0.0,
                "el radio de exclusión debe ser finito y >= 0"
            );
        }
        if let Some(tope) = tope_radio_km {
            ensure!(
                tope.is_finite() && tope >= 0.0,
                "el tope de radio efectivo debe ser finito y >= 0"
            );
        }
        if nivel_region > nivel_celda || nivel_celda > 29 {
            bail!("niveles de HEALPix inválidos para el filtro de índice");
        }
        let nivel_celda_u8 = u8::try_from(nivel_celda).context("nivel_celda fuera de u8")?;
        let nivel_reg_u8 = u8::try_from(nivel_region).context("nivel_region fuera de u8")?;
        let desplazamiento = 2 * (nivel_celda - nivel_region);

        if indice.is_empty()
            || excluir_km.is_some_and(|km| km <= 0.0)
            || tope_radio_km.is_some_and(|km| km <= 0.0)
        {
            return Ok(Self {
                indice,
                excluir_km,
                tope_radio_km,
                nivel_celda: nivel_celda_u8,
                desplazamiento,
                regiones: MapaRegiones::Denso(Vec::new()),
                cercanas: Vec::new(),
            });
        }

        let n_regiones = 12usize.checked_shl(2 * nivel_region);
        let mut cercanas = Vec::new();
        let regiones = if let Some(n_reg) = n_regiones.filter(|&n| n <= LIMITE_REGIONES_DENSAS) {
            let n_u32 = u32::try_from(n_reg).context("demasiadas regiones")?;
            let lista: Vec<Clasificacion> = (0..n_u32)
                .into_par_iter()
                .map(|r| {
                    clasificar_region(nivel_reg_u8, r, &indice.entradas, excluir_km, tope_radio_km)
                })
                .collect();
            let estados = lista
                .into_iter()
                .map(|c| registrar(c, &mut cercanas))
                .collect();
            MapaRegiones::Denso(estados)
        } else {
            let unicas: HashSet<u32> = ipix.iter().map(|&p| p >> desplazamiento).collect();
            let vec_unicas: Vec<u32> = unicas.into_iter().collect();
            let lista: Vec<(u32, Clasificacion)> = vec_unicas
                .into_par_iter()
                .map(|r| {
                    (
                        r,
                        clasificar_region(
                            nivel_reg_u8,
                            r,
                            &indice.entradas,
                            excluir_km,
                            tope_radio_km,
                        ),
                    )
                })
                .collect();
            let mut mapa = HashMap::with_capacity(lista.len());
            for (r, c) in lista {
                mapa.insert(r, registrar(c, &mut cercanas));
            }
            MapaRegiones::Disperso(mapa)
        };

        Ok(Self {
            indice,
            excluir_km,
            tope_radio_km,
            nivel_celda: nivel_celda_u8,
            desplazamiento,
            regiones,
            cercanas,
        })
    }

    #[must_use]
    pub fn excluye_celda(&self, ipix: u32) -> bool {
        if self.indice.is_empty()
            || self.excluir_km.is_some_and(|km| km <= 0.0)
            || self.tope_radio_km.is_some_and(|km| km <= 0.0)
        {
            return false;
        }
        let reg = ipix >> self.desplazamiento;
        let estado = match &self.regiones {
            MapaRegiones::Denso(v) => usize::try_from(reg).ok().and_then(|i| v.get(i)),
            MapaRegiones::Disperso(m) => m.get(&reg),
        };
        let (inicio, fin) = match estado {
            None | Some(EstadoRegion::Libre) => return false,
            Some(EstadoRegion::Excluida) => return true,
            Some(&EstadoRegion::Parcial(a, b)) => (a, b),
        };
        let (lat, lon) = centro_celda(self.nivel_celda, ipix);
        let Some(indices) = self.cercanas.get(inicio..fin) else {
            return false;
        };
        indices.iter().any(|&idx| {
            let Some(ent) = self.indice.entradas.get(idx) else {
                return false;
            };
            let radio = radio_entrada(self.excluir_km, self.tope_radio_km, ent.radio_km);
            haversine_km(lat, lon, ent.lat, ent.lon) < radio
        })
    }
}

#[cfg(test)]
mod pruebas {
    use super::*;

    fn entrada(id: &str, lat: f64, lon: f64, radio_km: f64) -> EntradaIndice {
        EntradaIndice {
            id: id.to_owned(),
            lat,
            lon,
            radio_km,
            estado: EstadoIndice::Documentado,
            fuente: "EJEMPLO, no es dato real".to_owned(),
            fecha: "2026-11-15".to_owned(),
        }
    }

    #[test]
    fn valida_campos_del_indice() {
        assert!(IndiceExclusion::desde_entradas(vec![entrada("A-1", 0.0, 0.0, 10.0)]).is_ok());
        assert!(IndiceExclusion::desde_entradas(vec![]).is_ok());
        for malo in [
            vec![entrada("", 0.0, 0.0, 10.0)],
            vec![entrada("A", 0.0, 0.0, 10.0), entrada("A", 1.0, 1.0, 5.0)],
            vec![entrada("A", 91.0, 0.0, 10.0)],
            vec![entrada("A", -90.5, 0.0, 10.0)],
            vec![entrada("A", 0.0, 181.0, 10.0)],
            vec![entrada("A", 0.0, 0.0, 0.0)],
            vec![entrada("A", 0.0, 0.0, -5.0)],
            vec![entrada("A", f64::NAN, 0.0, 10.0)],
        ] {
            assert!(IndiceExclusion::desde_entradas(malo).is_err());
        }
    }

    #[test]
    fn json_invalido_da_error_claro() {
        let err = IndiceExclusion::desde_json(
            r#"[{"id":"X","lat":0,"lon":0,"radio_km":10,"estado":"inventado","fuente":"x","fecha":"2026-11-15"}]"#,
        )
        .err();
        assert!(err.is_some());
    }
}
