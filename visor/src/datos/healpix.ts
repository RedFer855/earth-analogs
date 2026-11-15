const JRLL = [2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4];
const JPLL = [1, 3, 5, 7, 0, 2, 4, 6, 1, 3, 5, 7];

const RAD_A_DEG = 180 / Math.PI;
const DOS_TERCIOS = 2 / 3;

function deintercalar(n: number): number {
  let x = n & 0x55555555;
  x = (x | (x >>> 1)) & 0x33333333;
  x = (x | (x >>> 2)) & 0x0f0f0f0f;
  x = (x | (x >>> 4)) & 0x00ff00ff;
  x = (x | (x >>> 8)) & 0x0000ffff;
  return x;
}

function xyfAUnidad(fx: number, fy: number, cara: number, nside: number): [number, number] {
  const jr = JRLL[cara] * nside - fx - fy - 1;
  let z: number;
  let nr: number;
  let kshift: number;

  if (jr < nside) {
    nr = jr;
    const tmp = (nr * nr) / (nside * nside);
    z = 1 - tmp / 3;
    kshift = 0;
  } else if (jr > 3 * nside) {
    nr = 4 * nside - jr;
    const tmp = (nr * nr) / (nside * nside);
    z = tmp / 3 - 1;
    kshift = 0;
  } else {
    nr = nside;
    z = ((2 * nside - jr) * DOS_TERCIOS) / nside;
    kshift = (jr - nside) & 1;
  }

  // Esquina en el polo (anillo 0 o 4·nside): la longitud no está definida y la
  // fórmula de phi divide entre nr = 0. Se devuelve NaN y ipixAVertices la resuelve.
  if (nr <= 0) return [z > 0 ? 90 : -90, Number.NaN];

  let jp = (JPLL[cara] * nr + fx - fy + 1 + kshift) / 2;
  if (jp > 4 * nside) jp -= 4 * nside;
  if (jp < 1) jp += 4 * nside;

  const phi = ((jp - (kshift + 1) * 0.5) * (Math.PI / 2)) / nr;
  const lat = Math.asin(Math.max(-1, Math.min(1, z))) * RAD_A_DEG;
  return [lat, envolver180(phi * RAD_A_DEG)];
}

/** Lleva una longitud a (-180, 180] sin bucles (un bucle con Infinity no termina). */
function envolver180(lon: number): number {
  const l = (((lon + 180) % 360) + 360) % 360 - 180;
  return l === -180 ? 180 : l;
}

/**
 * Punto de la cara `cara` con coordenadas continuas (x, y) en [0, 1] a [lat, lon].
 * Es `xyf2loc` de la biblioteca HEALPix (healpix_base.cc). En el polo (nr = 0) la
 * longitud no está definida y se devuelve NaN.
 */
function xyfALocal(x: number, y: number, cara: number): [number, number] {
  const jr = JRLL[cara] - x - y;
  let nr: number;
  let z: number;
  if (jr < 1) {
    nr = jr;
    z = 1 - (nr * nr) / 3;
  } else if (jr > 3) {
    nr = 4 - jr;
    z = (nr * nr) / 3 - 1;
  } else {
    nr = 1;
    z = ((2 - jr) * 2) / 3;
  }
  const lat = Math.asin(Math.max(-1, Math.min(1, z))) * RAD_A_DEG;
  if (nr < 1e-15) return [z > 0 ? 90 : -90, Number.NaN];

  let tmp = JPLL[cara] * nr + x - y;
  if (tmp < 0) tmp += 8;
  if (tmp >= 8) tmp -= 8;
  const phi = (0.25 * Math.PI * tmp) / nr;
  return [lat, envolver180(phi * RAD_A_DEG)];
}

export function ipixACentro(ipix: number, nside: number): [number, number] {
  const npface = nside * nside;
  const cara = Math.floor(ipix / npface);
  const ipf = ipix - cara * npface;
  const ix = deintercalar(ipf);
  const iy = deintercalar(ipf >>> 1);
  return xyfAUnidad(ix + 0.5 - 0.5, iy + 0.5 - 0.5, cara, nside);
}

/**
 * Devuelve las 4 esquinas [lat, lon] de la celda HEALPix nested (ipix, nside),
 * manteniendo las longitudes continuas respecto a la primera esquina para cruzar ±180°.
 */
export function ipixAVertices(
  ipix: number,
  nside: number,
): [[number, number], [number, number], [number, number], [number, number]] {
  const npface = nside * nside;
  const cara = Math.floor(ipix / npface);
  const ipf = ipix - cara * npface;
  const ix = deintercalar(ipf);
  const iy = deintercalar(ipf >>> 1);

  const offsets: [number, number][] = [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ];

  // Las esquinas de la celda son (ix + dx, iy + dy) / nside en coordenadas de la cara.
  const esquinas = offsets.map(([dx, dy]) =>
    xyfALocal((ix + dx) / nside, (iy + dy) / nside, cara),
  ) as [[number, number], [number, number], [number, number], [number, number]];

  // Desenrolla respecto a la primera esquina con longitud definida.
  const ref = esquinas.find((e) => Number.isFinite(e[1]));
  const lonRef = ref ? ref[1] : 0;
  const definidas: number[] = [];
  for (let i = 0; i < 4; i += 1) {
    if (!Number.isFinite(esquinas[i][1])) continue;
    const d = envolver180(esquinas[i][1] - lonRef);
    esquinas[i] = [esquinas[i][0], lonRef + d];
    definidas.push(lonRef + d);
  }

  // La esquina del polo toma el promedio de las otras: así el polígono queda
  // como un triángulo con vértice en el polo, sin coordenadas NaN.
  const lonPolo = definidas.length > 0 ? definidas.reduce((a, b) => a + b, 0) / definidas.length : 0;
  for (let i = 0; i < 4; i += 1) {
    if (!Number.isFinite(esquinas[i][1])) esquinas[i] = [esquinas[i][0], lonPolo];
  }
  return esquinas;
}

// --- Punto → celda (ang2pix nested) con latitud autálica, igual que etl/comun.py y el motor ---

const F_WGS84 = 1 / 298.257223563;
const E2 = F_WGS84 * (2 - F_WGS84);
const EXC = Math.sqrt(E2);
const qAut = (s: number): number => (1 - E2) * (s / (1 - E2 * s * s) - Math.log((1 - EXC * s) / (1 + EXC * s)) / (2 * EXC));
const QP = qAut(1);

export function geodesicaAAutalica(latDeg: number): number {
  const v = qAut(Math.sin(latDeg / RAD_A_DEG)) / QP;
  return Math.asin(Math.max(-1, Math.min(1, v))) * RAD_A_DEG;
}

function intercalar(x: number): number {
  let v = x & 0xffff;
  v = (v | (v << 8)) & 0x00ff00ff;
  v = (v | (v << 4)) & 0x0f0f0f0f;
  v = (v | (v << 2)) & 0x33333333;
  v = (v | (v << 1)) & 0x55555555;
  return v >>> 0;
}

/** Celda nested que contiene (lat, lon) geodésicos. */
export function ang2pixNested(nside: number, latDeg: number, lonDeg: number): number {
  const z = Math.sin(geodesicaAAutalica(latDeg) / RAD_A_DEG);
  let lon = lonDeg % 360;
  if (lon < 0) lon += 360;
  const tt = lon / 90;
  const za = Math.abs(z);
  let cara: number;
  let ix: number;
  let iy: number;
  if (za <= DOS_TERCIOS) {
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

/** Índice de `ipix` en una lista ordenada ascendente, o -1. */
export function buscarIpix(lista: Uint32Array, ipix: number): number {
  let lo = 0;
  let hi = lista.length - 1;
  while (lo <= hi) {
    const m = (lo + hi) >>> 1;
    if (lista[m] === ipix) return m;
    if (lista[m] < ipix) lo = m + 1;
    else hi = m - 1;
  }
  return -1;
}
