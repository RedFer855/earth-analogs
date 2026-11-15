#![expect(
    clippy::indexing_slicing,
    reason = "camino caliente por filas: todas las columnas miden n filas (se comprueba en `Config::validar` y en `Compartido::validar`) y los índices salen de 0..n"
)]

//! Barrido de la tabla: puntúa cada celda contra el perfil y guarda la mejor de cada región de `HEALPix`.
//!
//! Una celda entra si su NDVI climatológico tiene dato y no pasa el umbral (suelo desnudo). Si le faltan
//! variables, entra con la regla de Gower (ADR-006, ADR-010): necesita todas las obligatorias y al menos
//! `FRACCION_MINIMA` de las variables, y su S se multiplica por la fracción presente, para que una celda
//! incompleta no adelante a una completa igual de parecida.

use std::cmp::Ordering;
use std::ops::Range;

use nucleo::{a_f32, ErrorPerfil, Perfil, MAX_VARS};
use rayon::prelude::*;

use crate::geo::{centro_celda, haversine_km, vector_unitario, RADIO_TIERRA_KM};
use crate::indice::FiltroIndice;

pub const FILAS_POR_TAREA: usize = 1 << 18;

/// Fracción mínima de variables presentes para que una celda incompleta sea candidata.
pub const FRACCION_MINIMA: f64 = 0.70;

/// Fracción de variables presentes, o `None` si no llega a `FRACCION_MINIMA`.
#[must_use]
pub fn factor_gower(mascara: u16, k: usize) -> Option<f64> {
    let total = f64::from(u32::try_from(k).ok()?);
    let f = f64::from(mascara.count_ones()) / total;
    (total > 0.0 && f >= FRACCION_MINIMA).then_some(f)
}

pub struct Config<'a> {
    pub perfil: &'a Perfil,

    pub columnas: &'a [&'a [f32]],

    pub ndvi: &'a [f32],
    pub ipix: &'a [u32],

    pub ndvi_max: f32,

    pub s_coincide: f32,

    pub nivel_region: u32,
    pub nivel_celda: u32,
}

impl Config<'_> {
    fn n(&self) -> usize {
        self.ipix.len()
    }

    fn n_regiones(&self) -> usize {
        12usize << (2 * self.nivel_region)
    }

    fn desplazamiento(&self) -> u32 {
        2 * (self.nivel_celda - self.nivel_region)
    }

    pub fn validar(&self) -> Result<(), String> {
        let n = self.n();
        if self.columnas.len() != self.perfil.k()
            || self.columnas.is_empty()
            || self.columnas.len() > MAX_VARS
        {
            return Err(format!(
                "{} columnas para un perfil de {} variables",
                self.columnas.len(),
                self.perfil.k()
            ));
        }
        if self.ndvi.len() != n || self.columnas.iter().any(|c| c.len() != n) {
            return Err("las columnas no miden lo mismo".to_owned());
        }
        if u32::try_from(n).is_err() {
            return Err("más filas de las que caben en u32".to_owned());
        }
        if self.nivel_region > self.nivel_celda || self.nivel_celda > 29 {
            return Err("niveles de HEALPix imposibles".to_owned());
        }
        Ok(())
    }
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Mejor {
    pub s_tol: f64,

    pub s_ex: f64,
    pub fila: u32,
    pub ipix: u32,
}

const VACIO: Mejor = Mejor {
    s_tol: f64::NEG_INFINITY,
    s_ex: f64::NEG_INFINITY,
    fila: u32::MAX,
    ipix: u32::MAX,
};

impl Mejor {
    #[must_use]
    pub fn comparar(&self, otro: &Self) -> Ordering {
        self.s_tol
            .total_cmp(&otro.s_tol)
            .then(self.s_ex.total_cmp(&otro.s_ex))
            .then(otro.ipix.cmp(&self.ipix))
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct Cuentas {
    pub elegibles: u64,

    pub completas: u64,

    pub coinciden: u64,

    pub coinciden_incompletas: u64,

    pub excluidos_por_indice: u64,

    pub excluidos_por_separacion: u64,
}

impl Cuentas {
    fn sumar(&mut self, otro: &Self) {
        self.elegibles += otro.elegibles;
        self.completas += otro.completas;
        self.coinciden += otro.coinciden;
        self.coinciden_incompletas += otro.coinciden_incompletas;
        self.excluidos_por_indice += otro.excluidos_por_indice;
        self.excluidos_por_separacion += otro.excluidos_por_separacion;
    }
}

#[derive(Default, Clone, Copy)]
pub struct Filtros<'a> {
    pub indice: Option<&'a FiltroIndice<'a>>,
    pub separacion_km: Option<f64>,
}

pub fn suprimir_por_separacion(
    candidatos: &mut Vec<Mejor>,
    separacion_km: f64,
    nivel_celda: u8,
) -> u64 {
    if !separacion_km.is_finite() || separacion_km <= 0.0 || candidatos.len() <= 1 {
        return 0;
    }
    let umbral = separacion_km / RADIO_TIERRA_KM;
    let cos_umbral = (umbral < std::f64::consts::PI).then(|| umbral.cos() - 1e-6);
    let mut aceptados = Vec::with_capacity(candidatos.len());
    let mut coords: Vec<(f64, f64, [f64; 3])> = Vec::with_capacity(candidatos.len());
    let mut excluidos = 0u64;
    for m in candidatos.drain(..) {
        let (lat, lon) = centro_celda(nivel_celda, m.ipix);
        let u = vector_unitario(lat, lon);
        let cerca = coords.iter().any(|&(alat, alon, au)| {
            if let Some(c) = cos_umbral {
                let dot = u[0] * au[0] + u[1] * au[1] + u[2] * au[2];
                if dot < c {
                    return false;
                }
            }
            haversine_km(lat, lon, alat, alon) < separacion_km
        });
        if cerca {
            excluidos += 1;
        } else {
            aceptados.push(m);
            coords.push((lat, lon, u));
        }
    }
    *candidatos = aceptados;
    excluidos
}

struct Acum {
    cuentas: Cuentas,
    mejores: Vec<Mejor>,
}

impl Acum {
    fn nuevo(n_regiones: usize) -> Self {
        Self {
            cuentas: Cuentas::default(),
            mejores: vec![VACIO; n_regiones],
        }
    }

    fn unir(mut self, otro: &Self) -> Self {
        self.cuentas.sumar(&otro.cuentas);
        for (a, b) in self.mejores.iter_mut().zip(&otro.mejores) {
            if b.comparar(a) == Ordering::Greater {
                *a = *b;
            }
        }
        self
    }

    fn procesar(
        &mut self,
        cfg: &Config<'_>,
        indice: Option<&FiltroIndice<'_>>,
        filas: Range<usize>,
    ) -> Result<(), ErrorPerfil> {
        let k = cfg.perfil.k();
        let completa = (1u16 << k) - 1;
        let desplazamiento = cfg.desplazamiento();
        let mut x = [f32::NAN; MAX_VARS];
        for i in filas {
            if cfg.ndvi[i].is_nan() || cfg.ndvi[i] > cfg.ndvi_max {
                continue;
            }
            for (valor, col) in x.iter_mut().zip(cfg.columnas) {
                *valor = col[i];
            }
            let Some(p) = cfg.perfil.puntuar_tolerante(&x[..k])? else {
                continue;
            };
            self.cuentas.elegibles += 1;
            let es_completa = p.mascara == completa;
            if es_completa {
                self.cuentas.completas += 1;
            }
            let Some(factor) = factor_gower(p.mascara, k) else {
                continue;
            };
            let s = p.s * factor;
            if a_f32(s) >= cfg.s_coincide {
                if es_completa {
                    self.cuentas.coinciden += 1;
                } else {
                    self.cuentas.coinciden_incompletas += 1;
                }
            }
            let ipix = cfg.ipix[i];
            if indice.is_some_and(|f| f.excluye_celda(ipix)) {
                self.cuentas.excluidos_por_indice += 1;
                continue;
            }
            let Some(hueco) = self
                .mejores
                .get_mut(usize::try_from(ipix >> desplazamiento).unwrap_or(usize::MAX))
            else {
                continue;
            };
            if s < hueco.s_tol {
                continue;
            }
            let s_ex = cfg
                .perfil
                .puntuar_exacta(&x[..k])?
                .map_or(f64::NEG_INFINITY, |q| q.s * factor);
            let fila = u32::try_from(i).unwrap_or(u32::MAX);
            let candidata = Mejor {
                s_tol: s,
                s_ex,
                fila,
                ipix,
            };
            if candidata.comparar(hueco) == Ordering::Greater {
                *hueco = candidata;
            }
        }
        Ok(())
    }
}

#[derive(Debug)]
pub struct Barrido {
    pub n_filas: usize,
    pub cuentas: Cuentas,

    pub por_region: Vec<Mejor>,
}

pub fn barrer(cfg: &Config<'_>) -> Result<Barrido, ErrorPerfil> {
    barrer_con_filtros(cfg, &Filtros::default())
}

pub fn barrer_con_filtros(cfg: &Config<'_>, filtros: &Filtros<'_>) -> Result<Barrido, ErrorPerfil> {
    barrer_en_rangos(cfg, filtros, None)
}

pub fn barrer_en_rangos(
    cfg: &Config<'_>,
    filtros: &Filtros<'_>,
    rangos: Option<&[Range<usize>]>,
) -> Result<Barrido, ErrorPerfil> {
    let n = cfg.n();
    if rangos.is_some_and(|rs| rs.iter().any(|r| r.end > n)) {
        return Err(ErrorPerfil::Dimension("rango de filas fuera de la tabla"));
    }
    let tareas: Vec<Range<usize>> = match rangos {
        Some(rs) => rs
            .iter()
            .flat_map(|r| {
                (r.start..r.end)
                    .step_by(FILAS_POR_TAREA)
                    .map(|a| a..(a + FILAS_POR_TAREA).min(r.end))
            })
            .collect(),
        None => (0..n)
            .step_by(FILAS_POR_TAREA)
            .map(|a| a..(a + FILAS_POR_TAREA).min(n))
            .collect(),
    };
    let n_filas = match rangos {
        Some(rs) => rs.iter().map(Range::len).sum(),
        None => n,
    };
    let n_regiones = cfg.n_regiones();
    let mut total = tareas
        .par_iter()
        .try_fold(
            || Acum::nuevo(n_regiones),
            |mut acum, filas| {
                acum.procesar(cfg, filtros.indice, filas.clone())?;
                Ok::<_, ErrorPerfil>(acum)
            },
        )
        .try_reduce(|| Acum::nuevo(n_regiones), |a, b| Ok(a.unir(&b)))?;
    let mut por_region: Vec<Mejor> = total
        .mejores
        .into_iter()
        .filter(|m| m.fila != u32::MAX)
        .collect();
    por_region.sort_by(|a, b| b.comparar(a));
    if let Some(sep) = filtros.separacion_km {
        let nivel = u8::try_from(cfg.nivel_celda).unwrap_or(12);
        total.cuentas.excluidos_por_separacion =
            suprimir_por_separacion(&mut por_region, sep, nivel);
    }
    Ok(Barrido {
        n_filas,
        cuentas: total.cuentas,
        por_region,
    })
}

pub fn s_por_fila(cfg: &Config<'_>) -> Result<Vec<f32>, ErrorPerfil> {
    let k = cfg.perfil.k();
    let mut salida = vec![f32::NAN; cfg.n()];
    salida
        .par_chunks_mut(FILAS_POR_TAREA)
        .enumerate()
        .try_for_each(|(c, trozo)| {
            let base = c * FILAS_POR_TAREA;
            let mut x = [f32::NAN; MAX_VARS];
            for (d, s) in trozo.iter_mut().enumerate() {
                let i = base + d;
                if cfg.ndvi[i].is_nan() || cfg.ndvi[i] > cfg.ndvi_max {
                    continue;
                }
                for (valor, col) in x.iter_mut().zip(cfg.columnas) {
                    *valor = col[i];
                }
                if let Some(p) = cfg.perfil.puntuar_tolerante(&x[..k])? {
                    *s = a_f32(p.s);
                }
            }
            Ok::<_, ErrorPerfil>(())
        })?;
    Ok(salida)
}

pub struct Compartido<'a> {
    pub columnas: &'a [&'a [f32]],

    pub requeridas: &'a [usize],
    pub ndvi: &'a [f32],

    pub ipix: &'a [u32],
    pub s_coincide: f32,
    pub nivel_region: u32,
    pub nivel_celda: u32,

    pub candidatos: usize,

    pub filas_por_tarea: usize,
}

pub struct Escenario {
    pub perfil: Perfil,

    pub columnas: Vec<usize>,
    pub ndvi_max: f32,
}

#[derive(Debug, Clone, PartialEq, Default)]
pub struct ResultadoEscenario {
    pub cuentas: Cuentas,

    pub regiones: u64,
    pub mejores: Vec<Mejor>,
}

impl ResultadoEscenario {
    fn cerrar(&mut self, m: Mejor, tope: Option<usize>) {
        if m.fila != u32::MAX {
            self.regiones += 1;
            self.mejores.push(m);
            if let Some(t) = tope {
                self.recortar_si_sobra(t);
            }
        }
    }

    fn recortar_si_sobra(&mut self, tope: usize) {
        if self.mejores.len() >= 2 * tope.max(1) {
            self.recortar(tope);
        }
    }

    fn recortar(&mut self, tope: usize) {
        self.mejores.sort_unstable_by(|a, b| b.comparar(a));
        self.mejores.truncate(tope);
    }
}

impl Compartido<'_> {
    fn desplazamiento(&self) -> u32 {
        2 * (self.nivel_celda - self.nivel_region)
    }

    pub fn validar(&self, escenarios: &[Escenario]) -> Result<(), String> {
        let n = self.ipix.len();
        if self.columnas.is_empty()
            || self.ndvi.len() != n
            || self.columnas.iter().any(|c| c.len() != n)
        {
            return Err("faltan columnas o no miden lo mismo".to_owned());
        }
        if u32::try_from(n).is_err()
            || self.nivel_region > self.nivel_celda
            || self.nivel_celda > 13
        {
            return Err("demasiadas filas o niveles de HEALPix imposibles".to_owned());
        }
        let fuera = |c: &usize| *c >= self.columnas.len();
        let malo = |e: &Escenario| {
            e.columnas.len() != e.perfil.k()
                || e.columnas.iter().any(fuera)
                || !e.ndvi_max.is_finite()
        };
        if self.filas_por_tarea == 0
            || self.requeridas.iter().any(fuera)
            || escenarios.iter().any(malo)
        {
            return Err(
                "un escenario nombra columnas que no existen o trae un corte de NDVI sin valor"
                    .to_owned(),
            );
        }
        let n_celdas = 12u32 << (2 * self.nivel_celda);
        if !self.ipix.par_windows(2).all(|p| p[0] < p[1])
            || self.ipix.last().is_some_and(|u| *u >= n_celdas)
        {
            return Err("`ipix` no viene ascendente o se sale de la malla: el barrido de escenarios lo necesita".to_owned());
        }
        Ok(())
    }

    fn tareas_en_rangos(&self, rangos: Option<&[Range<usize>]>) -> Vec<Vec<Range<usize>>> {
        let todo = 0..self.ipix.len();
        let rs = rangos.unwrap_or(std::slice::from_ref(&todo));
        let (d, tope) = (self.desplazamiento(), self.filas_por_tarea);
        let mut tareas = Vec::new();
        let mut actual: Vec<Range<usize>> = Vec::new();
        let mut cuenta = 0usize;
        let mut ultima_reg: Option<u32> = None;

        for r in rs {
            let mut a = r.start;
            while a < r.end {
                if let Some(reg_prev) = ultima_reg {
                    if cuenta >= tope && (self.ipix[a] >> d) != reg_prev {
                        tareas.push(std::mem::take(&mut actual));
                        cuenta = 0;
                    }
                }
                let falta = tope.saturating_sub(cuenta).max(1);
                let mut b = (a + falta).min(r.end);
                while b < r.end && self.ipix[b] >> d == self.ipix[b - 1] >> d {
                    b += 1;
                }
                actual.push(a..b);
                cuenta += b - a;
                ultima_reg = Some(self.ipix[b - 1] >> d);
                a = b;
            }
        }
        if !actual.is_empty() {
            tareas.push(actual);
        }
        tareas
    }
}

#[derive(Default)]
struct Bloque {
    fila: Vec<u32>,
    ipix: Vec<u32>,
    ndvi: Vec<f32>,

    x: Vec<f32>,
}

impl Bloque {
    fn llenar(&mut self, comp: &Compartido<'_>, ndvi_tope: f32, rangos: &[Range<usize>]) {
        self.fila.clear();
        self.ipix.clear();
        self.ndvi.clear();
        self.x.clear();
        for r in rangos {
            for i in r.clone() {
                let v = comp.ndvi[i];
                if v.is_nan()
                    || v > ndvi_tope
                    || comp
                        .requeridas
                        .iter()
                        .any(|&c| !comp.columnas[c][i].is_finite())
                {
                    continue;
                }
                self.fila.push(u32::try_from(i).unwrap_or(u32::MAX));
                self.ipix.push(comp.ipix[i]);
                self.ndvi.push(v);
                self.x.extend(comp.columnas.iter().map(|c| c[i]));
            }
        }
    }

    fn puntuar(
        &self,
        comp: &Compartido<'_>,
        e: &Escenario,
        indice: Option<&FiltroIndice<'_>>,
        tope: Option<usize>,
        r: &mut ResultadoEscenario,
    ) -> Result<(), ErrorPerfil> {
        let k = e.perfil.k();
        let completa = (1u16 << k) - 1;
        let desplazamiento = comp.desplazamiento();
        let mut x = [f32::NAN; MAX_VARS];
        let (mut region, mut actual) = (u32::MAX, VACIO);
        for (j, valores) in self.x.chunks_exact(comp.columnas.len()).enumerate() {
            if self.ndvi[j] > e.ndvi_max {
                continue;
            }
            for (valor, &c) in x.iter_mut().zip(&e.columnas) {
                *valor = valores[c];
            }
            let Some(p) = e.perfil.puntuar_tolerante(&x[..k])? else {
                continue;
            };
            r.cuentas.elegibles += 1;
            let es_completa = p.mascara == completa;
            if es_completa {
                r.cuentas.completas += 1;
            }
            let Some(factor) = factor_gower(p.mascara, k) else {
                continue;
            };
            let s = p.s * factor;
            if a_f32(s) >= comp.s_coincide {
                if es_completa {
                    r.cuentas.coinciden += 1;
                } else {
                    r.cuentas.coinciden_incompletas += 1;
                }
            }
            let ipix = self.ipix[j];
            if ipix >> desplazamiento != region {
                r.cerrar(actual, tope);
                (region, actual) = (ipix >> desplazamiento, VACIO);
            }
            if indice.is_some_and(|f| f.excluye_celda(ipix)) {
                r.cuentas.excluidos_por_indice += 1;
                continue;
            }
            if s < actual.s_tol {
                continue;
            }
            let s_ex = e
                .perfil
                .puntuar_exacta(&x[..k])?
                .map_or(f64::NEG_INFINITY, |q| q.s * factor);
            let candidata = Mejor {
                s_tol: s,
                s_ex,
                fila: self.fila[j],
                ipix,
            };
            if candidata.comparar(&actual) == Ordering::Greater {
                actual = candidata;
            }
        }
        r.cerrar(actual, tope);
        Ok(())
    }
}

pub fn barrer_escenarios(
    comp: &Compartido<'_>,
    escenarios: &[Escenario],
) -> Result<Vec<ResultadoEscenario>, String> {
    let filtros = vec![Filtros::default(); escenarios.len()];
    barrer_escenarios_con_filtros(comp, escenarios, &filtros)
}

pub fn barrer_escenarios_con_filtros(
    comp: &Compartido<'_>,
    escenarios: &[Escenario],
    filtros: &[Filtros<'_>],
) -> Result<Vec<ResultadoEscenario>, String> {
    barrer_escenarios_en_rangos(comp, escenarios, filtros, None)
}

pub fn barrer_escenarios_en_rangos(
    comp: &Compartido<'_>,
    escenarios: &[Escenario],
    filtros: &[Filtros<'_>],
    rangos: Option<&[Range<usize>]>,
) -> Result<Vec<ResultadoEscenario>, String> {
    comp.validar(escenarios)?;
    if rangos.is_some_and(|rs| rs.iter().any(|r| r.end > comp.ipix.len())) {
        return Err("rango de filas fuera de la tabla".to_owned());
    }
    if filtros.len() != escenarios.len() {
        return Err("número de filtros distinto al de escenarios".to_owned());
    }
    let ndvi_tope = escenarios
        .iter()
        .map(|e| e.ndvi_max)
        .fold(f32::NEG_INFINITY, f32::max);
    let nuevo = || {
        (
            Bloque::default(),
            vec![ResultadoEscenario::default(); escenarios.len()],
        )
    };
    let (_, mut total) = comp
        .tareas_en_rangos(rangos)
        .par_iter()
        .try_fold(nuevo, |(mut bloque, mut acum), trozos| {
            bloque.llenar(comp, ndvi_tope, trozos);
            for ((r, e), f) in acum.iter_mut().zip(escenarios).zip(filtros) {
                let tope = f.separacion_km.is_none().then_some(comp.candidatos);
                bloque.puntuar(comp, e, f.indice, tope, r)?;
            }
            Ok::<_, ErrorPerfil>((bloque, acum))
        })
        .try_reduce(nuevo, |(bloque, mut a), (_, b)| {
            for ((x, y), f) in a.iter_mut().zip(b).zip(filtros) {
                x.cuentas.sumar(&y.cuentas);
                x.regiones += y.regiones;
                x.mejores.extend(y.mejores);
                if f.separacion_km.is_none() {
                    x.recortar_si_sobra(comp.candidatos);
                }
            }
            Ok((bloque, a))
        })
        .map_err(|e| e.to_string())?;
    let nivel = u8::try_from(comp.nivel_celda).map_err(|_| "nivel_celda inválido".to_owned())?;
    for (r, f) in total.iter_mut().zip(filtros) {
        r.mejores.sort_unstable_by(|a, b| b.comparar(a));
        if let Some(sep) = f.separacion_km {
            r.cuentas.excluidos_por_separacion =
                suprimir_por_separacion(&mut r.mejores, sep, nivel);
            r.regiones = u64::try_from(r.mejores.len()).unwrap_or(u64::MAX);
        }
        r.mejores.truncate(comp.candidatos);
    }
    Ok(total)
}

#[cfg(test)]
mod pruebas {
    use super::factor_gower;

    #[test]
    fn gower_exige_el_setenta_por_ciento_y_descuenta_lineal() {
        assert_eq!(factor_gower(0b1111, 4), Some(1.0));
        assert_eq!(factor_gower(0b0111, 4), Some(0.75));
        assert_eq!(factor_gower(0b0011, 4), None);
        assert_eq!(factor_gower(0b11_1111_1110, 10), Some(0.9));
        assert_eq!(factor_gower(0b11_1111_1000, 10), Some(0.7));
        assert_eq!(factor_gower(0b11_1111_0000, 10), None);
        assert_eq!(factor_gower(0, 0), None);
    }
}
