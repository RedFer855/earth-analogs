import type { SimTelemetryAlertDetail, SimulationControlDetail } from '../types/copilot.types.ts';
import { COPILOT_COMMAND_MESSAGE, SIM_TELEMETRY_ALERT_EVENT } from '../types/copilot.types.ts';

/**
 * Default sandbox URL: the `nasa-3d-sandbox` Vite dev server (`npm run dev`, Vite default port 5173).
 * Override with `?sandbox=<url>` on the workspace URL or the `sandboxUrl` option.
 */
export const DEFAULT_SANDBOX_URL = 'http://localhost:5173/';

type Listener = (ev: unknown) => void;

interface ListenerTarget {
  addEventListener(type: string, fn: Listener): void;
  removeEventListener(type: string, fn: Listener): void;
}

export interface IframeLike extends ListenerTarget {
  src: string;
  title: string;
  className: string;
  readonly contentWindow: { postMessage(message: unknown, targetOrigin: string): void } | null;
  setAttribute(name: string, value: string): void;
  remove(): void;
}

/** DOM seams so the lifecycle is testable without a browser. */
export interface TransportEnv {
  readonly win: ListenerTarget;
  readonly doc: ListenerTarget & { readonly visibilityState: DocumentVisibilityState };
  readonly container: { append(node: never): void };
  createIframe(): IframeLike;
  /** Observes on-screen visibility of the element; returns a disconnect function. */
  observe(el: IframeLike, onChange: (visible: boolean) => void): () => void;
}

export function browserEnv(container: HTMLElement): TransportEnv {
  return {
    win: window as unknown as ListenerTarget,
    doc: document as unknown as TransportEnv['doc'],
    container: container as unknown as TransportEnv['container'],
    createIframe: () => document.createElement('iframe') as unknown as IframeLike,
    observe: (el, onChange) => {
      if (typeof IntersectionObserver === 'undefined') return () => undefined;
      const io = new IntersectionObserver((entries) => {
        const last = entries[entries.length - 1];
        if (last !== undefined) onChange(last.isIntersecting);
      });
      io.observe(el as unknown as Element);
      return () => io.disconnect();
    },
  };
}

export function buildEmbedUrl(sandboxUrl: string, parentOrigin: string): string {
  const url = new URL(sandboxUrl);
  url.searchParams.set('embed', '1');
  url.searchParams.set('origin', parentOrigin);
  return url.toString();
}

const SEVERITIES = new Set(['yellow', 'red']);

/** Validates an incoming `message` event: exact sandbox origin, alert envelope, and alert shape. */
export function parseAlertMessage(
  event: { readonly origin: string; readonly data: unknown },
  expectedOrigin: string,
): SimTelemetryAlertDetail | null {
  if (event.origin !== expectedOrigin) return null;
  const data = event.data;
  if (typeof data !== 'object' || data === null) return null;
  const rec = data as { type?: unknown; detail?: unknown };
  if (rec.type !== SIM_TELEMETRY_ALERT_EVENT || typeof rec.detail !== 'object' || rec.detail === null) return null;
  const d = rec.detail as Record<string, unknown>;
  if (d.source !== 'nasa-3d-sandbox' || typeof d.code !== 'string' || typeof d.message !== 'string') return null;
  if (typeof d.severity !== 'string' || !SEVERITIES.has(d.severity)) return null;
  return rec.detail as SimTelemetryAlertDetail;
}

export interface SimulatorTransportOptions {
  readonly sandboxUrl: string;
  readonly parentOrigin: string;
  readonly env: TransportEnv;
}

/**
 * Iframe transport to the 3D sandbox (`?embed=1`). Mounts lazily, posts `nasa:copilot-command` envelopes to the
 * sandbox origin only, pauses rendering while the panel is collapsed, scrolled away or the tab is hidden, and
 * removes every listener on `destroy()`.
 */
export class SimulatorTransport {
  private readonly sandboxUrl: string;
  private readonly sandboxOrigin: string;
  private readonly parentOrigin: string;
  private readonly env: TransportEnv;
  private iframe: IframeLike | null = null;
  private loaded = false;
  private queue: SimulationControlDetail[] = [];
  private readonly alertListeners = new Set<(a: SimTelemetryAlertDetail) => void>();
  private teardown: Array<() => void> = [];
  private panelVisible = true;
  private onScreen = true;
  private paused = false;

  constructor(options: SimulatorTransportOptions) {
    this.sandboxUrl = options.sandboxUrl;
    this.sandboxOrigin = new URL(options.sandboxUrl).origin;
    this.parentOrigin = options.parentOrigin;
    this.env = options.env;
  }

  isMounted(): boolean {
    return this.iframe !== null;
  }

  /** Creates the iframe and its listeners once; later calls are no-ops. */
  open(): void {
    if (this.iframe !== null) return;
    const { env } = this;
    const frame = env.createIframe();
    frame.className = 'sim-frame';
    frame.title = '3D sandbox (simulated, parametric)';
    frame.setAttribute('allow', 'fullscreen');
    frame.setAttribute('referrerpolicy', 'no-referrer');
    frame.src = buildEmbedUrl(this.sandboxUrl, this.parentOrigin);

    const onLoad: Listener = () => {
      this.loaded = true;
      const pending = this.queue;
      this.queue = [];
      for (const detail of pending) this.post(detail);
      if (this.paused) this.post({ action: 'PAUSE' });
    };
    const onMessage: Listener = (ev) => {
      const event = ev as { origin: string; data: unknown; source?: unknown };
      if (event.source !== undefined && event.source !== frame.contentWindow) return;
      const alert = parseAlertMessage(event, this.sandboxOrigin);
      if (alert !== null) for (const fn of this.alertListeners) fn(alert);
    };
    const onVisibility: Listener = () => this.syncPause();

    frame.addEventListener('load', onLoad);
    env.win.addEventListener('message', onMessage);
    env.doc.addEventListener('visibilitychange', onVisibility);
    env.container.append(frame as never);
    const disconnect = env.observe(frame, (visible) => {
      this.onScreen = visible;
      this.syncPause();
    });

    this.teardown = [
      () => frame.removeEventListener('load', onLoad),
      () => env.win.removeEventListener('message', onMessage),
      () => env.doc.removeEventListener('visibilitychange', onVisibility),
      disconnect,
    ];
    this.iframe = frame;
  }

  /** Sends a command, mounting the sandbox first if needed. Commands wait for the iframe `load`. */
  send(detail: SimulationControlDetail): void {
    this.open();
    if (!this.loaded) {
      this.queue.push(detail);
      return;
    }
    this.post(detail);
  }

  /** Called when the 3D panel is expanded or collapsed. */
  setPanelVisible(visible: boolean): void {
    this.panelVisible = visible;
    this.syncPause();
  }

  onAlert(fn: (a: SimTelemetryAlertDetail) => void): () => void {
    this.alertListeners.add(fn);
    return () => this.alertListeners.delete(fn);
  }

  destroy(): void {
    for (const fn of this.teardown) fn();
    this.teardown = [];
    this.iframe?.remove();
    this.iframe = null;
    this.loaded = false;
    this.queue = [];
    this.paused = false;
    this.onScreen = true;
  }

  private post(detail: SimulationControlDetail): void {
    this.iframe?.contentWindow?.postMessage({ type: COPILOT_COMMAND_MESSAGE, detail }, this.sandboxOrigin);
  }

  private syncPause(): void {
    if (this.iframe === null) return;
    const shouldPause = !this.panelVisible || !this.onScreen || this.env.doc.visibilityState !== 'visible';
    if (shouldPause === this.paused) return;
    this.paused = shouldPause;
    if (this.loaded) this.post({ action: shouldPause ? 'PAUSE' : 'RESUME' });
  }
}
