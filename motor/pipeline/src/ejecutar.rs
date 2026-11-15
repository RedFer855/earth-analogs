//! Una corrida del motor: abre la tabla y el perfil, barre, elige candidatos y escribe los resultados.

use std::ops::Range;
use std::path::{Path, PathBuf};
use std::time::{Instant, SystemTime, UNIX_EPOCH};

use anyhow::{Context, Result};
use nucleo::{Entrada, Perfil};
use serde::Serialize;

use crate::area::{
    cargar_area, evaluar_y_validar_area, validar_k_area, validar_min_area_km2, Area, ResumenArea,
};
use crate::barrido::{barrer_en_rangos, s_por_fila, Barrido, Config, Cuentas, Filtros};
use crate::entrada::{cargar, Cargado};
use crate::indice::{cargar_y_validar, FiltroIndice, IndiceExclusion};
use crate::salida::{
    escribir, indice, iso_utc, resultado, Cercanas, ColumnaCerca, Fuentes, Sitios, COLUMNAS_CERCA,
};
use crate::tabla::{Columna, Tabla};

pub(crate) const OBLIGATORIAS: [&str; 4] = [
    "slope_mean_deg",
    "slope_std_deg",
    "rug_rms_mean_m",
    "relieve_mean_m",
];
pub(crate) const COLUMNA_NDVI: &str = "ndvi_max_clim";
pub(crate) const COLUMNA_IPIX: &str = "ipix";

#[derive(Debug, Clone)]
pub struct Opciones {
    pub maestro: PathBuf,
    pub perfiles: PathBuf,
    pub sitios: PathBuf,
    pub objetivo: String,
    pub perfil: String,
    pub salida: PathBuf,
    pub candidatos: usize,

    pub hilos: Option<usize>,

    pub perfil_json: Option<PathBuf>,

    pub volcar_s: Option<PathBuf>,

    pub solo_barrido: bool,

    pub escenarios: Option<PathBuf>,

    pub indice: Option<PathBuf>,

    pub excluir_km: Option<f64>,

    pub separacion_km: Option<f64>,

    pub region: Option<PathBuf>,

    pub bbox: Option<[f64; 4]>,

    pub k_area: Option<f64>,

    pub min_area_km2: Option<f64>,

    /// Carpeta extra con columnas de distancia (`cerca_de`) sobre la misma malla, p. ej. otra corrida del ETL.
    pub puntos: Option<PathBuf>,
}

impl Opciones {
    #[must_use]
    pub fn por_omision() -> Self {
        let run = PathBuf::from(std::env::var("RUN").unwrap_or_else(|_| ".".to_owned()));
        let salida = run.join("salida");
        Self {
            maestro: run.clone(),
            perfiles: run.join("perfiles.json"),
            sitios: Path::new(env!("CARGO_MANIFEST_DIR")).join("../../etl/sitios"),
            objetivo: "JZ".to_owned(),
            perfil: "terreno".to_owned(),
            salida,
            candidatos: 200,
            hilos: None,
            perfil_json: None,
            volcar_s: None,
            solo_barrido: false,
            escenarios: None,
            indice: None,
            excluir_km: None,
            separacion_km: None,
            region: None,
            bbox: None,
            k_area: None,
            min_area_km2: None,
            puntos: None,
        }
    }
}

#[derive(Debug, Serialize)]
pub struct Tiempos {
    pub abrir_s: f64,
    pub perfil_s: f64,
    pub barrido_s: f64,
    pub candidatos_s: f64,
    pub escribir_s: f64,
    pub total_s: f64,
}

#[derive(Debug, Serialize)]
pub struct Informe {
    pub sitio: String,
    pub perfil: String,
    pub n_celdas: usize,
    pub hilos: usize,
    pub columnas_leidas: usize,
    pub mascaras_precalculadas: usize,
    pub elegibles: u64,
    pub completas: u64,
    pub coinciden: u64,
    pub coinciden_incompletas: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub excluidos_por_indice: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub excluidos_por_separacion: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub celdas_en_area: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub regiones_con_tierra: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sin_celdas_por_ndvi: Option<u64>,
    pub ref_coinciden: u64,

    pub diferencia_ref: i64,
    pub regiones_con_candidato: usize,
    pub candidatos_escritos: usize,
    pub nota_mejor: Option<f64>,
    pub nota_peor_escrita: Option<f64>,
    pub bytes_escritos: u64,

    pub gb_leidos: f64,
    pub gb_por_s: f64,
    pub tiempos: Tiempos,
    pub salida: PathBuf,
}

pub(crate) fn obligatorias(variables: &[String]) -> u16 {
    variables
        .iter()
        .enumerate()
        .filter(|(_, v)| OBLIGATORIAS.contains(&v.as_str()))
        .fold(0u16, |m, (i, _)| m | (1 << i))
}

fn armar_perfil(c: &Cargado) -> Result<Perfil> {
    let (p, e) = (&c.parametros, &c.perfil);
    Perfil::nuevo(&Entrada {
        objetivo: &e.objetivo,
        tolerancia: &e.tolerancia,
        escala: &e.escala,
        correlacion: &e.correlacion,
        pesos: e.pesos.as_deref(),
        gamma: p.gamma,
        lambda: e.lambda.unwrap_or(p.lambda_contraccion),
        obligatorias: obligatorias(&e.variables),
    })
    .map_err(|er| anyhow::anyhow!("perfil inválido: {er}"))
}

pub(crate) fn crear_pool(hilos: Option<usize>) -> Result<rayon::ThreadPool> {
    let mut constructor = rayon::ThreadPoolBuilder::new();
    if let Some(h) = hilos {
        constructor = constructor.num_threads(h);
    }
    constructor
        .build()
        .context("no se pudo crear el pool de hilos")
}

fn preparar_area(
    area: Option<&Area>,
    cfg: &Config<'_>,
    nivel_healpix: u8,
    min_celdas_region: u64,
) -> Result<Option<(Vec<Range<usize>>, ResumenArea)>> {
    let Some(a) = area else {
        return Ok(None);
    };
    let rangos = a.rangos_filas(cfg.ipix, nivel_healpix)?;
    let mask = cfg.perfil.obligatorias();
    let obligatorias_cols: Vec<&[f32]> = if mask == 0 {
        cfg.columnas.to_vec()
    } else {
        cfg.columnas
            .iter()
            .enumerate()
            .filter(|(i, _)| ((mask >> i) & 1) == 1)
            .map(|(_, c)| *c)
            .collect()
    };
    let resumen = evaluar_y_validar_area(
        &rangos,
        cfg.ipix,
        cfg.ndvi,
        &obligatorias_cols,
        cfg.ndvi_max,
        cfg.nivel_region,
        cfg.nivel_celda,
        min_celdas_region,
    )?;
    Ok(Some((rangos, resumen)))
}

fn barrer_filtrado(
    cfg: &Config<'_>,
    indice: Option<&IndiceExclusion>,
    opc: &Opciones,
    rangos: Option<&[Range<usize>]>,
    tope_radio_km: Option<f64>,
) -> Result<Barrido> {
    let filtro_indice = indice
        .map(|ind| {
            FiltroIndice::nuevo_con_tope(
                ind,
                cfg.nivel_region,
                cfg.nivel_celda,
                cfg.ipix,
                opc.excluir_km,
                tope_radio_km,
            )
        })
        .transpose()?;
    let filtros = Filtros {
        indice: filtro_indice.as_ref(),
        separacion_km: opc.separacion_km,
    };
    barrer_en_rangos(cfg, &filtros, rangos).map_err(|er| anyhow::anyhow!("falló el barrido: {er}"))
}

fn volcar_s(pool: &rayon::ThreadPool, cfg: &Config<'_>, ruta: &Path) -> Result<()> {
    let s = pool
        .install(|| s_por_fila(cfg))
        .map_err(|er| anyhow::anyhow!("falló el volcado: {er}"))?;
    std::fs::write(ruta, bytemuck::cast_slice::<f32, u8>(&s))
        .with_context(|| format!("no se pudo escribir {}", ruta.display()))
}

type AreaResuelta = (Option<Vec<Range<usize>>>, Option<ResumenArea>, Option<f64>);

fn resolver_area(
    area: Option<&Area>,
    cfg: &Config<'_>,
    nivel_healpix: u8,
    min_celdas_region: u64,
    k_area: f64,
    min_area_km2: f64,
) -> Result<AreaResuelta> {
    let Some((rangos, resumen)) = preparar_area(area, cfg, nivel_healpix, min_celdas_region)?
    else {
        return Ok((None, None, None));
    };
    resumen.exigir_minimo_km2(min_area_km2)?;
    let tope = resumen.tope_radio_km(k_area);
    Ok((Some(rangos), Some(resumen), Some(tope)))
}

pub fn correr(opc: &Opciones) -> Result<Informe> {
    let t0 = Instant::now();
    let k_area = validar_k_area(opc.k_area)?;
    let min_area_km2 = validar_min_area_km2(opc.min_area_km2)?;
    let area = cargar_area(opc.region.as_deref(), opc.bbox)?;
    let indice_exc = cargar_y_validar(opc.indice.as_deref(), opc.excluir_km, opc.separacion_km)?;
    let cargado = cargar(
        &opc.perfiles,
        &opc.objetivo,
        &opc.perfil,
        opc.perfil_json.as_deref(),
    )?;
    let (p, e) = (&cargado.parametros, &cargado.perfil);
    let tabla = Tabla::abrir(&opc.maestro)?;
    cargado.verificar_celdas(tabla.n_celdas)?;
    let cols = e
        .variables
        .iter()
        .map(|v| tabla.f32(v))
        .collect::<Result<Vec<_>>>()?;
    let diagnostico = e
        .diagnostico
        .iter()
        .map(|(v, _)| tabla.f32(v))
        .collect::<Result<Vec<_>>>()?;
    let ndvi = tabla.f32(COLUMNA_NDVI)?;
    let ipix = tabla.u32(COLUMNA_IPIX)?;
    let columnas: Vec<&[f32]> = cols.iter().map(Columna::f32s).collect();
    let t_abrir = t0.elapsed();

    let t1 = Instant::now();
    let perfil = armar_perfil(&cargado)?;
    let cfg = Config {
        perfil: &perfil,
        columnas: &columnas,
        ndvi: ndvi.f32s(),
        ipix: ipix.u32s(),
        ndvi_max: nucleo::a_f32(p.ndvi_max_principal),
        s_coincide: nucleo::a_f32(p.s_coincide),
        nivel_region: p.nivel_region,
        nivel_celda: u32::from(tabla.nivel_healpix),
    };
    cfg.validar().map_err(|m| anyhow::anyhow!(m))?;
    let t_perfil = t1.elapsed();

    let t2 = Instant::now();
    let pool = crear_pool(opc.hilos)?;
    let (rangos, resumen_area, tope_radio) = pool.install(|| {
        resolver_area(
            area.as_ref(),
            &cfg,
            tabla.nivel_healpix,
            p.min_celdas_region,
            k_area,
            min_area_km2,
        )
    })?;
    let barrido = pool.install(|| {
        barrer_filtrado(
            &cfg,
            indice_exc.as_ref(),
            opc,
            rangos.as_deref(),
            tope_radio,
        )
    })?;
    let t_barrido = t2.elapsed();
    if let Some(ruta) = &opc.volcar_s {
        volcar_s(&pool, &cfg, ruta)?;
    }
    let (bytes_escritos, candidatos_s, escribir_s) = if opc.solo_barrido {
        (0, 0.0, 0.0)
    } else {
        let diag: Vec<&[f32]> = diagnostico.iter().map(Columna::f32s).collect();
        escribir_candidatos(
            opc,
            &cargado,
            &perfil,
            (&columnas, &diag),
            &tabla,
            &barrido,
            resumen_area,
        )?
    };
    let tiempos = Tiempos {
        abrir_s: t_abrir.as_secs_f64(),
        perfil_s: t_perfil.as_secs_f64(),
        barrido_s: t_barrido.as_secs_f64(),
        candidatos_s,
        escribir_s,
        total_s: t0.elapsed().as_secs_f64(),
    };
    informe(
        &cargado,
        &perfil,
        &barrido,
        opc,
        pool.current_num_threads(),
        bytes_escritos,
        tiempos,
        resumen_area,
    )
}

fn escribir_candidatos(
    opc: &Opciones,
    c: &Cargado,
    perfil: &Perfil,
    (columnas, diagnostico): (&[&[f32]], &[&[f32]]),
    tabla: &Tabla,
    barrido: &Barrido,
    resumen_area: Option<ResumenArea>,
) -> Result<(u64, f64, f64)> {
    let t0 = Instant::now();
    let sitios = Sitios::leer(&opc.sitios)?;
    let extra = opc
        .puntos
        .as_deref()
        .map(|d| Tabla::abrir_extra(d, tabla))
        .transpose()?;
    let abiertas = abrir_cercanas(tabla, extra.as_ref())?;
    let cercanas = Cercanas {
        columnas: abiertas.each_ref().map(|c| {
            c.as_ref().map(|(col, t)| ColumnaCerca {
                datos: col.f32s(),
                tabla: t,
            })
        }),
    };
    let fuentes = Fuentes {
        perfil_nucleo: perfil,
        entrada: &c.perfil,
        parametros: &c.parametros,
        sitios: &sitios,
        columnas,
        diagnostico,
        tabla,
        cercanas: &cercanas,
        nivel_healpix: tabla.nivel_healpix,
        excluidos_por_indice: opc
            .indice
            .as_ref()
            .map(|_| barrido.cuentas.excluidos_por_indice),
        excluidos_por_separacion: opc
            .separacion_km
            .map(|_| barrido.cuentas.excluidos_por_separacion),
        celdas_en_area: resumen_area.map(|r| r.celdas_en_area),
        regiones_con_tierra: resumen_area.map(|r| r.regiones_con_tierra),
        sin_celdas_por_ndvi: resumen_area.map(|r| r.sin_celdas_por_ndvi),
    };
    let res = resultado(&fuentes, &barrido.por_region, opc.candidatos)?;
    let generado = iso_utc(
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_or(0, |d| d.as_secs()),
    );
    let idx = indice(&fuentes, &res, generado)?;
    let armar = t0.elapsed().as_secs_f64();
    let t1 = Instant::now();
    let bytes = escribir(&opc.salida, &idx, &res)?;
    Ok((bytes, armar, t1.elapsed().as_secs_f64()))
}

type Abierta<'t> = Option<(Columna, &'t Tabla)>;

/// Abre cada columna de `cerca_de`: primero en la tabla principal y, si no está, en la extra (`--puntos`).
fn abrir_cercanas<'t>(tabla: &'t Tabla, extra: Option<&'t Tabla>) -> Result<[Abierta<'t>; 3]> {
    let abrir = |(_, col): (&str, &str)| -> Result<Abierta<'t>> {
        for t in std::iter::once(tabla).chain(extra) {
            if t.tiene_f32(col) {
                return Ok(Some((t.f32(col)?, t)));
            }
        }
        Ok(None)
    };
    let [a, b, c] = COLUMNAS_CERCA;
    Ok([abrir(a)?, abrir(b)?, abrir(c)?])
}

#[expect(
    clippy::too_many_arguments,
    reason = "arma Informe con las métricas de la corrida"
)]
fn informe(
    c: &Cargado,
    perfil: &Perfil,
    barrido: &Barrido,
    opc: &Opciones,
    hilos: usize,
    bytes_escritos: u64,
    tiempos: Tiempos,
    resumen_area: Option<ResumenArea>,
) -> Result<Informe> {
    let e = &c.perfil;
    let Cuentas {
        elegibles,
        completas,
        coinciden,
        coinciden_incompletas,
        excluidos_por_indice,
        excluidos_por_separacion,
    } = barrido.cuentas.clone();
    let k = e.variables.len();
    let gb_leidos =
        f64::from(u32::try_from(k + 2)?) * 4.0 * f64::from(u32::try_from(barrido.n_filas)?) / 1e9;
    let notas: Vec<f64> = barrido
        .por_region
        .iter()
        .take(opc.candidatos)
        .map(|m| m.s_tol)
        .collect();
    Ok(Informe {
        sitio: e.sitio.clone(),
        perfil: e.id_perfil.clone(),
        n_celdas: barrido.n_filas,
        hilos,
        columnas_leidas: k + 2,
        mascaras_precalculadas: perfil.n_mascaras(),
        elegibles,
        completas,
        coinciden,
        coinciden_incompletas,
        excluidos_por_indice: opc.indice.as_ref().map(|_| excluidos_por_indice),
        excluidos_por_separacion: opc.separacion_km.map(|_| excluidos_por_separacion),
        celdas_en_area: resumen_area.map(|r| r.celdas_en_area),
        regiones_con_tierra: resumen_area.map(|r| r.regiones_con_tierra),
        sin_celdas_por_ndvi: resumen_area.map(|r| r.sin_celdas_por_ndvi),
        ref_coinciden: e.coinciden_ref,
        diferencia_ref: i64::try_from(coinciden)? - i64::try_from(e.coinciden_ref)?,
        regiones_con_candidato: barrido.por_region.len(),
        candidatos_escritos: notas.len(),
        nota_mejor: notas.first().copied(),
        nota_peor_escrita: notas.last().copied(),
        bytes_escritos,
        gb_leidos,
        gb_por_s: gb_leidos / tiempos.barrido_s.max(1e-9),
        tiempos,
        salida: opc.salida.clone(),
    })
}
