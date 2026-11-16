//! Puente WebAssembly del núcleo de puntaje ([ADR-003](../../../contexto/45-decisiones/ADR-003-motor-en-rust-y-webassembly.md)).
//!
//! Este crate no calcula nada propio: envuelve `nucleo::perfil::Perfil` en una ABI `extern "C"` que JavaScript puede
//! llamar sin `wasm-bindgen` (menos piezas, y el `.wasm` se instancia con `WebAssembly.instantiateStreaming`).
//!
//! Contrato con JavaScript, en orden de uso:
//!
//! 1. `reservar(bytes)` devuelve un puntero a memoria lineal de Wasm; ahí se escriben los arreglos `Float64Array`
//!    (objetivo, tolerancia, escala, correlación k×k, pesos) y las celdas como `Float32Array`.
//! 2. `perfil_crear(...)` devuelve un puntero opaco al perfil, o 0 si los datos no son válidos.
//! 3. `perfil_puntuar_lote(...)` escribe `S` y `D²` de cada celda y devuelve cuántas se puntuaron.
//! 4. `perfil_libre(...)`, `liberar(...)`.
//!
//! Una celda es una fila de `MAX_VARS` (12) valores `f32`; las variables ausentes van como `NaN`. Ninguna función hace
//! `panic!`: en `wasm32-unknown-unknown` un pánico es `unreachable` y envenena el módulo, así que todo error se
//! devuelve como código (0 o un contador menor al pedido).

#![deny(unsafe_op_in_unsafe_fn)]
#![warn(missing_docs)]

use core::ptr;
use core::slice;

use nucleo::algebra::MAX_VARS;
use nucleo::perfil::{Entrada, Perfil};

pub mod datos_prueba;

/// Perfil opaco para JavaScript: un puntero a esta caja es todo lo que cruza la frontera.
pub struct CajaPerfil {
    perfil: Perfil,
}

/// Copia `n` valores desde un puntero de JavaScript a un `Vec`.
///
/// # Safety
///
/// El puntero tiene que apuntar a `n` valores `f64` alineados y vivos durante la llamada; lo garantiza el llamador
/// porque los escribió en la memoria lineal de Wasm con `reservar`.
unsafe fn copiar_f64(p: *const f64, n: usize) -> Option<Vec<f64>> {
    if p.is_null() {
        return None;
    }
    // SAFETY: contrato de la función.
    let s = unsafe { slice::from_raw_parts(p, n) };
    Some(s.to_vec())
}

/// Reserva `bytes` en la memoria lineal de Wasm y devuelve el puntero (0 si `bytes` es 0).
#[no_mangle]
pub extern "C" fn reservar(bytes: u32) -> *mut u8 {
    if bytes == 0 {
        return ptr::null_mut();
    }
    let mut v: Vec<u8> = Vec::with_capacity(bytes as usize);
    let p = v.as_mut_ptr();
    core::mem::forget(v);
    p
}

/// Libera un bloque pedido con [`reservar`].
///
/// # Safety
///
/// `p` y `bytes` tienen que ser exactamente los que devolvió [`reservar`], sin usar después.
#[no_mangle]
pub unsafe extern "C" fn liberar(p: *mut u8, bytes: u32) {
    if p.is_null() || bytes == 0 {
        return;
    }
    // SAFETY: contrato de la función: mismo puntero y misma capacidad que `reservar`.
    drop(unsafe { Vec::from_raw_parts(p, 0, bytes as usize) });
}

/// Crea un perfil de puntaje. Devuelve el puntero a la caja, o 0 si la entrada no es válida.
///
/// `objetivo`, `tolerancia`, `escala` y `pesos` llevan `k` valores; `correlacion`, `k × k` en orden por filas.
/// `pesos` puede ser nulo (pesos iguales). `obligatorias` es una máscara de bits sobre las `k` variables.
///
/// # Safety
///
/// Los punteros tienen que apuntar a los valores descritos y seguir vivos durante la llamada.
#[no_mangle]
pub unsafe extern "C" fn perfil_crear(
    k: u32,
    objetivo: *const f64,
    tolerancia: *const f64,
    escala: *const f64,
    correlacion: *const f64,
    pesos: *const f64,
    gamma: f64,
    lambda: f64,
    obligatorias: u32,
) -> *mut CajaPerfil {
    let kk = k as usize;
    if kk == 0 || kk > MAX_VARS || obligatorias >> kk != 0 {
        return ptr::null_mut();
    }
    // SAFETY: contrato de la función; cada copia valida el puntero antes de leer.
    let (obj, tol, esc, corr, pes) = unsafe {
        (
            copiar_f64(objetivo, kk),
            copiar_f64(tolerancia, kk),
            copiar_f64(escala, kk),
            copiar_f64(correlacion, kk * kk),
            if pesos.is_null() {
                None
            } else {
                copiar_f64(pesos, kk)
            },
        )
    };
    let (Some(obj), Some(tol), Some(esc), Some(corr)) = (obj, tol, esc, corr) else {
        return ptr::null_mut();
    };
    if pesos.is_null() {
        // sin pesos: todo a uno
    } else if pes.is_none() {
        return ptr::null_mut();
    }
    let entrada = Entrada {
        objetivo: &obj,
        tolerancia: &tol,
        escala: &esc,
        correlacion: &corr,
        pesos: pes.as_deref(),
        gamma,
        lambda,
        obligatorias: u16::try_from(obligatorias).unwrap_or(u16::MAX),
    };
    match Perfil::nuevo(&entrada) {
        Ok(perfil) => Box::into_raw(Box::new(CajaPerfil { perfil })),
        Err(_) => ptr::null_mut(),
    }
}

/// Libera un perfil creado con [`perfil_crear`].
///
/// # Safety
///
/// `caja` tiene que venir de [`perfil_crear`] y no volver a usarse.
#[no_mangle]
pub unsafe extern "C" fn perfil_libre(caja: *mut CajaPerfil) {
    if caja.is_null() {
        return;
    }
    // SAFETY: contrato de la función.
    drop(unsafe { Box::from_raw(caja) });
}

/// Puntúa `n` celdas y escribe `S` en `s_salida` y `D²` en `d2_salida` (un `f64` por celda).
///
/// `celdas` trae `n × MAX_VARS` valores `f32` seguidos, con `NaN` en las variables ausentes. Devuelve cuántas celdas se
/// puntuaron; las que no (`NaN` en la salida) son celdas sin las variables obligatorias.
///
/// # Safety
///
/// `caja` tiene que venir de [`perfil_crear`]; `celdas` apunta a `n × MAX_VARS` `f32` y las salidas a `n` `f64`.
#[no_mangle]
pub unsafe extern "C" fn perfil_puntuar_lote(
    caja: *const CajaPerfil,
    celdas: *const f32,
    n: u32,
    s_salida: *mut f64,
    d2_salida: *mut f64,
) -> u32 {
    if caja.is_null() || celdas.is_null() || s_salida.is_null() || d2_salida.is_null() || n == 0 {
        return 0;
    }
    // SAFETY: contrato de la función; el llamador reservó las longitudes indicadas.
    let (perfil, filas, s_out, d2_out) = unsafe {
        (
            &(*caja).perfil,
            slice::from_raw_parts(celdas, (n as usize) * MAX_VARS),
            slice::from_raw_parts_mut(s_salida, n as usize),
            slice::from_raw_parts_mut(d2_salida, n as usize),
        )
    };
    let mut hechas = 0u32;
    let k = perfil.k();
    for i in 0..n as usize {
        let fila = &filas[i * MAX_VARS..i * MAX_VARS + k];
        match perfil.puntuar_tolerante(fila) {
            Ok(Some(p)) => {
                s_out[i] = p.s;
                d2_out[i] = p.d2;
                hechas += 1;
            }
            _ => {
                s_out[i] = f64::NAN;
                d2_out[i] = f64::NAN;
            }
        }
    }
    hechas
}

/// Devuelve cuántas variables tiene el perfil.
///
/// # Safety
///
/// `caja` tiene que venir de [`perfil_crear`].
#[no_mangle]
pub unsafe extern "C" fn perfil_variables(caja: *const CajaPerfil) -> u32 {
    if caja.is_null() {
        return 0;
    }
    // SAFETY: contrato de la función.
    unsafe { (*caja).perfil.k() as u32 }
}
