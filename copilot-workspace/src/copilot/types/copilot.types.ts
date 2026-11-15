/**
 * Copilot workspace contracts.
 *
 * The sandbox-facing types (`SimulationControlDetail`, `SimTelemetryAlertDetail`, actions, profiles) restate the
 * contract published by `nasa-3d-sandbox/src/bridge/copilotContract.ts`. They are restated, not imported, so this app
 * builds without pulling the sandbox's Three.js graph. Keep them in sync with that file.
 */

// ---- Sandbox contract (restated from nasa-3d-sandbox/src/bridge/copilotContract.ts) ----

export type SimModeId = 'ROVER' | 'SUIT_EDS' | 'LIDAR_LANDER' | 'ISRU_DRILL';
export const SIM_MODES: readonly SimModeId[] = ['ROVER', 'SUIT_EDS', 'LIDAR_LANDER', 'ISRU_DRILL'];

export type TargetBody = 'MOON' | 'MARS';
export type RoverProfile = 'VIPER' | 'PERSEVERANCE' | 'CURIOSITY';
export type LidarProfile = 'ALHAT' | 'SPLICE' | 'CLPS' | 'M2020';
export type OperationalStatus = 'green' | 'yellow' | 'red';
export type AnalogVarName = 'N1' | 'N2' | 'N3' | 'N4' | 'N5' | 'N6' | 'N7';
export type MissingVarName = AnalogVarName | 'surfaceTempK';

export type SimulationAction =
  | 'PULSE_EDS'
  | 'PAUSE'
  | 'RESUME'
  | 'RESET_DUST'
  | 'RETRACT_DRILL_BITE'
  | 'BOOST_DRILL_WOB';

export interface DiurnalRangePercentiles {
  readonly p1: number;
  readonly p50?: number;
  readonly p99: number;
}

export interface AnalogN1N7Payload {
  readonly n1SlopeDeg?: number | null;
  readonly n2RoughnessRmsM?: number | null;
  readonly n3ReliefM?: number | null;
  readonly n4SilicaPct?: number | null;
  readonly n5DiurnalTempK?: number | null;
  readonly n6SolarIllumFrac?: number | null;
  readonly n7SaltationTimeFrac?: number | null;
  readonly surfaceTempK?: number | null;
  readonly diurnalPercentiles?: DiurnalRangePercentiles;
  readonly targetBody?: TargetBody;
  readonly roverProfile?: RoverProfile;
  readonly lidarProfile?: LidarProfile;
  readonly sunlit?: boolean;
  readonly seed?: number;
}

export interface WhatIfOverride {
  readonly variable: AnalogVarName;
  readonly newValue: number;
}

export interface SimulationControlDetail {
  readonly mode?: SimModeId;
  readonly action?: SimulationAction;
  readonly analog?: AnalogN1N7Payload;
  readonly whatIf?: WhatIfOverride;
  readonly seed?: number;
  readonly targetBody?: TargetBody;
  readonly roverProfile?: RoverProfile;
  readonly lidarProfile?: LidarProfile;
  readonly sunlit?: boolean;
  readonly surfaceTempK?: number | null;
  readonly diurnalPercentiles?: DiurnalRangePercentiles;
}

export interface SimTelemetryAlertDetail {
  readonly source: 'nasa-3d-sandbox';
  readonly code: string;
  readonly mode: SimModeId;
  readonly body: 'moon' | 'mars' | 'earth';
  readonly severity: 'yellow' | 'red';
  readonly message: string;
  readonly metric: string;
  readonly value: number;
  readonly threshold: number;
  readonly suggestedAction?: SimulationAction;
  readonly timestampMs: number;
}

export const COPILOT_COMMAND_MESSAGE = 'nasa:copilot-command';
export const SIM_TELEMETRY_ALERT_EVENT = 'nasa:sim-telemetry-alert';

// ---- Copilot analog context ----

/** N1..N7 in Float32Array(7) order: [slope deg, RMS roughness m, relief m, SiO2 %, diurnal range K, solar illum frac, saltation frac]. NaN = missing. */
export type AnalogVector = Float32Array;

export interface AnalogCellContext {
  readonly targetBody: TargetBody;
  readonly targetSiteCode: string;
  readonly targetSiteName: string;
  readonly ipix: number;
  readonly lat: number;
  readonly lon: number;
  readonly regionName: string;
  readonly similarityScore: number;
  readonly analogVector: AnalogVector;
  readonly surfaceTempK: number | null;
  readonly missingVars: readonly MissingVarName[];
  readonly seed: number;
  readonly diurnalPercentiles?: DiurnalRangePercentiles;
}

export interface ModeReadiness {
  readonly mode: SimModeId;
  readonly status: OperationalStatus;
  /** 0..100. Higher means the cell exercises the subsystem well inside a test envelope. */
  readonly testSuitabilityScore: number;
  readonly reasons: readonly string[];
  readonly missingVars: readonly MissingVarName[];
}

// ---- Sample data shapes (field names from the integration plan, sections 4.3 and 4.4) ----

export interface EtlDiagnostico {
  readonly rango_diurno_k: number | null;
  readonly amp_anual_k?: number | null;
}

export interface EtlCandidateCell {
  readonly ipix: number;
  readonly lat: number;
  readonly lon: number;
  readonly region?: string;
  readonly similitud: number;
  readonly slope_mean_deg: number | null;
  readonly slope_std_deg?: number | null;
  readonly rug_rms_mean_m: number | null;
  readonly relieve_mean_m: number | null;
  readonly diagnostico: EtlDiagnostico;
}

export interface EtlResultFile {
  readonly synthetic: boolean;
  readonly notice: string;
  readonly perfil: string;
  readonly objetivo: { readonly codigo: string; readonly nombre: string; readonly cuerpo: TargetBody };
  readonly percentiles_rango_diurno_k?: DiurnalRangePercentiles;
  readonly celdas: readonly EtlCandidateCell[];
}

export interface MetricsTarget {
  readonly codigo: string;
  readonly nombre: string;
  readonly cuerpo: TargetBody;
  readonly perfil: string;
  readonly archivo: string;
  readonly n_celdas: number;
}

export interface MetricsFile {
  readonly synthetic: boolean;
  readonly notice: string;
  readonly generado: string;
  readonly objetivos: readonly MetricsTarget[];
}

export type FeaturePinType = 'tubo_lava' | 'crater_impacto' | 'playa_salar';

export interface PinFeature {
  readonly type: 'Feature';
  readonly geometry: { readonly type: 'Point'; readonly coordinates: readonly [number, number] };
  readonly properties: { readonly tipo: FeaturePinType; readonly nombre: string; readonly synthetic: true };
}

export interface PinCollection {
  readonly type: 'FeatureCollection';
  readonly synthetic: boolean;
  readonly notice: string;
  readonly features: readonly PinFeature[];
}

// ---- Search contract (plan section 4.1) ----

export interface TestSiteQuery {
  readonly mode?: SimModeId;
  readonly targetBody?: TargetBody;
  readonly targetSiteCode?: string;
  readonly minSlopeDeg?: number;
  readonly maxSlopeDeg?: number;
  readonly minRoughnessM?: number;
  readonly minReliefM?: number;
  readonly featurePinType?: FeaturePinType;
  readonly excludePolarIceCaps: boolean;
  readonly preferMarginStress?: boolean;
  readonly limit: number;
}

export interface NearestPin {
  readonly type: FeaturePinType;
  readonly name: string;
  readonly distanceKm: number;
}

export interface TestSiteMatch {
  readonly rank: number;
  readonly targetBody: TargetBody;
  readonly targetSiteCode: string;
  readonly targetSiteName: string;
  readonly ipix: number;
  readonly lat: number;
  readonly lon: number;
  readonly regionName: string;
  readonly similarityScore: number;
  readonly readiness: ModeReadiness;
  readonly combinedScore: number;
  readonly nearestPin?: NearestPin;
  readonly context: AnalogCellContext;
  readonly simControl: SimulationControlDetail;
}

// ---- Visor <-> Copilot bus (plan section 4.4) ----

export interface VisorFocusSitesDetail {
  readonly matches: readonly TestSiteMatch[];
  readonly highlightColorByStatus: boolean;
  readonly flyToBest: boolean;
}

export interface VisorSelectCellDetail {
  readonly cell: EtlCandidateCell;
  readonly targetBody: TargetBody;
  readonly targetSiteName: string;
  readonly targetSiteCode?: string;
  readonly mode?: SimModeId;
}

export interface VisorTourStepDetail {
  readonly match: TestSiteMatch;
  readonly stepIndex: number;
  readonly totalSteps: number;
}
