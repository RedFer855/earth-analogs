#![expect(
    clippy::indexing_slicing,
    reason = "ayuda de pruebas: un índice fuera de rango es un fallo de la prueba"
)]

pub struct Azar(u64);

impl Azar {
    pub fn new(semilla: u64) -> Self {
        Self(semilla ^ 0x9E37_79B9_7F4A_7C15 | 1)
    }

    fn siguiente(&mut self) -> u64 {
        let mut x = self.0;
        x ^= x >> 12;
        x ^= x << 25;
        x ^= x >> 27;
        self.0 = x;
        x.wrapping_mul(0x2545_F491_4F6C_DD1D)
    }

    pub fn unif(&mut self) -> f64 {
        let alto = u32::try_from(self.siguiente() >> 32).unwrap_or(0);
        f64::from(alto) / 4_294_967_296.0
    }

    pub fn rango(&mut self, a: f64, b: f64) -> f64 {
        a + (b - a) * self.unif()
    }

    pub fn entero(&mut self, n: usize) -> usize {
        let n32 = u32::try_from(n).unwrap_or(u32::MAX);
        usize::try_from(u32::try_from(self.siguiente() >> 32).unwrap_or(0) % n32).unwrap_or(0)
    }
}

pub fn correlacion_aleatoria(azar: &mut Azar, k: usize, fuerza: f64) -> Vec<f64> {
    let b: Vec<f64> = (0..k * k).map(|_| azar.rango(-1.0, 1.0) * fuerza).collect();
    let mut a = vec![0.0; k * k];
    for i in 0..k {
        for j in 0..k {
            let mut s: f64 = (0..k).map(|l| b[i * k + l] * b[j * k + l]).sum();
            if i == j {
                s += 1.0;
            }
            a[i * k + j] = s;
        }
    }
    let mut r = vec![0.0; k * k];
    for i in 0..k {
        for j in 0..k {
            r[i * k + j] = a[i * k + j] / (a[i * k + i] * a[j * k + j]).sqrt();
        }
    }
    r
}

pub fn equicorrelada(k: usize, r: f64) -> Vec<f64> {
    (0..k * k)
        .map(|p| if p / k == p % k { 1.0 } else { r })
        .collect()
}
