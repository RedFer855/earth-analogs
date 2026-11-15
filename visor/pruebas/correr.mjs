import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const dirPruebas = dirname(fileURLToPath(import.meta.url));
const archivos = readdirSync(dirPruebas)
  .filter((f) => f.endsWith('.prueba.ts'))
  .sort();

if (archivos.length === 0) {
  console.error('No se encontraron archivos *.prueba.ts en pruebas/');
  process.exit(1);
}

let fallos = 0;

for (const archivo of archivos) {
  const entrada = resolve(dirPruebas, archivo);
  const res = await build({
    entryPoints: [entrada],
    bundle: true,
    write: false,
    platform: 'node',
    format: 'esm',
    target: 'node20',
  });

  const codigo = res.outputFiles[0].text;
  const ejec = spawnSync(process.execPath, ['--input-type=module'], {
    input: codigo,
    encoding: 'utf8',
    cwd: dirPruebas,
  });

  if (ejec.stdout) process.stdout.write(ejec.stdout);
  if (ejec.stderr) process.stderr.write(ejec.stderr);

  if (ejec.status !== 0) {
    console.error(`FALLÓ ${archivo} (código ${ejec.status ?? 1})`);
    fallos += 1;
  } else {
    console.log(`OK ${archivo}`);
  }
}

if (fallos > 0) {
  process.exit(1);
}
