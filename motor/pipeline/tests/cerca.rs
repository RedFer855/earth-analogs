//! `cerca_de` (ADR-009 §2.3): columnas de distancia opcionales, también desde una carpeta extra (`--puntos`).

use std::fs;
use std::path::{Path, PathBuf};

use anyhow::ensure;
use pipeline::ejecutar::{correr, Opciones};
use pipeline::tabla::Tabla;

#[expect(
    clippy::expect_used,
    reason = "ayuda de pruebas: un fallo aquí es un fallo de la prueba"
)]
fn carpeta(nombre: &str, n: usize, manifiesto: Option<&str>) -> PathBuf {
    let d = std::env::temp_dir().join(format!("motor-cerca-{}-{nombre}", std::process::id()));
    let _ = fs::remove_dir_all(&d);
    fs::create_dir_all(d.join("columns")).expect("carpeta");
    fs::create_dir_all(d.join("grid")).expect("grid");
    if let Some(m) = manifiesto {
        fs::write(d.join("manifest.json"), m).expect("manifiesto");
    }
    let ipix: Vec<u32> = (0..u32::try_from(n).expect("n")).collect();
    fs::write(d.join("grid/ipix.u32"), bytemuck_bytes(&ipix)).expect("ipix");
    d
}

fn bytemuck_bytes(v: &[u32]) -> Vec<u8> {
    v.iter().flat_map(|x| x.to_le_bytes()).collect()
}

fn escribir_f32(d: &Path, nombre: &str, v: &[f32]) -> std::io::Result<()> {
    let b: Vec<u8> = v.iter().flat_map(|x| x.to_le_bytes()).collect();
    fs::write(d.join("columns").join(format!("{nombre}.f32")), b)
}

#[test]
fn la_carpeta_extra_toma_la_malla_y_el_origen_de_cada_columna() -> anyhow::Result<()> {
    let base = carpeta("base", 4, Some(r#"{"n_celdas":4,"nivel_healpix":12}"#));
    let extra = carpeta("extra", 4, None);
    escribir_f32(&extra, "dist_crater_km", &[1.0, 2.0, f32::NAN, 4.0])?;
    fs::write(
        extra.join("columns/dist_crater_km.json"),
        r#"{"fuente":"Wikidata","url":"https://query.wikidata.org/","licencia":"CC0 1.0","unidad":"km","celdas":4}"#,
    )?;
    let t = Tabla::abrir(&base)?;
    let x = Tabla::abrir_extra(&extra, &t)?;
    ensure!(x.n_celdas == 4, "{:?}", x.n_celdas);
    ensure!(
        x.tiene_f32("dist_crater_km") && !t.tiene_f32("dist_crater_km"),
        "falló: x.tiene_f32('dist_crater_km') && !t.tiene_f32('dist_crater_km')"
    );
    ensure!(
        x.columnas
            .get("dist_crater_km")
            .and_then(|o| o.licencia.as_deref())
            == Some("CC0 1.0"),
        "{:?}",
        x.columnas
            .get("dist_crater_km")
            .and_then(|o| o.licencia.as_deref())
    );
    let v = x.f32("dist_crater_km")?.f32s()[3];
    ensure!((v - 4.0).abs() < f32::EPSILON, "{v}");

    // columna de otro tamaño: Tabla::f32 la rechaza
    escribir_f32(&extra, "dist_playa_km", &[1.0, 2.0])?;
    ensure!(
        x.f32("dist_playa_km").is_err(),
        "falló: x.f32('dist_playa_km').is_err()"
    );

    // otra malla (ipix distinto): se rechaza la carpeta
    let otra = carpeta("otra", 4, None);
    fs::write(otra.join("grid/ipix.u32"), bytemuck_bytes(&[3, 2, 1, 0]))?;
    ensure!(
        Tabla::abrir_extra(&otra, &t).is_err(),
        "falló: Tabla::abrir_extra(&otra, &t).is_err()"
    );

    // manifiesto con otro n_celdas: se rechaza
    let corta = carpeta("corta", 3, Some(r#"{"n_celdas":3,"nivel_healpix":12}"#));
    ensure!(
        Tabla::abrir_extra(&corta, &t).is_err(),
        "falló: Tabla::abrir_extra(&corta, &t).is_err()"
    );

    for d in [base, extra, otra, corta] {
        let _ = fs::remove_dir_all(d);
    }
    Ok(())
}

#[test]
#[ignore = "necesita la tabla real y perfiles.json en $RUN; PUNTOS opcional con dist_crater_km y dist_playa_km"]
fn cerca_de_coincide_con_las_columnas_de_la_tabla_real() {
    let mut o = Opciones::por_omision();
    o.salida = std::env::temp_dir().join(format!("motor-cerca-{}-real", std::process::id()));
    o.candidatos = 5;
    o.puntos = std::env::var_os("PUNTOS").map(PathBuf::from);
    correr(&o).expect("corrida");
    let ruta = o
        .salida
        .join("resultados")
        .join(&o.perfil)
        .join(format!("{}.json", o.objetivo));
    let res: serde_json::Value =
        serde_json::from_slice(&fs::read(ruta).expect("resultado")).expect("JSON");
    let t = Tabla::abrir(&o.maestro).expect("tabla");
    let extra = o
        .puntos
        .as_deref()
        .map(|d| Tabla::abrir_extra(d, &t).expect("puntos"));
    let ipix = t.u32("ipix").expect("ipix");
    let columna = |nombre: &str| {
        std::iter::once(&t)
            .chain(extra.as_ref())
            .find(|x| x.tiene_f32(nombre))
            .map(|x| x.f32(nombre).expect("columna"))
    };
    let pares = [
        ("tubo_lava_km", "cueva_dist_km"),
        ("crater_km", "dist_crater_km"),
        ("salar_km", "dist_playa_km"),
    ];
    let cols: Vec<_> = pares.iter().map(|(_, c)| columna(c)).collect();
    for c in res["candidatos"]
        .as_array()
        .expect("candidatos")
        .iter()
        .take(2)
    {
        let p = u32::try_from(c["ipix"].as_u64().expect("ipix")).expect("u32");
        let fila = ipix
            .u32s()
            .iter()
            .position(|&x| x == p)
            .expect("ipix en la tabla");
        for ((campo, _), col) in pares.iter().zip(&cols) {
            let esperado = col.as_ref().and_then(|col| {
                let v = f64::from(col.f32s()[fila]);
                v.is_finite().then(|| (v * 10.0).round() / 10.0)
            });
            assert_eq!(
                c["cerca_de"][campo].as_f64(),
                esperado,
                "{campo} en ipix {p}"
            );
        }
    }
    let _ = fs::remove_dir_all(&o.salida);
}
