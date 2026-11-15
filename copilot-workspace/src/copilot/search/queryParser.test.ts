import { describe, expect, it } from 'vitest';
import { parseQuery } from './queryParser.ts';

const T1 = 'quiero una zona para probar el rover en pendiente fuerte en Marte';

describe('parseQuery', () => {
  it('parses the T1 query into a rover search on Mars with a steep-slope floor', () => {
    const q = parseQuery(T1);
    expect(q.mode).toBe('ROVER');
    expect(q.targetBody).toBe('MARS');
    expect(q.minSlopeDeg).toBe(12);
    expect(q.excludePolarIceCaps).toBe(true);
    expect(q.limit).toBe(5);
  });

  it('runs in under 5 ms', () => {
    parseQuery(T1);
    const t0 = performance.now();
    for (let i = 0; i < 100; i += 1) parseQuery(T1);
    expect((performance.now() - t0) / 100).toBeLessThan(5);
  });

  it('parses the plan section 5 query (Moon, rover, at the limit)', () => {
    const q = parseQuery('Quiero una zona en la Luna para probar el rover al límite de pendiente');
    expect(q).toMatchObject({ mode: 'ROVER', targetBody: 'MOON', preferMarginStress: true, excludePolarIceCaps: true });
  });

  it('reads an explicit slope number', () => {
    expect(parseQuery('Mars rover slope > 18°').minSlopeDeg).toBe(18);
    expect(parseQuery('rover en marte con pendiente mayor a 14 grados').minSlopeDeg).toBe(14);
  });

  it('keeps polar cells when the query asks for ice or permafrost', () => {
    expect(parseQuery('taladro para hielo en Marte').excludePolarIceCaps).toBe(false);
    expect(parseQuery('drill test on permafrost').excludePolarIceCaps).toBe(false);
    expect(parseQuery('prueba criogénica del taladro').excludePolarIceCaps).toBe(false);
    expect(parseQuery('taladro para hielo en Marte').mode).toBe('ISRU_DRILL');
  });

  it('maps modes and pins in English and Spanish', () => {
    expect(parseQuery('lidar landing on the Moon').mode).toBe('LIDAR_LANDER');
    expect(parseQuery('traje con polvo y viento').mode).toBe('SUIT_EDS');
    expect(parseQuery('rover cerca de un tubo de lava').featurePinType).toBe('tubo_lava');
    expect(parseQuery('suit test near a salt playa').featurePinType).toBe('playa_salar');
    expect(parseQuery('lander near an impact crater').featurePinType).toBe('crater_impacto');
  });

  it('recognizes a known site code and a top-N limit', () => {
    const q = parseQuery('top 3 rover sites for JEZ', ['JEZ', 'GAL']);
    expect(q.targetSiteCode).toBe('JEZ');
    expect(q.limit).toBe(3);
  });
});
