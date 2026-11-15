// HEALPix nested (ang2pix y centro) y latitud autálica, con las mismas fórmulas que etl/comun.py y
// motor/pipeline/src/geo.rs: la malla está sobre la esfera autálica; la entrada y la salida son WGS84 geodésicas.

const F_WGS84 = 1 / 298.257223563;
const E2 = F_WGS84 * (2 - F_WGS84);
const E = Math.sqrt(E2);
const RAD = Math.PI / 180;

function q(s) {
  return (1 - E2) * (s / (1 - E2 * s * s) - Math.log((1 - E * s) / (1 + E * s)) / (2 * E));
}
const QP = q(1);

export function geodesicaAAutalica(latDeg) {
  const v = q(Math.sin(latDeg * RAD)) / QP;
  return Math.asin(Math.max(-1, Math.min(1, v))) / RAD;
}

export function autalicaAGeodesica(betaDeg) {
  const b = betaDeg * RAD;
  const e4 = E2 * E2;
  const e6 = e4 * E2;
  const phi =
    b +
    (E2 / 3 + (31 * e4) / 180 + (517 * e6) / 5040) * Math.sin(2 * b) +
    ((23 * e4) / 360 + (251 * e6) / 3780) * Math.sin(4 * b) +
    ((761 * e6) / 45360) * Math.sin(6 * b);
  return phi / RAD;
}

function intercalar(x) {
  let v = x & 0xffff;
  v = (v | (v << 8)) & 0x00ff00ff;
  v = (v | (v << 4)) & 0x0f0f0f0f;
  v = (v | (v << 2)) & 0x33333333;
  v = (v | (v << 1)) & 0x55555555;
  return v >>> 0;
}

function deintercalar(n) {
  let x = n & 0x55555555;
  x = (x | (x >>> 1)) & 0x33333333;
  x = (x | (x >>> 2)) & 0x0f0f0f0f;
  x = (x | (x >>> 4)) & 0x00ff00ff;
  x = (x | (x >>> 8)) & 0x0000ffff;
  return x;
}

/** Celda nested que contiene (lat, lon) geodésicos, para nside potencia de 2 hasta 2^13. */
export function ang2pixNested(nside, latDeg, lonDeg) {
  const z = Math.sin(geodesicaAAutalica(latDeg) * RAD);
  let lon = lonDeg % 360;
  if (lon < 0) lon += 360;
  const tt = (lon * RAD) / (Math.PI / 2);
  const za = Math.abs(z);
  let cara;
  let ix;
  let iy;
  if (za <= 2 / 3) {
    const t1 = nside * (0.5 + tt);
    const t2 = nside * z * 0.75;
    const jp = Math.floor(t1 - t2);
    const jm = Math.floor(t1 + t2);
    const ifp = Math.floor(jp / nside);
    const ifm = Math.floor(jm / nside);
    cara = ifp === ifm ? ifp | 4 : ifp < ifm ? ifp : ifm + 8;
    ix = jm & (nside - 1);
    iy = nside - (jp & (nside - 1)) - 1;
  } else {
    const ntt = Math.min(3, Math.floor(tt));
    const tp = tt - ntt;
    const tmp = nside * Math.sqrt(3 * (1 - za));
    const jp = Math.min(nside - 1, Math.floor(tp * tmp));
    const jm = Math.min(nside - 1, Math.floor((1 - tp) * tmp));
    if (z >= 0) {
      cara = ntt;
      ix = nside - jm - 1;
      iy = nside - jp - 1;
    } else {
      cara = ntt + 8;
      ix = jp;
      iy = jm;
    }
  }
  return cara * nside * nside + intercalar(ix) + intercalar(iy) * 2;
}

const JRLL = [2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4];
const JPLL = [1, 3, 5, 7, 0, 2, 4, 6, 1, 3, 5, 7];

/** Centro geodésico [lat, lon] de una celda nested. */
export function centroNested(nside, ipix) {
  const npface = nside * nside;
  const cara = Math.floor(ipix / npface);
  const ipf = ipix - cara * npface;
  const ix = deintercalar(ipf);
  const iy = deintercalar(ipf >>> 1);
  const jr = JRLL[cara] * nside - ix - iy - 1;
  let z;
  let nr;
  let kshift;
  if (jr < nside) {
    nr = jr;
    z = 1 - (nr * nr) / (3 * nside * nside);
    kshift = 0;
  } else if (jr > 3 * nside) {
    nr = 4 * nside - jr;
    z = (nr * nr) / (3 * nside * nside) - 1;
    kshift = 0;
  } else {
    nr = nside;
    z = (2 * (2 * nside - jr)) / (3 * nside);
    kshift = (jr - nside) & 1;
  }
  let jp = (JPLL[cara] * nr + ix - iy + 1 + kshift) / 2;
  if (jp > 4 * nside) jp -= 4 * nside;
  if (jp < 1) jp += 4 * nside;
  const phi = ((jp - (kshift + 1) * 0.5) * (Math.PI / 2)) / nr;
  let lon = phi / RAD;
  if (lon > 180) lon -= 360;
  const beta = Math.asin(Math.max(-1, Math.min(1, z))) / RAD;
  return [autalicaAGeodesica(beta), lon];
}

/** Distancia de gran círculo en km sobre la esfera autálica de la Tierra. */
export function distanciaKm(lat1, lon1, lat2, lon2) {
  const R = 6371.0072;
  const a1 = lat1 * RAD;
  const a2 = lat2 * RAD;
  const dLat = a2 - a1;
  const dLon = (lon2 - lon1) * RAD;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a1) * Math.cos(a2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** ¿Está (lat, lon) en la caja [lat1, lon1, lat2, lon2]? Si lon1 > lon2 la caja cruza ±180°. */
export function enBbox(bbox, lat, lon) {
  const [la1, lo1, la2, lo2] = bbox;
  if (lat < Math.min(la1, la2) || lat > Math.max(la1, la2)) return false;
  return lo1 <= lo2 ? lon >= lo1 && lon <= lo2 : lon >= lo1 || lon <= lo2;
}
