// Arma en una carpeta temporal unos datos publicados de prueba: el fixture del visor (metrics.json y JZ.json),
// tres pines y unas capas7 de 3 celdas. Los valores son sintéticos; solo sirven a las pruebas.
import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RAIZ_REPO } from '../nucleo.mjs';
import { ang2pixNested } from '../healpix.mjs';

export function crearDatosPrueba() {
  const raiz = mkdtempSync(join(tmpdir(), 'ea-mcp-'));
  const datos = join(raiz, 'datos');
  cpSync(join(RAIZ_REPO, 'visor', 'pruebas', 'datos'), datos, { recursive: true });
  const pin = (id, tipo, nombre, lon, lat) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [lon, lat] },
    properties: { id, tipo, nombre, fuente: 'prueba', licencia: 'CC0', atribucion: 'prueba' },
  });
  writeFileSync(
    join(datos, 'puntos.geojson'),
    JSON.stringify({
      type: 'FeatureCollection',
      features: [
        pin('t1', 'tubo_lava', 'Tubo A', 2.5, 31.1),
        pin('c1', 'crater_impacto', 'Cráter B', 10, 40),
        pin('s1', 'playa_salar', 'Salar C', -67.5, -20.1),
      ],
    }),
  );
  const dir7 = join(datos, 'capas7');
  mkdirSync(dir7);
  // pendiente: 1 en el salar, 3 junto a JZ, sin dato en (40, 10)
  const celdas = [
    [ang2pixNested(128, -20, -67.5), 1],
    [ang2pixNested(128, 31.12, 2.46), 3],
    [ang2pixNested(128, 40, 10), Number.NaN],
  ].sort((a, b) => a[0] - b[0]);
  const pix = celdas.map((c) => c[0]);
  writeFileSync(join(dir7, 'ipix.u32'), Buffer.from(new Uint32Array(pix).buffer));
  writeFileSync(join(dir7, 'n_hijas.u16'), Buffer.from(new Uint16Array([1024, 1024, 1024]).buffer));
  writeFileSync(join(dir7, 'slope_mean_deg.f32'), Buffer.from(new Float32Array(celdas.map((c) => c[1])).buffer));
  writeFileSync(
    join(dir7, 'capas7.json'),
    JSON.stringify({
      nivel: 7,
      nside: 128,
      esquema: 'nested',
      n_celdas: 3,
      archivos: { ipix: 'ipix.u32', n_hijas: 'n_hijas.u16' },
      columnas: {
        slope_mean_deg: {
          archivo: 'slope_mean_deg.f32',
          unidad: 'grados',
          fuente: 'prueba',
          url: '',
          licencia: 'CC0',
          metodo: 'mediana',
          cobertura_pct: 66.7,
          p1: 0.05,
          p50: 1.15,
          p99: 20.9,
        },
      },
    }),
  );
  return { raiz, datos, pix };
}
