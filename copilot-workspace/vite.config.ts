import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

// CesiumJS loads its web workers, widget CSS and offline textures (NaturalEarthII) at runtime from
// window.CESIUM_BASE_URL (set in src/main.ts). They are copied verbatim to `/cesium/` so no Cesium ion token or
// network imagery is needed.
const cesiumSource = 'node_modules/cesium/Build/Cesium';
const cesiumBaseUrl = 'cesium';

export default defineConfig({
  server: {
    // The 3D sandbox dev server keeps Vite's default port (5173); this workspace runs next to it.
    port: 5190,
    strictPort: true,
  },
  plugins: [
    viteStaticCopy({
      targets: [
        { src: `${cesiumSource}/ThirdParty`, dest: cesiumBaseUrl },
        { src: `${cesiumSource}/Workers`, dest: cesiumBaseUrl },
        { src: `${cesiumSource}/Assets`, dest: cesiumBaseUrl },
        { src: `${cesiumSource}/Widgets`, dest: cesiumBaseUrl },
      ],
    }),
  ],
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
