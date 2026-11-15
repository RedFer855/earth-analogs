//! Álgebra en la pila para matrices de hasta `MAX_VARS` × `MAX_VARS`: Cholesky para invertir la correlación
//! contraída y Jacobi para su raíz inversa simétrica (la que reparte la distancia en notas por variable).

#![expect(
    clippy::indexing_slicing,
    reason = "matrices en la pila de MAX_VARS × MAX_VARS; cada función pública comprueba 1 <= m <= MAX_VARS antes de indexar"
)]

use core::fmt;

pub const MAX_VARS: usize = 12;

const TAM: usize = MAX_VARS * MAX_VARS;
const MAX_BARRIDOS: usize = 100;

pub type Matriz = [f64; TAM];

pub type Vector = [f64; MAX_VARS];

#[inline]
#[must_use]
pub const fn pos(i: usize, j: usize) -> usize {
    i * MAX_VARS + j
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ErrorAlgebra {
    Dimension,

    NoDefinidaPositiva,

    SinConvergencia,
}

impl fmt::Display for ErrorAlgebra {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Dimension => write!(f, "dimensión fuera de 1..={MAX_VARS}"),
            Self::NoDefinidaPositiva => write!(f, "la matriz no es definida positiva"),
            Self::SinConvergencia => write!(f, "Jacobi no convergió en {MAX_BARRIDOS} barridos"),
        }
    }
}

impl core::error::Error for ErrorAlgebra {}

fn comprobar(m: usize) -> Result<(), ErrorAlgebra> {
    if m == 0 || m > MAX_VARS {
        Err(ErrorAlgebra::Dimension)
    } else {
        Ok(())
    }
}

#[must_use]
pub fn identidad(m: usize) -> Matriz {
    let mut a = [0.0; TAM];
    for i in 0..m.min(MAX_VARS) {
        a[pos(i, i)] = 1.0;
    }
    a
}

pub fn inversa_cholesky(a: &Matriz, m: usize) -> Result<Matriz, ErrorAlgebra> {
    comprobar(m)?;
    let mut l = [0.0; TAM];
    for i in 0..m {
        for j in 0..=i {
            let mut suma = a[pos(i, j)];
            for k in 0..j {
                suma -= l[pos(i, k)] * l[pos(j, k)];
            }
            if i == j {
                if !suma.is_finite() || suma <= 0.0 {
                    return Err(ErrorAlgebra::NoDefinidaPositiva);
                }
                l[pos(i, i)] = suma.sqrt();
            } else {
                l[pos(i, j)] = suma / l[pos(j, j)];
            }
        }
    }

    let mut li = [0.0; TAM];
    for i in 0..m {
        li[pos(i, i)] = 1.0 / l[pos(i, i)];
        for j in 0..i {
            let mut suma = 0.0;
            for k in j..i {
                suma += l[pos(i, k)] * li[pos(k, j)];
            }
            li[pos(i, j)] = -suma / l[pos(i, i)];
        }
    }
    let mut inv = [0.0; TAM];
    for i in 0..m {
        for j in 0..=i {
            let mut suma = 0.0;
            for k in i..m {
                suma += li[pos(k, i)] * li[pos(k, j)];
            }
            inv[pos(i, j)] = suma;
            inv[pos(j, i)] = suma;
        }
    }
    Ok(inv)
}

pub fn eigh_jacobi(a: &Matriz, m: usize) -> Result<(Vector, Matriz), ErrorAlgebra> {
    comprobar(m)?;
    let mut s = *a;
    let mut u = identidad(m);
    let mut total = 0.0;
    for i in 0..m {
        for j in 0..m {
            total += s[pos(i, j)] * s[pos(i, j)];
        }
    }
    let mut convergio = false;
    for _ in 0..MAX_BARRIDOS {
        let mut fuera = 0.0;
        for p in 0..m {
            for q in (p + 1)..m {
                fuera += s[pos(p, q)] * s[pos(p, q)];
            }
        }
        if fuera <= 1e-32 * total {
            convergio = true;
            break;
        }
        for p in 0..m {
            for q in (p + 1)..m {
                let apq = s[pos(p, q)];
                if apq == 0.0 {
                    continue;
                }
                let theta = (s[pos(q, q)] - s[pos(p, p)]) / (2.0 * apq);
                let t = 1.0f64.copysign(theta) / (theta.abs() + theta.hypot(1.0));
                let c = 1.0 / t.hypot(1.0);
                let sn = t * c;

                for r in 0..m {
                    let (arp, arq) = (s[pos(r, p)], s[pos(r, q)]);
                    s[pos(r, p)] = c * arp - sn * arq;
                    s[pos(r, q)] = sn * arp + c * arq;
                }
                for r in 0..m {
                    let (apr, aqr) = (s[pos(p, r)], s[pos(q, r)]);
                    s[pos(p, r)] = c * apr - sn * aqr;
                    s[pos(q, r)] = sn * apr + c * aqr;
                }
                s[pos(p, q)] = 0.0;
                s[pos(q, p)] = 0.0;
                for r in 0..m {
                    let (urp, urq) = (u[pos(r, p)], u[pos(r, q)]);
                    u[pos(r, p)] = c * urp - sn * urq;
                    u[pos(r, q)] = sn * urp + c * urq;
                }
            }
        }
    }
    if !convergio {
        return Err(ErrorAlgebra::SinConvergencia);
    }
    let mut w = [0.0; MAX_VARS];
    for i in 0..m {
        w[i] = s[pos(i, i)];
    }
    Ok((w, u))
}

pub fn raiz_inversa(a: &Matriz, m: usize) -> Result<Matriz, ErrorAlgebra> {
    let (w, u) = eigh_jacobi(a, m)?;
    let mut factor = [0.0; MAX_VARS];
    for k in 0..m {
        if !w[k].is_finite() || w[k] <= 0.0 {
            return Err(ErrorAlgebra::NoDefinidaPositiva);
        }
        factor[k] = 1.0 / w[k].sqrt();
    }
    let mut r = [0.0; TAM];
    for i in 0..m {
        for j in 0..=i {
            let mut suma = 0.0;
            for k in 0..m {
                suma += u[pos(i, k)] * factor[k] * u[pos(j, k)];
            }
            r[pos(i, j)] = suma;
            r[pos(j, i)] = suma;
        }
    }
    Ok(r)
}
