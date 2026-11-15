use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

use pipeline::area::{radio_efectivo, Area};
use pipeline::ejecutar::{correr, Opciones};
use pipeline::escenarios::correr_escenarios;
use pipeline::geo::{centro_celda, haversine_km};
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

#[expect(
    clippy::expect_used,
    reason = "ayuda de pruebas: un fallo aquí es un fallo de la prueba"
)]
fn leer_json(ruta: &Path) -> Value {
    serde_json::from_slice(&std::fs::read(ruta).expect("leer json")).expect("parsear json")
}

#[expect(
    clippy::expect_used,
    reason = "ayuda de pruebas: los índices de celdas sintéticas caben en u32"
)]
fn malla_ipix(lat_min: f64, lat_max: f64, lon_min: f64, lon_max: f64, pasos: u32) -> Vec<u32> {
    let ancho_lon = if lon_min < lon_max {
        lon_max - lon_min
    } else {
        (180.0 - lon_min) + (lon_max + 180.0)
    };
    let n_pasos = f64::from(pasos);
    let mut pix = Vec::with_capacity(usize::try_from(pasos * pasos).expect("pasos"));
    for iy in 0..pasos {
        let lat = lat_min + (lat_max - lat_min) * (f64::from(iy) + 0.5) / n_pasos;
        for ix in 0..pasos {
            let mut lon = lon_min + ancho_lon * (f64::from(ix) + 0.5) / n_pasos;
            if lon >= 180.0 {
                lon -= 360.0;
            }
            let h = cdshealpix::nested::hash(12, lon.to_radians(), lat.to_radians());
            pix.push(u32::try_from(h).expect("ipix en u32"));
        }
    }
    pix.sort_unstable();
    pix.dedup();
    pix
}

struct Entorno {
    opciones: Opciones,
    raiz: PathBuf,
    ipix: Vec<u32>,
}

fn construir_tabla(nombre: &str, mut celdas: Vec<(u32, f32, f32)>) -> Entorno {
    let raiz = std::env::temp_dir().join(format!("motor-area-{}-{nombre}", std::process::id()));
    let _ = std::fs::remove_dir_all(&raiz);

    celdas.sort_unstable_by_key(|c| c.0);
    celdas.dedup_by_key(|c| c.0);
    let n = celdas.len();
    let ipix: Vec<u32> = celdas.iter().map(|c| c.0).collect();
    let slope_mean: Vec<f32> = celdas.iter().map(|c| c.1).collect();
    let ndvi: Vec<f32> = celdas.iter().map(|c| c.2).collect();
    let unos = vec![10.0_f32; n];

    for (col, datos) in [
        ("slope_mean_deg", &slope_mean),
        ("slope_std_deg", &unos),
        ("rug_rms_mean_m", &unos),
        ("relieve_mean_m", &unos),
        ("ndvi_max_clim", &ndvi),
    ] {
        escribir(
            &raiz.join(format!("maestro/{col}.f32")),
            bytemuck::cast_slice(datos),
        );
    }
    escribir(&raiz.join("maestro/ipix.u32"), bytemuck::cast_slice(&ipix));
    escribir(
        &raiz.join("maestro/manifest.json"),
        json!({"n_celdas": n, "healpix": {"nivel": 12}})
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
        "maestro": {"n_celdas": n, "generado": "prueba"},
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
    escribir(
        &raiz.join("sitios.json"),
        json!({"luna": {}, "marte": {"OBJ-01": {"nombre": "Sitio", "lat": 0.0, "lon": 0.0}}, "tierra": {}})
            .to_string()
            .as_bytes(),
    );

    let mut o = Opciones::por_omision();
    o.maestro = raiz.join("maestro");
    o.perfiles = raiz.join("perfiles.json");
    o.sitios = raiz.join("sitios.json");
    o.salida = raiz.join("salida");
    "OBJ-01".clone_into(&mut o.objetivo);
    "p".clone_into(&mut o.perfil);
    o.candidatos = 20;

    o.min_area_km2 = Some(0.0);
    Entorno {
        opciones: o,
        raiz,
        ipix,
    }
}

#[expect(
    clippy::expect_used,
    reason = "ayuda de pruebas: el ipix de prueba cabe en u32"
)]
fn tabla_4_regiones_con_exterior(nombre: &str) -> (Entorno, u32) {
    let dentro = malla_ipix(0.06, 2.44, 10.06, 12.44, 28);
    let mut por_reg: BTreeMap<u32, Vec<u32>> = BTreeMap::new();
    for p in dentro {
        por_reg.entry(p >> 12).or_default().push(p);
    }
    let mut celdas = Vec::new();
    let mut elegidas = 0usize;
    for (_, ps) in por_reg {
        if ps.len() >= 35 {
            for (k, &p) in ps.iter().take(34).enumerate() {
                let ndvi = if k < 2 && elegidas == 0 { 0.8 } else { 0.1 };
                celdas.push((p, 10.4, ndvi));
            }
            elegidas += 1;
            if elegidas == 4 {
                break;
            }
        }
    }
    assert_eq!(elegidas, 4);
    let fuera = u32::try_from(cdshealpix::nested::hash(
        12,
        (-50.0_f64).to_radians(),
        (-20.0_f64).to_radians(),
    ))
    .expect("ipix fuera");
    celdas.push((fuera, 10.0, 0.1));
    (construir_tabla(nombre, celdas), fuera)
}

#[test]
fn piso_de_tierra_en_km2_rechaza_areas_chicas_con_4_regiones() {
    let (ent, _) = tabla_4_regiones_con_exterior("piso");
    let mut o = ent.opciones.clone();
    o.bbox = Some([0.0, 10.0, 2.5, 12.5]);

    o.min_area_km2 = Some(1.0e6);
    let err = correr(&o).expect_err("debe rechazar por km²");
    assert!(format!("{err:#}").contains("km²"), "{err:#}");

    o.min_area_km2 = None;
    assert!(correr(&o).is_err());

    o.min_area_km2 = Some(0.0);
    assert!(correr(&o).is_ok());
    o.min_area_km2 = Some(-1.0);
    assert!(correr(&o).is_err());
}

#[test]
fn solo_celdas_en_area_bbox_equivale_a_poligono_y_sin_area_identico() {
    let (ent, ipix_fuera) = tabla_4_regiones_con_exterior("basico");

    correr(&ent.opciones).expect("corrida base");
    let res_base = leer_json(&ent.opciones.salida.join("resultados/p/OBJ-01.json"));
    assert_eq!(res_base["candidatos"][0]["ipix"], json!(ipix_fuera));
    assert!(res_base.get("celdas_en_area").is_none());
    assert!(res_base.get("regiones_con_tierra").is_none());
    assert!(res_base.get("sin_celdas_por_ndvi").is_none());

    let geojson = ent.raiz.join("region.geojson");
    escribir(
        &geojson,
        json!({
            "type": "FeatureCollection",
            "features": [{
                "type": "Feature",
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [[[10.0, 0.0], [12.5, 0.0], [12.5, 2.5], [10.0, 2.5], [10.0, 0.0]]]
                }
            }]
        })
        .to_string()
        .as_bytes(),
    );
    let mut o_reg = ent.opciones.clone();
    o_reg.region = Some(geojson);
    o_reg.salida = ent.raiz.join("salida_reg");
    let inf_reg = correr(&o_reg).expect("corrida con region");
    assert_eq!(inf_reg.celdas_en_area, Some(134));
    assert_eq!(inf_reg.regiones_con_tierra, Some(4));
    assert_eq!(inf_reg.sin_celdas_por_ndvi, Some(2));
    let res_reg = leer_json(&o_reg.salida.join("resultados/p/OBJ-01.json"));
    assert_eq!(res_reg["celdas_en_area"], json!(134));
    assert_eq!(res_reg["regiones_con_tierra"], json!(4));
    assert_eq!(res_reg["sin_celdas_por_ndvi"], json!(2));
    let salen_reg: Vec<u64> = res_reg["candidatos"]
        .as_array()
        .expect("candidatos")
        .iter()
        .filter_map(|c| c["ipix"].as_u64())
        .collect();
    assert_eq!(salen_reg.len(), 4);
    assert!(!salen_reg.contains(&u64::from(ipix_fuera)));

    let mut o_bbox = ent.opciones.clone();
    o_bbox.bbox = Some([0.0, 10.0, 2.5, 12.5]);
    o_bbox.salida = ent.raiz.join("salida_bbox");
    let inf_bbox = correr(&o_bbox).expect("corrida con bbox");
    assert_eq!(inf_bbox.celdas_en_area, inf_reg.celdas_en_area);
    assert_eq!(inf_bbox.regiones_con_tierra, inf_reg.regiones_con_tierra);
    assert_eq!(inf_bbox.sin_celdas_por_ndvi, inf_reg.sin_celdas_por_ndvi);
    let res_bbox = leer_json(&o_bbox.salida.join("resultados/p/OBJ-01.json"));
    assert_eq!(res_bbox["candidatos"], res_reg["candidatos"]);
}

#[test]
fn poligono_y_bbox_cruzan_antimeridiano() {
    let dentro = malla_ipix(-1.4, 1.4, 178.6, -178.6, 30);
    let mut por_reg: BTreeMap<u32, Vec<u32>> = BTreeMap::new();
    for p in dentro {
        por_reg.entry(p >> 12).or_default().push(p);
    }
    let mut celdas: Vec<(u32, f32, f32)> = Vec::new();
    let mut regs = 0usize;
    for (_, ps) in por_reg {
        if ps.len() >= 32 {
            celdas.extend(ps.into_iter().take(32).map(|p| (p, 10.3, 0.1)));
            regs += 1;
            if regs == 4 {
                break;
            }
        }
    }
    assert_eq!(regs, 4);
    let fuera = u32::try_from(cdshealpix::nested::hash(12, 0.0, 0.0)).expect("ipix fuera");
    celdas.push((fuera, 10.0, 0.1));
    let ent = construir_tabla("antimeridiano", celdas);

    let geojson = ent.raiz.join("anti.geojson");
    escribir(
        &geojson,
        json!({
            "type": "Polygon",
            "coordinates": [[[178.5, -1.5], [-178.5, -1.5], [-178.5, 1.5], [178.5, 1.5], [178.5, -1.5]]]
        })
        .to_string()
        .as_bytes(),
    );
    let mut o_poly = ent.opciones.clone();
    o_poly.region = Some(geojson);
    o_poly.salida = ent.raiz.join("salida_poly");
    let inf_poly = correr(&o_poly).expect("poligono ±180");
    assert_eq!(inf_poly.regiones_con_tierra, Some(4));

    let res_poly = leer_json(&o_poly.salida.join("resultados/p/OBJ-01.json"));
    let lons: Vec<f64> = res_poly["candidatos"]
        .as_array()
        .expect("cands")
        .iter()
        .filter_map(|c| c["centro"]["lon"].as_f64())
        .collect();
    assert!(lons.iter().any(|&l| l > 170.0), "falta lado +180: {lons:?}");
    assert!(
        lons.iter().any(|&l| l < -170.0),
        "falta lado -180: {lons:?}"
    );

    let mut o_bbox = ent.opciones;
    o_bbox.bbox = Some([-1.5, 178.5, 1.5, -178.5]);
    o_bbox.salida = ent.raiz.join("salida_bbox");
    let inf_bbox = correr(&o_bbox).expect("bbox ±180");
    assert_eq!(inf_bbox.celdas_en_area, inf_poly.celdas_en_area);
}

#[test]
fn area_menor_al_minimo_y_area_sin_tierra_dan_error_claro() {
    let dentro = malla_ipix(0.2, 2.3, 10.2, 12.3, 28);
    let mut por_reg: BTreeMap<u32, Vec<u32>> = BTreeMap::new();
    for p in dentro {
        por_reg.entry(p >> 12).or_default().push(p);
    }
    let mut celdas = Vec::new();
    let mut n_regs = 0usize;
    for (_, ps) in por_reg {
        if ps.len() >= 32 {
            let tomar = if n_regs < 3 { 32 } else { 29 };
            celdas.extend(ps.into_iter().take(tomar).map(|p| (p, 10.3, 0.1)));
            n_regs += 1;
            if n_regs == 4 {
                break;
            }
        }
    }
    assert_eq!(n_regs, 4);
    let ent = construir_tabla("chica", celdas);

    let mut o_chica = ent.opciones.clone();
    o_chica.bbox = Some([0.0, 10.0, 2.5, 12.5]);
    let err = correr(&o_chica).expect_err("debe rechazar <4 regiones");
    let msg = format!("{err:#}");
    assert!(
        msg.contains('4') && msg.contains('3') && msg.contains("125"),
        "{msg}"
    );

    let mut o_mar = ent.opciones.clone();
    o_mar.bbox = Some([-40.0, -140.0, -35.0, -135.0]);
    let err_mar = correr(&o_mar).expect_err("mar");
    assert!(
        format!("{err_mar:#}").contains(
            "el área no tiene celdas de tierra elegibles (¿cae en el mar o fuera de la tabla?)"
        ),
        "{err_mar:#}"
    );

    let mut o_ambos = ent.opciones;
    o_ambos.bbox = Some([0.0, 10.0, 2.5, 12.5]);
    o_ambos.region = Some(ent.raiz.join("no_importa.geojson"));
    assert!(correr(&o_ambos).is_err());
    o_ambos.region = None;
    o_ambos.k_area = Some(0.0);
    assert!(correr(&o_ambos).is_err());
    o_ambos.k_area = Some(1.5);
    assert!(correr(&o_ambos).is_err());
}

#[test]
fn radio_efectivo_y_escenarios_1_vs_8_hilos() {
    assert!((radio_efectivo(100.0, 40_000.0, 0.1) - 20.0).abs() < 1e-12);
    assert!(Area::desde_geojson(r#"{"type":"Polygon","coordinates":[[[0,0],[1,0],[1,1],[0,1],[0,0]],[[0.2,0.2],[0.3,0.2],[0.3,0.3],[0.2,0.3],[0.2,0.2]]]}"#).is_ok());

    let (ent, _) = tabla_4_regiones_con_exterior("escenarios");

    let (lat_in, lon_in) = ent
        .ipix
        .iter()
        .map(|&p| centro_celda(12, p))
        .filter(|&(lat, lon)| (0.0..=2.5).contains(&lat) && (10.0..=12.5).contains(&lon))
        .min_by(|a, b| a.1.total_cmp(&b.1))
        .expect("celda interior");
    let lon_fuera = 9.98;
    let d_km = haversine_km(lat_in, lon_in, lat_in, lon_fuera);
    assert!(d_km > 1.0 && d_km < 16.0, "d_km={d_km}");
    let idx_ruta = ent.raiz.join("indice.json");
    escribir(
        &idx_ruta,
        json!([{
            "id": "FUERA", "lat": lat_in, "lon": lon_fuera, "radio_km": 500.0,
            "estado": "documentado", "fuente": "EJEMPLO", "fecha": "2026-11-15"
        }])
        .to_string()
        .as_bytes(),
    );

    let mut o_chico = ent.opciones.clone();
    o_chico.bbox = Some([0.0, 10.0, 2.5, 12.5]);
    o_chico.indice = Some(idx_ruta.clone());
    o_chico.k_area = Some(0.01);
    o_chico.salida = ent.raiz.join("sal_k01");
    let inf_k001 = correr(&o_chico).expect("k 0.01");
    assert_eq!(inf_k001.excluidos_por_indice, Some(0));

    let mut o_grande = ent.opciones.clone();
    o_grande.bbox = Some([0.0, 10.0, 2.5, 12.5]);
    o_grande.indice = Some(idx_ruta.clone());
    o_grande.k_area = Some(1.0);
    o_grande.salida = ent.raiz.join("sal_k1");
    let inf_k1 = correr(&o_grande).expect("k 1.0");
    assert!(inf_k1.excluidos_por_indice.unwrap_or(0) > 0);

    let esc_ruta = ent.raiz.join("esc.json");
    escribir(
        &esc_ruta,
        json!({"escenarios": [{"id": "base", "objetivo": "OBJ-01", "perfil": "p"}]})
            .to_string()
            .as_bytes(),
    );
    let correr_esc = |h: usize| {
        let mut o = o_grande.clone();
        o.hilos = Some(h);
        o.salida = ent.raiz.join(format!("esc_h{h}"));
        correr_escenarios(&o, &esc_ruta).expect("escenarios")
    };
    let e1 = correr_esc(1);
    let e8 = correr_esc(8);
    assert_eq!(e1.medicion.celdas_en_area, Some(134));
    assert_eq!(
        serde_json::to_value(&e1.robustez).expect("val"),
        serde_json::to_value(&e8.robustez).expect("val")
    );
    assert_eq!(
        serde_json::to_value(&e1.escenarios).expect("val"),
        serde_json::to_value(&e8.escenarios).expect("val")
    );
}
