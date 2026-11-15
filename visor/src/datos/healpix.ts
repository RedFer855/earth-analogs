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

  let jp = (JPLL[cara] * nr + fx - fy + 1 + kshift) / 2;
  if (jp > 4 * nside) jp -= 4 * nside;
  if (jp < 1) jp += 4 * nside;

  const phi = ((jp - (kshift + 1) * 0.5) * (Math.PI / 2)) / nr;
  const lat = Math.asin(Math.max(-1, Math.min(1, z))) * RAD_A_DEG;
  let lon = phi * RAD_A_DEG;
  if (lon > 180) lon -= 360;
  return [lat, lon];
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

  // En HEALPix nested, (ix, iy) está en [0, nside-1]; las esquinas son (ix ± 0.5, iy ± 0.5)
  // relativas al centro (ix, iy) en la proyección xyf (desplazado por -0.5 en cada eje respecto al borde)
  const esquinas = offsets.map(([dx, dy]) =>
    xyfAUnidad(ix + dx - 0.5, iy + dy - 0.5, cara, nside),
  ) as [[number, number], [number, number], [number, number], [number, number]];

  const lonRef = esquinas[0][1];
  for (let i = 1; i < 4; i += 1) {
    let d = esquinas[i][1] - lonRef;
    while (d > 180) d -= 360;
    while (d < -180) d += 360;
    esquinas[i] = [esquinas[i][0], lonRef + d];
  }
  return esquinas;
}
