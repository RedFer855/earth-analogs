// Utilidades compartidas por build-index.js y verificar.js.
// Sin dependencias: solo módulos de Node.
"use strict";
const fs = require("fs");
const path = require("path");

const VAULT = "contexto";
// Índices generados en la raíz de contexto/: no son notas.
// INDEX.md se inyecta al arrancar; INDEX-bitacora.md se consulta (E-01 §6.2).
const INDICES = ["INDEX.md", "INDEX-bitacora.md"];
// Cualquier INDEX.md o INDEX-<carpeta>.md de la raíz de contexto/ es un índice generado, no una nota (E-01).
const esIndice = (rel) => /^INDEX(-[a-z0-9-]+)?\.md$/.test(rel);
// Sesiones que el índice de arranque lista una por una; el resto va a INDEX-bitacora.md.
const SESIONES_AL_ARRANCAR = 3;
const EXCLUIR = new Set([".obsidian", ".control", "_plantillas", "node_modules"]);

// Carpetas de primer nivel (E-01 §4.4), en el orden en que aparecen en el índice.
const CARPETAS = [
  ["00-mapa", "Vista para humanos"],
  ["10-reto", "El reto de NASA Space Apps 2026: enunciado, calendario, criterios del jurado"],
  ["20-casos-de-uso", "CU-NN: qué hace con el visor el jurado, un científico o un ingeniero de misión"],
  ["25-diagramas", "Diagramas: prompt_*.md es la fuente; lo demás se genera"],
  ["30-datos", "Variables, vector de parámetros, normalización y formato de las tablas ligeras"],
  ["32-sitios", "SL-NN sitios de base en Luna y Marte · ST-NN análogos terrestres candidatos"],
  ["35-modulos", "M-NN: ficha y contrato del módulo · SM-NN.N: especificación de cada submódulo (E-02)"],
  ["40-arquitectura", "Estado vivo: pipeline offline, motor Rust/Wasm, visor 3D, asistente"],
  ["45-decisiones", "ADR-NNN, estándares E-NN y decisiones pendientes DP-NN"],
  ["50-referencia", "Hechos externos con fecha: misiones, sensores, portales de datos, APIs, reglas de Space Apps"],
  ["55-investigaciones", "I-NN y sus prompts"],
  ["60-qa", "Validación de resultados contra análogos conocidos y pruebas del motor"],
  ["65-seguridad", "Secretos, licencias de datos y dependencias: hallazgos S-NNN"],
  ["70-bitacora", "Notas de sesión por mes"],
  ["80-deuda", "Deuda técnica P-NNN"],
  ["85-entrega", "Lo que se presenta: pitch, video, demo y formulario de Space Apps"],
];

const TIPOS = new Set([
  "sesion", "resumen", "adr", "decision-pendiente", "caso-uso", "regla", "diagrama", "arquitectura",
  "modulo", "submodulo",
  "datos", "referencia", "investigacion", "qa", "seguridad", "deuda", "producto", "estandar", "mapa",
  "informe", "sitio", "entrega",
]);
const ESTADOS = new Set(["borrador", "vigente", "reemplazado", "archivado"]);
const OBLIGATORIOS = ["title", "type", "status", "date", "updated", "summary", "autor"];
// Estados de un submódulo (E-02), en el orden en que avanzan.
const ESTADOS_SM = ["propuesto", "en-preguntas", "aprobado", "en-curso", "en-auditoria", "cerrado"];
const nivelSM = (estado) => ESTADOS_SM.indexOf(estado);
// ID de submódulo en el nombre del archivo: SM-01.3-invitaciones → SM-01.3
const idSM = (nombre) => (nombre.match(/^(SM-\d{2}\.\d+)(?=-|$)/) || [])[1] || null;
// Orden natural de submódulos: SM-01.2 antes que SM-01.10
function compararSM(a, b) {
  const pa = (idSM(a.nombre) || "").slice(3).split(".").map(Number);
  const pb = (idSM(b.nombre) || "").slice(3).split(".").map(Number);
  return (pa[0] - pb[0]) || (pa[1] - pb[1]) || (a.nombre < b.nombre ? -1 : 1);
}
// Herramienta que escribió la nota. "humano" cuando nadie usó un agente.
const AGENTES = new Set(["claude-code", "codex", "antigravity", "gemini-cli", "copilot", "cursor", "opencode", "hermes", "humano"]);

// Personas del equipo: contexto/.control/equipo.json → [{ alias, github }]
function leerEquipo(root) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, VAULT, ".control", "equipo.json"), "utf8"));
  } catch {
    return null;
  }
}

// Rutas relativas a contexto/, con "/" en cualquier sistema operativo.
function listarNotas(root) {
  const base = path.join(root, VAULT);
  const out = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) {
        if (!EXCLUIR.has(e.name)) walk(path.join(dir, e.name));
      } else if (e.isFile() && e.name.endsWith(".md")) {
        const rel = path.relative(base, path.join(dir, e.name)).split(path.sep).join("/");
        if (!esIndice(rel)) out.push(rel);
      }
    }
  })(base);
  return out.sort();
}

// BOM y CRLF rompen la detección del frontmatter (en Bimbo, 79 notas con CRLF).
function normalizar(txt) {
  return txt.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
}

const desquote = (s) => String(s).trim().replace(/^["'](.*)["']$/, "$1").trim();

// Quita el comentario "  # …" del final de un valor, salvo el "#" que está dentro de comillas.
// Como en YAML, una comilla abre cadena solo al inicio del valor o de un elemento de [a, b];
// el apóstrofo de "It's" no cuenta. Escapes: \" en comillas dobles, '' en simples.
function sinComentario(v) {
  let comilla = null;
  let inicio = true;
  for (let i = 0; i < v.length; i++) {
    const c = v[i];
    if (comilla === '"') {
      if (c === "\\") i++;
      else if (c === '"') comilla = null;
    } else if (comilla === "'") {
      if (c === "'" && v[i + 1] === "'") i++;
      else if (c === "'") comilla = null;
    } else if (c === "#" && i > 0 && /\s/.test(v[i - 1])) {
      return v.slice(0, i).trim();
    } else if (inicio && (c === '"' || c === "'")) {
      comilla = c;
    }
    if (!/\s/.test(c)) inicio = c === "[" || c === ",";
  }
  return v.trim();
}

// Subconjunto de YAML suficiente para el frontmatter de E-01 §4.6:
// escalares, listas en línea [a, b], listas con "- " y listas de mapas de un nivel (fuentes).
function parseFrontmatter(entrada) {
  const txt = normalizar(entrada);
  if (!txt.startsWith("---\n")) return { fm: null, cuerpo: txt };
  const fin = txt.indexOf("\n---", 3);
  if (fin === -1) return { fm: null, cuerpo: txt };
  const crudo = txt.slice(4, fin);
  const cuerpo = txt.slice(fin + 4).replace(/^\n/, "");
  const fm = {};
  let lista = null;
  for (const linea of crudo.split("\n")) {
    if (/^\s*(#.*)?$/.test(linea)) continue;
    const itemMapa = linea.match(/^\s*-\s+([A-Za-z_][\w-]*):\s*(.*)$/);
    const item = linea.match(/^\s*-\s+(.*)$/);
    const sub = linea.match(/^\s+([A-Za-z_][\w-]*):\s*(.*)$/);
    const kv = linea.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (lista && itemMapa && !/^https?$/.test(itemMapa[1])) {
      fm[lista].push({ [itemMapa[1]]: desquote(itemMapa[2]) });
    } else if (lista && item) {
      fm[lista].push(desquote(item[1]));
    } else if (lista && sub && typeof fm[lista].at(-1) === "object") {
      fm[lista].at(-1)[sub[1]] = desquote(sub[2]);
    } else if (kv) {
      const [, k, v] = kv;
      const valor = sinComentario(v);
      if (valor === "") { lista = k; fm[k] = []; }
      else if (valor.startsWith("[")) { lista = null; fm[k] = valor.slice(1, -1).split(",").map(desquote).filter(Boolean); }
      else { lista = null; fm[k] = desquote(valor); }
    }
  }
  return { fm, cuerpo };
}

// Destino de un wikilink: sin alias (|), sin ancla (#) y sin el "\" que escapa el pipe en tablas.
function destinoEnlace(interno) {
  return interno.replace(/\\(?=\|)/g, "").split("|")[0].split("#")[0].replace(/\.md$/, "").trim();
}

function leerNotas(root) {
  return listarNotas(root).map((rel) => {
    const txt = normalizar(fs.readFileSync(path.join(root, VAULT, rel), "utf8"));
    const { fm, cuerpo } = parseFrontmatter(txt);
    return { rel, nombre: path.basename(rel, ".md"), carpeta: rel.split("/")[0], txt, fm, cuerpo };
  });
}

// El índice es determinista: mismo contenido → mismo archivo, sin fechas de generación.
// Ciclo de vida (E-01 §4.8): lo reemplazado o archivado no se lista al arrancar.
const RETIRADOS = new Set(["reemplazado", "archivado"]);
const estaVivo = (n) => !RETIRADOS.has((n.fm || {}).status);

// Tope de INDEX.md (E-01): lo que se inyecta en cada arranque.
const TOPE_INDICE = 10240;
// Carpetas que el arranque resume; su detalle completo va en INDEX-<carpeta sin número>.md (E-01).
//   "enlaces": una línea con los wikilinks de las notas vigentes.
//   "conteo": una línea con cuántas son y dónde están.
// 35-modulos no está aquí: lista sus submódulos en trabajo sin summary y también tiene INDEX-modulos.md.
const ARRANQUE_RESUMIDO = new Map([
  ["32-sitios", "conteo"],
  ["40-arquitectura", "enlaces"],
  ["45-decisiones", "enlaces"],
  ["50-referencia", "conteo"],
  ["55-investigaciones", "conteo"],
  ["60-qa", "conteo"],
  ["65-seguridad", "conteo"],
]);
const nombreIndice = (carpeta) => `INDEX-${carpeta.replace(/^\d+-/, "")}.md`;
const lineaRetiradas = (r) => `_(${r} ${r === 1 ? "nota retirada" : "notas retiradas"}: reemplazadas o archivadas, no se listan)_`;

// Incidentes de seguridad (E-01): solo los abiertos van al índice de consulta, por severidad y sin tope.
// Abierto es todo lo que no está "resuelto"; los resueltos pasan a INDEX-seguridad-archivados.md.
const SEVERIDADES = [["critica", "críticos"], ["alta", "altos"], ["media", "medios"], ["baja", "bajos"]];
const INDICE_ARCHIVADOS = "INDEX-seguridad-archivados.md";
const esIncidente = (n) => (n.fm || {}).type === "seguridad" && Boolean((n.fm || {}).severidad);
const incidenteAbierto = (n) => (n.fm.estado_incidente || "") !== "resuelto";

function clasificarSeguridad(vivas) {
  const incidentes = vivas.filter(esIncidente);
  return {
    abiertos: incidentes.filter(incidenteAbierto),
    resueltos: incidentes.filter((n) => !incidenteAbierto(n)),
    otras: vivas.filter((n) => !esIncidente(n)),
  };
}

function lineasSeguridadArranque(vivas) {
  const { abiertos, resueltos, otras } = clasificarSeguridad(vivas);
  const cuenta = SEVERIDADES.map(([s, plural]) => [plural, abiertos.filter((n) => n.fm.severidad === s).length])
    .filter(([, c]) => c > 0).map(([p, c]) => `${p}: ${c}`).join(" · ") || "ninguno";
  const criticos = abiertos.some((n) => n.fm.severidad === "critica");
  const out = [`- Incidentes abiertos — ${cuenta}.`];
  out.push(criticos
    ? "- **Hay críticos abiertos: lee contexto/INDEX-seguridad.md antes de seguir, avisa a la persona cuáles son y no abras los demás incidentes salvo que ella lo pida.**"
    : "- Sin críticos abiertos; el detalle de los demás está en contexto/INDEX-seguridad.md.");
  if (resueltos.length) out.push(`- ${resueltos.length} ${resueltos.length === 1 ? "resuelto" : "resueltos"}: si la persona quiere verlos, que los busque en contexto/${INDICE_ARCHIVADOS}.`);
  if (otras.length) out.push(`- ${otras.length} ${otras.length === 1 ? "nota general" : "notas generales"} (amenazas, plan): contexto/${nombreIndice("65-seguridad")}.`);
  return out;
}

function lineaIncidente(n) {
  const fm = n.fm;
  return `- [[${n.nombre}]] · ${fm.severidad} · ${fm.estado_incidente || "?"} · ${fm.updated || "?"} — ${fm.summary || "(sin summary)"}`;
}

// Por severidad, de la más grave a la menos, todos los abiertos con su línea completa.
function lineasPorSeveridad(abiertos) {
  const out = [];
  for (const [sev, plural] of SEVERIDADES) {
    const deSev = abiertos.filter((n) => n.fm.severidad === sev).sort((a, b) => (a.nombre < b.nombre ? -1 : 1));
    if (!deSev.length) continue;
    out.push(`## ${plural[0].toUpperCase()}${plural.slice(1)} abiertos (${deSev.length})`, "");
    out.push(...deSev.map(lineaIncidente));
    out.push("");
  }
  return out;
}

function generarIndiceSeguridad(root) {
  const vivas = leerNotas(root).filter((n) => n.carpeta === "65-seguridad").filter(estaVivo);
  const { abiertos, resueltos, otras } = clasificarSeguridad(vivas);
  const out = [
    "<!-- GENERADO por scripts/contexto/build-index.js — no editar a mano -->",
    "# Índice de 65-seguridad",
    "",
    "Solo incidentes abiertos, de mayor a menor severidad. No se inyecta al arrancar.",
    "**Regla para el agente:** si hay críticos abiertos, léelos primero, avisa a la persona cuáles son en tu respuesta",
    "y no abras los demás incidentes salvo que ella lo pida.",
    `Los resueltos están en ${INDICE_ARCHIVADOS}: si la persona quiere verlos, dile que los busque ahí.`,
    "",
  ];
  const porSev = lineasPorSeveridad(abiertos);
  out.push(...(porSev.length ? porSev : ["_(sin incidentes abiertos)_", ""]));
  if (otras.length) out.push("## Notas generales", "", ...otras.map((n) => lineaNota(n)), "");
  if (resueltos.length) out.push(`_(${resueltos.length} ${resueltos.length === 1 ? "incidente resuelto" : "incidentes resueltos"}: ver ${INDICE_ARCHIVADOS})_`, "");
  return out.join("\n");
}

function generarIndiceSeguridadArchivados(root) {
  const vivas = leerNotas(root).filter((n) => n.carpeta === "65-seguridad").filter(estaVivo);
  const { resueltos } = clasificarSeguridad(vivas);
  const out = [
    "<!-- GENERADO por scripts/contexto/build-index.js — no editar a mano -->",
    "# Incidentes de seguridad resueltos",
    "",
    "Incidentes con `estado_incidente: resuelto`. No se inyecta al arrancar: se abre solo si la persona lo pide.",
    "",
    ...(resueltos.length ? resueltos.map(lineaIncidente) : ["_(vacío)_"]),
    "",
  ];
  return out.join("\n");
}

function lineasResumidas(carpeta, vivas) {
  if (carpeta === "65-seguridad") return lineasSeguridadArranque(vivas);
  const ver = `ver contexto/${nombreIndice(carpeta)}`;
  if (ARRANQUE_RESUMIDO.get(carpeta) === "enlaces") {
    return [`- ${vivas.map((n) => `[[${n.nombre}]]`).join(" · ")}`, `- _(tipo, estado y summary: ${ver})_`];
  }
  return [`- _(${vivas.length} ${vivas.length === 1 ? "nota" : "notas"}: ${ver})_`];
}

// Mes AAAA-MM de una nota de bitácora, tomado del nombre del archivo.
const mesDe = (n) => (n.nombre.match(/^(\d{4}-\d\d)-/) || [])[1] || null;
function mesAnterior(mes) {
  const [a, m] = mes.split("-").map(Number);
  return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, "0")}`;
}
// Meses cuyas sesiones se listan una por una: el más reciente con notas y el anterior.
// Se calcula con las notas, no con la fecha del sistema, para que el índice sea determinista.
function mesesAbiertos(notas) {
  const meses = notas.filter((n) => n.carpeta === "70-bitacora").map(mesDe).filter(Boolean).sort();
  if (meses.length === 0) return new Set();
  const ultimo = meses[meses.length - 1];
  return new Set([ultimo, mesAnterior(ultimo)]);
}

function lineaNota(n, sangria = "", conSummary = true) {
  const fm = n.fm || {};
  let meta;
  if (fm.type === "sesion") meta = [fm.type, fm.autor || "?", fm.agente || "?", fm.updated || "?"];
  else if (fm.type === "submodulo") meta = [fm.type, fm.estado_sm || "?", fm.responsable || "?", fm.updated || "?"];
  else if (fm.type === "modulo") meta = [fm.type, fm.responsable || "?", fm.updated || "?"];
  else meta = [fm.type || "?", fm.status || "?", fm.updated || "?"];
  const base = `${sangria}- [[${n.nombre}]] · ${meta.join(" · ")}`;
  return conSummary ? `${base} — ${fm.summary || "(sin summary)"}` : base;
}

// 35-modulos: cada módulo con su ficha y solo los submódulos en trabajo (de en-preguntas a en-auditoria).
// Los propuestos (todavía sin planear) y los cerrados se cuentan en una línea: su lista está en la ficha.
function lineasModulos(notas, conSummary = true) {
  const out = [];
  const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
  const carpetas = [...new Set(notas.map((n) => n.rel.split("/")[1]).filter((c) => c && !c.endsWith(".md")))].sort();
  for (const carpeta of carpetas) {
    const delModulo = notas.filter((n) => n.rel.split("/")[1] === carpeta);
    const ficha = delModulo.find((n) => (n.fm || {}).type === "modulo");
    const subs = delModulo.filter((n) => (n.fm || {}).type === "submodulo").sort(compararSM);
    const estado = (n) => (n.fm || {}).estado_sm;
    const enTrabajo = subs.filter((n) => !["propuesto", "cerrado"].includes(estado(n)));
    const propuestos = subs.filter((n) => estado(n) === "propuesto").length;
    const cerrados = subs.filter((n) => estado(n) === "cerrado").length;
    if (ficha) out.push(lineaNota(ficha));
    else out.push(`- ${carpeta}: sin ficha de módulo`);
    enTrabajo.forEach((n) => out.push(lineaNota(n, "  ", conSummary)));
    // "3 submódulos propuestos y 1 cerrado", "2 submódulos cerrados"…
    const resto = [];
    if (propuestos) resto.push(plural(propuestos, "submódulo propuesto", "submódulos propuestos"));
    if (cerrados) resto.push(resto.length ? plural(cerrados, "cerrado", "cerrados") : plural(cerrados, "submódulo cerrado", "submódulos cerrados"));
    if (resto.length) out.push(`  - _(${resto.join(" y ")}: ver la ficha)_`);
    delModulo.filter((n) => !["modulo", "submodulo"].includes((n.fm || {}).type)).forEach((n) => out.push(lineaNota(n, "  ", conSummary)));
  }
  return out;
}

function lineasBitacora(notas) {
  const abiertos = mesesAbiertos(notas);
  const meses = [...new Set(notas.map(mesDe).filter(Boolean))].sort().reverse();
  const out = [];
  for (const mes of meses) {
    const delMes = notas.filter((n) => mesDe(n) === mes);
    const resumen = delMes.find((n) => (n.fm || {}).type === "resumen");
    const sesiones = delMes.filter((n) => (n.fm || {}).type !== "resumen").reverse();
    if (abiertos.has(mes)) {
      if (resumen) out.push(lineaNota(resumen));
      sesiones.forEach((n) => out.push(lineaNota(n)));
    } else if (resumen) {
      out.push(lineaNota(resumen));
    } else {
      const cuantas = sesiones.length === 1 ? "1 sesión" : `${sesiones.length} sesiones`;
      out.push(`- ${mes}: ${cuantas} sin resumen mensual (buscar en 70-bitacora/${mes}/)`);
    }
  }
  return out;
}

// Índice de arranque: de la bitácora solo las sesiones más recientes y una línea que apunta al índice completo.
function lineasBitacoraArranque(notas) {
  // Solo meses abiertos: las sesiones de meses cerrados las representa su resumen, igual que en INDEX-bitacora.md.
  const abiertos = mesesAbiertos(notas);
  const sesiones = notas.filter((n) => (n.fm || {}).type === "sesion" && abiertos.has(mesDe(n)))
    .sort((a, b) => (a.nombre < b.nombre ? 1 : -1));
  const resumenes = notas.filter((n) => (n.fm || {}).type === "resumen").length;
  const out = sesiones.slice(0, SESIONES_AL_ARRANCAR).map((n) => lineaNota(n));
  const resto = [];
  const mas = sesiones.length - SESIONES_AL_ARRANCAR;
  if (mas > 0) resto.push(mas === 1 ? "1 sesión más" : `${mas} sesiones más`);
  if (resumenes > 0) resto.push(resumenes === 1 ? "1 resumen mensual" : `${resumenes} resúmenes mensuales`);
  if (resto.length) out.push(`- _(${resto.join(" y ")}: ver contexto/INDEX-bitacora.md)_`);
  return out;
}

function generarIndiceBitacora(root) {
  const notas = leerNotas(root).filter((n) => n.carpeta === "70-bitacora");
  const vivas = notas.filter(estaVivo);
  const retiradas = notas.length - vivas.length;
  const out = [
    "<!-- GENERADO por scripts/contexto/build-index.js — no editar a mano -->",
    "# Índice de la bitácora",
    "",
    "Todas las sesiones vigentes: una por una las del último mes con notas y del anterior; los meses anteriores,",
    "por su resumen mensual. No se inyecta al arrancar: se consulta cuando la pregunta es sobre el trabajo pasado.",
    "Sesiones: `sesion · autor · agente · fecha` — resumen.",
    "",
  ];
  const lineas = lineasBitacora(vivas);
  out.push(...(lineas.length ? lineas : ["_(vacía)_"]));
  if (retiradas > 0) out.push(lineaRetiradas(retiradas));
  out.push("");
  return out.join("\n");
}

function generarIndice(root) {
  const notas = leerNotas(root);
  const resumidas = [...ARRANQUE_RESUMIDO.keys()].map(nombreIndice).join(", ");
  const out = [
    "<!-- GENERADO por scripts/contexto/build-index.js — no editar a mano -->",
    "# Índice del contexto",
    "",
    "Una línea por nota: `tipo · estado · actualizado` — resumen. Sesiones: `sesion · autor · agente · fecha`.",
    "Lee este índice entero y abre solo las 3 a 6 notas que la tarea necesita.",
    "Solo aparece lo vigente: las notas reemplazadas o archivadas no se listan. Algunas carpetas van resumidas",
    `y su detalle está en contexto/: ${resumidas}; los summaries de los submódulos, en ${nombreIndice("35-modulos")}.`,
    `De la bitácora, solo las ${SESIONES_AL_ARRANCAR} sesiones más recientes; el resto está en contexto/INDEX-bitacora.md.`,
    "",
  ];
  const conocidas = new Set(CARPETAS.map(([c]) => c));
  const extra = [...new Set(notas.map((n) => n.carpeta))].filter((c) => !conocidas.has(c)).sort();
  for (const [carpeta, desc] of [...CARPETAS, ...extra.map((c) => [c, "Carpeta no registrada en lib.js"])]) {
    const deCarpeta = notas.filter((n) => n.carpeta === carpeta);
    const vivas = deCarpeta.filter(estaVivo);
    const retiradas = deCarpeta.length - vivas.length;
    out.push(`## ${carpeta} — ${desc}`, "");
    if (vivas.length === 0 && retiradas === 0) out.push("_(vacía)_");
    let lineas;
    if (carpeta === "70-bitacora") lineas = lineasBitacoraArranque(vivas);
    else if (carpeta === "35-modulos") {
      lineas = lineasModulos(vivas, false);
      if (vivas.length) lineas.push(`- _(summaries de los submódulos: ver contexto/${nombreIndice(carpeta)})_`);
    } else if (ARRANQUE_RESUMIDO.has(carpeta) && vivas.length) lineas = lineasResumidas(carpeta, vivas);
    else lineas = vivas.map((n) => lineaNota(n));
    out.push(...lineas);
    if (retiradas > 0) out.push(lineaRetiradas(retiradas));
    out.push("");
  }
  return out.join("\n");
}

// Índice completo de una carpeta: las mismas líneas que la carpeta tenía en INDEX.md antes de ADR-028.
function generarIndiceCarpeta(root, carpeta) {
  const deCarpeta = leerNotas(root).filter((n) => n.carpeta === carpeta);
  const vivas = deCarpeta.filter(estaVivo);
  const retiradas = deCarpeta.length - vivas.length;
  const desc = (CARPETAS.find(([c]) => c === carpeta) || [carpeta, ""])[1];
  const out = [
    "<!-- GENERADO por scripts/contexto/build-index.js — no editar a mano -->",
    `# Índice de ${carpeta}`,
    "",
    `${desc}. Una línea por nota vigente: \`tipo · estado · actualizado\` — resumen.`,
    "No se inyecta al arrancar: se abre cuando contexto/INDEX.md apunta aquí.",
    "",
  ];
  const lineas = carpeta === "35-modulos" ? lineasModulos(vivas) : vivas.map((n) => lineaNota(n));
  out.push(...(lineas.length ? lineas : ["_(vacía)_"]));
  if (retiradas > 0) out.push(lineaRetiradas(retiradas));
  out.push("");
  return out.join("\n");
}

// Todos los índices generados: { "INDEX.md": texto, ... }. build-index.js los escribe y verificar.js los compara.
function generarIndices(root) {
  const out = { "INDEX.md": generarIndice(root), "INDEX-bitacora.md": generarIndiceBitacora(root) };
  for (const carpeta of ["35-modulos", ...ARRANQUE_RESUMIDO.keys()]) {
    out[nombreIndice(carpeta)] = carpeta === "65-seguridad" ? generarIndiceSeguridad(root) : generarIndiceCarpeta(root, carpeta);
  }
  out[INDICE_ARCHIVADOS] = generarIndiceSeguridadArchivados(root);
  return out;
}

module.exports = {
  VAULT, INDICES, SESIONES_AL_ARRANCAR, CARPETAS, TIPOS, ESTADOS, OBLIGATORIOS, AGENTES, RETIRADOS, ESTADOS_SM, nivelSM, idSM,
  listarNotas, leerNotas, leerEquipo, normalizar, parseFrontmatter, destinoEnlace, generarIndice, generarIndiceBitacora,
  mesDe, mesAnterior, mesesAbiertos,
  esIndice, TOPE_INDICE, ARRANQUE_RESUMIDO, nombreIndice, generarIndiceCarpeta, generarIndices,
  generarIndiceSeguridad, generarIndiceSeguridadArchivados, SEVERIDADES, INDICE_ARCHIVADOS,
};
