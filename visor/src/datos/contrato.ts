export const VERSION_CONTRATO = '1.0.0';

export interface Centro {
  lat: number;
  lon: number;
}

export type EtiquetaVariable = 'coincide' | 'difiere' | 'sin_dato';

export interface VarCelda {
  valor: number | null;
  diferencia: number | null;
  nota: number | null;
  etiqueta: EtiquetaVariable;
}

export interface Cobertura {
  usadas: number;
  total: number;
  faltan: string[];
}

export interface Diagnostico {
  valor: number | null;
  objetivo: number;
  diferencia: number | null;
}

export type VerticesCelda = [
  [number, number],
  [number, number],
  [number, number],
  [number, number],
];

export interface CercaDe {
  tubo_lava_km?: number | null;
  crater_km?: number | null;
  salar_km?: number | null;
}

export interface Celda {
  rango: number;
  ipix: number;
  centro: Centro;
  vertices: VerticesCelda;
  nota: number;
  nota_exacta: number;
  variables: Record<string, VarCelda>;
  cobertura: Cobertura;
  diagnostico?: Record<string, Diagnostico>;
  cerca_de?: CercaDe;
  marcas: string[];
  analogo_conocido: string | null;
  region: string | null;
}

export interface ValorObjetivo {
  valor: number;
  valor_real?: number | null;
}

export interface ObjetivoJson {
  variables: Record<string, ValorObjetivo>;
  diagnostico?: Record<string, number>;
}

export interface Origen {
  columna: string;
  fuente: string | null;
  url: string | null;
  licencia: string | null;
}

export interface VariableParametro {
  id: string;
  peso: number;
  tolerancia: number;
  escala: number;
  origen: Origen;
}

export interface ParametrosJson {
  variables: VariableParametro[];
  diagnostico: Origen[];
  filtros: string[];
  ndvi_max: number;
  gamma: number;
  lambda_contraccion: number;
  fraccion_minima: number;
  correlacion: number[][];
}

export interface Healpix {
  esquema: string;
  nivel: number;
}

export interface ResultadoJson {
  version_contrato: string;
  es_ejemplo: boolean;
  perfil: string;
  sitio: string;
  healpix: Healpix;
  objetivo: ObjetivoJson;
  parametros: ParametrosJson;
  excluidos_por_indice?: number | null;
  excluidos_por_separacion?: number | null;
  celdas_en_area?: number | null;
  regiones_con_tierra?: number | null;
  sin_celdas_por_ndvi?: number | null;
  candidatos: Celda[];
}

export interface VariableCat {
  id: string;
  codigo: string;
  nombre: string;
  unidad: string;
  aplica_a: string[];
  descripcion: string;
}

export interface MarcaCat {
  id: string;
  nombre: string;
  tipo: string;
}

export interface PerfilCat {
  id: string;
  nombre: string;
  contra: string[];
  variables: string[];
  descripcion: string;
}

export interface SitioObjetivoCat {
  id: string;
  nombre: string;
  cuerpo: string;
  centro: Centro;
}

export interface AnalogoCat {
  id: string;
  nombre: string;
  centro: Centro;
}

export interface Mejora {
  nota: number;
  centro: Centro;
  region: string | null;
}

export interface ResumenResultado {
  perfil: string;
  sitio: string;
  archivo: string;
  n_candidatos: number;
  mejor: Mejora | null;
}

export interface FuenteCat {
  nombre: string;
  url: string | null;
  licencia: string | null;
  columnas: string[];
}

export interface TablaCat {
  generado: string | null;
  commit: string | null;
  n_celdas: number;
}

export interface Contrato {
  version: string;
  tabla: TablaCat;
}

export interface CuerpoJson {
  nombre: string;
  radio_m: number;
  gravedad_ms2: number;
  presion_superficie_pa: number;
  atmosfera: string;
  radiacion: string;
  fuente: string;
}

export interface Indice {
  version_contrato: string;
  contrato: Contrato;
  generado: string;
  es_ejemplo: boolean;
  healpix: Healpix;
  cuerpos: Record<string, CuerpoJson>;
  variables: VariableCat[];
  marcas: MarcaCat[];
  perfiles: PerfilCat[];
  sitios_objetivo: SitioObjetivoCat[];
  analogos_conocidos: AnalogoCat[];
  resultados: ResumenResultado[];
  fuentes: FuenteCat[];
}

export interface Sitio extends SitioObjetivoCat {
  archivo: string | null;
  n_candidatos: number;
  mejor: Mejora | null;
}

function unirRuta(base: string, ruta: string): string {
  const limpiaBase = base.replace(/\/+$/, '');
  const limpiaRuta = ruta.replace(/^\/+/, '');
  return limpiaBase ? `${limpiaBase}/${limpiaRuta}` : limpiaRuta;
}

function validarContrato(
  datos: { version_contrato?: unknown; es_ejemplo?: unknown },
  etiqueta: string,
): void {
  if (datos.version_contrato !== VERSION_CONTRATO) {
    throw new Error(
      `Versión de contrato incompatible en ${etiqueta}: se esperaba ${VERSION_CONTRATO} y llegó ${String(datos.version_contrato ?? 'desconocida')}.`,
    );
  }
  if (datos.es_ejemplo === true) {
    throw new Error(
      `Los datos de ${etiqueta} están marcados como ejemplo y no pueden mostrarse como resultados reales.`,
    );
  }
}

async function pedirJson<T extends { version_contrato?: unknown; es_ejemplo?: unknown }>(
  url: string,
  etiqueta: string,
): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`No se pudo cargar ${etiqueta} (HTTP ${res.status}).`);
  }
  const datos = (await res.json()) as T;
  validarContrato(datos, etiqueta);
  return datos;
}

export function cargarIndice(base = 'datos/'): Promise<Indice> {
  return pedirJson<Indice>(unirRuta(base, 'metrics.json'), 'el índice principal');
}

export function cargarResultado(base: string, archivo: string): Promise<ResultadoJson> {
  return pedirJson<ResultadoJson>(unirRuta(base, archivo), `el resultado ${archivo}`);
}

export type TipoPunto = 'tubo_lava' | 'crater_impacto' | 'playa_salar';

export interface PuntoPropiedades {
  id: string;
  tipo: TipoPunto;
  nombre: string;
  diametro_km?: number | null;
  confirmado?: boolean;
  fuente: string;
  url?: string | null;
  licencia: string;
  atribucion: string;
}

export interface PuntoFeature {
  type: 'Feature';
  id?: string;
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
  properties: PuntoPropiedades;
}

export interface PuntosGeoJson {
  type: 'FeatureCollection';
  features: PuntoFeature[];
}

export interface FilaCorrelacion {
  variable: string;
  etiqueta: string;
  n_sitios: number;
  mediana_sitio: number;
  mediana_control: number;
  diferencia_mediana: number;
  cliff_delta: number;
  p: number;
  p_holm: number;
}

export interface GrupoCorrelacion {
  sitios: number;
  sitios_usados: number;
  radio_km: number;
  filas: FilaCorrelacion[];
}

export interface CorrelacionJson {
  meta?: Record<string, unknown>;
  resultados: Record<string, GrupoCorrelacion>;
}

async function pedirOpcional<T>(url: string): Promise<T | null> {
  const res = await fetch(url);
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`No se pudo cargar ${url} (HTTP ${res.status}).`);
  }
  // Un servidor con respaldo de SPA (Vite en desarrollo, varios hostings) responde
  // 200 con index.html cuando el archivo opcional no existe: eso cuenta como ausente.
  const texto = await res.text();
  if (texto.trimStart().startsWith('<')) return null;
  try {
    return JSON.parse(texto) as T;
  } catch {
    return null;
  }
}

export async function cargarPuntos(base = 'datos/'): Promise<PuntosGeoJson | null> {
  const data = await pedirOpcional<PuntosGeoJson>(unirRuta(base, 'puntos.geojson'));
  if (!data || data.type !== 'FeatureCollection' || !Array.isArray(data.features)) {
    return null;
  }
  return data;
}

export async function cargarCorrelacion(base = 'datos/'): Promise<CorrelacionJson | null> {
  const data = await pedirOpcional<CorrelacionJson>(unirRuta(base, 'point-correlation.json'));
  if (!data || !data.resultados || typeof data.resultados !== 'object') {
    return null;
  }
  return data;
}

export interface CeldaEstabilidad {
  ipix: number;
  aparece_en: number;
  fraccion: number;
  s_min: number;
  s_mediana: number;
  s_max: number;
}

export interface EstabilidadObjetivo {
  n_escenarios: number;
  celdas: CeldaEstabilidad[];
}

export interface EstabilidadJson {
  objetivos: Record<string, EstabilidadObjetivo>;
}

/**
 * El motor escribe estabilidad.json como { escenarios: [{ objetivo, … }], robustez: { <sitio>: [celda, …] } }.
 * Se normaliza a { objetivos: { <sitio>: { n_escenarios, celdas } } }; la forma ya normalizada también se acepta.
 */
export function normalizarEstabilidad(data: unknown): EstabilidadJson | null {
  const d = data as {
    objetivos?: Record<string, EstabilidadObjetivo>;
    robustez?: Record<string, CeldaEstabilidad[]>;
    escenarios?: { objetivo?: string }[];
  } | null;
  if (!d || typeof d !== 'object') return null;
  if (d.objetivos && typeof d.objetivos === 'object') return { objetivos: d.objetivos };
  if (!d.robustez || typeof d.robustez !== 'object' || !Array.isArray(d.escenarios)) return null;
  const n = new Map<string, number>();
  for (const e of d.escenarios) if (e.objetivo) n.set(e.objetivo, (n.get(e.objetivo) ?? 0) + 1);
  const objetivos: Record<string, EstabilidadObjetivo> = {};
  for (const [sitio, celdas] of Object.entries(d.robustez)) {
    if (Array.isArray(celdas) && (n.get(sitio) ?? 0) > 0) objetivos[sitio] = { n_escenarios: n.get(sitio) ?? 0, celdas };
  }
  return { objetivos };
}

export async function cargarEstabilidad(base = 'datos/'): Promise<EstabilidadJson | null> {
  return normalizarEstabilidad(await pedirOpcional<unknown>(unirRuta(base, 'estabilidad.json')));
}

export function colorNota(n: number): [number, number, number] {
  const x = Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;
  const rojo: [number, number, number] = [239, 68, 68];
  const amarillo: [number, number, number] = [250, 204, 21];
  const verde: [number, number, number] = [34, 197, 94];

  if (x <= 0.5) {
    const t = x * 2;
    return [
      Math.round(rojo[0] + (amarillo[0] - rojo[0]) * t),
      Math.round(rojo[1] + (amarillo[1] - rojo[1]) * t),
      Math.round(rojo[2] + (amarillo[2] - rojo[2]) * t),
    ];
  }
  const t = (x - 0.5) * 2;
  return [
    Math.round(amarillo[0] + (verde[0] - amarillo[0]) * t),
    Math.round(amarillo[1] + (verde[1] - amarillo[1]) * t),
    Math.round(amarillo[2] + (verde[2] - amarillo[2]) * t),
  ];
}

export function sitiosPorCuerpo(indice: Indice): { luna: Sitio[]; marte: Sitio[] } {
  const porSitio = new Map<string, ResumenResultado>();
  for (const r of indice.resultados) {
    if (!porSitio.has(r.sitio)) {
      porSitio.set(r.sitio, r);
    }
  }

  const enriquecer = (s: SitioObjetivoCat): Sitio => {
    const res = porSitio.get(s.id);
    return {
      ...s,
      archivo: res?.archivo ?? null,
      n_candidatos: res?.n_candidatos ?? 0,
      mejor: res?.mejor ?? null,
    };
  };

  const ordenar = (a: Sitio, b: Sitio): number => a.id.localeCompare(b.id);

  return {
    luna: indice.sitios_objetivo
      .filter((s) => s.cuerpo === 'luna')
      .map(enriquecer)
      .sort(ordenar),
    marte: indice.sitios_objetivo
      .filter((s) => s.cuerpo === 'marte')
      .map(enriquecer)
      .sort(ordenar),
  };
}

export function objetivoDe(resultado: ResultadoJson, v: string): number | null {
  const entry = resultado.objetivo.variables[v];
  if (!entry) return null;
  return entry.valor_real ?? entry.valor;
}

export function pareceHielo(lat: number, lon: number): boolean {
  return lat > 60 && lon > -75 && lon < -10;
}

export function escaparHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
