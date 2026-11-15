import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

const base = './';
const cesiumBuild = 'node_modules/cesium/Build/Cesium';

/**
 * Las capas temáticas de una zona consultan servicios abiertos (Macrostrat, NASA POWER, SoilGrids, Overpass).
 * En localhost el visor las pide por /proxy/... para no depender de CORS; fuera de localhost va directo.
 */
const proxyServiciosAbiertos = Object.fromEntries(
  [
    ['/proxy/power', 'https://power.larc.nasa.gov'],
    ['/proxy/soilgrids-wms', 'https://maps.isric.org'],
    ['/proxy/macrostrat', 'https://macrostrat.org'],
    ['/proxy/overpass', 'https://overpass-api.de'],
  ].map(([ruta, destino]) => [
    ruta,
    { target: destino, changeOrigin: true, rewrite: (p: string) => p.slice(ruta.length) },
  ]),
);

export default defineConfig({
  base,
  define: {
    CESIUM_BASE_URL: JSON.stringify(`${base}cesiumStatic`),
  },
  server: { proxy: proxyServiciosAbiertos },
  preview: { proxy: proxyServiciosAbiertos },
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
