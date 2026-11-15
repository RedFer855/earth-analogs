export interface Coordenada {
  lat: number;
  lon: number;
}

/**
 * Parsea coordenadas decimales tipo Google Maps ("14.0540, -87.2489"),
 * separadas por coma, punto y coma o espacio, con soporte opcional de ° y N/S/E/W.
 */
export function parsearCoordenadas(texto: string): Coordenada | null {
  const limpio = texto.trim();
  if (!limpio) return null;

  const m =
    /^\s*([+-]?\d+(?:\.\d+)?)\s*°?\s*([NSns]?)\s*[,;\s]+\s*([+-]?\d+(?:\.\d+)?)\s*°?\s*([EWew]?)\s*$/.exec(
      limpio,
    );
  if (!m) return null;

  let lat = Number(m[1]);
  let lon = Number(m[3]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const hemiLat = m[2].toUpperCase();
  const hemiLon = m[4].toUpperCase();
  if (hemiLat === 'S') lat = -Math.abs(lat);
  if (hemiLat === 'N') lat = Math.abs(lat);
  if (hemiLon === 'W') lon = -Math.abs(lon);
  if (hemiLon === 'E') lon = Math.abs(lon);

  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { lat, lon };
}

export function formatearAlturaM(metros: number): string {
  if (!Number.isFinite(metros) || metros < 0) return '—';
  if (metros < 1000) return `${Math.round(metros)} m`;
  if (metros < 100_000) return `${(metros / 1000).toFixed(1)} km`;
  return `${Math.round(metros / 1000).toLocaleString('es')} km`;
}
