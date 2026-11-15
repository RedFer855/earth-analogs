import { describe, expect, it } from 'vitest';
import type { SimTelemetryAlertDetail } from '../types/copilot.types.ts';
import { SimulatorTransport, buildEmbedUrl, parseAlertMessage } from './simulatorTransport.ts';
import type { TransportEnv } from './simulatorTransport.ts';

const SANDBOX = 'http://localhost:5173/';
const SANDBOX_ORIGIN = 'http://localhost:5173';
const PARENT = 'http://localhost:5190';

const alert: SimTelemetryAlertDetail = {
  source: 'nasa-3d-sandbox',
  code: 'LIDAR_PSR_OPTICAL_BLIND',
  mode: 'LIDAR_LANDER',
  body: 'moon',
  severity: 'red',
  message: 'PSR',
  metric: 'opticalBlindPct',
  value: 100,
  threshold: 50,
  timestampMs: 1,
};

type Handler = (ev: unknown) => void;

class FakeTarget {
  readonly handlers = new Map<string, Set<Handler>>();
  addEventListener(type: string, h: Handler): void {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type)?.add(h);
  }
  removeEventListener(type: string, h: Handler): void {
    this.handlers.get(type)?.delete(h);
  }
  fire(type: string, ev: unknown = {}): void {
    for (const h of [...(this.handlers.get(type) ?? [])]) h(ev);
  }
  count(type: string): number {
    return this.handlers.get(type)?.size ?? 0;
  }
}

class FakeIframe extends FakeTarget {
  src = '';
  title = '';
  className = '';
  removed = false;
  readonly attrs = new Map<string, string>();
  readonly posted: Array<{ msg: unknown; origin: string }> = [];
  readonly contentWindow = { postMessage: (msg: unknown, origin: string) => this.posted.push({ msg, origin }) };
  setAttribute(k: string, v: string): void {
    this.attrs.set(k, v);
  }
  remove(): void {
    this.removed = true;
  }
}

function makeEnv() {
  const win = new FakeTarget();
  const doc = Object.assign(new FakeTarget(), { visibilityState: 'visible' as DocumentVisibilityState });
  const frames: FakeIframe[] = [];
  const appended: unknown[] = [];
  let observerCb: ((visible: boolean) => void) | null = null;
  let observers = 0;
  const env: TransportEnv = {
    win,
    doc,
    container: { append: (n: unknown) => appended.push(n) },
    createIframe: () => {
      const f = new FakeIframe();
      frames.push(f);
      return f;
    },
    observe: (_el, cb) => {
      observers += 1;
      observerCb = cb;
      return () => {
        observers -= 1;
        observerCb = null;
      };
    },
  };
  return { env, win, doc, frames, appended, intersect: (v: boolean) => observerCb?.(v), observers: () => observers };
}

const actions = (f: FakeIframe) => f.posted.map((p) => (p.msg as { detail: { action?: string } }).detail.action);

describe('buildEmbedUrl', () => {
  it('adds embed=1 and the parent origin', () => {
    const url = new URL(buildEmbedUrl(SANDBOX, PARENT));
    expect(url.searchParams.get('embed')).toBe('1');
    expect(url.searchParams.get('origin')).toBe(PARENT);
  });
});

describe('parseAlertMessage', () => {
  it('accepts a sandbox alert from the sandbox origin only', () => {
    const data = { type: 'nasa:sim-telemetry-alert', detail: alert };
    expect(parseAlertMessage({ origin: SANDBOX_ORIGIN, data }, SANDBOX_ORIGIN)).toEqual(alert);
    expect(parseAlertMessage({ origin: 'https://evil.example', data }, SANDBOX_ORIGIN)).toBeNull();
    expect(parseAlertMessage({ origin: SANDBOX_ORIGIN, data: { type: 'other', detail: alert } }, SANDBOX_ORIGIN)).toBeNull();
    expect(
      parseAlertMessage({ origin: SANDBOX_ORIGIN, data: { type: 'nasa:sim-telemetry-alert', detail: { code: 1 } } }, SANDBOX_ORIGIN),
    ).toBeNull();
  });
});

describe('SimulatorTransport', () => {
  it('does not create the iframe until it is opened (lazy mount)', () => {
    const e = makeEnv();
    const t = new SimulatorTransport({ sandboxUrl: SANDBOX, parentOrigin: PARENT, env: e.env });
    expect(e.frames.length).toBe(0);
    t.open();
    expect(e.frames.length).toBe(1);
    expect(e.frames[0].src).toContain('embed=1');
    t.open();
    expect(e.frames.length).toBe(1);
  });

  it('queues commands until load and posts them with the sandbox origin, never *', () => {
    const e = makeEnv();
    const t = new SimulatorTransport({ sandboxUrl: SANDBOX, parentOrigin: PARENT, env: e.env });
    t.send({ mode: 'ROVER', seed: 7 });
    const f = e.frames[0];
    expect(f.posted.length).toBe(0);
    f.fire('load');
    expect(f.posted).toEqual([{ msg: { type: 'nasa:copilot-command', detail: { mode: 'ROVER', seed: 7 } }, origin: SANDBOX_ORIGIN }]);
  });

  it('sends PAUSE when hidden by collapse, scroll or tab change, and RESUME when shown, without repeats', () => {
    const e = makeEnv();
    const t = new SimulatorTransport({ sandboxUrl: SANDBOX, parentOrigin: PARENT, env: e.env });
    t.open();
    const f = e.frames[0];
    f.fire('load');
    t.setPanelVisible(false);
    t.setPanelVisible(false);
    t.setPanelVisible(true);
    e.intersect(false);
    e.intersect(true);
    e.doc.visibilityState = 'hidden';
    e.doc.fire('visibilitychange');
    e.doc.visibilityState = 'visible';
    e.doc.fire('visibilitychange');
    expect(actions(f)).toEqual(['PAUSE', 'RESUME', 'PAUSE', 'RESUME', 'PAUSE', 'RESUME']);
  });

  it('forwards validated alerts to subscribers', () => {
    const e = makeEnv();
    const t = new SimulatorTransport({ sandboxUrl: SANDBOX, parentOrigin: PARENT, env: e.env });
    const seen: SimTelemetryAlertDetail[] = [];
    t.onAlert((a) => seen.push(a));
    t.open();
    const source = e.frames[0].contentWindow;
    e.win.fire('message', { origin: SANDBOX_ORIGIN, source, data: { type: 'nasa:sim-telemetry-alert', detail: alert } });
    e.win.fire('message', { origin: 'https://evil.example', source, data: { type: 'nasa:sim-telemetry-alert', detail: alert } });
    e.win.fire('message', { origin: SANDBOX_ORIGIN, source: {}, data: { type: 'nasa:sim-telemetry-alert', detail: alert } });
    expect(seen).toEqual([alert]);
  });

  it('destroy removes the iframe and every listener; remount does not duplicate listeners', () => {
    const e = makeEnv();
    const t = new SimulatorTransport({ sandboxUrl: SANDBOX, parentOrigin: PARENT, env: e.env });
    for (let i = 0; i < 3; i += 1) {
      t.open();
      expect(e.win.count('message')).toBe(1);
      expect(e.doc.count('visibilitychange')).toBe(1);
      expect(e.observers()).toBe(1);
      t.destroy();
      expect(e.frames[i].removed).toBe(true);
      expect(e.win.count('message')).toBe(0);
      expect(e.doc.count('visibilitychange')).toBe(0);
      expect(e.observers()).toBe(0);
    }
    expect(t.isMounted()).toBe(false);
  });
});
