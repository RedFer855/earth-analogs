//! Abre la tabla del ETL tal como la deja E-13 en `$RUN`: `manifest.json`, `grid/*.u32|f32` y `columns/*.f32`.
//!
//! Las columnas se mapean a memoria sin copiarlas. Del manifiesto se toman el tamaño de la malla, su nivel, la fecha
//! y el commit de la corrida, y la fuente, la URL, la licencia y la unidad de cada columna, para que cada número
//! del resultado diga de dónde sale (ADR-007).

use std::collections::BTreeMap;
use std::fs::File;
use std::path::{Path, PathBuf};

use anyhow::{bail, Context, Result};
use memmap2::Mmap;
use serde::Deserialize;

#[derive(Deserialize)]
struct Manifiesto {
    n_celdas: usize,
    #[serde(default)]
    nivel_healpix: Option<u8>,
    #[serde(default)]
    healpix: Option<HealpixInfo>,
    #[serde(default)]
    generado: Option<String>,
    #[serde(default)]
    commit: Option<String>,
    #[serde(default)]
    columnas: BTreeMap<String, OrigenColumna>,
}

/// Lo que el manifiesto dice de una columna.
#[derive(Debug, Clone, Default, Deserialize)]
pub struct OrigenColumna {
    #[serde(default)]
    pub fuente: Option<String>,
    #[serde(default)]
    pub url: Option<String>,
    #[serde(default)]
    pub licencia: Option<String>,
    #[serde(default)]
    pub unidad: Option<String>,
}

#[derive(Deserialize)]
struct HealpixInfo {
    nivel: u8,
}

pub struct Columna {
    mapa: Mmap,
    nombre: String,
}

pub struct Tabla {
    carpeta: PathBuf,
    pub n_celdas: usize,
    pub nivel_healpix: u8,
    /// Fecha en que E-13 escribió el manifiesto.
    pub generado: Option<String>,
    /// Commit del código que produjo la tabla.
    pub commit: Option<String>,
    pub columnas: BTreeMap<String, OrigenColumna>,
}

#[expect(
    unsafe_code,
    reason = "Mmap::map requiere invariante de archivo inmutable"
)]
fn mapear(archivo: &File) -> std::io::Result<Mmap> {
    // SAFETY: read-only immutable mapping
    unsafe { Mmap::map(archivo) }
}

impl Tabla {
    pub fn abrir(carpeta: &Path) -> Result<Self> {
        let ruta = carpeta.join("manifest.json");
        let texto = std::fs::read_to_string(&ruta)
            .with_context(|| format!("no se pudo leer {}", ruta.display()))?;
        let m: Manifiesto = serde_json::from_str(&texto)
            .with_context(|| format!("{} no tiene el formato esperado", ruta.display()))?;
        let nivel_healpix = m
            .nivel_healpix
            .or_else(|| m.healpix.map(|h| h.nivel))
            .with_context(|| format!("falta nivel_healpix en {}", ruta.display()))?;
        Ok(Self {
            carpeta: carpeta.to_path_buf(),
            n_celdas: m.n_celdas,
            nivel_healpix,
            generado: m.generado,
            commit: m.commit,
            columnas: m.columnas,
        })
    }

    fn columna(&self, candidatos: &[String]) -> Result<Columna> {
        let elegido = candidatos
            .iter()
            .find(|rel| self.carpeta.join(rel).exists())
            .or_else(|| candidatos.last())
            .context("sin rutas de columna")?;
        let ruta = self.carpeta.join(elegido);
        let f =
            File::open(&ruta).with_context(|| format!("no se pudo abrir {}", ruta.display()))?;
        let mapa = mapear(&f).with_context(|| format!("no se pudo mapear {}", ruta.display()))?;
        if mapa.len() != self.n_celdas * 4 {
            bail!(
                "{elegido}: {} bytes, se esperaban {} (4 × {} celdas)",
                mapa.len(),
                self.n_celdas * 4,
                self.n_celdas
            );
        }

        bytemuck::try_cast_slice::<u8, f32>(&mapa)
            .map_err(|e| anyhow::anyhow!("{elegido}: {e}"))?;
        Ok(Columna {
            mapa,
            nombre: elegido.clone(),
        })
    }

    pub fn f32(&self, nombre: &str) -> Result<Columna> {
        self.columna(&[
            format!("columns/{nombre}.f32"),
            format!("grid/{nombre}.f32"),
            format!("{nombre}.f32"),
        ])
    }

    pub fn u32(&self, nombre: &str) -> Result<Columna> {
        self.columna(&[format!("grid/{nombre}.u32"), format!("{nombre}.u32")])
    }
}

impl Columna {
    #[must_use]
    pub fn f32s(&self) -> &[f32] {
        bytemuck::cast_slice(&self.mapa)
    }

    #[must_use]
    pub fn u32s(&self) -> &[u32] {
        bytemuck::cast_slice(&self.mapa)
    }

    #[must_use]
    pub fn nombre(&self) -> &str {
        &self.nombre
    }
}
