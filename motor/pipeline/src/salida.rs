//! Escribe el resultado de una corrida (ADR-007): `metrics.json`, el índice que la web abre primero, y
//! `resultados/<perfil>/<sitio>.json`, el detalle de cada sitio, que la web pide cuando se elige ese sitio.
//!
//! Por cada candidato y variable va el valor de la Tierra, la diferencia con el objetivo y una etiqueta
//! (`coincide`, `difiere` o `sin_dato`). Las fuentes y unidades salen del manifiesto de E-13, no del código.
//! `metrics.json` acumula: cada corrida reemplaza solo la entrada de su perfil y su sitio.

use std::collections::BTreeMap;
use std::fs;
use std::path::Path;

use anyhow::{bail, Context, Result};
use nucleo::Perfil;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::barrido::Mejor;
use crate::entrada::{Parametros, PerfilCargado};
pub(crate) use crate::geo::normalizar_lon;
use crate::geo::{autalica_a_geodesica, haversine_km};
use crate::tabla::{OrigenColumna, Tabla};

pub const VERSION_CONTRATO: &str = "1.0.0";

#[must_use]
pub fn redondear(x: f64, d: i32) -> f64 {
    let f = 10f64.powi(d);
    (x * f).round() / f
}

#[must_use]
pub fn iso_utc(segundos: u64) -> String {
    let dias = i64::try_from(segundos / 86_400).unwrap_or(0);
    let resto = segundos % 86_400;
    let z = dias + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let dia = doy - (153 * mp + 2) / 5 + 1;
    let mes = if mp < 10 { mp + 3 } else { mp - 9 };
    let anio = yoe + era * 400 + i64::from(mes <= 2);
    format!(
        "{anio:04}-{mes:02}-{dia:02}T{:02}:{:02}:{:02}Z",
        resto / 3600,
        (resto % 3600) / 60,
        resto % 60
    )
}

#[derive(Debug, Clone, Deserialize)]
pub struct Sitio {
    pub nombre: String,
    pub lat: Option<f64>,
    #[serde(alias = "lon_e")]
    pub lon: Option<f64>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Sitios {
    #[serde(default)]
    pub luna: BTreeMap<String, Sitio>,
    #[serde(default)]
    pub marte: BTreeMap<String, Sitio>,
    #[serde(default)]
    pub tierra: BTreeMap<String, Sitio>,
}

#[derive(Deserialize)]
struct RegistroSitio {
    codigo: String,
    nombre: String,
    lat: Option<f64>,
    #[serde(alias = "lon_e")]
    lon: Option<f64>,
}

fn leer_registros(ruta: &Path, clave: &str) -> Result<BTreeMap<String, Sitio>> {
    let t =
        fs::read_to_string(ruta).with_context(|| format!("no se pudo leer {}", ruta.display()))?;
    let mut raiz: serde_json::Value = serde_json::from_str(&t)
        .with_context(|| format!("{} no es JSON válido", ruta.display()))?;
    let lista = raiz
        .get_mut(clave)
        .map(serde_json::Value::take)
        .with_context(|| format!("{} no contiene `{clave}`", ruta.display()))?;
    let registros: Vec<RegistroSitio> = serde_json::from_value(lista)
        .with_context(|| format!("`{clave}` en {} no tiene formato de sitios", ruta.display()))?;
    Ok(registros
        .into_iter()
        .map(|r| {
            (
                r.codigo,
                Sitio {
                    nombre: r.nombre,
                    lat: r.lat,
                    lon: r.lon,
                },
            )
        })
        .collect())
}

impl Sitios {
    pub fn leer(ruta: &Path) -> Result<Self> {
        if ruta.is_dir() {
            return Ok(Self {
                luna: leer_registros(&ruta.join("objetivos-luna.json"), "regiones")?,
                marte: leer_registros(&ruta.join("objetivos-marte.json"), "sitios")?,
                tierra: BTreeMap::new(),
            });
        }
        let t = fs::read_to_string(ruta)
            .with_context(|| format!("no se pudo leer {}", ruta.display()))?;
        serde_json::from_str(&t)
            .with_context(|| format!("{} no tiene el formato de sitios JSON", ruta.display()))
    }

    fn objetivo(&self, id: &str) -> Option<&Sitio> {
        self.luna.get(id).or_else(|| self.marte.get(id))
    }
}

#[derive(Debug, Serialize)]
pub struct Centro {
    pub lat: f64,
    pub lon: f64,
}

#[derive(Debug, Serialize)]
struct VarCelda {
    valor: Option<f64>,
    /// Valor de la Tierra menos el valor real del objetivo (aunque se haya buscado el borde de la Tierra).
    diferencia: Option<f64>,
    nota: Option<f64>,
    /// `coincide` si la diferencia cabe en la tolerancia, `difiere` si no, `sin_dato` si la celda no tiene valor.
    etiqueta: &'static str,
}

#[derive(Debug, Serialize)]
struct Cobertura {
    usadas: usize,
    total: usize,
    faltan: Vec<String>,
}

#[derive(Debug, Serialize)]
struct Diagnostico {
    valor: Option<f64>,
    objetivo: f64,
    diferencia: Option<f64>,
}

#[derive(Debug, Serialize)]
struct Celda {
    rango: usize,
    ipix: u32,
    centro: Centro,

    vertices: [[f64; 2]; 4],
    nota: f64,
    nota_exacta: f64,
    variables: BTreeMap<String, VarCelda>,
    cobertura: Cobertura,
    #[serde(skip_serializing_if = "BTreeMap::is_empty")]
    diagnostico: BTreeMap<String, Diagnostico>,
    marcas: Vec<&'static str>,
    analogo_conocido: Option<String>,
    region: Option<String>,
    /// Distancias a puntos de interés (ADR-009 §2.3). No puntúan: solo se informan. Se omite si la corrida no
    /// tiene ninguna de las columnas.
    #[serde(skip_serializing_if = "Option::is_none")]
    cerca_de: Option<CercaDe>,
}

/// Distancia en km, redondeada a 0.1, desde el centro de la celda al punto más cercano de cada catálogo.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct CercaDe {
    pub tubo_lava_km: Option<f64>,
    pub crater_km: Option<f64>,
    pub salar_km: Option<f64>,
}

/// Campo de `cerca_de` y la columna de la tabla de la que sale, en el orden de [`Cercanas::columnas`].
pub const COLUMNAS_CERCA: [(&str, &str); 3] = [
    ("tubo_lava_km", "cueva_dist_km"),
    ("crater_km", "dist_crater_km"),
    ("salar_km", "dist_playa_km"),
];

/// Una columna de distancia ya abierta y la tabla que dice su origen.
pub struct ColumnaCerca<'a> {
    pub datos: &'a [f32],
    pub tabla: &'a Tabla,
}

/// Las columnas de [`COLUMNAS_CERCA`] que hay en la corrida (`None` si falta).
#[derive(Default)]
pub struct Cercanas<'a> {
    pub columnas: [Option<ColumnaCerca<'a>>; 3],
}

impl Cercanas<'_> {
    /// `cerca_de` de la fila: `None` si no hay ninguna columna; cada distancia no finita queda en `null`.
    #[must_use]
    pub fn de_fila(&self, fila: usize) -> Option<CercaDe> {
        if self.columnas.iter().all(Option::is_none) {
            return None;
        }
        let d = |i: usize| {
            self.columnas
                .get(i)?
                .as_ref()?
                .datos
                .get(fila)
                .copied()
                .map(f64::from)
                .filter(|v| v.is_finite())
                .map(|v| redondear(v, 1))
        };
        Some(CercaDe {
            tubo_lava_km: d(0),
            crater_km: d(1),
            salar_km: d(2),
        })
    }

    /// Nombre de cada columna presente y la tabla que dice su origen.
    fn origenes(&self) -> impl Iterator<Item = (String, &Tabla)> + '_ {
        self.columnas
            .iter()
            .zip(COLUMNAS_CERCA)
            .filter_map(|(c, (_, col))| Some((col.to_owned(), c.as_ref()?.tabla)))
    }
}

#[derive(Debug, Serialize)]
struct ValorObjetivo {
    valor: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    valor_real: Option<f64>,
}

#[derive(Debug, Serialize)]
struct ObjetivoJson {
    variables: BTreeMap<String, ValorObjetivo>,
    #[serde(skip_serializing_if = "BTreeMap::is_empty")]
    diagnostico: BTreeMap<String, f64>,
}

#[derive(Debug, Clone, Serialize)]
struct Origen {
    columna: String,
    fuente: Option<String>,
    url: Option<String>,
    licencia: Option<String>,
}

impl Origen {
    fn de(columna: &str, tabla: &Tabla) -> Self {
        let o = tabla.columnas.get(columna).cloned().unwrap_or_default();
        Self {
            columna: columna.to_owned(),
            fuente: o.fuente,
            url: o.url,
            licencia: o.licencia,
        }
    }
}

#[derive(Debug, Serialize)]
struct VariableParametro {
    id: String,
    peso: f64,
    tolerancia: f64,
    escala: f64,
    origen: Origen,
}

#[derive(Debug, Serialize)]
struct ParametrosJson {
    variables: Vec<VariableParametro>,
    diagnostico: Vec<Origen>,
    filtros: Vec<&'static str>,
    ndvi_max: f64,
    gamma: f64,
    lambda_contraccion: f64,
    fraccion_minima: f64,
    correlacion: Vec<Vec<f64>>,
}

#[derive(Debug, Serialize)]
struct Healpix {
    esquema: &'static str,
    nivel: u8,
}

#[derive(Debug, Serialize)]
pub struct ResultadoJson {
    version_contrato: &'static str,
    es_ejemplo: bool,
    perfil: String,
    sitio: String,
    healpix: Healpix,
    objetivo: ObjetivoJson,
    parametros: ParametrosJson,
    #[serde(skip_serializing_if = "Option::is_none")]
    excluidos_por_indice: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    excluidos_por_separacion: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    celdas_en_area: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    regiones_con_tierra: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    sin_celdas_por_ndvi: Option<u64>,
    candidatos: Vec<Celda>,
}

struct VarCatalogo {
    id: &'static str,
    codigo: &'static str,
    nombre: &'static str,
    unidad: &'static str,
    aplica_a: &'static [&'static str],
    descripcion: &'static str,
}

const CATALOGO: [VarCatalogo; 6] = [
    VarCatalogo {
        id: "slope_mean_deg",
        codigo: "N1",
        nombre: "Pendiente media",
        unidad: "°",
        aplica_a: &["luna", "marte"],
        descripcion: "Pendiente de Horn a 200 m promediada por celda",
    },
    VarCatalogo {
        id: "slope_std_deg",
        codigo: "N12",
        nombre: "Variación de la pendiente",
        unidad: "°",
        aplica_a: &["luna", "marte"],
        descripcion: "Desviación estándar de la pendiente dentro de la celda",
    },
    VarCatalogo {
        id: "rug_rms_mean_m",
        codigo: "N2",
        nombre: "Rugosidad RMS",
        unidad: "m",
        aplica_a: &["luna", "marte"],
        descripcion: "Rugosidad RMS en ventana de 5 × 5 píxeles de 200 m promediada por celda",
    },
    VarCatalogo {
        id: "relieve_mean_m",
        codigo: "N3",
        nombre: "Relieve relativo",
        unidad: "m",
        aplica_a: &["luna", "marte"],
        descripcion: "Desnivel en ventana de 5 × 5 píxeles de 200 m promediado por celda",
    },
    VarCatalogo {
        id: "rango_diurno_k",
        codigo: "N5",
        nombre: "Rango térmico diario",
        unidad: "K",
        aplica_a: &["luna", "marte"],
        descripcion: "MODIS Aqua MYD11C3 v061, diferencia entre LST de día y de noche",
    },
    VarCatalogo {
        id: "amp_anual_k",
        codigo: "N13",
        nombre: "Amplitud térmica anual",
        unidad: "K",
        aplica_a: &["marte"],
        descripcion:
            "Diferencia entre el mes más cálido y el mes más frío de la temperatura media diaria",
    },
];

#[derive(Serialize)]
struct CuerpoJson {
    nombre: &'static str,
    radio_m: f64,
    gravedad_ms2: f64,
    presion_superficie_pa: f64,
    atmosfera: &'static str,
    radiacion: &'static str,
    fuente: &'static str,
}

fn cuerpos() -> BTreeMap<&'static str, CuerpoJson> {
    BTreeMap::from([
        ("tierra", CuerpoJson { nombre: "Tierra", radio_m: 6_371_000.0, gravedad_ms2: 9.80, presion_superficie_pa: 101_400.0, atmosfera: "Densa, con nitrógeno y oxígeno", radiacion: "Campo magnético y atmósfera protegen la superficie", fuente: "https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html" }),
        ("luna", CuerpoJson { nombre: "Luna", radio_m: 1_737_400.0, gravedad_ms2: 1.62, presion_superficie_pa: 3e-10, atmosfera: "Prácticamente vacío (exosfera)", radiacion: "Sin campo magnético global ni atmósfera: la superficie recibe radiación solar y cósmica directa", fuente: "https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html" }),
        ("marte", CuerpoJson { nombre: "Marte", radio_m: 3_389_500.0, gravedad_ms2: 3.71, presion_superficie_pa: 636.0, atmosfera: "Muy delgada, casi toda CO₂", radiacion: "Sin campo magnético global y con atmósfera delgada: mucha más radiación en superficie que en la Tierra", fuente: "https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html" }),
    ])
}

const MARCA_NDVI_BAJO: &str = "ndvi_bajo";

pub struct Fuentes<'a> {
    pub perfil_nucleo: &'a Perfil,
    pub entrada: &'a PerfilCargado,
    pub parametros: &'a Parametros,
    pub sitios: &'a Sitios,

    pub columnas: &'a [&'a [f32]],
    /// Columnas de diagnóstico, en el orden de `entrada.diagnostico`.
    pub diagnostico: &'a [&'a [f32]],
    pub tabla: &'a Tabla,
    /// Columnas de distancia de `cerca_de`; no puntúan.
    pub cercanas: &'a Cercanas<'a>,
    pub nivel_healpix: u8,
    pub excluidos_por_indice: Option<u64>,
    pub excluidos_por_separacion: Option<u64>,
    pub celdas_en_area: Option<u64>,
    pub regiones_con_tierra: Option<usize>,
    pub sin_celdas_por_ndvi: Option<u64>,
}

fn vertices_de(nivel: u8, ipix: u32, centro_lon: f64) -> [[f64; 2]; 4] {
    let v = cdshealpix::nested::vertices(nivel, u64::from(ipix));
    let punto = |(lon, lat): (f64, f64)| {
        let mut l = normalizar_lon(lon.to_degrees());
        if l - centro_lon > 180.0 {
            l -= 360.0;
        } else if l - centro_lon < -180.0 {
            l += 360.0;
        }
        [
            redondear(l, 5),
            redondear(autalica_a_geodesica(lat.to_degrees()), 5),
        ]
    };

    [punto(v[2]), punto(v[1]), punto(v[0]), punto(v[3])]
}

fn analogo_conocido(sitios: &Sitios, lat: f64, lon: f64, radio_km: f64) -> Option<String> {
    sitios
        .tierra
        .iter()
        .filter_map(|(id, s)| Some((id, haversine_km(lat, lon, s.lat?, s.lon?))))
        .filter(|(_, d)| *d <= radio_km)
        .min_by(|a, b| a.1.total_cmp(&b.1))
        .map(|(id, _)| id.clone())
}

fn celda(f: &Fuentes<'_>, rango: usize, m: &Mejor) -> Result<Celda> {
    let fila = usize::try_from(m.fila)?;
    let x: Vec<f64> = f
        .columnas
        .iter()
        .map(|c| {
            c.get(fila)
                .copied()
                .map(f64::from)
                .context("fila fuera de la tabla")
        })
        .collect::<Result<_>>()?;
    let notas = f
        .perfil_nucleo
        .notas_por_variable(&x)?
        .context("la celda candidata no tiene las variables obligatorias")?;
    let coincide = f.perfil_nucleo.coincide(&x)?;
    let e = f.entrada;
    let nivel = f.nivel_healpix;
    let (lon_c, lat_c) = cdshealpix::nested::center(nivel, u64::from(m.ipix));
    let (lat, lon) = (
        redondear(autalica_a_geodesica(lat_c.to_degrees()), 5),
        redondear(normalizar_lon(lon_c.to_degrees()), 5),
    );
    let mut variables = BTreeMap::new();
    let mut faltan = Vec::new();
    for (i, nombre) in e.variables.iter().enumerate() {
        let dato = x.get(i).copied().filter(|v| v.is_finite());
        let nota = notas.get(i).copied().flatten();
        let c = coincide.get(i).copied().flatten();
        let objetivo_real = e
            .fuera_de_alcance
            .iter()
            .find(|(v, _)| v == nombre)
            .map(|(_, r)| *r)
            .or_else(|| e.objetivo.get(i).copied());

        let v = if let (Some(v), Some(n), Some(c)) = (dato, nota, c) {
            VarCelda {
                valor: Some(redondear(v, 4)),
                diferencia: objetivo_real.map(|y| redondear(v - y, 4)),
                nota: Some(redondear(n, 4)),
                etiqueta: if c { "coincide" } else { "difiere" },
            }
        } else {
            faltan.push(nombre.clone());
            VarCelda {
                valor: None,
                diferencia: None,
                nota: None,
                etiqueta: "sin_dato",
            }
        };
        variables.insert(nombre.clone(), v);
    }
    let mut diagnostico = BTreeMap::new();
    for ((nombre, objetivo), col) in e.diagnostico.iter().zip(f.diagnostico) {
        let valor = col
            .get(fila)
            .copied()
            .map(f64::from)
            .filter(|v| v.is_finite());
        diagnostico.insert(
            nombre.clone(),
            Diagnostico {
                valor: valor.map(|v| redondear(v, 4)),
                objetivo: redondear(*objetivo, 4),
                diferencia: valor.map(|v| redondear(v - objetivo, 4)),
            },
        );
    }
    Ok(Celda {
        rango,
        ipix: m.ipix,
        centro: Centro { lat, lon },
        vertices: vertices_de(nivel, m.ipix, lon),
        nota: redondear(m.s_tol, 4),
        nota_exacta: redondear(m.s_ex, 4),
        variables,
        cobertura: Cobertura {
            usadas: e.variables.len() - faltan.len(),
            total: e.variables.len(),
            faltan,
        },
        diagnostico,
        marcas: vec![MARCA_NDVI_BAJO],
        analogo_conocido: analogo_conocido(f.sitios, lat, lon, f.parametros.radio_documentado_km),
        region: None,
        cerca_de: f.cercanas.de_fila(fila),
    })
}

pub fn resultado(f: &Fuentes<'_>, por_region: &[Mejor], n: usize) -> Result<ResultadoJson> {
    let e = f.entrada;
    let k = e.variables.len();
    let candidatos = por_region
        .iter()
        .take(n)
        .enumerate()
        .map(|(i, m)| celda(f, i + 1, m))
        .collect::<Result<Vec<_>>>()?;
    let mut objetivo = BTreeMap::new();
    let mut variables = Vec::new();
    let pesos: Vec<f64> = e.pesos.clone().unwrap_or_else(|| vec![1.0; k]);
    let suma_pesos: f64 = pesos.iter().sum();
    for (i, nombre) in e.variables.iter().enumerate() {
        let usado = *e.objetivo.get(i).context("objetivo corto")?;
        let real = e
            .fuera_de_alcance
            .iter()
            .find(|(v, _)| v == nombre)
            .map(|(_, r)| redondear(*r, 4));
        objetivo.insert(
            nombre.clone(),
            ValorObjetivo {
                valor: redondear(usado, 4),
                valor_real: real,
            },
        );
        variables.push(VariableParametro {
            id: nombre.clone(),
            peso: redondear(pesos.get(i).context("pesos cortos")? / suma_pesos, 4),
            tolerancia: redondear(*e.tolerancia.get(i).context("tolerancia corta")?, 4),
            escala: redondear(*e.escala.get(i).context("escala corta")?, 4),
            origen: Origen::de(nombre, f.tabla),
        });
    }
    let correlacion = e.correlacion.chunks(k).map(<[f64]>::to_vec).collect();
    Ok(ResultadoJson {
        version_contrato: VERSION_CONTRATO,
        es_ejemplo: false,
        perfil: e.id_perfil.clone(),
        sitio: e.sitio.clone(),
        healpix: Healpix {
            esquema: "nested",
            nivel: f.nivel_healpix,
        },
        objetivo: ObjetivoJson {
            variables: objetivo,
            diagnostico: e
                .diagnostico
                .iter()
                .map(|(v, y)| (v.clone(), redondear(*y, 4)))
                .collect(),
        },
        parametros: ParametrosJson {
            variables,
            diagnostico: e
                .diagnostico
                .iter()
                .map(|(v, _)| Origen::de(v, f.tabla))
                .collect(),
            filtros: vec![MARCA_NDVI_BAJO],
            ndvi_max: f.parametros.ndvi_max_principal,
            gamma: f.parametros.gamma,
            lambda_contraccion: e.lambda.unwrap_or(f.parametros.lambda_contraccion),
            fraccion_minima: crate::barrido::FRACCION_MINIMA,
            correlacion,
        },
        excluidos_por_indice: f.excluidos_por_indice,
        excluidos_por_separacion: f.excluidos_por_separacion,
        celdas_en_area: f.celdas_en_area,
        regiones_con_tierra: f.regiones_con_tierra,
        sin_celdas_por_ndvi: f.sin_celdas_por_ndvi,
        candidatos,
    })
}

#[derive(Serialize)]
struct VariableCat {
    id: String,
    codigo: String,
    nombre: String,
    unidad: String,
    aplica_a: Vec<String>,
    descripcion: String,
}

#[derive(Serialize)]
struct MarcaCat {
    id: &'static str,
    nombre: &'static str,
    tipo: &'static str,
}

#[derive(Serialize)]
struct PerfilCat {
    id: String,
    nombre: String,
    contra: Vec<String>,
    variables: Vec<String>,
    descripcion: String,
}

#[derive(Serialize)]
struct SitioObjetivoCat {
    id: String,
    nombre: String,
    cuerpo: String,
    centro: Centro,
}

#[derive(Serialize)]
struct AnalogoCat {
    id: String,
    nombre: String,
    centro: Centro,
}

#[derive(Serialize)]
struct Mejora {
    nota: f64,
    centro: Centro,
    region: Option<String>,
}

#[derive(Serialize)]
struct ResumenResultado {
    perfil: String,
    sitio: String,
    archivo: String,
    n_candidatos: usize,
    mejor: Option<Mejora>,
}

#[derive(Serialize)]
struct FuenteCat {
    nombre: String,
    url: Option<String>,
    licencia: Option<String>,
    columnas: Vec<String>,
}

#[derive(Serialize)]
struct TablaCat {
    generado: Option<String>,
    commit: Option<String>,
    n_celdas: usize,
}

#[derive(Serialize)]
struct Contrato {
    version: &'static str,
    tabla: TablaCat,
}

/// Agrupa por fuente las columnas que usa la corrida, con lo que dice el manifiesto.
fn fuentes_de<'t>(columnas: impl IntoIterator<Item = (String, &'t Tabla)>) -> Vec<FuenteCat> {
    let mut por_fuente: BTreeMap<String, FuenteCat> = BTreeMap::new();
    for (c, tabla) in columnas {
        let o: OrigenColumna = tabla.columnas.get(&c).cloned().unwrap_or_default();
        let nombre = o
            .fuente
            .unwrap_or_else(|| "no declarada en el manifiesto".to_owned());
        por_fuente
            .entry(nombre.clone())
            .or_insert_with(|| FuenteCat {
                nombre,
                url: o.url,
                licencia: o.licencia,
                columnas: Vec::new(),
            })
            .columnas
            .push(c);
    }
    por_fuente.into_values().collect()
}

#[derive(Serialize)]
pub struct Indice {
    version_contrato: &'static str,
    contrato: Contrato,
    generado: String,
    es_ejemplo: bool,
    healpix: Healpix,
    cuerpos: BTreeMap<&'static str, CuerpoJson>,
    variables: Vec<VariableCat>,
    marcas: Vec<MarcaCat>,
    perfiles: Vec<PerfilCat>,
    sitios_objetivo: Vec<SitioObjetivoCat>,
    analogos_conocidos: Vec<AnalogoCat>,
    resultados: Vec<ResumenResultado>,
    fuentes: Vec<FuenteCat>,
}

fn centro_de(s: &Sitio) -> Option<Centro> {
    Some(Centro {
        lat: s.lat?,
        lon: redondear(normalizar_lon(s.lon?), 5),
    })
}

fn variable_cat(v: &str, tabla: &Tabla) -> VariableCat {
    let unidad = tabla.columnas.get(v).and_then(|o| o.unidad.clone());
    CATALOGO.iter().find(|c| c.id == v).map_or_else(
        || VariableCat {
            id: v.to_owned(),
            codigo: v.to_owned(),
            nombre: v.to_owned(),
            unidad: unidad.clone().unwrap_or_default(),
            aplica_a: vec!["luna".to_owned(), "marte".to_owned()],
            descripcion: v.to_owned(),
        },
        |c| VariableCat {
            id: c.id.to_owned(),
            codigo: c.codigo.to_owned(),
            nombre: c.nombre.to_owned(),
            unidad: unidad.clone().unwrap_or_else(|| c.unidad.to_owned()),
            aplica_a: c.aplica_a.iter().map(|s| (*s).to_owned()).collect(),
            descripcion: c.descripcion.to_owned(),
        },
    )
}

pub fn indice(f: &Fuentes<'_>, res: &ResultadoJson, generado: String) -> Result<Indice> {
    let e = f.entrada;
    let usadas: Vec<String> = e
        .variables
        .iter()
        .chain(e.diagnostico.iter().map(|(v, _)| v))
        .cloned()
        .chain(std::iter::once(crate::ejecutar::COLUMNA_NDVI.to_owned()))
        .collect();
    let variables: Vec<VariableCat> = usadas
        .iter()
        .filter(|v| v.as_str() != crate::ejecutar::COLUMNA_NDVI)
        .map(|v| variable_cat(v, f.tabla))
        .collect();
    let Some(sitio) = f.sitios.objetivo(&e.sitio) else {
        bail!("el sitio {} no está en los sitios cargados", e.sitio);
    };
    let centro = centro_de(sitio).context("el sitio objetivo no tiene coordenadas")?;
    let primero = res.candidatos.first();
    let archivo = format!("resultados/{}/{}.json", e.id_perfil, e.sitio);
    Ok(Indice {
        version_contrato: VERSION_CONTRATO,
        contrato: Contrato {
            version: VERSION_CONTRATO,
            tabla: TablaCat {
                generado: f.tabla.generado.clone(),
                commit: f.tabla.commit.clone(),
                n_celdas: f.tabla.n_celdas,
            },
        },
        generado,
        es_ejemplo: false,
        healpix: Healpix {
            esquema: "nested",
            nivel: f.nivel_healpix,
        },
        cuerpos: cuerpos(),
        variables,
        marcas: vec![MarcaCat {
            id: MARCA_NDVI_BAJO,
            nombre: "NDVI máximo de la climatología con dato y bajo el umbral",
            tipo: "filtro",
        }],
        perfiles: vec![PerfilCat {
            id: e.id_perfil.clone(),
            nombre: e.id_perfil.clone(),
            contra: e.contra.clone(),
            variables: e.variables.clone(),
            descripcion: format!("Perfil {} contra {}", e.id_perfil, e.contra.join(", ")),
        }],
        sitios_objetivo: vec![SitioObjetivoCat {
            id: e.sitio.clone(),
            nombre: e.nombre_sitio.clone(),
            cuerpo: e.cuerpo.clone(),
            centro,
        }],
        analogos_conocidos: f
            .sitios
            .tierra
            .iter()
            .filter_map(|(id, s)| {
                Some(AnalogoCat {
                    id: id.clone(),
                    nombre: s.nombre.clone(),
                    centro: centro_de(s)?,
                })
            })
            .collect(),
        resultados: vec![ResumenResultado {
            perfil: e.id_perfil.clone(),
            sitio: e.sitio.clone(),
            archivo,
            n_candidatos: res.candidatos.len(),
            mejor: primero.map(|c| Mejora {
                nota: c.nota,
                centro: Centro {
                    lat: c.centro.lat,
                    lon: c.centro.lon,
                },
                region: c.region.clone(),
            }),
        }],
        fuentes: fuentes_de(
            usadas
                .into_iter()
                .map(|c| (c, f.tabla))
                .chain(f.cercanas.origenes()),
        ),
    })
}

/// Clave con la que se reconoce una entrada de cada lista del índice.
fn clave(lista: &str, v: &Value) -> String {
    let campo = |c: &str| v.get(c).and_then(Value::as_str).unwrap_or("").to_owned();
    match lista {
        "resultados" => format!("{}/{}", campo("perfil"), campo("sitio")),
        "fuentes" => campo("nombre"),
        _ => campo("id"),
    }
}

/// Junta el índice nuevo con el `metrics.json` anterior de la misma carpeta.
///
/// Si el anterior es de otra versión del contrato o de otra tabla (otra fecha o commit de E-13), se descarta:
/// mezclar resultados de tablas distintas no tendría sentido. Si no, cada lista conserva lo anterior y la corrida
/// nueva reemplaza solo sus propias entradas (su perfil, su sitio, sus variables); las fuentes unen columnas.
#[must_use]
pub fn acumular(nuevo: Value, previo: Option<Value>) -> Value {
    let Some(previo) = previo else {
        return nuevo;
    };
    let misma = |c: &str| previo.get(c).is_some() && previo.get(c) == nuevo.get(c);
    if !(misma("version_contrato") && misma("contrato") && misma("healpix")) {
        return nuevo;
    }
    let mut salida = nuevo.clone();
    for lista in [
        "variables",
        "perfiles",
        "sitios_objetivo",
        "analogos_conocidos",
        "resultados",
        "fuentes",
    ] {
        let mut juntas: BTreeMap<String, Value> = BTreeMap::new();
        for v in previo
            .get(lista)
            .and_then(Value::as_array)
            .into_iter()
            .flatten()
        {
            juntas.insert(clave(lista, v), v.clone());
        }
        for v in nuevo
            .get(lista)
            .and_then(Value::as_array)
            .into_iter()
            .flatten()
        {
            let k = clave(lista, v);
            let mut v = v.clone();
            if lista == "fuentes" {
                let mut cols: Vec<Value> = juntas
                    .get(&k)
                    .and_then(|a| a.get("columnas"))
                    .and_then(Value::as_array)
                    .cloned()
                    .unwrap_or_default();
                for c in v
                    .get("columnas")
                    .and_then(Value::as_array)
                    .into_iter()
                    .flatten()
                {
                    if !cols.contains(c) {
                        cols.push(c.clone());
                    }
                }
                if let Some(o) = v.as_object_mut() {
                    o.insert("columnas".to_owned(), Value::Array(cols));
                }
            }
            juntas.insert(k, v);
        }
        if let Some(o) = salida.as_object_mut() {
            o.insert(
                lista.to_owned(),
                Value::Array(juntas.into_values().collect()),
            );
        }
    }
    salida
}

pub fn escribir(carpeta: &Path, indice: &Indice, res: &ResultadoJson) -> Result<u64> {
    let ruta_res = carpeta
        .join("resultados")
        .join(&res.perfil)
        .join(format!("{}.json", res.sitio));
    if let Some(padre) = ruta_res.parent() {
        fs::create_dir_all(padre)
            .with_context(|| format!("no se pudo crear {}", padre.display()))?;
    }
    let ruta_indice = carpeta.join("metrics.json");
    let previo = fs::read_to_string(&ruta_indice)
        .ok()
        .and_then(|t| serde_json::from_str::<Value>(&t).ok());
    let a = serde_json::to_vec_pretty(&acumular(serde_json::to_value(indice)?, previo))?;
    let b = serde_json::to_vec_pretty(res)?;
    fs::write(&ruta_indice, &a).context("no se pudo escribir metrics.json")?;
    fs::write(&ruta_res, &b)
        .with_context(|| format!("no se pudo escribir {}", ruta_res.display()))?;
    Ok(u64::try_from(a.len() + b.len())?)
}

#[cfg(test)]
mod pruebas {
    use anyhow::ensure;

    use super::*;

    #[test]
    fn fecha_iso_de_instantes_conocidos() {
        assert_eq!(iso_utc(0), "1970-01-01T00:00:00Z");
        assert_eq!(iso_utc(1_700_000_000), "2023-11-14T22:13:20Z");
        assert_eq!(iso_utc(951_782_400), "2000-02-29T00:00:00Z");
        assert_eq!(iso_utc(1_794_744_000), "2026-11-15T12:00:00Z");
    }

    #[test]
    fn metrics_acumula_sitios_de_la_misma_tabla() {
        let base = |sitio: &str, nota: f64, commit: &str| {
            serde_json::json!({
                "version_contrato": VERSION_CONTRATO,
                "contrato": {"version": VERSION_CONTRATO, "tabla": {"commit": commit}},
                "healpix": {"nivel": 12},
                "sitios_objetivo": [{"id": sitio}],
                "resultados": [{"perfil": "terreno", "sitio": sitio, "mejor": {"nota": nota}}],
                "fuentes": [{"nombre": "GLO-90", "columnas": [format!("col_{sitio}")]}],
            })
        };
        let uno = acumular(base("JZ", 0.5, "a"), None);
        let dos = acumular(base("CB", 0.7, "a"), Some(uno.clone()));
        assert_eq!(dos["resultados"].as_array().map(Vec::len), Some(2));
        assert_eq!(dos["sitios_objetivo"].as_array().map(Vec::len), Some(2));
        assert_eq!(
            dos["fuentes"][0]["columnas"].as_array().map(Vec::len),
            Some(2)
        );
        // repetir un sitio lo reemplaza
        let tres = acumular(base("JZ", 0.9, "a"), Some(dos.clone()));
        assert_eq!(tres["resultados"].as_array().map(Vec::len), Some(2));
        assert!(tres["resultados"]
            .as_array()
            .is_some_and(|r| r.iter().any(|x| x["mejor"]["nota"] == 0.9)));
        // otra tabla descarta lo anterior
        let otra = acumular(base("MV", 0.4, "b"), Some(tres));
        assert_eq!(otra["resultados"].as_array().map(Vec::len), Some(1));
    }

    #[test]
    fn longitudes_y_distancias() {
        assert!((normalizar_lon(340.8) - (-19.2)).abs() < 1e-12);
        assert!((normalizar_lon(180.0) - (-180.0)).abs() < 1e-12);

        assert!((haversine_km(0.0, 0.0, 1.0, 0.0) - 111.19).abs() < 0.01);
    }

    #[test]
    fn vertices_de_la_celda_base_0() {
        let v = vertices_de(0, 0, 45.0);
        // el borde de la celda base está a asin(2/3) en la esfera (autálica); se escribe en geodésica
        let lat_borde = autalica_a_geodesica((2.0_f64 / 3.0).asin().to_degrees());
        assert!((v[0][1] - 90.0).abs() < 1e-4, "N: {:?}", v[0]);
        assert!(
            (v[1][1] - lat_borde).abs() < 1e-4 && (v[1][0] - 90.0).abs() < 1e-4,
            "E: {:?}",
            v[1]
        );
        assert!(
            v[2][1].abs() < 1e-4 && (v[2][0] - 45.0).abs() < 1e-4,
            "S: {:?}",
            v[2]
        );
        assert!(
            (v[3][1] - lat_borde).abs() < 1e-4 && v[3][0].abs() < 1e-4,
            "O: {:?}",
            v[3]
        );
    }

    #[test]
    fn vertices_continuos_sobre_el_meridiano_180() {
        let ipix = cdshealpix::nested::hash(12, 180.0_f64.to_radians(), 0.0_f64.to_radians());
        let (lon_c, _) = cdshealpix::nested::center(12, ipix);
        let centro = normalizar_lon(lon_c.to_degrees());
        let v = vertices_de(12, u32::try_from(ipix).expect("cabe en u32"), centro);
        let (min, max) = v
            .iter()
            .fold((f64::MAX, f64::MIN), |(a, b), p| (a.min(p[0]), b.max(p[0])));
        assert!(
            max - min < 0.1,
            "la celda de ~1,6 km no puede medir {} grados de ancho",
            max - min
        );
    }

    fn tabla_vacia() -> Result<Tabla> {
        static N: std::sync::atomic::AtomicUsize = std::sync::atomic::AtomicUsize::new(0);
        let n = N.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        let dir = std::env::temp_dir().join(format!("motor-cerca-{}-{n}", std::process::id()));
        fs::create_dir_all(&dir)?;
        fs::write(
            dir.join("manifest.json"),
            r#"{"n_celdas":3,"nivel_healpix":12}"#,
        )?;
        let t = Tabla::abrir(&dir);
        let _ = fs::remove_dir_all(&dir);
        t
    }

    #[test]
    fn cerca_de_se_omite_sin_columnas() {
        let c = Cercanas::default();
        assert_eq!(c.de_fila(0), None);
        assert_eq!(c.origenes().count(), 0);
    }

    #[test]
    fn cerca_de_redondea_y_deja_null_lo_que_falta() -> Result<()> {
        let tabla = tabla_vacia()?;
        let cueva = [12.345_f32, f32::NAN, 0.04];
        let playa = [f32::INFINITY, 7.25, 1500.0];
        let c = Cercanas {
            columnas: [
                Some(ColumnaCerca {
                    datos: &cueva,
                    tabla: &tabla,
                }),
                None,
                Some(ColumnaCerca {
                    datos: &playa,
                    tabla: &tabla,
                }),
            ],
        };
        ensure!(
            c.de_fila(0)
                == Some(CercaDe {
                    tubo_lava_km: Some(12.3),
                    crater_km: None,
                    salar_km: None,
                }),
            "{:?}",
            c.de_fila(0)
        );
        let f1 = c.de_fila(1).context("fila 1")?;
        ensure!(f1.tubo_lava_km.is_none(), "NaN debe ser null");
        ensure!(f1.salar_km == Some(7.3), "{f1:?}");
        ensure!(
            c.de_fila(2)
                == Some(CercaDe {
                    tubo_lava_km: Some(0.0),
                    crater_km: None,
                    salar_km: Some(1500.0),
                }),
            "{:?}",
            c.de_fila(2)
        );
        // fila fuera de la columna: null, no error
        ensure!(
            c.de_fila(9).map(|x| x.tubo_lava_km) == Some(None),
            "{:?}",
            c.de_fila(9).map(|x| x.tubo_lava_km)
        );
        let json = serde_json::to_value(c.de_fila(1))?;
        ensure!(
            json["tubo_lava_km"].is_null() && json["crater_km"].is_null(),
            "{json}"
        );
        let cols: Vec<String> = c.origenes().map(|(n, _)| n).collect();
        ensure!(cols == ["cueva_dist_km", "dist_playa_km"], "{cols:?}");
        Ok(())
    }

    #[test]
    fn fuentes_juntan_columnas_de_dos_tablas() -> Result<()> {
        let mut a = tabla_vacia()?;
        let mut b = tabla_vacia()?;
        let origen = |f: &str| OrigenColumna {
            fuente: Some(f.to_owned()),
            licencia: Some("CC0 1.0".to_owned()),
            ..OrigenColumna::default()
        };
        a.columnas
            .insert("slope_mean_deg".to_owned(), origen("GLO-90"));
        b.columnas
            .insert("dist_crater_km".to_owned(), origen("Wikidata"));
        let f = fuentes_de([
            ("slope_mean_deg".to_owned(), &a),
            ("dist_crater_km".to_owned(), &b),
        ]);
        let nombres: Vec<&str> = f.iter().map(|x| x.nombre.as_str()).collect();
        ensure!(nombres == ["GLO-90", "Wikidata"], "{nombres:?}");
        ensure!(f[1].columnas == ["dist_crater_km"], "{:?}", f[1].columnas);
        ensure!(
            f[1].licencia.as_deref() == Some("CC0 1.0"),
            "{:?}",
            f[1].licencia.as_deref()
        );
        Ok(())
    }

    #[test]
    fn redondeo() {
        assert!((redondear(1.234_567, 4) - 1.2346).abs() < 1e-12);
        assert!((redondear(-0.000_04, 4)).abs() < 1e-12);
    }

    #[test]
    fn lee_carpeta_de_objetivos_luna_y_marte() -> Result<()> {
        let dir = std::env::temp_dir().join(format!("motor-sitios-{}", std::process::id()));
        fs::create_dir_all(&dir)?;
        fs::write(
            dir.join("objetivos-luna.json"),
            r#"{"regiones":[{"codigo":"CB","nombre":"Peak near Cabeus B","lat":-83.637,"lon_e":291.251}]}"#,
        )?;
        fs::write(
            dir.join("objetivos-marte.json"),
            r#"{"sitios":[{"codigo":"JZ","nombre":"Jezero","lat":18.38,"lon_e":77.58}]}"#,
        )?;
        let sitios = Sitios::leer(&dir)?;
        let cb = sitios.objetivo("CB").context("falta CB")?;
        let c_cb = centro_de(cb).context("centro CB")?;
        ensure!((c_cb.lat - (-83.637)).abs() < 1e-9, "cb lat");
        ensure!((c_cb.lon - (-68.749)).abs() < 1e-9, "cb lon");
        let jz = sitios.objetivo("JZ").context("falta JZ")?;
        let c_jz = centro_de(jz).context("centro JZ")?;
        ensure!((c_jz.lat - 18.38).abs() < 1e-9, "jz lat");
        ensure!((c_jz.lon - 77.58).abs() < 1e-9, "jz lon");
        let _ = fs::remove_dir_all(&dir);
        Ok(())
    }
}
