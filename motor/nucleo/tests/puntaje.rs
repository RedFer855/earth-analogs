mod comun;

use comun::{correlacion_aleatoria, Azar};
use nucleo::{a_f32, Entrada, ErrorPerfil, Perfil};
use proptest::prelude::*;

const GAMMA: f64 = 0.5;

#[expect(
    clippy::expect_used,
    reason = "ayuda de pruebas: un perfil inválido es un fallo de la prueba"
)]
fn perfil(y: &[f64], tau: &[f64], s: &[f64], r: &[f64], lambda: f64, obligatorias: u16) -> Perfil {
    Perfil::nuevo(&Entrada {
        objetivo: y,
        tolerancia: tau,
        escala: s,
        correlacion: r,
        pesos: None,
        gamma: GAMMA,
        lambda,
        obligatorias,
    })
    .expect("perfil válido")
}

fn identidad(k: usize) -> Vec<f64> {
    (0..k * k)
        .map(|p| if p / k == p % k { 1.0 } else { 0.0 })
        .collect()
}

fn casi(a: f64, b: f64, tol: f64) -> bool {
    (a - b).abs() <= tol * (1.0 + a.abs().max(b.abs()))
}

#[test]
fn s_vale_uno_en_el_objetivo() {
    let y = [2.5, 0.75, 10.0, 40.0];
    let x = [2.5_f32, 0.75, 10.0, 40.0];
    let mut azar = Azar::new(1);
    let r = correlacion_aleatoria(&mut azar, 4, 1.0);
    let p = perfil(
        &y,
        &[1.0, 0.25, 3.0, 5.0],
        &[0.8, 0.4, 4.0, 3.0],
        &r,
        0.1,
        0b1111,
    );
    let exacta = p.puntuar_exacta(&x).unwrap().expect("celda completa");
    let tolerante = p.puntuar_tolerante(&x).unwrap().expect("celda completa");
    assert!(
        (exacta.s - 1.0).abs() < 1e-15 && exacta.d2.abs() < 1e-15,
        "S exacta = {}",
        exacta.s
    );
    assert!((tolerante.s - 1.0).abs() < 1e-15);
}

#[test]
fn la_tolerancia_atenua_sin_anular_y_no_hay_meseta() {
    let y = [2.0, 1.0];
    let p = perfil(&y, &[1.0, 0.5], &[0.8, 0.4], &identidad(2), 0.1, 0b11);
    let x = [2.9_f32, 0.6];
    let tolerante = p.puntuar_tolerante(&x).unwrap().unwrap();
    let exacta = p.puntuar_exacta(&x).unwrap().unwrap();
    assert!(exacta.s < 0.9);
    assert!(
        tolerante.s > exacta.s && tolerante.s < 1.0,
        "S tolerante = {}",
        tolerante.s
    );
    // dos celdas dentro de la tolerancia ya no empatan: la más cercana puntúa más
    let cerca = p.puntuar_tolerante(&[2.3_f32, 0.9]).unwrap().unwrap();
    assert!(cerca.s > tolerante.s);
    // pseudo-Huber de una variable: u = z / (1 + (z/t)^2)^(1/4)
    let uno = perfil(&[0.0], &[1.0], &[1.0], &[1.0], 0.0, 0b1);
    let u: f64 = 3.0 / (1.0_f64 + 9.0).powf(0.25);
    let s = uno.puntuar_tolerante(&[3.0_f32]).unwrap().unwrap().s;
    assert!(casi(s, (-GAMMA * u * u).exp(), 1e-12), "S = {s}");
    assert_eq!(
        p.coincide(&[2.9, 0.6]).unwrap(),
        vec![Some(true), Some(true)]
    );
    assert_eq!(
        p.coincide(&[3.2, f64::NAN]).unwrap(),
        vec![Some(false), None]
    );
}

#[test]
fn con_tolerancia_cero_la_formula_es_la_de_adr_006() {
    let mut azar = Azar::new(3);
    for _ in 0..200 {
        let k = 1 + azar.entero(6);
        let y: Vec<f64> = (0..k).map(|_| azar.rango(-5.0, 5.0)).collect();
        let s: Vec<f64> = (0..k).map(|_| azar.rango(0.1, 3.0)).collect();
        let r = correlacion_aleatoria(&mut azar, k, 1.0);
        let p = perfil(&y, &vec![0.0; k], &s, &r, 0.1, (1 << k) - 1);
        let x: Vec<f32> = (0..k).map(|_| a_f32(azar.rango(-8.0, 8.0))).collect();
        let a = p.puntuar_tolerante(&x).unwrap().unwrap();
        let b = p.puntuar_exacta(&x).unwrap().unwrap();
        assert!(casi(a.s, b.s, 1e-14) && casi(a.d2, b.d2, 1e-14));
    }
}

#[test]
fn sin_correlacion_es_la_euclidiana_ponderada() {
    let y = [1.0, -2.0, 0.5];
    let s = [0.5, 2.0, 1.0];
    let p = perfil(&y, &[0.0; 3], &s, &identidad(3), 0.37, 0b111);
    let x = [1.5_f32, -1.0, 2.5];
    let d2 = ((0.5_f64 / 0.5).powi(2) + (1.0_f64 / 2.0).powi(2) + (2.0_f64 / 1.0).powi(2)) / 3.0;
    let r = p.puntuar_exacta(&x).unwrap().unwrap();
    assert!(casi(r.d2, d2, 1e-14), "D² = {} frente a {d2}", r.d2);
    assert!(casi(r.s, (-GAMMA * d2).exp(), 1e-14));
}

#[test]
fn s_no_depende_del_orden_de_las_variables() {
    let mut azar = Azar::new(5);
    for caso in 0..300 {
        let k = 2 + azar.entero(7);
        let y: Vec<f64> = (0..k).map(|_| azar.rango(-5.0, 5.0)).collect();
        let tau: Vec<f64> = (0..k).map(|_| azar.rango(0.0, 1.0)).collect();
        let s: Vec<f64> = (0..k).map(|_| azar.rango(0.2, 3.0)).collect();
        let r = correlacion_aleatoria(&mut azar, k, 1.5);
        let x: Vec<f64> = (0..k).map(|_| azar.rango(-8.0, 8.0)).collect();

        let mut orden: Vec<usize> = (0..k).collect();
        for i in (1..k).rev() {
            orden.swap(i, azar.entero(i + 1));
        }
        let y2: Vec<f64> = orden.iter().map(|&i| y[i]).collect();
        let tau2: Vec<f64> = orden.iter().map(|&i| tau[i]).collect();
        let s2: Vec<f64> = orden.iter().map(|&i| s[i]).collect();
        let x2: Vec<f64> = orden.iter().map(|&i| x[i]).collect();
        let r2: Vec<f64> = (0..k * k)
            .map(|p| r[orden[p / k] * k + orden[p % k]])
            .collect();
        let todas = (1u16 << k) - 1;
        let a = perfil(&y, &tau, &s, &r, 0.1, todas)
            .puntuar_tolerante_f64(&x)
            .unwrap()
            .unwrap();
        let b = perfil(&y2, &tau2, &s2, &r2, 0.1, todas)
            .puntuar_tolerante_f64(&x2)
            .unwrap()
            .unwrap();
        assert!(
            casi(a.s, b.s, 1e-10) && casi(a.d2, b.d2, 1e-10),
            "caso {caso}: {} frente a {}",
            a.s,
            b.s
        );
    }
}

#[test]
fn el_producto_de_las_notas_por_variable_es_s() {
    let mut azar = Azar::new(9);
    for caso in 0..300 {
        let k = 1 + azar.entero(8);
        let y: Vec<f64> = (0..k).map(|_| azar.rango(-5.0, 5.0)).collect();
        let tau: Vec<f64> = (0..k).map(|_| azar.rango(0.0, 1.5)).collect();
        let s: Vec<f64> = (0..k).map(|_| azar.rango(0.5, 3.0)).collect();
        let r = correlacion_aleatoria(&mut azar, k, 1.5);
        let obligatorias = 1u16;
        let p = perfil(&y, &tau, &s, &r, 0.1, obligatorias);

        let x: Vec<f64> = (0..k)
            .map(|i| {
                if i > 0 && azar.unif() < 0.3 {
                    f64::NAN
                } else {
                    y[i] + azar.rango(-4.0, 4.0)
                }
            })
            .collect();
        let s_tol = p.puntuar_tolerante_f64(&x).unwrap().unwrap().s;
        let notas = p.notas_por_variable(&x).unwrap().unwrap();
        let producto: f64 = notas.iter().flatten().product();
        assert!(
            casi(producto, s_tol, 1e-9),
            "caso {caso}: Π notas = {producto}, S = {s_tol}"
        );
        for (n, v) in notas.iter().zip(&x) {
            assert_eq!(
                n.is_some(),
                v.is_finite(),
                "una nota por cada variable con dato y ninguna sin dato"
            );
        }
    }
}

#[test]
fn un_faltante_equivale_al_perfil_sin_esa_variable() {
    let mut azar = Azar::new(13);
    for caso in 0..200 {
        let k = 3 + azar.entero(5);
        let y: Vec<f64> = (0..k).map(|_| azar.rango(-5.0, 5.0)).collect();
        let tau: Vec<f64> = (0..k).map(|_| azar.rango(0.0, 1.0)).collect();
        let s: Vec<f64> = (0..k).map(|_| azar.rango(0.5, 3.0)).collect();
        let r = correlacion_aleatoria(&mut azar, k, 1.5);
        let x: Vec<f64> = (0..k).map(|i| y[i] + azar.rango(-3.0, 3.0)).collect();
        let falta = 1 + azar.entero(k - 1);
        let completo = perfil(&y, &tau, &s, &r, 0.1, 1);
        let mut con_hueco = x.clone();
        con_hueco[falta] = f64::NAN;
        let a = completo.puntuar_tolerante_f64(&con_hueco).unwrap().unwrap();

        let q: Vec<usize> = (0..k).filter(|&i| i != falta).collect();
        let n = q.len();
        let r_sub: Vec<f64> = (0..n * n).map(|p| r[q[p / n] * k + q[p % n]]).collect();
        let sin: Vec<f64> = q.iter().map(|&i| y[i]).collect();
        let sin_tau: Vec<f64> = q.iter().map(|&i| tau[i]).collect();
        let sin_s: Vec<f64> = q.iter().map(|&i| s[i]).collect();
        let sin_x: Vec<f64> = q.iter().map(|&i| x[i]).collect();
        let b = perfil(&sin, &sin_tau, &sin_s, &r_sub, 0.1, 1)
            .puntuar_tolerante_f64(&sin_x)
            .unwrap()
            .unwrap();
        assert!(
            casi(a.s, b.s, 1e-12) && casi(a.d2, b.d2, 1e-12),
            "caso {caso}: {} frente a {}",
            a.s,
            b.s
        );
        assert_eq!(usize::try_from(a.mascara.count_ones()).unwrap(), n);
    }
}

#[test]
fn faltar_una_obligatoria_no_se_puntua() {
    let p = perfil(
        &[1.0, 2.0, 3.0],
        &[0.0; 3],
        &[1.0; 3],
        &identidad(3),
        0.1,
        0b011,
    );
    assert!(p
        .puntuar_tolerante(&[1.0, f32::NAN, 3.0])
        .unwrap()
        .is_none());
    assert!(p
        .puntuar_tolerante(&[f32::NAN, 2.0, 3.0])
        .unwrap()
        .is_none());
    assert!(p
        .puntuar_tolerante(&[1.0, 2.0, f32::NAN])
        .unwrap()
        .is_some());
    assert_eq!(p.n_mascaras(), 2);
    assert_eq!(
        p.puntuar_tolerante(&[1.0, 2.0]).unwrap_err(),
        ErrorPerfil::Dimension("la celda debe traer una entrada por variable del perfil")
    );
}

#[test]
fn los_pesos_se_reparten_entre_las_presentes() {
    let p = Perfil::nuevo(&Entrada {
        objetivo: &[0.0, 0.0],
        tolerancia: &[0.0, 0.0],
        escala: &[1.0, 1.0],
        correlacion: &identidad(2),
        pesos: Some(&[3.0, 1.0]),
        gamma: GAMMA,
        lambda: 0.1,
        obligatorias: 0b01,
    })
    .unwrap();
    let r = p.puntuar_exacta_f64(&[2.0, 4.0]).unwrap().unwrap();
    assert!(casi(r.d2, 0.75 * 4.0 + 0.25 * 16.0, 1e-14));

    let r = p.puntuar_exacta_f64(&[2.0, f64::NAN]).unwrap().unwrap();
    assert!(casi(r.d2, 4.0, 1e-14));
}

#[test]
fn la_nota_no_sube_al_crecer_una_diferencia_solo_sin_correlacion() {
    let y = [0.0, 0.0];
    let sin = perfil(&y, &[0.0; 2], &[1.0; 2], &identidad(2), 0.0, 0b11);
    let mut anterior = f64::INFINITY;
    for paso in 0..50 {
        let x = [1.0_f32, a_f32(f64::from(paso) * 0.1)];
        let s = sin.puntuar_exacta(&x).unwrap().unwrap().s;
        assert!(s <= anterior + 1e-15, "R = I: S subió de {anterior} a {s}");
        anterior = s;
    }
    let r = [1.0, 0.9, 0.9, 1.0];
    let con = perfil(&y, &[0.0; 2], &[1.0; 2], &r, 0.0, 0b11);
    let s0 = con.puntuar_exacta(&[1.0, 0.0]).unwrap().unwrap().s;
    let s1 = con.puntuar_exacta(&[1.0, 0.9]).unwrap().unwrap().s;
    assert!(
        s1 > s0,
        "con r = 0,9, alejar la segunda variable acerca la celda: {s0} → {s1}"
    );
}

#[test]
fn con_una_variable_la_tolerancia_nunca_empeora_la_nota() {
    let mut azar = Azar::new(17);
    for _ in 0..200 {
        let p = perfil(
            &[azar.rango(-3.0, 3.0)],
            &[azar.rango(0.0, 2.0)],
            &[azar.rango(0.2, 2.0)],
            &[1.0],
            0.1,
            1,
        );
        let x = [a_f32(azar.rango(-9.0, 9.0))];
        let t = p.puntuar_tolerante(&x).unwrap().unwrap();
        let e = p.puntuar_exacta(&x).unwrap().unwrap();
        assert!(t.d2 <= e.d2 + 1e-15 && t.s >= e.s - 1e-15);
    }
}

#[test]
fn entradas_invalidas_se_rechazan() {
    let ok = |y: &[f64], tau: &[f64], s: &[f64], r: &[f64], lambda: f64| {
        Perfil::nuevo(&Entrada {
            objetivo: y,
            tolerancia: tau,
            escala: s,
            correlacion: r,
            pesos: None,
            gamma: GAMMA,
            lambda,
            obligatorias: 1,
        })
    };
    assert!(ok(&[0.0], &[0.0], &[1.0], &[1.0], 0.1).is_ok());
    assert!(matches!(
        ok(&[], &[], &[], &[], 0.1),
        Err(ErrorPerfil::Dimension(_))
    ));
    assert!(matches!(
        ok(&[0.0], &[-1.0], &[1.0], &[1.0], 0.1),
        Err(ErrorPerfil::ValorInvalido(_))
    ));
    assert!(matches!(
        ok(&[0.0], &[0.0], &[0.0], &[1.0], 0.1),
        Err(ErrorPerfil::ValorInvalido(_))
    ));
    assert!(matches!(
        ok(&[f64::NAN], &[0.0], &[1.0], &[1.0], 0.1),
        Err(ErrorPerfil::ValorInvalido(_))
    ));
    assert!(
        matches!(
            ok(
                &[0.0, 0.0],
                &[0.0; 2],
                &[1.0; 2],
                &[1.0, 0.5, 0.4, 1.0],
                0.1
            ),
            Err(ErrorPerfil::ValorInvalido(_))
        ),
        "asimétrica"
    );
    assert!(matches!(
        ok(&[0.0], &[0.0], &[1.0], &[1.0], 1.5),
        Err(ErrorPerfil::ValorInvalido(_))
    ));

    assert!(matches!(
        ok(
            &[0.0, 0.0],
            &[0.0; 2],
            &[1.0; 2],
            &[1.0, 2.0, 2.0, 1.0],
            0.0
        ),
        Err(ErrorPerfil::CorrelacionNoDefinida { .. })
    ));

    assert!(matches!(
        ok(
            &[0.0, 0.0],
            &[0.0; 2],
            &[1.0; 2],
            &[1.0, 2.0, 2.0, 1.0],
            0.1
        ),
        Err(ErrorPerfil::CorrelacionNoDefinida { .. })
    ));
}

proptest! {

    #[test]
    fn s_esta_entre_0_y_1_para_cualquier_celda(
        semilla in any::<u64>(),
        k in 1usize..=8,
        x in prop::collection::vec(-1.0e6f32..1.0e6, 8),
        faltan in prop::collection::vec(any::<bool>(), 8),
        y in prop::collection::vec(-1.0e3f64..1.0e3, 8),
        tau in prop::collection::vec(0.0f64..50.0, 8),
        s in prop::collection::vec(1.0e-3f64..1.0e3, 8),
    ) {
        let mut azar = Azar::new(semilla);
        let r = correlacion_aleatoria(&mut azar, k, 2.0);
        let p = perfil(&y[..k], &tau[..k], &s[..k], &r, 0.1, 1);
        let celda: Vec<f32> = (0..k).map(|i| if i > 0 && faltan[i] { f32::NAN } else { x[i] }).collect();
        for resultado in [p.puntuar_tolerante(&celda).unwrap(), p.puntuar_exacta(&celda).unwrap()] {
            let r = resultado.expect("la variable obligatoria está presente");
            prop_assert!(r.s.is_finite() && (0.0..=1.0).contains(&r.s), "S = {}", r.s);
            prop_assert!(r.d2.is_finite() && r.d2 >= 0.0);
        }
    }

    #[test]
    fn infinitos_y_colinealidad_extrema_no_rompen_el_puntaje(
        x in prop::collection::vec(prop_oneof![Just(f32::NAN), Just(f32::INFINITY), Just(f32::NEG_INFINITY), Just(-0.0f32), Just(1.0e-40f32), -1.0e30f32..1.0e30], 4),
    ) {
        let r = comun::equicorrelada(4, 0.999);
        let p = perfil(&[0.0; 4], &[0.0; 4], &[1.0; 4], &r, 0.1, 0);
        if let Some(r) = p.puntuar_tolerante(&x).unwrap() {
            prop_assert!(r.s.is_finite() && (0.0..=1.0).contains(&r.s));
            prop_assert_eq!(usize::try_from(r.mascara.count_ones()).unwrap(), x.iter().filter(|v| v.is_finite()).count());
        } else {
            prop_assert!(x.iter().all(|v| !v.is_finite()), "solo es None si no hay ninguna variable con dato");
        }
    }
}
