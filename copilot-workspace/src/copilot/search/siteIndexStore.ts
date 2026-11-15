import type { EtlResultFile, MetricsFile, MetricsTarget, PinCollection, PinFeature, TargetBody } from '../types/copilot.types.ts';

export type FetchLike = (url: string) => Promise<Response>;

/**
 * Front-end site index. Loads the small `metrics.json` and `puntos.geojson` at start; fetches each
 * `resultados/<profile>/<site>.json` only when a search needs it and keeps it cached in memory.
 */
export class SiteIndexStore {
  private readonly baseUrl: string;
  private readonly fetchFn: FetchLike;
  private metrics: MetricsFile | null = null;
  private pinList: readonly PinFeature[] = [];
  private readonly cache = new Map<string, Promise<EtlResultFile>>();

  constructor(baseUrl: string, fetchFn: FetchLike = (url) => fetch(url)) {
    this.baseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    this.fetchFn = fetchFn;
  }

  private async getJson<T>(rel: string): Promise<T> {
    const url = `${this.baseUrl}${rel}`;
    const res = await this.fetchFn(url);
    if (!res.ok) throw new Error(`Could not load ${url}: HTTP ${res.status}`);
    return (await res.json()) as T;
  }

  async init(): Promise<void> {
    this.metrics = await this.getJson<MetricsFile>('metrics.json');
    const pins = await this.getJson<PinCollection>('puntos.geojson');
    this.pinList = pins.features;
  }

  targets(): readonly MetricsTarget[] {
    return this.metrics?.objetivos ?? [];
  }

  pins(): readonly PinFeature[] {
    return this.pinList;
  }

  isSynthetic(): boolean {
    return this.metrics?.synthetic === true;
  }

  notice(): string {
    return this.metrics?.notice ?? '';
  }

  private loadTarget(target: MetricsTarget): Promise<EtlResultFile> {
    let pending = this.cache.get(target.archivo);
    if (pending === undefined) {
      pending = this.getJson<EtlResultFile>(target.archivo);
      // Drop failed fetches from the cache so a later search can retry.
      pending.catch(() => this.cache.delete(target.archivo));
      this.cache.set(target.archivo, pending);
    }
    return pending;
  }

  /** Loads (or returns cached) result files for the targets that match the body and site filters. */
  async loadResults(filter: { readonly targetBody?: TargetBody; readonly targetSiteCode?: string }): Promise<EtlResultFile[]> {
    const wanted = this.targets().filter(
      (t) =>
        (filter.targetBody === undefined || t.cuerpo === filter.targetBody) &&
        (filter.targetSiteCode === undefined || t.codigo === filter.targetSiteCode),
    );
    return Promise.all(wanted.map((t) => this.loadTarget(t)));
  }
}
