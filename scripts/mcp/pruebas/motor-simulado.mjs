// Motor simulado para las pruebas: lee los argumentos como `pipeline`, guarda la línea de comandos y escribe
// metrics.json y resultados/<perfil>/<objetivo>.json copiando el fixture del visor.
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const valor = (f) => {
  const i = args.indexOf(f);
  return i >= 0 ? args[i + 1] : undefined;
};
const salida = valor('--salida');
const fixtures = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'visor', 'pruebas', 'datos');
const extra = { args };
const perfilJson = valor('--perfil-json');
if (perfilJson) extra.perfil = JSON.parse(readFileSync(perfilJson, 'utf8'));
const region = valor('--region');
if (region) extra.region = JSON.parse(readFileSync(region, 'utf8'));
writeFileSync(join(salida, 'llamada.json'), JSON.stringify(extra));
if (process.env.MOTOR_SIMULADO_FALLA) {
  // clave falsa armada en tiempo de ejecución para que gitleaks no la confunda con una real
  process.stderr.write(`error: clave ${'AIza'}${'x'.repeat(35)} filtrada\n`);
  process.exit(1);
}
if (process.env.MOTOR_SIMULADO_LENTO) await new Promise((r) => setTimeout(r, 1500));
const perfil = valor('--perfil') ?? 'terreno';
const objetivo = valor('--objetivo') ?? 'JZ';
mkdirSync(join(salida, 'resultados', perfil), { recursive: true });
copyFileSync(join(fixtures, 'resultados', 'terreno', 'JZ.json'), join(salida, 'resultados', perfil, `${objetivo}.json`));
copyFileSync(join(fixtures, 'metrics.json'), join(salida, 'metrics.json'));
console.log(JSON.stringify({ sitio: objetivo, perfil, n_celdas: 3, tiempos: { total_s: 0.01 } }));
