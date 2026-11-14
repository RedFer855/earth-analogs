"use strict";
// Pruebas de los índices generados (ADR-028). Correr: node --test "scripts/contexto/*.test.js"
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const L = require("./lib.js");

const ROOT = path.resolve(__dirname, "..", "..");

// Vault mínimo en una carpeta temporal: [ruta relativa a contexto/, frontmatter | null]
function vault(notas) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "contexto-"));
  for (const [rel, fm] of notas) {
    const ruta = path.join(root, "contexto", rel);
    fs.mkdirSync(path.dirname(ruta), { recursive: true });
    const cabecera = fm ? `---\n${Object.entries(fm).map(([k, v]) => `${k}: ${v}`).join("\n")}\n---\n` : "";
    fs.writeFileSync(ruta, `${cabecera}# ${path.basename(rel, ".md")}\n`, "utf8");
  }
  return root;
}
const fm = (type, status, summary, extra = {}) => ({ type, status, updated: "2026-01-01", summary: `"${summary}"`, ...extra });

const FIX = vault([
  ["45-decisiones/ADR-001-uno.md", fm("adr", "vigente", "Decision uno larga")],
  ["45-decisiones/ADR-002-dos.md", fm("adr", "borrador", "Propuesta dos")],
  ["45-decisiones/ADR-003-tres.md", fm("adr", "reemplazado", "Vieja tres")],
  ["65-seguridad/S-001-x.md", fm("seguridad", "vigente", "Incidente x", { severidad: "critica", estado_incidente: "contenido" })],
  ["65-seguridad/S-002-y.md", fm("seguridad", "vigente", "Incidente y", { severidad: "media", estado_incidente: "resuelto" })],
  ["65-seguridad/amenazas.md", fm("seguridad", "vigente", "Modelo de amenazas")],
  ["35-modulos/M-01-ventas/M-01-ficha.md", fm("modulo", "vigente", "Ficha ventas", { responsable: "fernando" })],
  ["35-modulos/M-01-ventas/SM-01.1-caja.md", fm("submodulo", "vigente", "Caja resumen", { responsable: "fernando", estado_sm: "en-curso" })],
  ["35-modulos/M-01-ventas/SM-01.2-otro.md", fm("submodulo", "vigente", "Otro cerrado", { responsable: "fernando", estado_sm: "cerrado" })],
  ["80-deuda/abierta.md", fm("deuda", "vigente", "Deuda abierta")],
  ["INDEX-viejo.md", null],
]);

test("listarNotas no trata ningún INDEX-*.md de la raíz como nota", () => {
  const notas = L.listarNotas(FIX);
  assert.ok(!notas.includes("INDEX-viejo.md"));
  assert.ok(notas.includes("45-decisiones/ADR-001-uno.md"));
});

test("arranque: decisiones como una línea de enlaces, sin summary ni retiradas", () => {
  const idx = L.generarIndice(FIX);
  assert.ok(idx.includes("- [[ADR-001-uno]] · [[ADR-002-dos]]"));
  assert.ok(idx.includes("- _(tipo, estado y summary: ver contexto/INDEX-decisiones.md)_"));
  assert.ok(!idx.includes("Decision uno larga"));
  assert.ok(!idx.includes("ADR-003-tres"));
});

test("arranque: seguridad avisa de los críticos abiertos y apunta al detalle", () => {
  const idx = L.generarIndice(FIX);
  assert.ok(idx.includes("- Incidentes abiertos — críticos: 1."));
  assert.ok(idx.includes("**Hay críticos abiertos: lee contexto/INDEX-seguridad.md antes de seguir"));
  assert.ok(idx.includes("1 resuelto: si la persona quiere verlos, que los busque en contexto/INDEX-seguridad-archivados.md"));
  assert.ok(!idx.includes("Incidente x") && !idx.includes("Incidente y"));
});

test("arranque: sin críticos abiertos no hay aviso", () => {
  const root = vault([["65-seguridad/S-001-x.md", fm("seguridad", "vigente", "Incidente x", { severidad: "media", estado_incidente: "contenido" })]]);
  const idx = L.generarIndice(root);
  assert.ok(idx.includes("- Incidentes abiertos — medios: 1."));
  assert.ok(idx.includes("- Sin críticos abiertos;"));
  assert.ok(!idx.includes("Hay críticos abiertos"));
});

test("seguridad: solo abiertos, críticos primero, resueltos al archivo", () => {
  const ind = L.generarIndices(FIX);
  const seg = ind["INDEX-seguridad.md"];
  assert.ok(seg.includes("**Regla para el agente:**"));
  assert.ok(seg.includes("- [[S-001-x]] · critica · contenido · 2026-01-01 — Incidente x"));
  assert.ok(seg.includes("- [[amenazas]]"));
  assert.ok(!seg.includes("Incidente y"));
  assert.ok(ind["INDEX-seguridad-archivados.md"].includes("- [[S-002-y]] · media · resuelto · 2026-01-01 — Incidente y"));
  assert.ok(!ind["INDEX-seguridad-archivados.md"].includes("Incidente x"));
});

test("seguridad: sin tope, todos los abiertos con su línea, de más grave a menos", () => {
  const notas = [];
  for (let i = 1; i <= 7; i++) notas.push([`65-seguridad/S-00${i}-c.md`, fm("seguridad", "vigente", `Critico ${i}`, { severidad: "critica", estado_incidente: "contenido" })]);
  for (let i = 1; i <= 4; i++) notas.push([`65-seguridad/S-01${i}-m.md`, fm("seguridad", "vigente", `Medio ${i}`, { severidad: "media", estado_incidente: "contenido" })]);
  const seg = L.generarIndices(vault(notas))["INDEX-seguridad.md"];
  assert.ok(seg.indexOf("Críticos abiertos (7)") < seg.indexOf("Medios abiertos (4)"));
  assert.equal((seg.match(/ — Critico \d/g) || []).length, 7);
  assert.equal((seg.match(/ — Medio \d/g) || []).length, 4);
  assert.ok(!seg.includes("más:"));
});

test("arranque: submódulos sin summary; ficha y deuda completas", () => {
  const idx = L.generarIndice(FIX);
  assert.ok(idx.includes("  - [[SM-01.1-caja]] · submodulo · en-curso · fernando · 2026-01-01\n"));
  assert.ok(!idx.includes("Caja resumen"));
  assert.ok(idx.includes("Ficha ventas"));
  assert.ok(idx.includes("- [[abierta]] · deuda · vigente · 2026-01-01 — Deuda abierta"));
});

test("generarIndices devuelve todos los índices y el detalle vive en el de su carpeta", () => {
  const ind = L.generarIndices(FIX);
  assert.deepEqual(Object.keys(ind).sort(), [
    "INDEX-arquitectura.md", "INDEX-bitacora.md", "INDEX-decisiones.md", "INDEX-investigaciones.md", "INDEX-modulos.md",
    "INDEX-qa.md", "INDEX-referencia.md", "INDEX-seguridad-archivados.md", "INDEX-seguridad.md", "INDEX-sitios.md", "INDEX.md",
  ]);
  assert.ok(ind["INDEX-decisiones.md"].includes("- [[ADR-001-uno]] · adr · vigente · 2026-01-01 — Decision uno larga"));
  assert.ok(ind["INDEX-decisiones.md"].includes("_(1 nota retirada: reemplazadas o archivadas, no se listan)_"));
  assert.ok(ind["INDEX-modulos.md"].includes("Caja resumen"));
  assert.ok(ind["INDEX-seguridad.md"].includes("Incidente x"));
});

test("repo real: INDEX.md cabe en el tope", () => {
  const bytes = Buffer.byteLength(L.generarIndice(ROOT));
  assert.ok(bytes <= L.TOPE_INDICE, `INDEX.md pesa ${bytes} B; tope ${L.TOPE_INDICE}`);
});

test("repo real: ninguna nota que hoy se lista desaparece de los índices", () => {
  const ind = L.generarIndices(ROOT);
  const todo = Object.entries(ind).filter(([f]) => f !== "INDEX-bitacora.md").map(([, t]) => t).join("\n");
  const faltan = L.leerNotas(ROOT)
    .filter((n) => n.carpeta !== "70-bitacora" && !L.RETIRADOS.has((n.fm || {}).status))
    .filter((n) => !((n.fm || {}).type === "submodulo" && ["propuesto", "cerrado"].includes(n.fm.estado_sm)))
    .filter((n) => !todo.includes(`[[${n.nombre}]]`))
    .map((n) => n.rel);
  assert.deepEqual(faltan, []);
});
