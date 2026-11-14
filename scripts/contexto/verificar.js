#!/usr/bin/env node
// Portón de calidad del contexto (E-01 §5).
//
//   node scripts/contexto/verificar.js
//
// Sale con código 1 si hay errores. CI lo corre en cada PR y en cada push a main.
// Los avisos no bloquean: se informan para arreglarlos por lotes.
"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const L = require("./lib.js");

const ROOT = path.resolve(__dirname, "..", "..");
const notas = L.leerNotas(ROOT);
const errores = [];
const avisos = [];
const hoy = new Date().toISOString().slice(0, 10);

const esFecha = (s) => /^\d{4}-\d\d-\d\d$/.test(s) && new Date(s + "T00:00:00Z").toISOString().slice(0, 10) === s;
const sinCodigo = (t) => t.replace(/```[\s\S]*?```/g, "").replace(/`[^`\n]*`/g, "");
// Texto citado (entre comillas o en bloque "> "): es de otro autor o de un prompt, no redacción propia.
const sinCitas = (t) => sinCodigo(t).replace(/^>.*$/gm, "").replace(/"[^"\n]*"/g, "").replace(/«[^»\n]*»/g, "").replace(/“[^”\n]*”/g, "");

// Rutas absolutas de disco: unidades de Windows (con \ o /) y rutas de git-bash como /c/Users
const RUTA_ABSOLUTA = [/(?<!\w)[A-Za-z]:\\/, /(?<![\w:])[A-Za-z]:\/(?!\/)/, /(?:^|[\s(`"'])\/[a-z]\/[A-Za-z]/m];
// Datos personales (regla de oro 2 de AGENTS.md): teléfonos de Honduras y correos fuera de dominios de ejemplo
const TELEFONO = /(?<![\w.,\/-])(?:\+?504[\s-]?)?[2389]\d{3}[\s-]?\d{4}(?![\w.,\/-])/;
const CORREO = /[\w.+-]+@([\w-]+(?:\.[\w-]+)+)/g;
const DOMINIOS_PERMITIDOS = new Set(["example.com", "example.org", "anthropic.com", "users.noreply.github.com"]);
const PROHIBIDAS = /\b(soluci[oó]n integral|mejores pr[aá]cticas de la industria|robust[oa]s?|escalables?)\b/gi;
const ID_ARCHIVO = /^(ADR-\d{3}|E-\d{2}|I-\d{2}|CU-\d{2}|DP-\d{2}|S-\d{3}|SL-\d{2}|ST-\d{2}|SM-\d{2}\.\d+|M-\d{2})(?=-|$)/;

// Texto de una sección "## Título" hasta la siguiente "## "
function seccion(cuerpo, titulo) {
  const m = cuerpo.match(new RegExp(`^##\\s+${titulo}[^\\n]*\\n([\\s\\S]*?)(?=^##\\s|(?![\\s\\S]))`, "mi"));
  return m ? m[1] : null;
}
// Preguntas de un submódulo: filas "| Q-NN | … | estado |" de la sección Preguntas; abiertas = abierta o investigando
function preguntasAbiertas(cuerpo) {
  const s = seccion(cuerpo, "Preguntas") || "";
  return s.split("\n").filter((l) => /^\|\s*Q-\d+/.test(l)).map((l) => l.split("|").map((c) => c.trim()).filter(Boolean))
    .filter((c) => /^(abierta|investigando)$/i.test(c[c.length - 1] || "")).map((c) => c[0]);
}

function revisarTexto(origen, txt) {
  if (RUTA_ABSOLUTA.some((r) => r.test(txt))) errores.push(`${origen}: contiene una ruta absoluta de disco`);
  const tel = txt.match(TELEFONO);
  if (tel) errores.push(`${origen}: posible teléfono (${tel[0].trim()}); los datos personales no van al repo (regla de oro 2 de AGENTS.md)`);
  for (const m of txt.matchAll(CORREO)) {
    if (!DOMINIOS_PERMITIDOS.has(m[1].toLowerCase())) errores.push(`${origen}: correo ${m[0]}; los datos personales no van al repo (regla de oro 2 de AGENTS.md)`);
  }
}

// Nombres a los que puede apuntar un wikilink (Obsidian resuelve sin distinguir mayúsculas)
const existentes = new Set(notas.map((n) => n.nombre.toLowerCase()));
["index", "agents"].forEach((n) => existentes.add(n));
const porNombre = new Map(notas.map((n) => [n.nombre.toLowerCase(), n]));
const entrantes = new Map(notas.map((n) => [n.nombre.toLowerCase(), 0]));
const HISTORICOS = new Set(["sesion", "resumen"]);   // describen el pasado: no se desactualizan ni necesitan enlaces de entrada

// Fecha (AAAA-MM-DD) del último commit que tocó alguna de esas rutas. Vacío si no hay git o historial.
function ultimoCommit(rutas) {
  try {
    return execFileSync("git", ["log", "-1", "--format=%cs", "--", ...rutas],
      { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

const ids = new Map();
const deuda = new Map();
const pAbiertos = new Set();    // P-NNN en abierta.md
const pResueltos = new Set();   // P-NNN en resuelta-AAAA.md
const filasSeguridad = [];      // filas de tabla de notas de seguridad: [nota, fila]
const equipo = L.leerEquipo(ROOT);
if (!Array.isArray(equipo)) errores.push("contexto/.control/equipo.json no existe o no es una lista válida");
const alias = new Set((equipo || []).map((p) => p.alias));
const integradores = new Set((equipo || []).filter((p) => p.integrador).map((p) => p.alias));
const submodulos = new Map();   // SM-NN.N → nota

for (const n of notas) {
  const { rel, fm, cuerpo, txt } = n;
  revisarTexto(rel, txt);

  const id = n.nombre.match(ID_ARCHIVO);
  if (id) ids.set(id[1], [...(ids.get(id[1]) || []), rel]);

  if (!fm) { errores.push(`${rel}: sin frontmatter`); continue; }
  for (const k of L.OBLIGATORIOS) {
    if (fm[k] === undefined || fm[k] === "" || (Array.isArray(fm[k]) && fm[k].length === 0)) errores.push(`${rel}: falta '${k}'`);
  }
  if (fm.type && !L.TIPOS.has(fm.type)) errores.push(`${rel}: type '${fm.type}' no es válido`);
  if (fm.status && !L.ESTADOS.has(fm.status)) errores.push(`${rel}: status '${fm.status}' no es válido`);
  if (fm.autor && equipo && !alias.has(fm.autor)) errores.push(`${rel}: autor '${fm.autor}' no está en contexto/.control/equipo.json`);
  if (fm.agente && !L.AGENTES.has(fm.agente)) errores.push(`${rel}: agente '${fm.agente}' no es válido (${[...L.AGENTES].join(", ")})`);

  // Sesiones: 70-bitacora/AAAA-MM/AAAA-MM-DD-autor-titulo.md, con el agente declarado
  if (fm.type === "sesion") {
    if (!fm.agente) errores.push(`${rel}: una sesión debe declarar 'agente'`);
    const m = n.nombre.match(/^(\d{4}-\d\d-\d\d)-([a-z0-9]+)-[a-z0-9-]+$/);
    if (!m) errores.push(`${rel}: el nombre de una sesión debe ser AAAA-MM-DD-autor-titulo.md`);
    else {
      if (fm.date && m[1] !== fm.date) errores.push(`${rel}: la fecha del nombre (${m[1]}) no coincide con date (${fm.date})`);
      if (fm.autor && m[2] !== fm.autor) errores.push(`${rel}: el autor del nombre (${m[2]}) no coincide con autor (${fm.autor})`);
      if (rel !== `70-bitacora/${m[1].slice(0, 7)}/${n.nombre}.md`) errores.push(`${rel}: una sesión va en 70-bitacora/${m[1].slice(0, 7)}/`);
    }
  }

  // Módulos y submódulos (E-02): 35-modulos/M-NN-nombre/{M-NN-ficha.md, SM-NN.N-nombre.md}
  if (fm.type === "modulo" || fm.type === "submodulo") {
    const partes = rel.split("/");
    const carpetaMod = (partes[1] || "").match(/^M-(\d{2})-[a-z0-9-]+$/);
    if (partes[0] !== "35-modulos" || partes.length !== 3 || !carpetaMod) {
      errores.push(`${rel}: módulos y submódulos van en 35-modulos/M-NN-nombre/`);
    } else if (fm.type === "modulo" && n.nombre !== `M-${carpetaMod[1]}-ficha`) {
      errores.push(`${rel}: la ficha del módulo se llama M-${carpetaMod[1]}-ficha.md`);
    }
    if (!fm.responsable) errores.push(`${rel}: falta 'responsable'`);
    else if (equipo && !alias.has(fm.responsable)) errores.push(`${rel}: responsable '${fm.responsable}' no está en contexto/.control/equipo.json`);

    if (fm.type === "submodulo") {
      const id = L.idSM(n.nombre);
      if (!id) errores.push(`${rel}: el nombre de un submódulo es SM-NN.N-nombre.md`);
      else {
        submodulos.set(id, n);
        if (carpetaMod && id.slice(3, 5) !== carpetaMod[1]) errores.push(`${rel}: ${id} no pertenece al módulo M-${carpetaMod[1]}`);
      }
      if (fm.modulo && carpetaMod && fm.modulo !== `M-${carpetaMod[1]}`) errores.push(`${rel}: modulo '${fm.modulo}' no coincide con la carpeta (M-${carpetaMod[1]})`);
      if (!fm.modulo) errores.push(`${rel}: falta 'modulo'`);
      if (!Array.isArray(fm.depende_de)) errores.push(`${rel}: falta 'depende_de' (lista; [] si no depende de nada)`);
      const nivel = L.nivelSM(fm.estado_sm);
      if (nivel < 0) errores.push(`${rel}: estado_sm '${fm.estado_sm || ""}' no es válido (${L.ESTADOS_SM.join(", ")})`);
      const abiertas = preguntasAbiertas(cuerpo);
      if (nivel >= L.nivelSM("aprobado") && abiertas.length) {
        errores.push(`${rel}: está '${fm.estado_sm}' con preguntas abiertas (${abiertas.join(", ")}); se responden antes de aprobar`);
      }
      if (nivel >= L.nivelSM("aprobado") && String(fm.cambia_contrato) === "true" && !integradores.has(fm.aprobado_contrato_por)) {
        errores.push(`${rel}: cambia el contrato del módulo; necesita 'aprobado_contrato_por' de un integrador de equipo.json`);
      }
      if (fm.estado_sm === "cerrado") {
        const cierre = (seccion(cuerpo, "Cierre") || "").replace(/<!--[\s\S]*?-->/g, "").trim();
        if (cierre.length < 20) errores.push(`${rel}: un submódulo cerrado necesita su sección '## Cierre'`);
      }
    }
  }

  // Resumen mensual: 70-bitacora/AAAA-MM/AAAA-MM-resumen.md
  if (fm.type === "resumen") {
    const m = n.nombre.match(/^(\d{4}-\d\d)-resumen$/);
    if (!m || rel !== `70-bitacora/${m[1]}/${n.nombre}.md`) errores.push(`${rel}: un resumen mensual va en 70-bitacora/AAAA-MM/AAAA-MM-resumen.md`);
  }

  // Reemplazo: toda nota reemplazada dice cuál la reemplaza, y esa nota existe
  if (fm.status === "reemplazado") {
    const destino = fm.reemplazado_por ? L.destinoEnlace(String(fm.reemplazado_por).replace(/^\[\[|\]\]$/g, "")) : "";
    if (!destino) errores.push(`${rel}: una nota reemplazada debe indicar 'reemplazado_por'`);
    else if (!existentes.has(destino.toLowerCase())) errores.push(`${rel}: reemplazado_por '${destino}' no existe`);
  }
  for (const k of ["date", "updated", "consultado", "vence"]) {
    if (fm[k] && !esFecha(fm[k])) errores.push(`${rel}: ${k} no es una fecha AAAA-MM-DD válida ('${fm[k]}')`);
  }
  if (esFecha(fm.date || "") && esFecha(fm.updated || "") && fm.updated < fm.date) errores.push(`${rel}: updated es anterior a date`);
  if (esFecha(fm.vence || "") && fm.vence < hoy) avisos.push(`${rel}: venció el ${fm.vence}; verificar de nuevo contra la fuente`);

  const scopeExistente = [];
  for (const s of Array.isArray(fm.scope) ? fm.scope : []) {
    if (!s.includes("/") || /[<>()]/.test(s)) { errores.push(`${rel}: scope '${s}' no es una ruta del repo`); continue; }
    if (!fs.existsSync(path.join(ROOT, s))) {
      const msg = `${rel}: scope '${s}' no existe en el repo`;
      fm.status === "vigente" ? errores.push(msg) : avisos.push(msg + " (se acepta en borrador)");
    } else scopeExistente.push(s);
  }

  // Desactualizada: el código que describe cambió después de la última actualización de la nota
  if (scopeExistente.length && !HISTORICOS.has(fm.type) && !L.RETIRADOS.has(fm.status) && esFecha(fm.updated || "")) {
    const cambio = ultimoCommit(scopeExistente);
    if (cambio && cambio > fm.updated) avisos.push(`${rel}: su scope cambió el ${cambio} y la nota se actualizó el ${fm.updated}; revisar si quedó vieja`);
  }

  // Investigación vigente: sin fuentes es error; con fuentes pero sin clasificar [O]/[P]/[B] es aviso.
  // Acepta sección de bibliografía o fuentes, o una tabla con columna "Fuente" (formato Tipo A), y el
  // marcado escapado \[O\] que dejan los documentos exportados desde Word o Google Docs.
  if (fm.type === "investigacion" && fm.status === "vigente") {
    // El encabezado puede venir numerado y en negrita ("## **13\. Bibliografía**"); la URL puede ir sin esquema
    // ("docs.flutter.dev/app-architecture/guide").
    const conSeccion = /^#{1,4}\s+[\W\d\\]*(bibliograf|fuentes|referencias|obras citadas)/im.test(cuerpo)
      || /^\|.*\bFuente\b.*\|/im.test(cuerpo);
    const conUrl = /https?:\/\//.test(cuerpo) || /\b[\w-]+(\.[\w-]+)+\/[\w\/.-]+/.test(cuerpo);
    if (!(conSeccion && conUrl)) errores.push(`${rel}: investigación vigente sin fuentes (sección de bibliografía o tabla con columna Fuente, con URL)`);
    else if (!/\\?\[(O|P|B)\\?\]/.test(cuerpo)) avisos.push(`${rel}: fuentes sin clasificar [O]/[P]/[B] (CLAUDE.md §8)`);
  }

  if (fm.type === "deuda") {
    for (const m of cuerpo.matchAll(/^#{2,4}\s+(P-\d{3})\b/gm)) {
      deuda.set(m[1], [...(deuda.get(m[1]) || []), rel]);
      if (n.nombre === "abierta") pAbiertos.add(m[1]);
      else if (/^resuelta-/.test(n.nombre)) pResueltos.add(m[1]);
    }
  }
  if (fm.type === "seguridad") {
    for (const fila of cuerpo.split("\n")) if (/^\|/.test(fila)) filasSeguridad.push([rel, fila]);
  }

  for (const m of sinCodigo(cuerpo).matchAll(/\[\[([^\]]+)\]\]/g)) {
    const destino = L.destinoEnlace(m[1]);
    const clave = destino.toLowerCase();
    if (!existentes.has(clave)) { avisos.push(`${rel}: wikilink sin destino [[${destino}]]`); continue; }
    if (clave !== n.nombre.toLowerCase() && entrantes.has(clave)) entrantes.set(clave, entrantes.get(clave) + 1);
    const apuntada = porNombre.get(clave);
    // La nota que reemplaza a otra puede enlazar a su antecesora: es su historia, no un enlace viejo.
    const esSuReemplazo = apuntada && L.destinoEnlace(String((apuntada.fm || {}).reemplazado_por || "").replace(/^\[\[|\]\]$/g, "")).toLowerCase() === n.nombre.toLowerCase();
    if (apuntada && (apuntada.fm || {}).status === "reemplazado" && !HISTORICOS.has(fm.type) && !esSuReemplazo) {
      avisos.push(`${rel}: enlaza a [[${destino}]], que está reemplazada; apuntar a ${apuntada.fm.reemplazado_por || "su reemplazo"}`);
    }
  }
  if (!/^##\s+Relaciones\s*$/m.test(cuerpo)) avisos.push(`${rel}: sin sección '## Relaciones'`);

  const prohibidas = [...new Set([...sinCitas(cuerpo).matchAll(PROHIBIDAS)].map((m) => m[0].toLowerCase()))];
  if (prohibidas.length) avisos.push(`${rel}: palabras vetadas por el estándar de redacción: ${prohibidas.join(", ")}`);
}

// Huérfanas: notas vivas a las que ninguna otra enlaza (el índice no cuenta)
for (const n of notas) {
  const fm = n.fm || {};
  if (HISTORICOS.has(fm.type) || L.RETIRADOS.has(fm.status)) continue;
  if (entrantes.get(n.nombre.toLowerCase()) === 0) avisos.push(`${n.rel}: ninguna nota la enlaza; conectarla o evaluar si sobra`);
}

// Dependencias entre submódulos: existen, no forman ciclos, y lo que está en curso no espera a algo abierto
for (const [id, n] of submodulos) {
  for (const dep of (n.fm.depende_de || [])) {
    if (!submodulos.has(dep)) errores.push(`${n.rel}: depende_de '${dep}' no existe`);
    else if (n.fm.estado_sm === "en-curso" && submodulos.get(dep).fm.estado_sm !== "cerrado") {
      avisos.push(`${n.rel}: está en curso pero ${dep} no está cerrado`);
    }
  }
}
const visitado = new Map();   // id → 1 visitando, 2 terminado
function buscarCiclo(id, camino) {
  if (visitado.get(id) === 2) return;
  if (visitado.get(id) === 1) { errores.push(`ciclo de dependencias entre submódulos: ${[...camino, id].join(" → ")}`); return; }
  visitado.set(id, 1);
  for (const dep of (submodulos.get(id)?.fm.depende_de || [])) if (submodulos.has(dep)) buscarCiclo(dep, [...camino, id]);
  visitado.set(id, 2);
}
for (const id of submodulos.keys()) buscarCiclo(id, []);

// Cierre de deuda (E-01): lo que el plan de seguridad marca ✅ no puede seguir abierto, ni al revés.
// Una fila "parcial" no cuenta: su ítem sigue abierto a propósito.
for (const [rel, fila] of filasSeguridad) {
  const citados = [...new Set(fila.match(/\bP-\d{3}\b/g) || [])];
  if (!citados.length || /parcial/i.test(fila)) continue;
  const hecha = fila.includes("✅");
  for (const id of citados) {
    if (hecha && pAbiertos.has(id)) errores.push(`${rel}: una fila con ✅ cita ${id}, que sigue en abierta.md; moverlo a resuelta-2026.md o quitar el ✅ (E-01)`);
    else if (!hecha && pResueltos.has(id)) avisos.push(`${rel}: una fila sin ✅ cita ${id}, que ya está en resuelta; revisar si falta el ✅ (E-01)`);
  }
}

// Meses cerrados de bitácora sin resumen mensual
const abiertos = L.mesesAbiertos(notas.filter((n) => !L.RETIRADOS.has((n.fm || {}).status)));
const mesesBitacora = new Map();
for (const n of notas.filter((x) => x.carpeta === "70-bitacora")) {
  const mes = L.mesDe(n);
  if (!mes) continue;
  const r = mesesBitacora.get(mes) || { resumen: false };
  if ((n.fm || {}).type === "resumen") r.resumen = true;
  mesesBitacora.set(mes, r);
}
for (const [mes, r] of mesesBitacora) {
  if (!abiertos.has(mes) && !r.resumen) avisos.push(`70-bitacora/${mes}: mes cerrado sin resumen (${mes}-resumen.md)`);
}

for (const [id, rutas] of ids) if (rutas.length > 1) errores.push(`identificador ${id} repetido en: ${rutas.join(", ")}`);
for (const [id, rutas] of deuda) if (rutas.length > 1) errores.push(`deuda ${id} aparece ${rutas.length} veces: ${rutas.join(", ")}`);

// Archivos de control
const leer = (p) => { try { return L.normalizar(fs.readFileSync(path.join(ROOT, p), "utf8")); } catch { return null; } };
const agents = leer("AGENTS.md");
if (agents === null) errores.push("AGENTS.md no existe");
else {
  revisarTexto("AGENTS.md", agents);
  if (Buffer.byteLength(agents) > 8192) errores.push(`AGENTS.md pesa ${Buffer.byteLength(agents)} B; el tope es 8 KB (E-01 §6.2)`);
}
const esperados = L.generarIndices(ROOT);
for (const [f, txt] of Object.entries(esperados)) {
  const actual = leer(path.join(L.VAULT, f));
  if (actual === null) errores.push(`contexto/${f} no existe: correr node scripts/contexto/build-index.js`);
  else if (actual !== txt) errores.push(`contexto/${f} está desactualizado: correr node scripts/contexto/build-index.js`);
}
for (const f of fs.readdirSync(path.join(ROOT, L.VAULT))) {
  if (L.esIndice(f) && !(f in esperados)) errores.push(`contexto/${f} ya no se genera: correr node scripts/contexto/build-index.js para borrarlo`);
}
const indice = leer(path.join(L.VAULT, "INDEX.md"));
if (indice !== null && Buffer.byteLength(indice) > L.TOPE_INDICE) errores.push(`INDEX.md pesa ${Buffer.byteLength(indice)} B; el tope es ${L.TOPE_INDICE} B (E-01)`);

// Reporte
const arranque = Buffer.byteLength(agents || "") + Buffer.byteLength(indice || "");
console.log(`Contexto: ${notas.length} notas`);
console.log(`Arranque: AGENTS.md + INDEX.md = ${arranque} B (≈ ${Math.round(arranque / 4.5)} tokens, estimado a 4,5 B/token medido en Bimbo)`);
console.log("");
console.log(`Errores: ${errores.length}`);
errores.forEach((e) => console.log("  ✗ " + e));
const unicos = [...new Set(avisos)];
console.log(`Avisos : ${unicos.length}`);
unicos.forEach((a) => console.log("  · " + a));
process.exit(errores.length ? 1 : 0);
