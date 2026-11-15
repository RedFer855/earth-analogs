export type ZoneLayerFamily =
  | 'none'
  | 'geology'
  | 'soil'
  | 'radiation'
  | 'hydrology'
  | 'ndvi';

export type ZoneSubLayerId =
  | 'geology-lithology'
  | 'soil-texture'
  | 'soil-sand'
  | 'soil-clay'
  | 'soil-dust-gibs'
  | 'radiation-solar'
  | 'radiation-uv'
  | 'hydrology-surface'
  | 'hydrology-seasonality'
  | 'ndvi-modis';

export type LayerScientificRole = 'comparable' | 'filtro' | 'contexto';

export interface ZoneSubLayerOption {
  id: ZoneSubLayerId;
  family: Exclude<ZoneLayerFamily, 'none'>;
  label: string;
  role: LayerScientificRole;
  roleLabel: string;
}

export interface ZoneLayerLegendStop {
  color: string;
  label: string;
}

export interface ZoneLayerMetricRow {
  label: string;
  value: string;
}

export interface ZoneBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface ZoneLayerResult {
  subLayerId: ZoneSubLayerId;
  title: string;
  role: LayerScientificRole;
  roleLabel: string;
  unit: string;
  resolutionLabel: string;
  sourceLabel: string;
  note: string;
  minLabel: string;
  maxLabel: string;
  meanLabel: string;
  gradientCss?: string;
  legendStops: ZoneLayerLegendStop[];
  metricsRows: ZoneLayerMetricRow[];
  canvas: HTMLCanvasElement | null;
  bounds: ZoneBounds;
  available: boolean;
  unavailableReason?: string;
  creditText?: string;
}

export const ZONE_SUBLAYER_OPTIONS: ZoneSubLayerOption[] = [
  {
    id: 'geology-lithology',
    family: 'geology',
    label: 'Litología y Formaciones (Macrostrat)',
    role: 'filtro',
    roleLabel: 'Geología · Contexto/Filtro',
  },
  {
    id: 'soil-texture',
    family: 'soil',
    label: 'Clases de Suelo: Arena / Limo / Arcilla (SoilGrids)',
    role: 'contexto',
    roleLabel: 'Movilidad / Suelo',
  },
  {
    id: 'soil-sand',
    family: 'soil',
    label: '% Arena superficial 0–5 cm (SoilGrids)',
    role: 'contexto',
    roleLabel: 'Movilidad / Dunas',
  },
  {
    id: 'soil-clay',
    family: 'soil',
    label: '% Arcilla superficial 0–5 cm (SoilGrids)',
    role: 'contexto',
    roleLabel: 'Composición / Cohesión',
  },
  {
    id: 'soil-dust-gibs',
    family: 'soil',
    label: 'Polvo y Aerosoles AOD (NASA GIBS MODIS)',
    role: 'contexto',
    roleLabel: 'Proceso atmosférico · Contexto Marte',
  },
  {
    id: 'radiation-solar',
    family: 'radiation',
    label: 'Irradiancia Solar Superficial (NASA POWER)',
    role: 'contexto',
    roleLabel: 'Límite terrestre / Energía',
  },
  {
    id: 'radiation-uv',
    family: 'radiation',
    label: 'Índice UV Superficial (NASA POWER)',
    role: 'contexto',
    roleLabel: 'Estrés astrobiológico / Límite Tierra',
  },
  {
    id: 'hydrology-surface',
    family: 'hydrology',
    label: 'Agua superficial y Salares (JRC GSW + OSM)',
    role: 'filtro',
    roleLabel: 'Filtro hídrico / Salares · Análogos',
  },
  {
    id: 'hydrology-seasonality',
    family: 'hydrology',
    label: 'Estacionalidad hídrica meses/año (JRC GSW)',
    role: 'filtro',
    roleLabel: 'Estacionalidad lacustre / evaporitas',
  },
  {
    id: 'ndvi-modis',
    family: 'ndvi',
    label: 'Vegetación — NDVI 8 días (NASA GIBS MODIS)',
    role: 'filtro',
    roleLabel: 'Filtro biótico / Cobertura vegetal',
  },
];
