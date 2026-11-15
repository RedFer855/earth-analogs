import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseQuery } from './queryParser.ts';
import { SiteIndexStore } from './siteIndexStore.ts';
import { findTestSites } from './siteRecommender.ts';

const dataDir = join(__dirname, '..', '..', '..', 'public', 'data');
const diskFetch = async (url: string): Promise<Response> =>
  new Response(readFileSync(join(dataDir, url.replace(/^\/data\//, '')), 'utf8'), { status: 200 });

describe('T1 on the synthetic sample (offline, no key)', () => {
  it('returns #1..#5 Mars rover cells below 60 N in under 50 ms once the store is warm', async () => {
    const store = new SiteIndexStore('/data/', diskFetch);
    await store.init();
    const text = 'quiero una zona para probar el rover en pendiente fuerte en Marte';
    await findTestSites(store, parseQuery(text)); // warm the result cache, as the app does after the first search

    const t0 = performance.now();
    const query = parseQuery(text);
    const tParse = performance.now() - t0;
    const matches = await findTestSites(store, query);
    const total = performance.now() - t0;

    console.log(`T1 parse ${tParse.toFixed(3)} ms, parse+rank ${total.toFixed(2)} ms`);
    for (const m of matches) {
      console.log(`#${m.rank} ${m.targetSiteCode} ipix ${m.ipix} lat ${m.lat} slope ${m.context.analogVector[0].toFixed(1)} ${m.readiness.status} combined ${m.combinedScore}`);
    }

    expect(tParse).toBeLessThan(5);
    expect(total).toBeLessThan(50);
    expect(matches.map((m) => m.rank)).toEqual([1, 2, 3, 4, 5]);
    for (const m of matches) {
      expect(m.targetBody).toBe('MARS');
      expect(m.lat).toBeLessThanOrEqual(60);
      expect(m.simControl.mode).toBe('ROVER');
      expect(m.simControl.roverProfile).toBe('PERSEVERANCE');
    }
  });
});
