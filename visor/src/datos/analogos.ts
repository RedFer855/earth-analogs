// Catálogo de análogos documentados de la Tierra (datos/analogos-tierra.json, desde etl/sitios).

export interface AnalogoTierra {
  codigo: string;
  nombre: string;
  pais: string;
  lat: number;
  lon: number;
  radio_km: number;
  cuerpo: 'luna' | 'marte' | 'ambos';
  uso: string;
  programa: string;
}

export interface CatalogoAnalogos {
  descripcion: string;
  fuente: { investigacion: string; lista_europlanet?: string; coordenadas_verificadas: boolean; nota: string };
  sitios: AnalogoTierra[];
}

export function validarCatalogo(d: unknown): CatalogoAnalogos | null {
  const c = d as CatalogoAnalogos | null;
  if (!c || !Array.isArray(c.sitios)) return null;
  const sitios = c.sitios.filter(
    (s) =>
      typeof s.codigo === 'string' &&
      typeof s.nombre === 'string' &&
      Number.isFinite(s.lat) &&
      Number.isFinite(s.lon) &&
      Math.abs(s.lat) <= 90 &&
      Math.abs(s.lon) <= 180,
  );
  return { ...c, sitios };
}

export async function cargarAnalogos(base = 'datos/'): Promise<CatalogoAnalogos | null> {
  try {
    const res = await fetch(`${base.replace(/\/+$/, '')}/analogos-tierra.json`);
    if (!res.ok) return null;
    return validarCatalogo(await res.json());
  } catch {
    return null;
  }
}
