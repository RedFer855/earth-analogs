//! Lee `perfiles.json` (paso E-20 del ETL): parámetros de la búsqueda y el perfil de cada sitio objetivo.
//!
//! Un perfil dice, por variable, el valor que se busca, la tolerancia, la escala en la Tierra y la correlación entre
//! variables. Puede traer pesos, su propia contracción `lambda_contraccion` (la Luna y Marte usan una distinta, ver
//! ADR-010) y variables de `diagnostico` que no puntúan pero se informan junto a cada candidato.

use std::collections::BTreeMap;
use std::fs;
use std::path::Path;

use anyhow::{bail, ensure, Context, Result};
use serde::Deserialize;

fn min_celdas_defecto() -> u64 {
    30
}

#[derive(Debug, Clone, Deserialize)]
pub struct Parametros {
    pub gamma: f64,
    pub lambda_contraccion: f64,
    pub ndvi_max_principal: f64,
    pub s_coincide: f64,
    pub nivel_region: u32,
    pub radio_documentado_km: f64,
    #[serde(default = "min_celdas_defecto")]
    pub min_celdas_region: u64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct InfoMaestro {
    pub n_celdas: usize,
    pub generado: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct PerfilJson {
    pub variables: Vec<String>,
    pub objetivo: BTreeMap<String, f64>,
    pub tolerancia: BTreeMap<String, f64>,
    pub escala_tierra: BTreeMap<String, f64>,
    pub correlacion: Vec<Vec<f64>>,
    #[serde(default)]
    pub fuera_del_alcance_de_la_tierra: BTreeMap<String, FueraDeAlcance>,
    #[serde(default)]
    pub celdas_que_coinciden_en_la_tierra: u64,
    #[serde(default)]
    pub pesos: BTreeMap<String, f64>,
    #[serde(default)]
    pub lambda_contraccion: Option<f64>,
    #[serde(default)]
    pub diagnostico: BTreeMap<String, f64>,
}

/// Variables que tienen sentido en la Luna: solo forma del terreno (sin atmósfera, agua ni vegetación; ADR-010).
pub const VARIABLES_LUNA: [&str; 5] = [
    "slope_mean_deg",
    "slope_std_deg",
    "rug_rms_mean_m",
    "relieve_mean_m",
    "elev_mean_m",
];

#[derive(Debug, Clone, Deserialize)]
pub struct FueraDeAlcance {
    pub objetivo_real: f64,
}

#[derive(Debug, Clone, Deserialize)]
struct Objetivo {
    nombre: String,
    cuerpo: String,
    perfiles: BTreeMap<String, PerfilJson>,
}

#[derive(Debug, Clone, Deserialize)]
struct EntradaPerfiles {
    parametros: Parametros,
    #[serde(default)]
    maestro: Option<InfoMaestro>,
    objetivos: BTreeMap<String, Objetivo>,
}

#[derive(Debug, Clone)]
pub struct PerfilCargado {
    pub sitio: String,
    pub nombre_sitio: String,
    pub cuerpo: String,
    pub id_perfil: String,

    pub contra: Vec<String>,
    pub variables: Vec<String>,
    pub objetivo: Vec<f64>,
    pub tolerancia: Vec<f64>,
    pub escala: Vec<f64>,

    pub correlacion: Vec<f64>,
    /// Pesos por variable, en el orden de `variables`; `None` reparte por igual.
    pub pesos: Option<Vec<f64>>,
    /// Contracción propia del perfil; si falta, se usa la de `parametros`.
    pub lambda: Option<f64>,
    /// Variables que se informan pero no puntúan, con el valor del objetivo.
    pub diagnostico: Vec<(String, f64)>,

    pub fuera_de_alcance: Vec<(String, f64)>,

    pub coinciden_ref: u64,
}

pub struct Cargado {
    pub parametros: Parametros,
    pub maestro: Option<InfoMaestro>,
    pub perfil: PerfilCargado,
}

impl Cargado {
    pub fn verificar_celdas(&self, n_celdas: usize) -> Result<()> {
        if let Some(m) = self.maestro.as_ref() {
            ensure!(
                n_celdas == m.n_celdas,
                "la tabla tiene {n_celdas} celdas y perfiles.json se calculó sobre {}",
                m.n_celdas
            );
        }
        Ok(())
    }
}

fn por_variable(mapa: &BTreeMap<String, f64>, variables: &[String], que: &str) -> Result<Vec<f64>> {
    variables
        .iter()
        .map(|v| {
            mapa.get(v)
                .copied()
                .with_context(|| format!("falta `{v}` en `{que}`"))
        })
        .collect()
}

pub fn cargar(
    perfiles: &Path,
    sitio: &str,
    id_perfil: &str,
    perfil_alterno: Option<&Path>,
) -> Result<Cargado> {
    let texto = fs::read_to_string(perfiles)
        .with_context(|| format!("no se pudo leer {}", perfiles.display()))?;
    let a: EntradaPerfiles = serde_json::from_str(&texto)
        .with_context(|| format!("{} no tiene el formato esperado", perfiles.display()))?;
    let Some(obj) = a.objetivos.get(sitio) else {
        bail!("el sitio {sitio} no está en {}", perfiles.display());
    };
    let contra: Vec<String> = {
        let mut c: Vec<String> = a
            .objetivos
            .values()
            .filter(|o| o.perfiles.contains_key(id_perfil))
            .map(|o| o.cuerpo.clone())
            .collect();
        c.sort();
        c.dedup();
        c
    };
    let p: PerfilJson = match perfil_alterno {
        Some(ruta) => {
            let t = fs::read_to_string(ruta)
                .with_context(|| format!("no se pudo leer {}", ruta.display()))?;
            serde_json::from_str(&t)
                .with_context(|| format!("{} no tiene el formato de un perfil", ruta.display()))?
        }
        None => obj
            .perfiles
            .get(id_perfil)
            .with_context(|| format!("el sitio {sitio} no tiene el perfil `{id_perfil}`"))?
            .clone(),
    };
    let k = p.variables.len();
    if p.correlacion.len() != k || p.correlacion.iter().any(|f| f.len() != k) {
        bail!("la correlación de {sitio}/{id_perfil} no es {k} × {k}");
    }
    if obj.cuerpo == "luna" {
        if let Some(v) = p
            .variables
            .iter()
            .find(|v| !VARIABLES_LUNA.contains(&v.as_str()))
        {
            bail!("{sitio}/{id_perfil}: `{v}` no se compara con la Luna (sin atmósfera, agua ni vegetación)");
        }
    }
    if let Some(v) = p.pesos.keys().find(|v| !p.variables.contains(v)) {
        bail!("{sitio}/{id_perfil}: hay peso para `{v}`, que no está en las variables");
    }
    if let Some(v) = p.diagnostico.keys().find(|v| p.variables.contains(v)) {
        bail!("{sitio}/{id_perfil}: `{v}` no puede puntuar y ser diagnóstico a la vez");
    }
    let pesos = (!p.pesos.is_empty()).then(|| {
        p.variables
            .iter()
            .map(|v| p.pesos.get(v).copied().unwrap_or(1.0))
            .collect()
    });
    let perfil = PerfilCargado {
        sitio: sitio.to_owned(),
        nombre_sitio: obj.nombre.clone(),
        cuerpo: obj.cuerpo.clone(),
        id_perfil: id_perfil.to_owned(),
        contra,
        objetivo: por_variable(&p.objetivo, &p.variables, "objetivo")?,
        tolerancia: por_variable(&p.tolerancia, &p.variables, "tolerancia")?,
        escala: por_variable(&p.escala_tierra, &p.variables, "escala_tierra")?,
        correlacion: p.correlacion.iter().flatten().copied().collect(),
        pesos,
        lambda: p.lambda_contraccion,
        diagnostico: p.diagnostico.into_iter().collect(),
        fuera_de_alcance: p
            .fuera_del_alcance_de_la_tierra
            .iter()
            .map(|(v, f)| (v.clone(), f.objetivo_real))
            .collect(),
        coinciden_ref: p.celdas_que_coinciden_en_la_tierra,
        variables: p.variables,
    };
    Ok(Cargado {
        parametros: a.parametros,
        maestro: a.maestro,
        perfil,
    })
}

#[cfg(test)]
mod pruebas {
    use super::cargar;
    use anyhow::{ensure, Result};

    fn escribir(nombre: &str, cuerpo: &str, extra: &str) -> Result<std::path::PathBuf> {
        let dir =
            std::env::temp_dir().join(format!("motor-entrada-{}-{nombre}", std::process::id()));
        std::fs::create_dir_all(&dir)?;
        let ruta = dir.join("perfiles.json");
        let texto = format!(
            r#"{{"parametros": {{"gamma": 0.5, "lambda_contraccion": 0.1, "ndvi_max_principal": 0.2,
                 "s_coincide": 0.5, "nivel_region": 6, "radio_documentado_km": 50}},
               "objetivos": {{"X": {{"nombre": "X", "cuerpo": "{cuerpo}", "perfiles": {{"p": {{
                 "variables": ["slope_mean_deg", "aridez_ai"],
                 "objetivo": {{"slope_mean_deg": 1, "aridez_ai": 0.1}},
                 "tolerancia": {{"slope_mean_deg": 1, "aridez_ai": 0.1}},
                 "escala_tierra": {{"slope_mean_deg": 1, "aridez_ai": 0.1}},
                 "correlacion": [[1, 0], [0, 1]] {extra} }}}}}}}}}}"#
        );
        std::fs::write(&ruta, texto)?;
        Ok(ruta)
    }

    #[test]
    fn la_luna_no_acepta_variables_de_atmosfera_o_agua() -> Result<()> {
        let ruta = escribir("luna", "luna", "")?;
        let e = cargar(&ruta, "X", "p", None).err().map(|e| e.to_string());
        ensure!(
            e.is_some_and(|m| m.contains("aridez_ai")),
            "la Luna aceptó aridez_ai"
        );
        Ok(())
    }

    #[test]
    fn pesos_lambda_y_diagnostico_del_perfil() -> Result<()> {
        let extra = r#", "pesos": {"aridez_ai": 3}, "lambda_contraccion": 0.5, "diagnostico": {"rango_diurno_k": 80}"#;
        let c = cargar(&escribir("marte", "marte", extra)?, "X", "p", None)?;
        ensure!(
            c.perfil.pesos == Some(vec![1.0, 3.0]),
            "pesos {:?}",
            c.perfil.pesos
        );
        ensure!(c.perfil.lambda == Some(0.5), "lambda {:?}", c.perfil.lambda);
        ensure!(
            c.perfil.diagnostico == vec![("rango_diurno_k".to_owned(), 80.0)],
            "diagnóstico {:?}",
            c.perfil.diagnostico
        );
        let mal = r#", "diagnostico": {"aridez_ai": 1}"#;
        ensure!(
            cargar(&escribir("mal", "marte", mal)?, "X", "p", None).is_err(),
            "aceptó una variable que puntúa y es diagnóstico"
        );
        Ok(())
    }
}
