use nucleo::{Entrada, Perfil};
use pipeline::barrido::{
    barrer, barrer_escenarios, Compartido, Config, Escenario, ResultadoEscenario,
};

const N: usize = 20_000;

const NIVEL_REGION: u32 = 8;

const REQUERIDAS: [usize; 2] = [0, 1];

struct Tabla {
    cols: Vec<Vec<f32>>,
    ndvi: Vec<f32>,
    ipix: Vec<u32>,
}

fn tabla(semilla: u64) -> Tabla {
    let mut estado = semilla;
    let mut azar = move || {
        estado = estado
            .wrapping_mul(6_364_136_223_846_793_005)
            .wrapping_add(1_442_695_040_888_963_407);
        f32::from(u16::try_from(estado >> 48).unwrap_or(0)) / 65536.0
    };
    let mut t = Tabla {
        cols: vec![Vec::new(); 5],
        ndvi: Vec::new(),
        ipix: Vec::new(),
    };
    let mut ipix = 0u32;
    for _ in 0..N {
        ipix += 1 + 2 * u32::from(azar() < 0.5);
        t.ipix.push(ipix);
        t.ndvi.push(if azar() < 0.05 {
            f32::NAN
        } else {
            azar() * 0.6
        });
        for (c, col) in t.cols.iter_mut().enumerate() {
            let falta = azar() < if c < 2 { 0.02 } else { 0.08 };
            col.push(if falta {
                f32::NAN
            } else {
                10.0 + 4.0 * (azar() - 0.5)
            });
        }
    }
    t
}

type Caso = (&'static [usize], f64, Option<&'static [f64]>, f32);

const CASOS: [Caso; 4] = [
    (&[0, 1, 2, 3, 4], 1.2, None, 0.30),
    (&[0, 1, 3], 0.6, Some(&[1.0, 2.0, 1.0]), 0.30),
    (&[0, 1, 2, 4], 2.4, None, 0.45),
    (&[0, 1], 1.2, None, 0.15),
];

#[expect(
    clippy::expect_used,
    clippy::indexing_slicing,
    reason = "ayuda de pruebas con datos fijos"
)]
fn perfil((vars, tau, pesos, _): Caso) -> Perfil {
    let k = vars.len();
    let correlacion: Vec<f64> = (0..k * k)
        .map(|p| match (vars[p / k], vars[p % k]) {
            (a, b) if a == b => 1.0,
            (a, b) if a + b == 1 => 0.6,
            _ => 0.1,
        })
        .collect();
    Perfil::nuevo(&Entrada {
        objetivo: &vec![10.0; k],
        tolerancia: &vec![tau; k],
        escala: &vec![1.0; k],
        correlacion: &correlacion,
        pesos,
        gamma: 0.5,
        lambda: 0.1,
        obligatorias: (0..k)
            .filter(|&i| REQUERIDAS.contains(&vars[i]))
            .fold(0, |m, i| m | (1 << i)),
    })
    .expect("perfil")
}

fn escenarios(casos: &[Caso]) -> Vec<Escenario> {
    casos
        .iter()
        .map(|&c| Escenario {
            perfil: perfil(c),
            columnas: c.0.to_vec(),
            ndvi_max: c.3,
        })
        .collect()
}

fn compartido<'a>(
    t: &'a Tabla,
    columnas: &'a [&'a [f32]],
    candidatos: usize,
    filas_por_tarea: usize,
) -> Compartido<'a> {
    Compartido {
        columnas,
        requeridas: &REQUERIDAS,
        ndvi: &t.ndvi,
        ipix: &t.ipix,
        s_coincide: 0.9,
        nivel_region: NIVEL_REGION,
        nivel_celda: 12,
        candidatos,
        filas_por_tarea,
    }
}

#[test]
fn cada_escenario_da_lo_mismo_que_barrerlo_solo() {
    let t = tabla(7);
    let columnas: Vec<&[f32]> = t.cols.iter().map(Vec::as_slice).collect();
    let esc = escenarios(&CASOS);
    for (candidatos, filas_por_tarea) in [(25, 7), (25, 1000), (25, N), (10_000, 1000)] {
        let todos = barrer_escenarios(
            &compartido(&t, &columnas, candidatos, filas_por_tarea),
            &esc,
        )
        .expect("barrido");
        assert_eq!(todos.len(), CASOS.len());
        for (caso, r) in CASOS.iter().zip(&todos) {
            let p = perfil(*caso);
            let suyas: Vec<&[f32]> = caso.0.iter().map(|&c| columnas[c]).collect();
            let cfg = Config {
                perfil: &p,
                columnas: &suyas,
                ndvi: &t.ndvi,
                ipix: &t.ipix,
                ndvi_max: caso.3,
                s_coincide: 0.9,
                nivel_region: NIVEL_REGION,
                nivel_celda: 12,
            };
            cfg.validar().expect("config");
            let solo = barrer(&cfg).expect("barrer");
            assert!(
                solo.cuentas.coinciden > 0 && solo.por_region.len() > 100,
                "la tabla sintética no sirve"
            );
            assert_eq!(
                r.cuentas, solo.cuentas,
                "cuentas de {caso:?} con tareas de {filas_por_tarea}"
            );
            assert_eq!(
                usize::try_from(r.regiones).expect("regiones"),
                solo.por_region.len()
            );
            let esperadas = &solo.por_region[..candidatos.min(solo.por_region.len())];
            assert_eq!(
                r.mejores, esperadas,
                "mejores regiones de {caso:?} con tareas de {filas_por_tarea}"
            );
        }

        let uno = barrer_escenarios(
            &compartido(&t, &columnas, candidatos, filas_por_tarea),
            &esc[..1],
        )
        .expect("barrido");
        assert_eq!(uno[0], todos[0]);
    }
}

#[test]
fn el_resultado_no_depende_del_numero_de_hilos() {
    let t = tabla(11);
    let columnas: Vec<&[f32]> = t.cols.iter().map(Vec::as_slice).collect();
    let esc = escenarios(&CASOS);
    let con = |hilos: usize| -> Vec<ResultadoEscenario> {
        let pool = rayon::ThreadPoolBuilder::new()
            .num_threads(hilos)
            .build()
            .expect("pool");
        pool.install(|| barrer_escenarios(&compartido(&t, &columnas, 40, 500), &esc))
            .expect("barrido")
    };
    let uno = con(1);
    assert_eq!(uno, con(3));
    assert_eq!(uno, con(8));
}

#[test]
fn el_terreno_se_exige_aunque_el_escenario_no_lo_use() {
    let t = tabla(3);
    let columnas: Vec<&[f32]> = t.cols.iter().map(Vec::as_slice).collect();

    let caso: Caso = (&[0, 2, 3], 1.2, None, 0.30);
    let r = barrer_escenarios(&compartido(&t, &columnas, 10, 1000), &escenarios(&[caso]))
        .expect("barrido");
    let esperadas = (0..N)
        .filter(|&i| t.ndvi[i] <= 0.30 && REQUERIDAS.iter().all(|&c| t.cols[c][i].is_finite()))
        .count();
    assert_eq!(
        usize::try_from(r[0].cuentas.elegibles).expect("elegibles"),
        esperadas
    );
    assert!(t.cols[1].iter().any(|v| v.is_nan()));
}

#[test]
fn rechaza_un_ipix_desordenado_y_columnas_que_no_existen() {
    let mut t = tabla(5);
    let columnas: Vec<&[f32]> = t.cols.iter().map(Vec::as_slice).collect();
    let mut malo = escenarios(&CASOS[..1]);
    malo[0].columnas[4] = 9;
    assert!(barrer_escenarios(&compartido(&t, &columnas, 10, 1000), &malo).is_err());
    drop(columnas);
    t.ipix.swap(100, 101);
    let columnas: Vec<&[f32]> = t.cols.iter().map(Vec::as_slice).collect();
    let error = barrer_escenarios(&compartido(&t, &columnas, 10, 1000), &escenarios(&CASOS))
        .expect_err("desordenado");
    assert!(error.contains("ascendente"), "{error}");
}
