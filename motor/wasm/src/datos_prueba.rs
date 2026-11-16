//! Datos de la prueba de paridad nativo ↔ wasm: un perfil de tres variables y cuatro celdas.
//!
//! Los mismos números están en `visor/pruebas/wasm/paridad.mjs`; si cambian aquí, cambian allá.

use nucleo::algebra::MAX_VARS;

/// Número de variables del perfil de prueba.
pub const K: usize = 3;

/// Valores objetivo de las tres variables.
pub const OBJETIVO: [f64; K] = [2.0, 15.0, 0.30];

/// Tolerancia por variable, en las mismas unidades que el objetivo.
pub const TOLERANCIA: [f64; K] = [0.5, 3.0, 0.05];

/// Escala natural de cada variable en la Tierra.
pub const ESCALA: [f64; K] = [1.0, 1.0, 1.0];

/// Correlación 3 × 3 por filas, con 0.3 fuera de la diagonal.
pub const CORRELACION: [f64; K * K] = [1.0, 0.3, 0.3, 0.3, 1.0, 0.3, 0.3, 0.3, 1.0];

/// Pesos por variable (no iguales, a propósito: el oráculo usa pesos iguales).
pub const PESOS: [f64; K] = [1.0, 2.0, 1.0];

/// `gamma` de `S = exp(-gamma · D²)`.
pub const GAMMA: f64 = 0.8;

/// Contracción de la correlación hacia la identidad.
pub const LAMBDA: f64 = 0.1;

/// Máscara de variables obligatorias: la 0 y la 2.
pub const OBLIGATORIAS: u32 = 0b101;

/// Cuatro celdas de `MAX_VARS` valores `f32`, con `NaN` en las ausentes.
///
/// La tercera pierde la variable obligatoria 0 (no se puntúa); la cuarta pierde la 1 (sí se puntúa, con dos variables).
pub const CELDAS: [[f32; MAX_VARS]; 4] = [
    [
        2.1,
        14.8,
        0.31,
        f32::NAN,
        f32::NAN,
        f32::NAN,
        f32::NAN,
        f32::NAN,
        f32::NAN,
        f32::NAN,
        f32::NAN,
        f32::NAN,
    ],
    [
        2.4,
        18.0,
        0.22,
        f32::NAN,
        f32::NAN,
        f32::NAN,
        f32::NAN,
        f32::NAN,
        f32::NAN,
        f32::NAN,
        f32::NAN,
        f32::NAN,
    ],
    [
        f32::NAN,
        15.0,
        0.30,
        f32::NAN,
        f32::NAN,
        f32::NAN,
        f32::NAN,
        f32::NAN,
        f32::NAN,
        f32::NAN,
        f32::NAN,
        f32::NAN,
    ],
    [
        2.0,
        f32::NAN,
        0.30,
        f32::NAN,
        f32::NAN,
        f32::NAN,
        f32::NAN,
        f32::NAN,
        f32::NAN,
        f32::NAN,
        f32::NAN,
        f32::NAN,
    ],
];
