use std::collections::HashSet;
use std::path::{Path, PathBuf};

use pipeline::ejecutar::{correr, Opciones};
use pipeline::tabla::Tabla;

#[expect(
    clippy::expect_used,
    reason = "ayuda de pruebas: un fallo aquí es un fallo de la prueba"
)]
fn temporal(nombre: &str) -> PathBuf {
    let d = std::env::temp_dir().join(format!("motor-humo-{}-{nombre}", std::process::id()));
    std::fs::create_dir_all(&d).expect("carpeta temporal");
    d
}

fn opciones(nombre: &str) -> Opciones {
    let mut o = Opciones::por_omision();
    o.salida = temporal(nombre);
    o
}

#[expect(
    clippy::expect_used,
    reason = "ayuda de pruebas: un fallo aquí es un fallo de la prueba"
)]
fn leer(ruta: &Path) -> serde_json::Value {
    serde_json::from_slice(&std::fs::read(ruta).expect("archivo")).expect("JSON")
}

#[test]
#[ignore = "necesita la tabla real y perfiles.json en $RUN"]
fn el_barrido_con_la_tabla_real_es_consistente() {
    let o = opciones("conteo");
    let i = correr(&o).expect("corrida");
    assert!(i.n_celdas > 0 && i.elegibles > 0 && i.coinciden > 0);
    assert_eq!(
        i.candidatos_escritos,
        i.regiones_con_candidato.min(o.candidatos)
    );
    let ruta = o
        .salida
        .join("resultados")
        .join(&o.perfil)
        .join(format!("{}.json", o.objetivo));
    let res = leer(&ruta);
    let c = res["candidatos"].as_array().expect("candidatos");
    assert_eq!(c.len(), i.candidatos_escritos);
    let ipix: HashSet<u64> = c
        .iter()
        .map(|x| x["ipix"].as_u64().expect("ipix"))
        .collect();
    assert_eq!(ipix.len(), c.len(), "una celda por región: sin repetidas");
}

#[test]
#[ignore = "necesita la tabla real y perfiles.json en $RUN"]
fn el_resultado_es_el_mismo_con_1_y_con_4_hilos() {
    let (mut a, mut b) = (opciones("h1"), opciones("h4"));
    a.hilos = Some(1);
    b.hilos = Some(4);
    let (ia, ib) = (correr(&a).expect("1 hilo"), correr(&b).expect("4 hilos"));
    assert_eq!(
        (ia.elegibles, ia.completas, ia.coinciden),
        (ib.elegibles, ib.completas, ib.coinciden)
    );
    let ruta = |o: &Opciones| {
        o.salida
            .join("resultados")
            .join(&o.perfil)
            .join(format!("{}.json", o.objetivo))
    };
    assert_eq!(
        leer(&ruta(&a))["candidatos"],
        leer(&ruta(&b))["candidatos"],
        "mismos candidatos, mismo orden"
    );
}

#[test]
#[ignore = "necesita la tabla real en $RUN"]
fn cdshealpix_en_rust_coincide_con_lat_lon_de_la_tabla() {
    let o = Opciones::por_omision();
    let t = Tabla::abrir(&o.maestro).expect("tabla");
    let (ipix, lat, lon) = (
        t.u32("ipix").expect("ipix"),
        t.f32("lat").expect("lat"),
        t.f32("lon").expect("lon"),
    );
    let (mut max_lat, mut max_lon): (f64, f64) = (0.0, 0.0);
    for i in (0..t.n_celdas).step_by(50_000) {
        // la tabla guarda latitud geodésica WGS84; centro_celda la convierte desde la autálica de HEALPix
        let (lat_d, lon_d) = pipeline::geo::centro_celda(t.nivel_healpix, ipix.u32s()[i]);
        max_lat = max_lat.max((lat_d - f64::from(lat.f32s()[i])).abs());
        max_lon = max_lon.max((lon_d - f64::from(lon.f32s()[i])).abs());
    }
    println!("máxima diferencia con la tabla: lat {max_lat:.2e}°, lon {max_lon:.2e}°");
    assert!(max_lat < 1e-4 && max_lon < 1e-4);
}
