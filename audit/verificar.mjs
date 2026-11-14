#!/usr/bin/env node
// Verifica el registro de auditoría del ETL (audit/etl-log.jsonl), escrito por audit/audit.py.
// Comprueba: JSON válido, campos completos, hora con -06:00 desde el 2026-11-14 y sin retrocesos, integrante,
// agente y evento conocidos (team.json), paso E-NN y la cadena: prev = sha256 de la línea anterior.
// Uso: node audit/verificar.mjs [registro]. Sale con 1 si encuentra un error.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const CERO = '0'.repeat(64);
const CAMPOS = ['ts', 'integrante', 'agente', 'modelo', 'paso', 'evento', 'comando', 'commit', 'arbol_limpio',
  'duracion_s', 'salidas', 'resultado', 'nota', 'prev'];
const HORA = /^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d)-06:00$/;

export function verificarRegistro(texto, equipo) {
  const errores = [];
  const lineas = texto.split('\n').map((l) => l.replace(/\r$/, '')).filter((l) => l.trim());
  let previo = CERO;
  let horaPrevia = '';
  lineas.forEach((linea, i) => {
    const n = i + 1;
    let e;
    try {
      e = JSON.parse(linea);
    } catch {
      errores.push(`línea ${n}: no es JSON`);
      previo = createHash('sha256').update(linea, 'utf8').digest('hex');
      return;
    }
    for (const c of CAMPOS) if (!(c in e)) errores.push(`línea ${n}: falta ${c}`);
    const m = HORA.exec(e.ts ?? '');
    if (!m) errores.push(`línea ${n}: hora inválida ${e.ts}`);
    else {
      if (m[1] < '2026-11-14T00:00:00') errores.push(`línea ${n}: hora fuera de la ventana`);
      if (m[1] < horaPrevia) errores.push(`línea ${n}: la hora retrocede`);
      horaPrevia = m[1];
    }
    if (!equipo.integrantes.includes(e.integrante)) errores.push(`línea ${n}: integrante desconocido`);
    if (!equipo.agentes.includes(e.agente)) errores.push(`línea ${n}: agente desconocido`);
    if (!equipo.eventos.includes(e.evento)) errores.push(`línea ${n}: evento desconocido`);
    if (!/^E-\d\d$/.test(e.paso ?? '')) errores.push(`línea ${n}: paso inválido`);
    if (!Array.isArray(e.salidas)) errores.push(`línea ${n}: salidas no es lista`);
    if (e.prev !== previo) errores.push(`línea ${n}: cadena rota (prev no coincide con la línea anterior)`);
    previo = createHash('sha256').update(linea, 'utf8').digest('hex');
  });
  return { n: lineas.length, errores };
}

function main(argv) {
  const registro = resolve(argv[0] ?? join(AQUI, 'etl-log.jsonl'));
  const equipo = JSON.parse(readFileSync(join(dirname(registro), 'team.json'), 'utf8'));
  if (!existsSync(registro)) {
    console.log('audit: sin registro todavía');
    return 0;
  }
  const { n, errores } = verificarRegistro(readFileSync(registro, 'utf8'), equipo);
  if (errores.length) {
    console.error(`audit: ${errores.length} error(es) en ${n} línea(s):`);
    for (const e of errores) console.error(`  ${e}`);
    return 1;
  }
  console.log(`audit: ${n} línea(s), cadena íntegra`);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
