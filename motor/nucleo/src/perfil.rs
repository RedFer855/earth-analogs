//! Perfil de búsqueda y puntaje de una celda (ADR-010).
//!
//! Para las variables presentes de la celda: diferencia en unidades de escala, atenuada con pseudo-Huber según la
//! tolerancia; distancia de Mahalanobis con la correlación contraída hacia la identidad, `(1 - lambda) R + lambda I`,
//! y pesos repartidos entre las presentes; semejanza `S = exp(-gamma D2)`. Las matrices de cada combinación de
//! variables presentes se precalculan al crear el perfil, así el barrido no invierte nada por celda.

#![expect(
    clippy::indexing_slicing,
    reason = "arreglos de MAX_VARS elementos indexados con i < k <= MAX_VARS, validado en Perfil::nuevo"
)]

use core::fmt;

use crate::algebra::{inversa_cholesky, pos, raiz_inversa, ErrorAlgebra, Matriz, Vector, MAX_VARS};

#[must_use]
pub fn a_f32(x: f64) -> f32 {
    #[expect(clippy::cast_possible_truncation, reason = "redondeo a f32")]
    let r = x as f32;
    r
}

#[derive(Debug, Clone, Copy)]
pub struct Entrada<'a> {
    pub objetivo: &'a [f64],

    pub tolerancia: &'a [f64],

    pub escala: &'a [f64],

    pub correlacion: &'a [f64],

    pub pesos: Option<&'a [f64]>,

    pub gamma: f64,

    pub lambda: f64,

    pub obligatorias: u16,
}

#[derive(Debug, Clone, PartialEq)]
pub enum ErrorPerfil {
    Dimension(&'static str),

    ValorInvalido(&'static str),

    CorrelacionNoDefinida { mascara: u16 },

    PesosNulos { mascara: u16 },

    Algebra(ErrorAlgebra),
}

impl fmt::Display for ErrorPerfil {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Dimension(que) => write!(f, "dimensión incorrecta: {que}"),
            Self::ValorInvalido(que) => write!(f, "valor inválido: {que}"),
            Self::CorrelacionNoDefinida { mascara } => write!(
                f,
                "la correlación contraída de la máscara {mascara:#b} no es definida positiva"
            ),
            Self::PesosNulos { mascara } => {
                write!(f, "los pesos de la máscara {mascara:#b} suman cero")
            }
            Self::Algebra(e) => write!(f, "álgebra: {e}"),
        }
    }
}

impl core::error::Error for ErrorPerfil {}

impl From<ErrorAlgebra> for ErrorPerfil {
    fn from(e: ErrorAlgebra) -> Self {
        Self::Algebra(e)
    }
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Puntuacion {
    pub mascara: u16,

    pub d2: f64,

    pub s: f64,
}

#[derive(Debug, Clone)]
struct Sub {
    m: usize,

    idx: [usize; MAX_VARS],

    mx: Matriz,

    rs: Matriz,

    raiz_w: Vector,
}

#[derive(Debug, Clone)]
pub struct Perfil {
    k: usize,
    y: Vector,
    tau: Vector,
    s: Vector,
    gamma: f64,
    obligatorias: u16,

    subs: Vec<Option<Sub>>,
}

fn finito(x: f64, que: &'static str) -> Result<f64, ErrorPerfil> {
    if x.is_finite() {
        Ok(x)
    } else {
        Err(ErrorPerfil::ValorInvalido(que))
    }
}

fn construir_sub(
    mascara: u16,
    k: usize,
    r: &Matriz,
    lambda: f64,
    pesos: &[f64],
) -> Result<Sub, ErrorPerfil> {
    let mut idx = [0usize; MAX_VARS];
    let mut m = 0;
    for i in 0..k {
        if ((mascara >> i) & 1) == 1 {
            idx[m] = i;
            m += 1;
        }
    }
    let mut rs = [0.0; MAX_VARS * MAX_VARS];
    for a in 0..m {
        for b in 0..m {
            let identidad = if a == b { lambda } else { 0.0 };
            rs[pos(a, b)] = (1.0 - lambda) * r[pos(idx[a], idx[b])] + identidad;
        }
    }
    let inv =
        inversa_cholesky(&rs, m).map_err(|_| ErrorPerfil::CorrelacionNoDefinida { mascara })?;
    let suma_pesos: f64 = idx[..m].iter().map(|&i| pesos[i]).sum();
    if suma_pesos <= 0.0 {
        return Err(ErrorPerfil::PesosNulos { mascara });
    }
    let mut raiz_w = [0.0; MAX_VARS];
    for a in 0..m {
        raiz_w[a] = (pesos[idx[a]] / suma_pesos).sqrt();
    }
    let mut mx = [0.0; MAX_VARS * MAX_VARS];
    for a in 0..m {
        for b in 0..m {
            mx[pos(a, b)] = raiz_w[a] * raiz_w[b] * inv[pos(a, b)];
        }
    }
    Ok(Sub {
        m,
        idx,
        mx,
        rs,
        raiz_w,
    })
}

impl Perfil {
    pub fn nuevo(e: &Entrada<'_>) -> Result<Self, ErrorPerfil> {
        let k = e.objetivo.len();
        if k == 0 || k > MAX_VARS {
            return Err(ErrorPerfil::Dimension(
                "el número de variables debe estar entre 1 y MAX_VARS",
            ));
        }
        if e.tolerancia.len() != k || e.escala.len() != k {
            return Err(ErrorPerfil::Dimension(
                "tolerancia y escala deben tener una entrada por variable",
            ));
        }
        if e.correlacion.len() != k * k {
            return Err(ErrorPerfil::Dimension("la correlación debe ser k × k"));
        }
        if e.pesos.is_some_and(|p| p.len() != k) {
            return Err(ErrorPerfil::Dimension(
                "los pesos deben tener una entrada por variable",
            ));
        }
        if e.obligatorias >> k != 0 {
            return Err(ErrorPerfil::Dimension(
                "las obligatorias nombran variables que no existen",
            ));
        }
        let gamma = finito(e.gamma, "gamma")?;
        if gamma <= 0.0 {
            return Err(ErrorPerfil::ValorInvalido("gamma debe ser positivo"));
        }
        let lambda = finito(e.lambda, "lambda")?;
        if !(0.0..=1.0).contains(&lambda) {
            return Err(ErrorPerfil::ValorInvalido("lambda debe estar en [0, 1]"));
        }
        let mut y = [0.0; MAX_VARS];
        let mut tau = [0.0; MAX_VARS];
        let mut s = [1.0; MAX_VARS];
        for i in 0..k {
            y[i] = finito(e.objetivo[i], "objetivo")?;
            tau[i] = finito(e.tolerancia[i], "tolerancia")?;
            s[i] = finito(e.escala[i], "escala")?;
            if tau[i] < 0.0 {
                return Err(ErrorPerfil::ValorInvalido(
                    "la tolerancia no puede ser negativa",
                ));
            }
            if s[i] <= 0.0 {
                return Err(ErrorPerfil::ValorInvalido("la escala debe ser positiva"));
            }
        }
        let mut r = [0.0; MAX_VARS * MAX_VARS];
        for i in 0..k {
            for j in 0..k {
                r[pos(i, j)] = finito(e.correlacion[i * k + j], "correlacion")?;
            }
        }
        for i in 0..k {
            if (r[pos(i, i)] - 1.0).abs() > 1e-9 {
                return Err(ErrorPerfil::ValorInvalido(
                    "la diagonal de la correlación debe ser 1",
                ));
            }
            for j in 0..i {
                if (r[pos(i, j)] - r[pos(j, i)]).abs() > 1e-9 {
                    return Err(ErrorPerfil::ValorInvalido(
                        "la correlación debe ser simétrica",
                    ));
                }
            }
        }
        let pesos: Vec<f64> = match e.pesos {
            Some(p) => p.to_vec(),
            None => vec![1.0; k],
        };
        if pesos.iter().any(|p| !p.is_finite() || *p < 0.0) {
            return Err(ErrorPerfil::ValorInvalido(
                "los pesos deben ser finitos y no negativos",
            ));
        }
        let mut subs = Vec::with_capacity(1 << k);
        for mascara in 0..(1u32 << k) {
            let mascara = u16::try_from(mascara)
                .map_err(|_| ErrorPerfil::Dimension("máscara de más de 16 bits"))?;
            if mascara == 0 || (mascara & e.obligatorias) != e.obligatorias {
                subs.push(None);
            } else {
                subs.push(Some(construir_sub(mascara, k, &r, lambda, &pesos)?));
            }
        }
        Ok(Self {
            k,
            y,
            tau,
            s,
            gamma,
            obligatorias: e.obligatorias,
            subs,
        })
    }

    #[must_use]
    pub fn k(&self) -> usize {
        self.k
    }

    #[must_use]
    pub fn gamma(&self) -> f64 {
        self.gamma
    }

    #[must_use]
    pub fn obligatorias(&self) -> u16 {
        self.obligatorias
    }

    #[must_use]
    pub fn n_mascaras(&self) -> usize {
        self.subs.iter().flatten().count()
    }

    fn a_vector(&self, x: &[f64]) -> Result<Vector, ErrorPerfil> {
        if x.len() != self.k {
            return Err(ErrorPerfil::Dimension(
                "la celda debe traer una entrada por variable del perfil",
            ));
        }
        let mut v = [f64::NAN; MAX_VARS];
        v[..self.k].copy_from_slice(x);
        Ok(v)
    }

    fn a_vector_f32(&self, x: &[f32]) -> Result<Vector, ErrorPerfil> {
        if x.len() != self.k {
            return Err(ErrorPerfil::Dimension(
                "la celda debe traer una entrada por variable del perfil",
            ));
        }
        let mut v = [f64::NAN; MAX_VARS];
        for (d, o) in v.iter_mut().zip(x) {
            *d = f64::from(*o);
        }
        Ok(v)
    }

    fn mascara_de(&self, x: &Vector) -> u16 {
        let mut mascara = 0u16;
        for (i, v) in x.iter().take(self.k).enumerate() {
            if v.is_finite() {
                mascara |= 1 << i;
            }
        }
        mascara
    }

    /// Diferencia de cada variable presente, en unidades de su escala.
    ///
    /// Sin tolerancia es `z = (x - y) / s`. Con tolerancia se usa la coordenada pseudo-Huber
    /// `u = z / (1 + (z / t)^2)^(1/4)`, con `t = tau / s`: cerca del objetivo crece como `z`, lejos crece como
    /// `sqrt(t |z|)`, y nunca se anula salvo en `z = 0`. Así los términos cruzados de la correlación siguen
    /// contando dentro de la tolerancia y no hay mesetas de S = 1 (ADR-010).
    fn deltas(&self, sub: &Sub, x: &Vector, con_tolerancia: bool) -> Vector {
        let mut d = [0.0; MAX_VARS];
        for (j, &i) in sub.idx[..sub.m].iter().enumerate() {
            let z = (x[i] - self.y[i]) / self.s[i];
            let t = self.tau[i] / self.s[i];
            d[j] = if con_tolerancia && t > 0.0 {
                let r = z / t;
                z / (1.0 + r * r).sqrt().sqrt()
            } else {
                z
            };
        }
        d
    }

    fn evaluar(&self, x: &Vector, con_tolerancia: bool) -> Option<Puntuacion> {
        let mascara = self.mascara_de(x);
        let sub = self.subs.get(usize::from(mascara))?.as_ref()?;
        let d = self.deltas(sub, x, con_tolerancia);
        let mut d2 = 0.0;
        for (i, di) in d.iter().take(sub.m).enumerate() {
            let fila: f64 = d
                .iter()
                .take(sub.m)
                .enumerate()
                .map(|(j, dj)| sub.mx[pos(i, j)] * dj)
                .sum();
            d2 += di * fila;
        }
        if d2.is_nan() {
            return None;
        }
        let d2 = d2.max(0.0);
        Some(Puntuacion {
            mascara,
            d2,
            s: (-self.gamma * d2).exp(),
        })
    }

    pub fn puntuar_tolerante(&self, x: &[f32]) -> Result<Option<Puntuacion>, ErrorPerfil> {
        Ok(self.evaluar(&self.a_vector_f32(x)?, true))
    }

    pub fn puntuar_exacta(&self, x: &[f32]) -> Result<Option<Puntuacion>, ErrorPerfil> {
        Ok(self.evaluar(&self.a_vector_f32(x)?, false))
    }

    pub fn puntuar_tolerante_f64(&self, x: &[f64]) -> Result<Option<Puntuacion>, ErrorPerfil> {
        Ok(self.evaluar(&self.a_vector(x)?, true))
    }

    pub fn puntuar_exacta_f64(&self, x: &[f64]) -> Result<Option<Puntuacion>, ErrorPerfil> {
        Ok(self.evaluar(&self.a_vector(x)?, false))
    }

    pub fn notas_por_variable(&self, x: &[f64]) -> Result<Option<Vec<Option<f64>>>, ErrorPerfil> {
        let v = self.a_vector(x)?;
        let mascara = self.mascara_de(&v);
        let Some(Some(sub)) = self.subs.get(usize::from(mascara)) else {
            return Ok(None);
        };
        let d = self.deltas(sub, &v, true);
        let raiz = raiz_inversa(&sub.rs, sub.m)?;
        let mut notas = vec![None; self.k];
        for a in 0..sub.m {
            let mut zc = 0.0;
            for b in 0..sub.m {
                zc += raiz[pos(a, b)] * sub.raiz_w[b] * d[b];
            }
            notas[sub.idx[a]] = Some((-self.gamma * zc * zc).exp());
        }
        Ok(Some(notas))
    }

    pub fn coincide(&self, x: &[f64]) -> Result<Vec<Option<bool>>, ErrorPerfil> {
        let v = self.a_vector(x)?;
        Ok((0..self.k)
            .map(|i| {
                v[i].is_finite()
                    .then(|| (v[i] - self.y[i]).abs() <= self.tau[i])
            })
            .collect())
    }
}
