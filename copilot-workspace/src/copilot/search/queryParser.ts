import type { FeaturePinType, SimModeId, TargetBody, TestSiteQuery } from '../types/copilot.types.ts';

/**
 * Offline Spanish/English keyword parser. It turns a chat request into the same `TestSiteQuery` that the
 * `findTestSites` function call receives, without a network or a model. Regex-only, well under 5 ms.
 */

/** Slope floor applied for "steep" / "pendiente fuerte" without a number. */
export const STEEP_SLOPE_FLOOR_DEG = 12;
/** Slope ceiling applied for "gentle" / "plano" without a number. */
export const GENTLE_SLOPE_CEILING_DEG = 8;
export const DEFAULT_LIMIT = 5;
export const MAX_LIMIT = 10;

const MODE_KEYWORDS: ReadonlyArray<readonly [SimModeId, RegExp]> = [
  ['ROVER', /\b(rover|traccion|traction|duna|dunas|dune|traverse|travesia|pendiente|slope)\b/],
  ['ISRU_DRILL', /\b(taladro|drill|drilling|perforar|perforacion|isru|hielo|ice|silice|silica|broca|trident)\b/],
  ['LIDAR_LANDER', /\b(lidar|aterrizaje|aterrizar|landing|lander|alunizaje|psr)\b/],
  ['SUIT_EDS', /\b(traje|suit|polvo|dust|eds|viento|wind|eva)\b/],
];

const BODY_KEYWORDS: ReadonlyArray<readonly [TargetBody, RegExp]> = [
  ['MOON', /\b(luna|moon|lunar|lunares)\b/],
  ['MARS', /\b(marte|mars|marciano|marciana|martian)\b/],
];

const PIN_KEYWORDS: ReadonlyArray<readonly [FeaturePinType, RegExp]> = [
  ['tubo_lava', /\b(tubos? de lava|lava tubes?)\b/],
  ['playa_salar', /\b(salar|salares|playa|salt flats?|salt playa)\b/],
  ['crater_impacto', /\b(crater(es)? de impacto|impact craters?)\b/],
];

const ICE_TERMS = /\b(hielo|ice|icy|criogenic[oa]s?|cryogenic|permafrost|svalbard|congelad[oa])\b/;
const STRESS_TERMS = /\b(limites?|limits?|extrem[oa]s?|extreme|estres|stress|exigir|exigente|critic[oa]|critical|al borde|edge)\b/;
const STEEP_TERMS = /\b(pendiente fuerte|fuerte pendiente|empinad[oa]s?|steep|inclinad[oa]s?|escarpad[oa]s?)\b/;
const GENTLE_TERMS = /\b(plan[oa]s?|flat|suave|gentle|nivelad[oa])\b/;
const SLOPE_NUMBER =
  /(?:pendiente|slope|inclinacion)?\s*(>|>=|mayor (?:a|que)|mas de|over|above|at least|<|<=|menor (?:a|que)|menos de|under|below)?\s*(\d{1,2}(?:[.,]\d+)?)\s*(?:°|º|grados|deg|degrees)/;
const TOP_N = /\btop\s*(\d{1,2})\b|\b(\d{1,2})\s*(?:zonas|sitios|sites|candidatos|candidates|celdas|cells)\b/;

function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function firstMatch<T>(text: string, table: ReadonlyArray<readonly [T, RegExp]>): T | undefined {
  let best: T | undefined;
  let bestIdx = Number.POSITIVE_INFINITY;
  for (const [value, re] of table) {
    const m = re.exec(text);
    if (m !== null && m.index < bestIdx) {
      best = value;
      bestIdx = m.index;
    }
  }
  return best;
}

export function parseQuery(raw: string, knownSiteCodes: readonly string[] = []): TestSiteQuery {
  const text = normalize(raw);

  // A pin phrase like "crater de impacto" is a location hint, not a mode: strip it before mode detection.
  const featurePinType = firstMatch(text, PIN_KEYWORDS);
  let modeText = text;
  for (const [, re] of PIN_KEYWORDS) modeText = modeText.replace(re, ' ');
  const mode = firstMatch(modeText, MODE_KEYWORDS);
  const targetBody = firstMatch(text, BODY_KEYWORDS);

  let minSlopeDeg: number | undefined;
  let maxSlopeDeg: number | undefined;
  const num = SLOPE_NUMBER.exec(text);
  if (num !== null) {
    const value = Number(num[2].replace(',', '.'));
    const op = num[1] ?? '';
    if (/^(<|<=|menor|menos|under|below)/.test(op)) maxSlopeDeg = value;
    else minSlopeDeg = value;
  } else if (STEEP_TERMS.test(text)) {
    minSlopeDeg = STEEP_SLOPE_FLOOR_DEG;
  } else if (GENTLE_TERMS.test(text) && featurePinType !== 'playa_salar') {
    maxSlopeDeg = GENTLE_SLOPE_CEILING_DEG;
  }

  let limit = DEFAULT_LIMIT;
  const top = TOP_N.exec(text);
  if (top !== null) limit = Math.min(MAX_LIMIT, Math.max(1, Number(top[1] ?? top[2])));

  const upperTokens = new Set(raw.toUpperCase().match(/\b[A-Z0-9]{2,6}\b/g) ?? []);
  const targetSiteCode = knownSiteCodes.find((c) => upperTokens.has(c.toUpperCase()));

  const query: TestSiteQuery = {
    excludePolarIceCaps: !ICE_TERMS.test(text),
    limit,
    ...(mode !== undefined ? { mode } : {}),
    ...(targetBody !== undefined ? { targetBody } : {}),
    ...(targetSiteCode !== undefined ? { targetSiteCode } : {}),
    ...(minSlopeDeg !== undefined ? { minSlopeDeg } : {}),
    ...(maxSlopeDeg !== undefined ? { maxSlopeDeg } : {}),
    ...(featurePinType !== undefined ? { featurePinType } : {}),
    ...(STRESS_TERMS.test(text) ? { preferMarginStress: true } : {}),
  };
  return query;
}
