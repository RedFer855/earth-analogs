//! Línea de comandos del motor. `pipeline --ayuda` lista las opciones.

use std::path::PathBuf;
use std::process::ExitCode;

use anyhow::{bail, Context, Result};
use pipeline::area::parsear_bbox;
use pipeline::ejecutar::{correr, Opciones};
use pipeline::escenarios::correr_escenarios;

const AYUDA: &str = "\
pipeline: busca en la Tierra las celdas que se parecen a un sitio de la Luna o Marte y escribe metrics.json.

Opciones (todas con valor por omisión):
  --maestro DIR        carpeta de la tabla maestra (manifest.json y las columnas .f32/.u32)
  --perfiles FILE      perfiles.json con el perfil (objetivo, tolerancia, escala y correlación)
  --sitios DIR|FILE    carpeta etl/sitios (objetivos-luna.json y objetivos-marte.json) o JSON equivalente
  --objetivo CODIGO    sitio objetivo            [JZ]
  --perfil ID          perfil de perfiles.json   [terreno]
  --salida DIR         donde escribir metrics.json y resultados/
  --candidatos N       celdas a escribir (la mejor de cada región de nivel 6) [200]
  --hilos N            hilos de rayon [todos]
  --perfil-json FILE   toma el perfil de este archivo (p. ej. con los números sin redondear)
  --volcar-s FILE      escribe la S de cada fila (f32) para validación
  --solo-barrido       solo mide el barrido: no elige candidatos ni escribe archivos
  --escenarios FILE    barre de una pasada los escenarios de FILE (sitio × variables × tolerancias × pesos × NDVI)
                       y escribe estabilidad.json: en qué fracción de escenarios aparece cada candidato y con qué S
  --indice FILE        índice JSON de análogos ya hallados a excluir por celda (arreglo de entradas)
  --excluir-km N       sustituye el radio_km de todas las entradas del índice
  --separacion-km N    distancia mínima en km entre candidatos (sobre el orden total, antes de recortar)
  --region FILE        GeoJSON (Polygon, MultiPolygon, Feature o FeatureCollection) para buscar solo en esa área
  --bbox LAT1,LON1,LAT2,LON2
                       caja geográfica [lat1,lon1,lat2,lon2] (si lon1 > lon2 cruza ±180°)
  --k-area X           factor provisional k en (0, 1] para radio_efectivo = min(radio, k*sqrt(área)) [0.15]
  --min-area-km2 X     piso de tierra elegible del área en km² [40000, provisional; 0 lo desactiva]
  --ayuda
";

fn leer_opciones() -> Result<Option<Opciones>> {
    let mut o = Opciones::por_omision();
    let mut args = std::env::args().skip(1);
    while let Some(a) = args.next() {
        if a == "--ayuda" || a == "-h" || a == "--help" {
            return Ok(None);
        }
        if a == "--solo-barrido" {
            o.solo_barrido = true;
            continue;
        }
        let valor = args
            .next()
            .with_context(|| format!("falta el valor de {a}"))?;
        match a.as_str() {
            "--maestro" => o.maestro = PathBuf::from(valor),
            "--perfiles" => o.perfiles = PathBuf::from(valor),
            "--sitios" => o.sitios = PathBuf::from(valor),
            "--objetivo" => o.objetivo = valor,
            "--perfil" => o.perfil = valor,
            "--salida" => o.salida = PathBuf::from(valor),
            "--candidatos" => {
                o.candidatos = valor.parse().context("--candidatos debe ser un entero")?;
            }
            "--hilos" => o.hilos = Some(valor.parse().context("--hilos debe ser un entero")?),
            "--perfil-json" => o.perfil_json = Some(PathBuf::from(valor)),
            "--volcar-s" => o.volcar_s = Some(PathBuf::from(valor)),
            "--escenarios" => o.escenarios = Some(PathBuf::from(valor)),
            "--indice" => o.indice = Some(PathBuf::from(valor)),
            "--excluir-km" => {
                o.excluir_km = Some(valor.parse().context("--excluir-km debe ser un número")?);
            }
            "--separacion-km" => {
                o.separacion_km = Some(
                    valor
                        .parse()
                        .context("--separacion-km debe ser un número")?,
                );
            }
            "--region" => o.region = Some(PathBuf::from(valor)),
            "--bbox" => o.bbox = Some(parsear_bbox(&valor)?),
            "--k-area" => {
                o.k_area = Some(valor.parse().context("--k-area debe ser un número")?);
            }
            "--min-area-km2" => {
                o.min_area_km2 = Some(valor.parse().context("--min-area-km2 debe ser un número")?);
            }
            otra => bail!("opción desconocida: {otra} (usa --ayuda)"),
        }
    }
    Ok(Some(o))
}

fn ejecutar() -> Result<()> {
    let Some(opciones) = leer_opciones()? else {
        print!("{AYUDA}");
        return Ok(());
    };
    if let Some(archivo) = &opciones.escenarios {
        let informe = correr_escenarios(&opciones, archivo)?;
        println!("{}", serde_json::to_string_pretty(&informe.medicion)?);
        return Ok(());
    }
    let informe = correr(&opciones)?;
    println!("{}", serde_json::to_string_pretty(&informe)?);
    Ok(())
}

fn main() -> ExitCode {
    match ejecutar() {
        Ok(()) => ExitCode::SUCCESS,
        Err(e) => {
            eprintln!("error: {e:#}");
            ExitCode::FAILURE
        }
    }
}
