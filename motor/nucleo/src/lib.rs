//! Núcleo del motor de análogos: la fórmula de semejanza entre una celda de la Tierra y un sitio objetivo.
//!
//! Sin E/S ni dependencias: recibe números y devuelve números, para que se pueda probar contra una referencia
//! independiente (`analisis/referencia_motor.py`) y, más adelante, compilar a WebAssembly. La fórmula está en ADR-010.

#![forbid(unsafe_code)]

pub mod algebra;
pub mod perfil;

pub use algebra::{ErrorAlgebra, MAX_VARS};
pub use perfil::{a_f32, Entrada, ErrorPerfil, Perfil, Puntuacion};
