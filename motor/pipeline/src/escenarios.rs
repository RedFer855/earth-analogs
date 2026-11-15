//! Barrido de muchos escenarios en una sola pasada por la tabla (sitio × variables × tolerancias × pesos × NDVI)
//! y `estabilidad.json`: en qué fracción de escenarios aparece cada candidato y con qué S.

use std::collections::btree_map::Entry;
use std::collections::{BTreeMap, BTreeSet};
use std::ops::Range;
use std::path::{Path, PathBuf};
use std::time::Instant;

use anyhow::{bail, ensure, Context, Result};
use nucleo::{a_f32, Entrada, Perfil};
use serde::{Deserialize, Serialize};

use crate::area::{
    cargar_area, evaluar_y_validar_area, validar_k_area, validar_min_area_km2, ResumenArea,
};
use crate::barrido::{
    barrer_escenarios_en_rangos, Compartido, Escenario, Filtros, ResultadoEscenario,
    FILAS_POR_TAREA,
};
use crate::ejecutar::{
    crear_pool, obligatorias, Opciones, COLUMNA_IPIX, COLUMNA_NDVI, OBLIGATORIAS,
};
use crate::entrada::{cargar, Cargado};
use crate::indice::{cargar_y_validar, validar_distancia_km, FiltroIndice, IndiceExclusion};
use crate::muestreo::{Azar, Muestreo};
use crate::salida::redondear;
use crate::tabla::{Columna, Tabla};

fn uno() -> f64 {
    1.0
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Definicion {
    pub id: String,
    pub objetivo: String,

    pub perfil: String,

    #[serde(default)]
    pub variables: Vec<String>,

    #[serde(default = "uno")]
    pub factor_tolerancia: f64,

    #[serde(default)]
    pub pesos: BTreeMap<String, f64>,

    #[serde(default)]
    pub ndvi_max: Option<f64>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub radio_exclusion_km: Option<f64>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub separacion_km: Option<f64>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Archivo {
    #[serde(default)]
    pub escenarios: Vec<Definicion>,
    #[serde(default)]
    pub muestreo: Option<Muestreo>,
}

fn armar(d: &Definicion, c: &Cargado) -> Result<(Perfil, Vec<String>)> {
    let b = &c.perfil;
    if let Some(v) = d.variables.iter().find(|v| !b.variables.contains(v)) {
        bail!(
            "{}: `{v}` no está en el perfil `{}` de {}",
            d.id,
            d.perfil,
            d.objetivo
        );
    }
    ensure!(
        d.factor_tolerancia.is_finite() && d.factor_tolerancia >= 0.0,
        "{}: factor_tolerancia inválido",
        d.id
    );
    let k = b.variables.len();
    let idx: Vec<usize> = (0..k)
        .filter(|&i| {
            d.variables.is_empty() || b.variables.get(i).is_some_and(|v| d.variables.contains(v))
        })
        .collect();
    let de = |v: &[f64]| -> Vec<f64> { idx.iter().filter_map(|&i| v.get(i).copied()).collect() };
    let variables: Vec<String> = idx
        .iter()
        .filter_map(|&i| b.variables.get(i).cloned())
        .collect();
    if let Some(v) = d.pesos.keys().find(|v| !variables.contains(v)) {
        bail!(
            "{}: el peso de `{v}` no corresponde a ninguna variable del escenario",
            d.id
        );
    }
    let tolerancia: Vec<f64> = de(&b.tolerancia)
        .iter()
        .map(|t| t * d.factor_tolerancia)
        .collect();
    let correlacion: Vec<f64> = idx
        .iter()
        .flat_map(|&i| {
            idx.iter()
                .filter_map(move |&j| b.correlacion.get(i * k + j).copied())
        })
        .collect();
    // el peso del escenario manda; si no trae, el del perfil; si tampoco, 1
    let pesos_perfil = b.pesos.as_deref().map(de);
    let pesos: Vec<f64> = variables
        .iter()
        .enumerate()
        .map(|(j, v)| {
            d.pesos
                .get(v)
                .copied()
                .or_else(|| pesos_perfil.as_ref().and_then(|p| p.get(j).copied()))
                .unwrap_or(1.0)
        })
        .collect();
    let con_pesos = !d.pesos.is_empty() || pesos_perfil.is_some();
    let perfil = Perfil::nuevo(&Entrada {
        objetivo: &de(&b.objetivo),
        tolerancia: &tolerancia,
        escala: &de(&b.escala),
        correlacion: &correlacion,
        pesos: con_pesos.then_some(pesos.as_slice()),
        gamma: c.parametros.gamma,
        lambda: b.lambda.unwrap_or(c.parametros.lambda_contraccion),
        obligatorias: obligatorias(&variables),
    })
    .map_err(|e| anyhow::anyhow!("{}: perfil inválido: {e}", d.id))?;
    Ok((perfil, variables))
}

#[derive(Debug, Serialize)]
pub struct FilaEscenario {
    #[serde(flatten)]
    pub definicion: Definicion,
    pub elegibles: u64,
    pub completas: u64,
    pub coinciden: u64,
    pub coinciden_incompletas: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub excluidos_por_indice: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub excluidos_por_separacion: Option<u64>,
    pub regiones_con_candidato: u64,
    pub nota_mejor: Option<f64>,
    pub nota_peor_candidato: Option<f64>,
}

impl FilaEscenario {
    fn de((definicion, r): (Definicion, &ResultadoEscenario), con_indice: bool) -> Self {
        let excluidos_por_separacion = definicion
            .separacion_km
            .map(|_| r.cuentas.excluidos_por_separacion);
        Self {
            definicion,
            elegibles: r.cuentas.elegibles,
            completas: r.cuentas.completas,
            coinciden: r.cuentas.coinciden,
            coinciden_incompletas: r.cuentas.coinciden_incompletas,
            excluidos_por_indice: con_indice.then_some(r.cuentas.excluidos_por_indice),
            excluidos_por_separacion,
            regiones_con_candidato: r.regiones,
            nota_mejor: r.mejores.first().map(|m| m.s_tol),
            nota_peor_candidato: r.mejores.last().map(|m| m.s_tol),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct Robustez {
    pub region: u32,

    pub ipix: u32,
    pub lat: f64,
    pub lon: f64,

    pub aparece_en: usize,
    pub fraccion: f64,

    pub s_min: f64,
    pub s_mediana: f64,
    pub s_max: f64,
}

fn a_f64(n: usize) -> f64 {
    f64::from(u32::try_from(n).unwrap_or(u32::MAX))
}

#[must_use]
pub fn robustez(
    resultados: &[&ResultadoEscenario],
    desplazamiento: u32,
    nivel: u8,
) -> Vec<Robustez> {
    let mut por_region: BTreeMap<u32, Vec<(f64, u32)>> = BTreeMap::new();
    for m in resultados.iter().flat_map(|r| &r.mejores) {
        por_region
            .entry(m.ipix >> desplazamiento)
            .or_default()
            .push((m.s_tol, m.ipix));
    }
    let mut salida: Vec<Robustez> = por_region
        .into_iter()
        .map(|(region, mut v)| {
            v.sort_by(|a, b| a.0.total_cmp(&b.0));
            let nota = |i: usize| v.get(i).map_or(f64::NAN, |x| x.0);
            let mut veces: BTreeMap<u32, usize> = BTreeMap::new();
            for (_, ipix) in &v {
                *veces.entry(*ipix).or_default() += 1;
            }
            let ipix = veces
                .iter()
                .max_by(|a, b| a.1.cmp(b.1).then(b.0.cmp(a.0)))
                .map_or(0, |(i, _)| *i);
            let (lat, lon) = crate::geo::centro_celda(nivel, ipix);
            Robustez {
                region,
                ipix,
                lat: redondear(lat, 5),
                lon: redondear(lon, 5),
                aparece_en: v.len(),
                fraccion: a_f64(v.len()) / a_f64(resultados.len()),
                s_min: nota(0),
                s_mediana: f64::midpoint(nota((v.len() - 1) / 2), nota(v.len() / 2)),
                s_max: nota(v.len() - 1),
            }
        })
        .collect();
    salida.sort_by(|a, b| {
        b.aparece_en
            .cmp(&a.aparece_en)
            .then(b.s_mediana.total_cmp(&a.s_mediana))
            .then(a.region.cmp(&b.region))
    });
    salida
}

#[derive(Debug, Clone, Serialize)]
pub struct Medicion {
    pub n_celdas: usize,
    pub hilos: usize,
    pub columnas_leidas: usize,
    pub n_escenarios: usize,
    pub candidatos_por_escenario: usize,
    pub preparar_s: f64,
    pub barrido_s: f64,
    pub escenarios_por_s: f64,
    pub total_s: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub celdas_en_area: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub regiones_con_tierra: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sin_celdas_por_ndvi: Option<u64>,
    pub salida: PathBuf,
}

#[derive(Debug, Serialize)]
pub struct InformeEscenarios {
    #[serde(flatten)]
    pub medicion: Medicion,
    pub escenarios: Vec<FilaEscenario>,

    pub robustez: BTreeMap<String, Vec<Robustez>>,
}

fn base<'a>(
    bases: &'a mut BTreeMap<(String, String), Cargado>,
    opc: &Opciones,
    objetivo: &str,
    perfil: &str,
) -> Result<&'a Cargado> {
    Ok(
        match bases.entry((objetivo.to_owned(), perfil.to_owned())) {
            Entry::Occupied(o) => o.into_mut(),
            Entry::Vacant(v) => v.insert(cargar(&opc.perfiles, objetivo, perfil, None)?),
        },
    )
}

fn leer_definiciones(
    opc: &Opciones,
    archivo: &Path,
    bases: &mut BTreeMap<(String, String), Cargado>,
) -> Result<Vec<Definicion>> {
    let texto = std::fs::read_to_string(archivo)
        .with_context(|| format!("no se pudo leer {}", archivo.display()))?;
    let spec: Archivo = serde_json::from_str(&texto)
        .with_context(|| format!("{} no es un archivo de escenarios", archivo.display()))?;
    let mut definiciones = spec.escenarios;
    if let Some(m) = &spec.muestreo {
        let mut azar = Azar(m.semilla);
        for objetivo in &m.objetivos {
            let variables = base(bases, opc, objetivo, &m.perfil)?
                .perfil
                .variables
                .clone();
            definiciones.extend(m.generar(objetivo, &variables, &mut azar)?);
        }
    }
    let ids: BTreeSet<&str> = definiciones.iter().map(|d| d.id.as_str()).collect();
    ensure!(
        !ids.is_empty() && ids.len() == definiciones.len(),
        "{}: sin escenarios o con `id` repetidos",
        archivo.display()
    );
    Ok(definiciones)
}

fn robustez_por_objetivo(
    definiciones: &[Definicion],
    resultados: &[ResultadoEscenario],
    desplazamiento: u32,
    nivel_healpix: u8,
) -> BTreeMap<String, Vec<Robustez>> {
    let mut por_objetivo: BTreeMap<String, Vec<&ResultadoEscenario>> = BTreeMap::new();
    for (d, r) in definiciones.iter().zip(resultados) {
        por_objetivo.entry(d.objetivo.clone()).or_default().push(r);
    }
    por_objetivo
        .into_iter()
        .map(|(objetivo, r)| (objetivo, robustez(&r, desplazamiento, nivel_healpix)))
        .collect()
}

type FiltrosResueltos = (Vec<Option<u64>>, Vec<Option<usize>>);

#[expect(
    clippy::too_many_arguments,
    reason = "pasa los parámetros compartidos de exclusión y rangos de área al barrido"
)]
fn barrer_filtrado(
    comp: &Compartido<'_>,
    escenarios: &[Escenario],
    definiciones: &[Definicion],
    indice: Option<&IndiceExclusion>,
    radios_bits: &[Option<u64>],
    indice_por_escenario: &[Option<usize>],
    tope_radio_km: Option<f64>,
    rangos: Option<&[Range<usize>]>,
) -> Result<Vec<ResultadoEscenario>> {
    let filtros_indice: Vec<FiltroIndice<'_>> = if let Some(ind) = indice {
        radios_bits
            .iter()
            .map(|bits| {
                FiltroIndice::nuevo_con_tope(
                    ind,
                    comp.nivel_region,
                    comp.nivel_celda,
                    comp.ipix,
                    bits.map(f64::from_bits),
                    tope_radio_km,
                )
            })
            .collect::<Result<Vec<_>>>()?
    } else {
        Vec::new()
    };
    let filtros: Vec<Filtros<'_>> = definiciones
        .iter()
        .zip(indice_por_escenario)
        .map(|(d, idx)| Filtros {
            indice: idx.and_then(|i| filtros_indice.get(i)),
            separacion_km: d.separacion_km,
        })
        .collect();
    barrer_escenarios_en_rangos(comp, escenarios, &filtros, rangos).map_err(|m| anyhow::anyhow!(m))
}

fn resolver_filtros_escenarios(
    definiciones: &mut [Definicion],
    opc: &Opciones,
    con_indice: bool,
) -> Result<FiltrosResueltos> {
    let mut radios_bits: Vec<Option<u64>> = Vec::new();
    let mut indice_por_escenario = Vec::with_capacity(definiciones.len());
    for d in definiciones {
        let radio_exc = d.radio_exclusion_km.or(opc.excluir_km);
        if radio_exc.is_some() {
            ensure!(
                con_indice,
                "{}: `radio_exclusion_km` requiere `--indice`",
                d.id
            );
        }
        validar_distancia_km(radio_exc, &format!("{}: `radio_exclusion_km`", d.id))?;
        let sep = d.separacion_km.or(opc.separacion_km);
        validar_distancia_km(sep, &format!("{}: `separacion_km`", d.id))?;
        (d.radio_exclusion_km, d.separacion_km) = (radio_exc, sep);
        if con_indice {
            let clave = radio_exc.map(f64::to_bits);
            let pos = if let Some(pos) = radios_bits.iter().position(|&c| c == clave) {
                pos
            } else {
                radios_bits.push(clave);
                radios_bits.len() - 1
            };
            indice_por_escenario.push(Some(pos));
        } else {
            indice_por_escenario.push(None);
        }
    }
    Ok((radios_bits, indice_por_escenario))
}

fn preparar_escenarios_y_nombres(
    opc: &Opciones,
    tabla: &Tabla,
    definiciones: &mut [Definicion],
    bases: &mut BTreeMap<(String, String), Cargado>,
) -> Result<(Vec<Escenario>, Vec<String>, crate::entrada::Parametros)> {
    let mut nombres: Vec<String> = OBLIGATORIAS.iter().map(|v| (*v).to_owned()).collect();
    let mut escenarios = Vec::with_capacity(definiciones.len());
    let mut parametros = None;
    for d in definiciones {
        let c = base(bases, opc, &d.objetivo, &d.perfil)?;
        c.verificar_celdas(tabla.n_celdas)?;
        let (perfil, variables) = armar(d, c)?;
        let mut columnas = Vec::with_capacity(variables.len());
        for v in &variables {
            let hay = nombres.iter().position(|n| n == v);
            columnas.push(hay.unwrap_or(nombres.len()));
            if hay.is_none() {
                nombres.push(v.clone());
            }
        }
        let ndvi_max = d.ndvi_max.unwrap_or(c.parametros.ndvi_max_principal);
        (d.variables, d.ndvi_max) = (variables, Some(ndvi_max));
        escenarios.push(Escenario {
            perfil,
            columnas,
            ndvi_max: a_f32(ndvi_max),
        });
        parametros = Some(c.parametros.clone());
    }
    Ok((escenarios, nombres, parametros.context("sin escenarios")?))
}

pub fn correr_escenarios(opc: &Opciones, archivo: &Path) -> Result<InformeEscenarios> {
    let t0 = Instant::now();
    let k_area = validar_k_area(opc.k_area)?;
    let min_area_km2 = validar_min_area_km2(opc.min_area_km2)?;
    let area = cargar_area(opc.region.as_deref(), opc.bbox)?;
    let indice_exc = cargar_y_validar(opc.indice.as_deref(), opc.excluir_km, opc.separacion_km)?;
    let mut bases = BTreeMap::new();
    let mut definiciones = leer_definiciones(opc, archivo, &mut bases)?;
    let (radios_bits, indice_por_escenario) =
        resolver_filtros_escenarios(&mut definiciones, opc, indice_exc.is_some())?;

    let tabla = Tabla::abrir(&opc.maestro)?;
    let (escenarios, nombres, p) =
        preparar_escenarios_y_nombres(opc, &tabla, &mut definiciones, &mut bases)?;
    let cols = nombres
        .iter()
        .map(|v| tabla.f32(v))
        .collect::<Result<Vec<_>>>()?;
    let (ndvi, ipix) = (tabla.f32(COLUMNA_NDVI)?, tabla.u32(COLUMNA_IPIX)?);
    let columnas: Vec<&[f32]> = cols.iter().map(Columna::f32s).collect();
    let requeridas: Vec<usize> = (0..OBLIGATORIAS.len()).collect();
    let comp = Compartido {
        columnas: &columnas,
        requeridas: &requeridas,
        ndvi: ndvi.f32s(),
        ipix: ipix.u32s(),
        s_coincide: a_f32(p.s_coincide),
        nivel_region: p.nivel_region,
        nivel_celda: u32::from(tabla.nivel_healpix),
        candidatos: opc.candidatos,
        filas_por_tarea: FILAS_POR_TAREA,
    };
    let pool = crear_pool(opc.hilos)?;
    let area_res = preparar_area_escenarios(
        &pool,
        area.as_ref(),
        &comp,
        &escenarios,
        tabla.nivel_healpix,
        p.min_celdas_region,
    )?;
    if let Some((_, res)) = &area_res {
        res.exigir_minimo_km2(min_area_km2)?;
    }
    let (rangos, resumen_area) = match area_res {
        Some((r, res)) => (Some(r), Some(res)),
        None => (None, None),
    };
    let tope_radio = resumen_area.map(|r| r.tope_radio_km(k_area));
    let preparar_s = t0.elapsed().as_secs_f64();
    let t1 = Instant::now();
    let resultados = pool.install(|| {
        barrer_filtrado(
            &comp,
            &escenarios,
            &definiciones,
            indice_exc.as_ref(),
            &radios_bits,
            &indice_por_escenario,
            tope_radio,
            rangos.as_deref(),
        )
    })?;
    let barrido_s = t1.elapsed().as_secs_f64();
    escribir_informe_escenarios(
        opc,
        &tabla,
        definiciones,
        &resultados,
        &comp,
        nombres.len() + 2,
        pool.current_num_threads(),
        indice_exc.is_some(),
        rangos.as_deref(),
        resumen_area,
        (preparar_s, barrido_s, t0.elapsed().as_secs_f64()),
    )
}

#[expect(
    clippy::too_many_arguments,
    reason = "arma y escribe InformeEscenarios tras el barrido"
)]
fn escribir_informe_escenarios(
    opc: &Opciones,
    tabla: &Tabla,
    definiciones: Vec<Definicion>,
    resultados: &[ResultadoEscenario],
    comp: &Compartido<'_>,
    columnas_leidas: usize,
    hilos: usize,
    con_indice: bool,
    rangos: Option<&[Range<usize>]>,
    resumen_area: Option<ResumenArea>,
    (preparar_s, barrido_s, total_s): (f64, f64, f64),
) -> Result<InformeEscenarios> {
    let desplazamiento = 2 * (comp.nivel_celda - comp.nivel_region);
    let robustez = robustez_por_objetivo(
        &definiciones,
        resultados,
        desplazamiento,
        tabla.nivel_healpix,
    );
    let n_celdas = rangos.map_or(tabla.n_celdas, |rs| rs.iter().map(Range::len).sum());
    let informe = InformeEscenarios {
        medicion: Medicion {
            n_celdas,
            hilos,
            columnas_leidas,
            n_escenarios: resultados.len(),
            candidatos_por_escenario: opc.candidatos,
            preparar_s,
            barrido_s,
            escenarios_por_s: a_f64(resultados.len()) / barrido_s.max(1e-9),
            total_s,
            celdas_en_area: resumen_area.map(|r| r.celdas_en_area),
            regiones_con_tierra: resumen_area.map(|r| r.regiones_con_tierra),
            sin_celdas_por_ndvi: resumen_area.map(|r| r.sin_celdas_por_ndvi),
            salida: opc.salida.join("estabilidad.json"),
        },
        escenarios: definiciones
            .into_iter()
            .zip(resultados)
            .map(|par| FilaEscenario::de(par, con_indice))
            .collect(),
        robustez,
    };
    std::fs::create_dir_all(&opc.salida)
        .with_context(|| format!("no se pudo crear {}", opc.salida.display()))?;
    std::fs::write(&informe.medicion.salida, serde_json::to_vec(&informe)?)
        .with_context(|| format!("no se pudo escribir {}", informe.medicion.salida.display()))?;
    Ok(informe)
}

fn preparar_area_escenarios(
    pool: &rayon::ThreadPool,
    area: Option<&crate::area::Area>,
    comp: &Compartido<'_>,
    escenarios: &[Escenario],
    nivel_healpix: u8,
    min_celdas_region: u64,
) -> Result<Option<(Vec<Range<usize>>, ResumenArea)>> {
    let Some(a) = area else {
        return Ok(None);
    };
    comp.validar(escenarios).map_err(|m| anyhow::anyhow!(m))?;
    let rangos = a.rangos_filas(comp.ipix, nivel_healpix)?;
    let ndvi_tope = escenarios
        .iter()
        .map(|e| e.ndvi_max)
        .fold(f32::NEG_INFINITY, f32::max);
    let obligatorias = comp
        .columnas
        .get(..OBLIGATORIAS.len())
        .context("faltan columnas obligatorias")?;
    let resumen = pool.install(|| {
        evaluar_y_validar_area(
            &rangos,
            comp.ipix,
            comp.ndvi,
            obligatorias,
            ndvi_tope,
            comp.nivel_region,
            comp.nivel_celda,
            min_celdas_region,
        )
    })?;
    Ok(Some((rangos, resumen)))
}
