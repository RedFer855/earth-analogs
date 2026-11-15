//! Ejecutor del motor sobre la tabla del ETL: lee `$RUN` (manifiesto, malla y columnas de E-01 a E-13) y
//! `perfiles.json` (E-20), barre las celdas de la Tierra y escribe `metrics.json` con el detalle por sitio.

pub mod area;
pub mod barrido;
pub mod ejecutar;
pub mod entrada;
pub mod escenarios;
pub mod geo;
pub mod indice;
pub mod muestreo;
pub mod salida;
pub mod tabla;
