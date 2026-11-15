//! Geometría: distancias sobre la esfera y el paso entre la latitud de `HEALPix` y la latitud WGS84.
//!
//! La malla del ETL (E-01) vive en una esfera de radio autálico: la latitud de `HEALPix` es **autálica** (conserva
//! áreas). Las coordenadas de la tabla (`grid/lat.f32`), de los sitios y de los mapas son **geodésicas** WGS84. La
//! diferencia llega a 0.128° (unos 14 km) cerca de los 45°. Todo lo que el motor escribe o compara con coordenadas
//! de fuera pasa por `autalica_a_geodesica` o `geodesica_a_autalica`, con las mismas fórmulas que `etl/comun.py`.

pub const RADIO_TIERRA_KM: f64 = 6371.0;

/// Excentricidad al cuadrado de WGS84 (f = 1 / 298.257223563).
const E2: f64 = (1.0 / 298.257_223_563) * (2.0 - 1.0 / 298.257_223_563);

#[must_use]
pub fn normalizar_lon(lon: f64) -> f64 {
    (lon + 180.0).rem_euclid(360.0) - 180.0
}

#[must_use]
pub fn haversine_km(lat_a: f64, lon_a: f64, lat_b: f64, lon_b: f64) -> f64 {
    let (dl, dn) = ((lat_b - lat_a).to_radians(), (lon_b - lon_a).to_radians());
    let h = (dl / 2.0).sin().powi(2)
        + lat_a.to_radians().cos() * lat_b.to_radians().cos() * (dn / 2.0).sin().powi(2);
    2.0 * RADIO_TIERRA_KM * h.sqrt().min(1.0).asin()
}

/// Latitud autálica a geodésica, en grados (serie de Snyder 1987, ec. 3-18).
#[must_use]
pub fn autalica_a_geodesica(beta_deg: f64) -> f64 {
    let b = beta_deg.to_radians();
    let (e2, e4, e6) = (E2, E2 * E2, E2 * E2 * E2);
    let phi = b
        + (e2 / 3.0 + 31.0 * e4 / 180.0 + 517.0 * e6 / 5040.0) * (2.0 * b).sin()
        + (23.0 * e4 / 360.0 + 251.0 * e6 / 3780.0) * (4.0 * b).sin()
        + (761.0 * e6 / 45360.0) * (6.0 * b).sin();
    phi.to_degrees()
}

/// Latitud geodésica a autálica, en grados (fórmula cerrada de q, Snyder 1987, ec. 3-11 y 3-12).
#[must_use]
pub fn geodesica_a_autalica(phi_deg: f64) -> f64 {
    let e = E2.sqrt();
    let q = |s: f64| {
        (1.0 - E2) * (s / (1.0 - E2 * s * s) - ((1.0 - e * s) / (1.0 + e * s)).ln() / (2.0 * e))
    };
    let s = phi_deg.to_radians().sin();
    (q(s) / q(1.0)).clamp(-1.0, 1.0).asin().to_degrees()
}

/// Centro de una celda como (latitud geodésica, longitud) en grados.
#[must_use]
pub fn centro_celda(nivel: u8, ipix: u32) -> (f64, f64) {
    let (lon, lat) = cdshealpix::nested::center(nivel, u64::from(ipix));
    (
        autalica_a_geodesica(lat.to_degrees()),
        normalizar_lon(lon.to_degrees()),
    )
}

#[must_use]
pub fn vector_unitario(lat_deg: f64, lon_deg: f64) -> [f64; 3] {
    let (lat, lon) = (lat_deg.to_radians(), lon_deg.to_radians());
    let cos_lat = lat.cos();
    [cos_lat * lon.cos(), cos_lat * lon.sin(), lat.sin()]
}

#[cfg(test)]
mod pruebas {
    use super::{autalica_a_geodesica, geodesica_a_autalica};

    #[test]
    fn ida_y_vuelta_y_valores_conocidos() {
        for i in -90..=90 {
            let phi = f64::from(i);
            let vuelta = autalica_a_geodesica(geodesica_a_autalica(phi));
            // la serie de Snyder (la misma del ETL) se aleja menos de 1e-5° (~1 m), lo peor en los polos
            assert!((vuelta - phi).abs() < 1e-5, "{phi}: {vuelta}");
        }
        // en el ecuador y los polos coinciden; a 45° la geodésica supera a la autálica en ~0.128°
        assert!(autalica_a_geodesica(0.0).abs() < 1e-12);
        assert!((autalica_a_geodesica(90.0) - 90.0).abs() < 1e-9);
        let d = 45.0 - geodesica_a_autalica(45.0);
        assert!((d - 0.1283).abs() < 1e-3, "diferencia a 45°: {d}");
    }
}
