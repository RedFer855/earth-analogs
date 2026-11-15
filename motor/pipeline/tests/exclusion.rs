use std::path::{Path, PathBuf};

use nucleo::{Entrada, Perfil};
use pipeline::barrido::{
    barrer, barrer_con_filtros, barrer_escenarios_con_filtros, Compartido, Config, Escenario,
    Filtros,
};
use pipeline::ejecutar::{correr, Opciones};
use pipeline::escenarios::correr_escenarios;
use pipeline::geo::{centro_celda, haversine_km};
use pipeline::indice::{EstadoIndice, FiltroIndice, IndiceExclusion};
use serde_json::{json, Value};

const VARIABLES: [&str; 4] = [
    "slope_mean_deg",
    "slope_std_deg",
    "rug_rms_mean_m",
    "relieve_mean_m",
];

#[expect(
    clippy::expect_used,
    reason = "ayuda de pruebas: un fallo aquí es un fallo de la prueba"
)]
fn escribir(ruta: &Path, bytes: &[u8]) {
    std::fs::create_dir_all(ruta.parent().expect("carpeta")).expect("crear carpeta");
    std::fs::write(ruta, bytes).expect("escribir");
}

struct Entorno {
    opciones: Opciones,
    raiz: PathBuf,
}

fn entorno_sintetico(nombre: &str) -> Entorno {
    let raiz = std::env::temp_dir().join(format!("motor-excl-{}-{nombre}", std::process::id()));
    let _ = std::fs::remove_dir_all(&raiz);

    let ipix: Vec<u32> = vec![
        100 << 12,
        (100 << 12) + 4095,
        (101 << 12) + 10,
        (102 << 12) + 20,
        (5000 << 12) + 30,
    ];

    let slope_mean = vec![10.0_f32, 10.6, 10.1, 10.2, 10.4];
    let slope_std = vec![10.0_f32; 5];
    let rug = vec![10.0_f32; 5];
    let relieve = vec![10.0_f32; 5];
    let ndvi = vec![0.1_f32; 5];

    for (nombre_col, datos) in [
        ("slope_mean_deg", &slope_mean),
        ("slope_std_deg", &slope_std),
        ("rug_rms_mean_m", &rug),
        ("relieve_mean_m", &relieve),
        ("ndvi_max_clim", &ndvi),
    ] {
        escribir(
            &raiz.join(format!("maestro/{nombre_col}.f32")),
            bytemuck::cast_slice(datos),
        );
    }
    escribir(&raiz.join("maestro/ipix.u32"), bytemuck::cast_slice(&ipix));
    escribir(
        &raiz.join("maestro/manifest.json"),
        json!({"n_celdas": ipix.len(), "healpix": {"nivel": 12}})
            .to_string()
            .as_bytes(),
    );

    let por_var = |x: f64| -> Value {
        VARIABLES
            .iter()
            .map(|v| ((*v).to_owned(), json!(x)))
            .collect()
    };
    let corr: Vec<Vec<f64>> = (0..4)
        .map(|i| (0..4).map(|j| if i == j { 1.0 } else { 0.0 }).collect())
        .collect();
    let perfiles = json!({
        "parametros": {
            "gamma": 0.5, "lambda_contraccion": 0.1, "ndvi_max_principal": 0.3,
            "s_coincide": 0.9, "nivel_region": 6, "radio_documentado_km": 50.0
        },
        "maestro": {"n_celdas": ipix.len(), "generado": "prueba"},
        "objetivos": {"OBJ-01": {
            "nombre": "Sitio de prueba", "cuerpo": "marte",
            "perfiles": {"p": {
                "variables": VARIABLES, "objetivo": por_var(10.0), "tolerancia": por_var(0.1),
                "escala_tierra": por_var(1.0), "correlacion": corr,
                "celdas_que_coinciden_en_la_tierra": 0
            }}
        }}
    });
    escribir(&raiz.join("perfiles.json"), perfiles.to_string().as_bytes());
    let sitios = json!({
        "luna": {},
        "marte": {"OBJ-01": {"nombre": "Sitio de prueba", "lat": 0.0, "lon": 0.0}},
        "tierra": {}
    });
    escribir(&raiz.join("sitios.json"), sitios.to_string().as_bytes());

    let mut o = Opciones::por_omision();
    o.maestro = raiz.join("maestro");
    o.perfiles = raiz.join("perfiles.json");
    o.sitios = raiz.join("sitios.json");
    o.salida = raiz.join("salida");
    "OBJ-01".clone_into(&mut o.objetivo);
    "p".clone_into(&mut o.perfil);
    o.candidatos = 10;
    Entorno { opciones: o, raiz }
}

#[expect(
    clippy::expect_used,
    reason = "ayuda de pruebas: un fallo aquí es un fallo de la prueba"
)]
fn leer_json(ruta: &Path) -> Value {
    serde_json::from_slice(&std::fs::read(ruta).expect("leer json")).expect("parsear json")
}

#[test]
fn exclusion_por_celda_conserva_celdas_lejanas_de_la_misma_region() {
    let ent = entorno_sintetico("celda_lejana");
    let ipix_cerca = 100 << 12;
    let ipix_lejos = (100 << 12) + 4095;
    let (lat_cerca, lon_cerca) = centro_celda(12, ipix_cerca);
    let (lat_lejos, lon_lejos) = centro_celda(12, ipix_lejos);
    let dist_interna = haversine_km(lat_cerca, lon_cerca, lat_lejos, lon_lejos);
    assert!(dist_interna > 30.0, "celdas muy juntas: {dist_interna}");

    let base = correr(&ent.opciones).expect("corrida base");
    let res_base = leer_json(&ent.opciones.salida.join("resultados/p/OBJ-01.json"));
    assert_eq!(res_base["candidatos"][0]["ipix"], json!(ipix_cerca));
    assert!(base.excluidos_por_indice.is_none());
    assert!(res_base.get("excluidos_por_indice").is_none());

    let idx_ruta = ent.raiz.join("indice.json");
    escribir(
        &idx_ruta,
        json!([{
            "id": "EJ-01", "lat": lat_cerca, "lon": lon_cerca, "radio_km": 10.0,
            "estado": "documentado", "fuente": "EJEMPLO, no es dato real", "fecha": "2026-11-15"
        }])
        .to_string()
        .as_bytes(),
    );
    let mut o_excl = ent.opciones.clone();
    o_excl.indice = Some(idx_ruta);
    o_excl.salida = ent.raiz.join("salida_excl");
    let inf = correr(&o_excl).expect("corrida con índice");
    assert_eq!(inf.excluidos_por_indice, Some(1));
    let res_excl = leer_json(&o_excl.salida.join("resultados/p/OBJ-01.json"));
    assert_eq!(res_excl["excluidos_por_indice"], json!(1));
    let ipix_salen: Vec<u64> = res_excl["candidatos"]
        .as_array()
        .expect("candidatos")
        .iter()
        .filter_map(|c| c["ipix"].as_u64())
        .collect();
    assert!(!ipix_salen.contains(&u64::from(ipix_cerca)));
    assert!(ipix_salen.contains(&u64::from(ipix_lejos)));

    o_excl.excluir_km = Some(500.0);
    o_excl.salida = ent.raiz.join("salida_500");
    let inf_500 = correr(&o_excl).expect("corrida con excluir-km");
    assert!(inf_500.excluidos_por_indice.unwrap_or(0) >= 2);
    let res_500 = leer_json(&o_excl.salida.join("resultados/p/OBJ-01.json"));
    let salen_500: Vec<u64> = res_500["candidatos"]
        .as_array()
        .expect("candidatos")
        .iter()
        .filter_map(|c| c["ipix"].as_u64())
        .collect();
    assert!(!salen_500.contains(&u64::from(ipix_lejos)));
}

#[test]
fn separacion_conserva_el_mejor_y_descarta_vecinos_antes_de_truncar() {
    let ent = entorno_sintetico("separacion");
    let (lat0, lon0) = centro_celda(12, 100 << 12);
    let (lat2, lon2) = centro_celda(12, (102 << 12) + 20);
    let (lat_lejos, lon_lejos) = centro_celda(12, (5000 << 12) + 30);
    let d_vecinos = haversine_km(lat0, lon0, lat2, lon2);
    let d_lejos = haversine_km(lat0, lon0, lat_lejos, lon_lejos);
    assert!(d_vecinos < 400.0 && d_lejos > 1000.0);

    let mut o = ent.opciones.clone();
    o.candidatos = 2;
    o.separacion_km = Some(500.0);
    let inf = correr(&o).expect("corrida con separación");
    assert_eq!(inf.candidatos_escritos, 2);
    assert_eq!(inf.excluidos_por_separacion, Some(2));
    let res = leer_json(&o.salida.join("resultados/p/OBJ-01.json"));
    let ipix_salen: Vec<u64> = res["candidatos"]
        .as_array()
        .expect("candidatos")
        .iter()
        .filter_map(|c| c["ipix"].as_u64())
        .collect();
    assert_eq!(
        ipix_salen,
        vec![u64::from(100u32 << 12), u64::from((5000u32 << 12) + 30)]
    );
}

#[test]
fn sin_opciones_nuevas_los_bytes_de_salida_son_identicos() {
    let ent = entorno_sintetico("bytes_iguales");
    let a = ent.opciones.clone();
    correr(&a).expect("primera corrida");
    let bytes_a = std::fs::read(a.salida.join("resultados/p/OBJ-01.json")).expect("res a");

    let mut b = ent.opciones;
    b.salida = ent.raiz.join("salida_b");
    correr(&b).expect("segunda corrida");
    let bytes_b = std::fs::read(b.salida.join("resultados/p/OBJ-01.json")).expect("res b");
    assert_eq!(bytes_a, bytes_b);

    let esc_ruta = ent.raiz.join("esc.json");
    escribir(
        &esc_ruta,
        json!({"escenarios": [{"id": "base", "objetivo": "OBJ-01", "perfil": "p"}]})
            .to_string()
            .as_bytes(),
    );
    let inf_esc = correr_escenarios(&a, &esc_ruta).expect("escenarios");
    assert!(inf_esc.escenarios[0].excluidos_por_indice.is_none());
    assert!(inf_esc.escenarios[0].excluidos_por_separacion.is_none());
}

#[test]
fn escenarios_e_hilos_1_vs_8_son_deterministas() {
    let ent = entorno_sintetico("hilos");
    let (lat_cerca, lon_cerca) = centro_celda(12, 100 << 12);
    let idx_ruta = ent.raiz.join("indice.json");
    escribir(
        &idx_ruta,
        json!([{
            "id": "EJ-01", "lat": lat_cerca, "lon": lon_cerca, "radio_km": 10.0,
            "estado": "verificado_campo", "fuente": "EJEMPLO, no es dato real", "fecha": "2026-11-15"
        }])
        .to_string()
        .as_bytes(),
    );
    let esc_ruta = ent.raiz.join("esc.json");
    escribir(
        &esc_ruta,
        json!({
            "escenarios": [
                {"id": "solo-indice", "objetivo": "OBJ-01", "perfil": "p"},
                {
                    "id": "radio-y-sep",
                    "objetivo": "OBJ-01",
                    "perfil": "p",
                    "radio_exclusion_km": 10.0,
                    "separacion_km": 500.0
                }
            ]
        })
        .to_string()
        .as_bytes(),
    );

    let correr_con = |hilos: usize| {
        let mut o = ent.opciones.clone();
        o.indice = Some(idx_ruta.clone());
        o.hilos = Some(hilos);
        o.salida = ent.raiz.join(format!("salida_h{hilos}"));
        let inf = correr_escenarios(&o, &esc_ruta).expect("escenarios");
        (
            inf,
            std::fs::read(o.salida.join("estabilidad.json")).expect("estabilidad"),
        )
    };
    let (inf1, bytes1) = correr_con(1);
    let (inf8, bytes8) = correr_con(8);
    assert_eq!(inf1.escenarios[0].excluidos_por_indice, Some(1));
    assert_eq!(inf1.escenarios[1].excluidos_por_indice, Some(1));
    assert_eq!(inf1.escenarios[1].excluidos_por_separacion, Some(2));
    assert_eq!(
        serde_json::to_value(&inf1.robustez).expect("val"),
        serde_json::to_value(&inf8.robustez).expect("val")
    );
    assert_eq!(
        serde_json::to_value(&inf1.escenarios).expect("val"),
        serde_json::to_value(&inf8.escenarios).expect("val")
    );
    assert!(!bytes1.is_empty() && !bytes8.is_empty());
}

#[test]
fn indice_invalido_y_excluir_sin_indice_fallan_con_mensaje_claro() {
    let mut ent = entorno_sintetico("errores");
    ent.opciones.excluir_km = Some(50.0);
    let err = correr(&ent.opciones).expect_err("excluir-km sin indice");
    assert!(format!("{err:#}").contains("--indice"), "{err:#}");

    let malo = ent.raiz.join("malo.json");
    escribir(
        &malo,
        json!([{
            "id": "BAD", "lat": 120.0, "lon": 0.0, "radio_km": 10.0,
            "estado": "documentado", "fuente": "EJEMPLO", "fecha": "2026-11-15"
        }])
        .to_string()
        .as_bytes(),
    );
    ent.opciones.excluir_km = None;
    ent.opciones.indice = Some(malo);
    let err_lat = correr(&ent.opciones).expect_err("lat invalida");
    assert!(format!("{err_lat:#}").contains("latitud"), "{err_lat:#}");
}

#[test]
fn barrer_y_barrer_escenarios_con_filtros_coinciden_con_1_y_8_hilos() {
    let vars = [0usize, 1];
    let p = Perfil::nuevo(&Entrada {
        objetivo: &[10.0, 10.0],
        tolerancia: &[0.2, 0.2],
        escala: &[1.0, 1.0],
        correlacion: &[1.0, 0.0, 0.0, 1.0],
        pesos: None,
        gamma: 0.5,
        lambda: 0.1,
        obligatorias: 0b11,
    })
    .expect("perfil");
    let ipix = vec![
        10u32 << 12,
        (10 << 12) + 4095,
        (11 << 12) + 5,
        (4000 << 12) + 9,
    ];
    let c0 = vec![10.0_f32, 10.3, 10.1, 10.4];
    let c1 = vec![10.0_f32; 4];
    let ndvi = vec![0.1_f32; 4];
    let cols: Vec<&[f32]> = vec![&c0, &c1];
    let (lat0, lon0) = centro_celda(12, ipix[0]);
    let idx = IndiceExclusion::desde_json(
        &json!([{
            "id": "T1", "lat": lat0, "lon": lon0, "radio_km": 5.0,
            "estado": EstadoIndice::VerificadoRemoto, "fuente": "EJEMPLO, no es dato real", "fecha": "2026-11-15"
        }])
        .to_string(),
    )
    .expect("indice");
    let filtro_idx = FiltroIndice::nuevo(&idx, 6, 12, &ipix, None).expect("filtro");
    let filtros = Filtros {
        indice: Some(&filtro_idx),
        separacion_km: Some(300.0),
    };
    let cfg = Config {
        perfil: &p,
        columnas: &cols,
        ndvi: &ndvi,
        ipix: &ipix,
        ndvi_max: 0.3,
        s_coincide: 0.9,
        nivel_region: 6,
        nivel_celda: 12,
    };
    assert_eq!(barrer(&cfg).expect("sin filtros").por_region.len(), 3);
    let b = barrer_con_filtros(&cfg, &filtros).expect("con filtros");
    let comp = Compartido {
        columnas: &cols,
        requeridas: &vars,
        ndvi: &ndvi,
        ipix: &ipix,
        s_coincide: 0.9,
        nivel_region: 6,
        nivel_celda: 12,
        candidatos: 10,
        filas_por_tarea: 2,
    };
    let esc = vec![Escenario {
        perfil: p,
        columnas: vars.to_vec(),
        ndvi_max: 0.3,
    }];
    let e1 = rayon::ThreadPoolBuilder::new()
        .num_threads(1)
        .build()
        .expect("pool 1")
        .install(|| barrer_escenarios_con_filtros(&comp, &esc, &[filtros]))
        .expect("escenarios 1");
    let e8 = rayon::ThreadPoolBuilder::new()
        .num_threads(8)
        .build()
        .expect("pool 8")
        .install(|| barrer_escenarios_con_filtros(&comp, &esc, &[filtros]))
        .expect("escenarios 8");
    assert_eq!(b.cuentas, e1[0].cuentas);
    assert_eq!(b.por_region, e1[0].mejores);
    assert_eq!(e1, e8);
}
