import './style.css';
import { CopilotEventBus } from './copilot/bridge/copilotEventBus.ts';
import { DEFAULT_SANDBOX_URL, SimulatorTransport, browserEnv } from './copilot/bridge/simulatorTransport.ts';
import { SiteIndexStore } from './copilot/search/siteIndexStore.ts';
import { CopilotPanel } from './copilot/ui/CopilotPanel.ts';
import { el } from './copilot/ui/dom.ts';

// CesiumJS reads its workers, widgets and offline textures from here (copied by vite-plugin-static-copy).
(window as unknown as { CESIUM_BASE_URL: string }).CESIUM_BASE_URL = `${import.meta.env.BASE_URL}cesium/`;

/** `?sandbox=<url>` overrides the sandbox location; only http(s) URLs are accepted. */
function sandboxUrlFromQuery(): string {
  const raw = new URLSearchParams(window.location.search).get('sandbox');
  if (raw === null) return DEFAULT_SANDBOX_URL;
  try {
    const url = new URL(raw);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : DEFAULT_SANDBOX_URL;
  } catch {
    return DEFAULT_SANDBOX_URL;
  }
}

async function start(): Promise<void> {
  const app = document.querySelector<HTMLElement>('#app');
  if (app === null) return;

  const header = el('header', 'topbar');
  header.append(el('h1', 'brand', 'Analog test-site copilot'), el('p', 'topbar-sub', 'Earth cells to rehearse Moon and Mars hardware'));
  const notice = el('p', 'notice');
  header.append(notice);
  const side = el('aside', 'side');
  const stage = el('main', 'stage');
  const globeHost = el('div', 'globe');
  globeHost.setAttribute('aria-label', 'Globe with candidate cells and geological pins');
  stage.append(globeHost);
  app.replaceChildren(header, side, stage);

  const store = new SiteIndexStore(`${import.meta.env.BASE_URL}data/`);
  try {
    await store.init();
  } catch (err) {
    side.append(el('p', 'error', `Sample data did not load: ${err instanceof Error ? err.message : String(err)}`));
    return;
  }
  notice.textContent = store.isSynthetic() ? 'Synthetic sample: random values, not real sites.' : '';

  const bus = new CopilotEventBus(window);
  const sandboxHost = el('div', 'sim-host');
  const transport = new SimulatorTransport({
    sandboxUrl: sandboxUrlFromQuery(),
    parentOrigin: window.location.origin,
    env: browserEnv(sandboxHost),
  });
  const panel = new CopilotPanel(side, { store, bus, transport, sandboxHost, stage });

  // CesiumJS is large; load it after the chat is usable.
  try {
    const { AnalogGlobe } = await import('./copilot/viewer/cesiumViewer.ts');
    const globe = new AnalogGlobe(globeHost, bus, store.pins());
    panel.attachGlobe(globe);
    window.addEventListener('pagehide', () => {
      panel.destroy();
      globe.destroy();
    });
  } catch (err) {
    globeHost.append(el('p', 'error', `Globe unavailable: ${err instanceof Error ? err.message : String(err)}`));
  }
}

void start();
