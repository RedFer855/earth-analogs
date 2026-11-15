import type { Coordenada } from './coordenadas';

const RADIO_TIERRA_M = 6_371_008.8;
const RAD = Math.PI / 180;

export function normalizarLon(lon: number): number {
  let l = lon;
  while (l > 180) l -= 360;
  while (l < -180) l += 360;
  return l;
}

export function distanciaGeodesicaM(a: Coordenada, b: Coordenada): number {
  const dLat = (b.lat - a.lat) * RAD;
  const dLon = (b.lon - a.lon) * RAD;
  const lat1 = a.lat * RAD;
  const lat2 = b.lat * RAD;
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLon * sinLon;
  return 2 * RADIO_TIERRA_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function desenrollarLongitudes(coords: Coordenada[]): Coordenada[] {
  if (coords.length === 0) return [];
  const res: Coordenada[] = [{ lat: coords[0].lat, lon: coords[0].lon }];
  for (let i = 1; i < coords.length; i += 1) {
    let lon = coords[i].lon;
    const prev = res[i - 1].lon;
    while (lon - prev > 180) lon -= 360;
    while (lon - prev < -180) lon += 360;
    res.push({ lat: coords[i].lat, lon });
  }
  return res;
}

export function perimetroEsfericoM(coords: Coordenada[]): number {
  if (coords.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < coords.length; i += 1) {
    total += distanciaGeodesicaM(coords[i], coords[(i + 1) % coords.length]);
  }
  return total;
}

/** Área geodésica aproximada en m² usando exceso esférico por trapecios sobre la esfera. */
export function areaEsfericaM2(coords: Coordenada[]): number {
  if (coords.length < 3) return 0;
  const anillo = desenrollarLongitudes(coords);
  let suma = 0;
  for (let i = 0; i < anillo.length; i += 1) {
    const p1 = anillo[i];
    const p2 = anillo[(i + 1) % anillo.length];
    const lon1 = p1.lon * RAD;
    const lon2 = p2.lon * RAD;
    const lat1 = p1.lat * RAD;
    const lat2 = p2.lat * RAD;
    suma += (lon2 - lon1) * (2 + Math.sin(lat1) + Math.sin(lat2));
  }
  return Math.abs((suma * RADIO_TIERRA_M * RADIO_TIERRA_M) / 2);
}

function orientacion(a: Coordenada, b: Coordenada, c: Coordenada): number {
  return (b.lon - a.lon) * (c.lat - a.lat) - (b.lat - a.lat) * (c.lon - a.lon);
}

function segmentosSeCruzan(a: Coordenada, b: Coordenada, c: Coordenada, d: Coordenada): boolean {
  const o1 = orientacion(a, b, c);
  const o2 = orientacion(a, b, d);
  const o3 = orientacion(c, d, a);
  const o4 = orientacion(c, d, b);
  return o1 * o2 < 0 && o3 * o4 < 0;
}

export function hayAutoInterseccion(coords: Coordenada[]): boolean {
  const n = coords.length;
  if (n < 4) return false;
  const anillo = desenrollarLongitudes(coords);
  for (let i = 0; i < n; i += 1) {
    const a = anillo[i];
    const b = anillo[(i + 1) % n];
    for (let j = i + 2; j < n; j += 1) {
      if (i === 0 && j === n - 1) continue;
      if (segmentosSeCruzan(a, b, anillo[j], anillo[(j + 1) % n])) return true;
    }
  }
  return false;
}

/** Reordena vértices mediante 2-opt si existen cruces de aristas. */
export function destorcerPoligono(coords: Coordenada[]): Coordenada[] {
  const n = coords.length;
  if (n < 4) return coords.map((c) => ({ ...c }));
  const res = desenrollarLongitudes(coords);
  for (let iter = 0; iter < n * 4; iter += 1) {
    let cambio = false;
    for (let i = 0; i < n; i += 1) {
      for (let j = i + 2; j < n; j += 1) {
        if (i === 0 && j === n - 1) continue;
        if (segmentosSeCruzan(res[i], res[(i + 1) % n], res[j], res[(j + 1) % n])) {
          const tramo = res.slice(i + 1, j + 1).reverse();
          res.splice(i + 1, j - i, ...tramo);
          cambio = true;
        }
      }
    }
    if (!cambio) break;
  }
  return res.map((c) => ({ lat: c.lat, lon: normalizarLon(c.lon) }));
}

export function construirCuadroPorPerimetro(centro: Coordenada, perimetroKm: number): Coordenada[] {
  const ladoM = (perimetroKm * 1000) / 4;
  const mitadM = ladoM / 2;
  const dLat = (mitadM / RADIO_TIERRA_M) / RAD;
  const cosLat = Math.max(0.05, Math.cos(centro.lat * RAD));
  const dLon = (mitadM / (RADIO_TIERRA_M * cosLat)) / RAD;
  return [
    { lat: centro.lat + dLat, lon: normalizarLon(centro.lon - dLon) },
    { lat: centro.lat + dLat, lon: normalizarLon(centro.lon + dLon) },
    { lat: centro.lat - dLat, lon: normalizarLon(centro.lon + dLon) },
    { lat: centro.lat - dLat, lon: normalizarLon(centro.lon - dLon) },
  ];
}

export function construirCirculoPorPerimetro(
  centro: Coordenada,
  perimetroKm: number,
  segmentos = 48,
): Coordenada[] {
  const radioM = (perimetroKm * 1000) / (2 * Math.PI);
  const cosLat = Math.max(0.05, Math.cos(centro.lat * RAD));
  const pts: Coordenada[] = [];
  for (let i = 0; i < segmentos; i += 1) {
    const ang = (i / segmentos) * 2 * Math.PI;
    const dLat = ((radioM * Math.sin(ang)) / RADIO_TIERRA_M) / RAD;
    const dLon = ((radioM * Math.cos(ang)) / (RADIO_TIERRA_M * cosLat)) / RAD;
    pts.push({ lat: centro.lat + dLat, lon: normalizarLon(centro.lon + dLon) });
  }
  return pts;
}

export function puntoEnPoligono(lat: number, lon: number, poligono: Coordenada[]): boolean {
  if (poligono.length < 3) return false;
  const anillo = desenrollarLongitudes(poligono);
  let lonPrueba = lon;
  const lonRef = anillo[0].lon;
  while (lonPrueba - lonRef > 180) lonPrueba -= 360;
  while (lonPrueba - lonRef < -180) lonPrueba += 360;

  let dentro = false;
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const yi = anillo[i].lat;
    const xi = anillo[i].lon;
    const yj = anillo[j].lat;
    const xj = anillo[j].lon;
    const intersecta =
      yi > lat !== yj > lat &&
      lonPrueba < ((xj - xi) * (lat - yi)) / (yj - yi + 1e-15) + xi;
    if (intersecta) dentro = !dentro;
  }
  return dentro;
}
