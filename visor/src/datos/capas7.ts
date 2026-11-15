export interface ColumnaCapas7 {
  archivo: string;
  unidad: string;
  fuente: string;
  url: string;
  licencia: string;
  metodo: string;
  cobertura_pct: number;
  p1: number;
  p50: number;
  p99: number;
}

export interface Capas7Json {
  nivel: number;
  nside: number;
  esquema: string;
  n_celdas: number;
  archivos: {
    ipix: string;
    n_hijas: string;
  };
  columnas: Record<string, ColumnaCapas7>;
}

export type OperadorCondicion = '<=' | '>=';

export interface CondicionBusqueda {
  columna: string;
  op: OperadorCondicion;
  umbral: number;
}

export interface ResultadoBusqueda {
  conteos: Uint8Array;
  totalCondiciones: number;
  celdasTodas: number;
  celdasAlguna: number;
}

export interface DatosCapas7 {
  meta: Capas7Json;
  ipix: Uint32Array;
  cacheColumnas: Map<string, Float32Array>;
}

function unir(base: string, archivo: string): string {
  return `${base.replace(/\/+$/, '')}/${archivo.replace(/^\/+/, '')}`;
}

export async function cargarCapas7(base = 'datos/capas7/'): Promise<DatosCapas7 | null> {
  const resMeta = await fetch(unir(base, 'capas7.json'));
  if (resMeta.status === 404) return null;
  if (!resMeta.ok) {
    throw new Error(`No se pudo cargar capas7.json (HTTP ${resMeta.status}).`);
  }
  const meta = (await resMeta.json()) as Capas7Json;
  const resIpix = await fetch(unir(base, meta.archivos.ipix));
  if (!resIpix.ok) {
    throw new Error(`No se pudo cargar ${meta.archivos.ipix} (HTTP ${resIpix.status}).`);
  }
  const buf = await resIpix.arrayBuffer();
  const ipix = new Uint32Array(buf);
  if (ipix.length !== meta.n_celdas) {
    throw new Error(
      `Longitud de ipix (${ipix.length}) no coincide con n_celdas (${meta.n_celdas}).`,
    );
  }
  return { meta, ipix, cacheColumnas: new Map() };
}

export async function obtenerColumnaCapas7(
  datos: DatosCapas7,
  columna: string,
  base = 'datos/capas7/',
): Promise<Float32Array> {
  const existente = datos.cacheColumnas.get(columna);
  if (existente) return existente;

  const info = datos.meta.columnas[columna];
  if (!info) {
    throw new Error(`Columna desconocida en capas7: ${columna}`);
  }
  const res = await fetch(unir(base, info.archivo));
  if (!res.ok) {
    throw new Error(`No se pudo cargar ${info.archivo} (HTTP ${res.status}).`);
  }
  const buf = await res.arrayBuffer();
  const arr = new Float32Array(buf);
  if (arr.length !== datos.meta.n_celdas) {
    throw new Error(
      `Longitud de ${info.archivo} (${arr.length}) no coincide con n_celdas (${datos.meta.n_celdas}).`,
    );
  }
  datos.cacheColumnas.set(columna, arr);
  return arr;
}

export function evaluarCondiciones(
  nCeldas: number,
  columnas: Map<string, Float32Array>,
  condiciones: CondicionBusqueda[],
): ResultadoBusqueda {
  const conteos = new Uint8Array(nCeldas);
  const totalCondiciones = condiciones.length;
  if (totalCondiciones === 0) {
    return { conteos, totalCondiciones: 0, celdasTodas: 0, celdasAlguna: 0 };
  }

  for (const cond of condiciones) {
    const arr = columnas.get(cond.columna);
    if (!arr) continue;
    if (cond.op === '<=') {
      for (let i = 0; i < nCeldas; i += 1) {
        const v = arr[i];
        if (Number.isFinite(v) && v <= cond.umbral) {
          conteos[i] += 1;
        }
      }
    } else {
      for (let i = 0; i < nCeldas; i += 1) {
        const v = arr[i];
        if (Number.isFinite(v) && v >= cond.umbral) {
          conteos[i] += 1;
        }
      }
    }
  }

  let celdasTodas = 0;
  let celdasAlguna = 0;
  for (let i = 0; i < nCeldas; i += 1) {
    const c = conteos[i];
    if (c > 0) celdasAlguna += 1;
    if (c === totalCondiciones) celdasTodas += 1;
  }

  return { conteos, totalCondiciones, celdasTodas, celdasAlguna };
}
