mod comun;

use comun::{correlacion_aleatoria, equicorrelada, Azar};
use nalgebra::{DMatrix, SymmetricEigen};
use nucleo::algebra::{
    eigh_jacobi, inversa_cholesky, pos, raiz_inversa, ErrorAlgebra, Matriz, MAX_VARS,
};

#[expect(
    clippy::indexing_slicing,
    reason = "ayuda de pruebas: un índice fuera de rango es un fallo de la prueba"
)]
fn a_matriz(a: &[f64], m: usize) -> Matriz {
    let mut r = [0.0; MAX_VARS * MAX_VARS];
    for i in 0..m {
        for j in 0..m {
            r[pos(i, j)] = a[i * m + j];
        }
    }
    r
}

#[expect(
    clippy::indexing_slicing,
    reason = "ayuda de pruebas: un índice fuera de rango es un fallo de la prueba"
)]
fn maxdif(a: &Matriz, b: &DMatrix<f64>, m: usize) -> f64 {
    let mut d: f64 = 0.0;
    for i in 0..m {
        for j in 0..m {
            d = d.max((a[pos(i, j)] - b[(i, j)]).abs());
        }
    }
    d
}

#[expect(
    clippy::indexing_slicing,
    reason = "ayuda de pruebas: un índice fuera de rango es un fallo de la prueba"
)]
fn contraer(r: &[f64], m: usize, lambda: f64) -> Vec<f64> {
    (0..m * m)
        .map(|p| (1.0 - lambda) * r[p] + if p / m == p % m { lambda } else { 0.0 })
        .collect()
}

#[test]
fn inversa_y_autovalores_coinciden_con_nalgebra() {
    let mut azar = Azar::new(7);
    for caso in 0..300 {
        let m = 1 + caso % MAX_VARS;
        let fuerza = azar.rango(0.0, 2.0);
        let r = contraer(&correlacion_aleatoria(&mut azar, m, fuerza), m, 0.1);
        let a = a_matriz(&r, m);
        let na = DMatrix::from_row_slice(m, m, &r);

        let inv = inversa_cholesky(&a, m).expect("definida positiva");
        let inv_na = na.clone().try_inverse().expect("invertible");
        assert!(
            maxdif(&inv, &inv_na, m) < 1e-10,
            "inversa, caso {caso}, m = {m}"
        );

        let (w, u) = eigh_jacobi(&a, m).expect("converge");
        let mut propios: Vec<f64> = w[..m].to_vec();
        propios.sort_by(f64::total_cmp);
        let mut propios_na: Vec<f64> = SymmetricEigen::new(na.clone())
            .eigenvalues
            .iter()
            .copied()
            .collect();
        propios_na.sort_by(f64::total_cmp);
        for (x, y) in propios.iter().zip(&propios_na) {
            assert!(
                (x - y).abs() < 1e-10,
                "autovalores, caso {caso}, m = {m}: {x} frente a {y}"
            );
        }

        let mut rec = [0.0; MAX_VARS * MAX_VARS];
        let mut ortogonal: f64 = 0.0;
        for i in 0..m {
            for j in 0..m {
                rec[pos(i, j)] = (0..m).map(|k| u[pos(i, k)] * w[k] * u[pos(j, k)]).sum();
                let utu: f64 = (0..m).map(|k| u[pos(k, i)] * u[pos(k, j)]).sum();
                ortogonal = ortogonal.max((utu - if i == j { 1.0 } else { 0.0 }).abs());
            }
        }
        assert!(maxdif(&rec, &na, m) < 1e-10, "descomposicion, caso {caso}");
        assert!(ortogonal < 1e-12, "ortogonalidad, caso {caso}");
    }
}

#[test]
fn la_raiz_inversa_es_simetrica_y_su_cuadrado_es_la_inversa() {
    let mut azar = Azar::new(11);
    for caso in 0..200 {
        let m = 1 + azar.entero(MAX_VARS);
        let fuerza = azar.rango(0.0, 2.0);
        let r = contraer(&correlacion_aleatoria(&mut azar, m, fuerza), m, 0.1);
        let a = a_matriz(&r, m);
        let raiz = raiz_inversa(&a, m).expect("definida positiva");
        let inv = inversa_cholesky(&a, m).expect("definida positiva");
        for i in 0..m {
            for j in 0..m {
                assert!(
                    (raiz[pos(i, j)] - raiz[pos(j, i)]).abs() < 1e-12,
                    "simetría"
                );
                let cuadrado: f64 = (0..m).map(|k| raiz[pos(i, k)] * raiz[pos(k, j)]).sum();
                assert!(
                    (cuadrado - inv[pos(i, j)]).abs() < 1e-9,
                    "caso {caso}: R^(-1/2)² ≠ R⁻¹"
                );
            }
        }
    }
}

#[test]
fn equicorrelada_con_colinealidad_alta_da_los_autovalores_analiticos() {
    let m = 12;
    let r = contraer(&equicorrelada(m, 0.999), m, 0.1);
    let a = a_matriz(&r, m);
    let (w, _) = eigh_jacobi(&a, m).expect("converge");
    let mut propios = w[..m].to_vec();
    propios.sort_by(f64::total_cmp);
    let grande = 0.1 + 0.9 * (1.0 + 11.0 * 0.999);
    let pequeno = 0.1 + 0.9 * (1.0 - 0.999);
    assert!(
        (propios[m - 1] - grande).abs() < 1e-12,
        "mayor: {} frente a {grande}",
        propios[m - 1]
    );
    for p in &propios[..m - 1] {
        assert!((p - pequeno).abs() < 1e-12, "menor: {p} frente a {pequeno}");
    }
    assert!((grande / pequeno - 107.93).abs() < 0.01);
}

#[test]
fn rechaza_lo_que_no_es_definida_positiva_y_las_dimensiones_malas() {
    let a = a_matriz(&[1.0, 2.0, 2.0, 1.0], 2);
    assert_eq!(
        inversa_cholesky(&a, 2),
        Err(ErrorAlgebra::NoDefinidaPositiva)
    );
    assert_eq!(raiz_inversa(&a, 2), Err(ErrorAlgebra::NoDefinidaPositiva));
    let i = a_matriz(&[1.0], 1);
    assert_eq!(inversa_cholesky(&i, 0), Err(ErrorAlgebra::Dimension));
    assert_eq!(
        eigh_jacobi(&i, MAX_VARS + 1).map(|_| ()),
        Err(ErrorAlgebra::Dimension)
    );
}
