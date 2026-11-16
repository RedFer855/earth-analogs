//! Corre los datos de `datos_prueba` con el núcleo **nativo** y escribe la nota `S` y `D²` de cada celda como JSON.
//!
//! La prueba `visor/pruebas/wasm/paridad.mjs` hace lo mismo con el `.wasm` y compara: si los números coinciden dentro de
//! 1e-9, el artefacto que corre en el navegador es el mismo motor (ADR-003, regla 9).

use motor_wasm::datos_prueba as d;
use nucleo::perfil::{Entrada, Perfil};

fn main() {
    let entrada = Entrada {
        objetivo: &d::OBJETIVO,
        tolerancia: &d::TOLERANCIA,
        escala: &d::ESCALA,
        correlacion: &d::CORRELACION,
        pesos: Some(&d::PESOS),
        gamma: d::GAMMA,
        lambda: d::LAMBDA,
        obligatorias: u16::try_from(d::OBLIGATORIAS).unwrap_or(u16::MAX),
    };
    let perfil = match Perfil::nuevo(&entrada) {
        Ok(p) => p,
        Err(e) => {
            println!("{{\"error\":\"{e}\"}}");
            std::process::exit(1);
        }
    };
    let mut s = Vec::new();
    let mut d2 = Vec::new();
    let mut hechas = 0usize;
    for fila in d::CELDAS.iter() {
        match perfil.puntuar_tolerante(&fila[..d::K]) {
            Ok(Some(p)) => {
                s.push(format!("{:.17e}", p.s));
                d2.push(format!("{:.17e}", p.d2));
                hechas += 1;
            }
            _ => {
                s.push("null".to_string());
                d2.push("null".to_string());
            }
        }
    }
    println!(
        "{{\"k\":{},\"hechas\":{},\"s\":[{}],\"d2\":[{}]}}",
        d::K,
        hechas,
        s.join(","),
        d2.join(",")
    );
}
