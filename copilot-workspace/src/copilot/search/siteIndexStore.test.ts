import { describe, expect, it } from 'vitest';
import { SiteIndexStore } from './siteIndexStore.ts';

const metrics = {
  synthetic: true,
  notice: 'n',
  generado: '2026-11-15',
  objetivos: [
    { codigo: 'SHK', nombre: 'S', cuerpo: 'MOON', perfil: 'luna', archivo: 'resultados/luna/SHK.json', n_celdas: 0 },
    { codigo: 'JEZ', nombre: 'J', cuerpo: 'MARS', perfil: 'marte', archivo: 'resultados/marte/JEZ.json', n_celdas: 0 },
  ],
};
const pins = { type: 'FeatureCollection', synthetic: true, notice: 'n', features: [] };

function fakeFetch() {
  const calls: string[] = [];
  const fn = async (url: string): Promise<Response> => {
    calls.push(url);
    let body: unknown = { synthetic: true, notice: 'n', perfil: 'p', objetivo: {}, celdas: [] };
    if (url.endsWith('metrics.json')) body = metrics;
    if (url.endsWith('puntos.geojson')) body = pins;
    return new Response(JSON.stringify(body), { status: 200 });
  };
  return { calls, fn };
}

describe('SiteIndexStore', () => {
  it('loads metrics and pins at start and nothing else', async () => {
    const f = fakeFetch();
    const store = new SiteIndexStore('/data/', f.fn);
    await store.init();
    expect(f.calls).toEqual(['/data/metrics.json', '/data/puntos.geojson']);
    expect(store.targets().map((t) => t.codigo)).toEqual(['SHK', 'JEZ']);
  });

  it('fetches only the result files of the requested body and caches them', async () => {
    const f = fakeFetch();
    const store = new SiteIndexStore('/data/', f.fn);
    await store.init();
    await store.loadResults({ targetBody: 'MARS' });
    await store.loadResults({ targetBody: 'MARS' });
    expect(f.calls.filter((c) => c.includes('resultados'))).toEqual(['/data/resultados/marte/JEZ.json']);
  });

  it('reports a failed fetch with the URL', async () => {
    const store = new SiteIndexStore('/data/', async () => new Response('x', { status: 404 }));
    await expect(store.init()).rejects.toThrow(/metrics\.json.*404/);
  });
});
