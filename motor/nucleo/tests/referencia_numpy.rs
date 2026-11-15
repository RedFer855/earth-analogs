//! Compara el núcleo con la referencia de numpy (`analisis/referencia_motor.py`) sobre filas sintéticas.
//!
//! La referencia implementa la fórmula de ADR-010 por separado, con álgebra de numpy. Si alguno de los dos cambia sin
//! el otro, esta prueba falla. Para regenerar la referencia, ver la cabecera de `referencia_numpy.txt`.

use nucleo::{Entrada, Perfil};

const REFERENCIA: &str = include_str!("referencia_numpy.txt");

#[expect(
    clippy::expect_used,
    reason = "ayuda de pruebas: un número mal escrito es un fallo de la prueba"
)]
fn numeros(texto: &str) -> Vec<f64> {
    texto
        .split_whitespace()
        .map(|t| t.parse::<f64>().expect("número"))
        .collect()
}

fn casi(a: f64, b: f64, tol: f64) -> bool {
    (a - b).abs() <= tol * (1.0 + a.abs().max(b.abs()))
}

#[test]
fn el_nucleo_coincide_con_numpy() {
    let mut claves = std::collections::BTreeMap::new();
    let mut filas = Vec::new();
    let mut n_oblig = 0u32;
    for linea in REFERENCIA
        .lines()
        .filter(|l| !l.starts_with('#') && !l.trim().is_empty())
    {
        let (clave, resto) = linea.split_once(' ').expect("clave y valores");
        if clave == "fila" {
            filas.push(resto);
        } else if clave == "obligatorias" {
            n_oblig = resto.trim().parse().expect("obligatorias");
        } else {
            claves.insert(clave, numeros(resto));
        }
    }
    assert!(filas.len() >= 5, "la referencia trae {} filas", filas.len());
    let objetivo = &claves["objetivo"];
    let k = objetivo.len();
    let perfil = Perfil::nuevo(&Entrada {
        objetivo,
        tolerancia: &claves["tolerancia"],
        escala: &claves["escala"],
        correlacion: &claves["correlacion"],
        pesos: None,
        gamma: claves["gamma"][0],
        lambda: claves["lambda"][0],
        obligatorias: u16::try_from((1u32 << n_oblig) - 1).expect("máscara"),
    })
    .expect("perfil");

    for (n, fila) in filas.iter().enumerate() {
        let partes: Vec<&str> = fila.split('|').collect();
        let x: Vec<f32> = partes[0]
            .split_whitespace()
            .map(|t| t.parse::<f32>().expect("f32"))
            .collect();
        let s = numeros(partes[1]);
        let notas: Vec<f64> = partes[2]
            .split_whitespace()
            .map(|t| t.parse().expect("nota"))
            .collect();
        assert_eq!((x.len(), notas.len()), (k, k));

        let tolerante = perfil.puntuar_tolerante(&x).unwrap().expect("puntuable");
        let exacta = perfil.puntuar_exacta(&x).unwrap().expect("puntuable");
        assert!(
            casi(tolerante.s, s[0], 1e-12),
            "fila {n}: S con tolerancia {} frente a numpy {}",
            tolerante.s,
            s[0]
        );
        assert!(
            casi(exacta.s, s[1], 1e-12),
            "fila {n}: S sin tolerancia {} frente a numpy {}",
            exacta.s,
            s[1]
        );

        let x64: Vec<f64> = x.iter().map(|v| f64::from(*v)).collect();
        let mias = perfil.notas_por_variable(&x64).unwrap().expect("puntuable");
        for (i, (mia, suya)) in mias.iter().zip(&notas).enumerate() {
            match mia {
                Some(m) => assert!(
                    casi(*m, *suya, 1e-12),
                    "fila {n}, variable {i}: nota {m} frente a numpy {suya}"
                ),
                None => assert!(
                    suya.is_nan(),
                    "fila {n}, variable {i}: el motor no da nota y numpy sí"
                ),
            }
        }
    }
}
