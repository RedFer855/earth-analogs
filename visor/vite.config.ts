import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

const base = './';
const cesiumBuild = 'node_modules/cesium/Build/Cesium';

export default defineConfig({
  base,
  define: {
    CESIUM_BASE_URL: JSON.stringify(`${base}cesiumStatic`),
  },
  plugins: [
    viteStaticCopy({
      targets: [
        { src: `${cesiumBuild}/ThirdParty`, dest: 'cesiumStatic' },
        { src: `${cesiumBuild}/Workers`, dest: 'cesiumStatic' },
        { src: `${cesiumBuild}/Assets`, dest: 'cesiumStatic' },
        { src: `${cesiumBuild}/Widgets`, dest: 'cesiumStatic' },
      ],
    }),
  ],
  build: {
    chunkSizeWarningLimit: 5000,
    rollupOptions: {
      output: {
        manualChunks: {
          cesium: ['cesium'],
        },
      },
    },
  },
});
