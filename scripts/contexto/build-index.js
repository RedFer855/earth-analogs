#!/usr/bin/env node
// Regenera contexto/INDEX.md (arranque) y los índices de consulta INDEX-*.md desde el frontmatter de las notas.
//
//   node scripts/contexto/build-index.js
//
// Correrlo después de crear, mover o cambiar el frontmatter de una nota.
// CI falla si INDEX.md no coincide con lo que produce este script.
"use strict";
const fs = require("fs");
const path = require("path");
const L = require("./lib.js");

const ROOT = path.resolve(__dirname, "..", "..");
const base = path.join(ROOT, L.VAULT);
const indices = L.generarIndices(ROOT);
// Un INDEX-*.md que ya no se genera (carpeta que dejó de resumirse) se borra para que no quede viejo.
for (const f of fs.readdirSync(base)) {
  if (L.esIndice(f) && !(f in indices)) {
    fs.unlinkSync(path.join(base, f));
    console.log(`${f} borrado: ya no se genera`);
  }
}
for (const [f, txt] of Object.entries(indices)) {
  fs.writeFileSync(path.join(base, f), txt, "utf8");
  console.log(`${f} regenerado · ${Buffer.byteLength(txt)} B`);
}
console.log(`${L.listarNotas(ROOT).length} notas`);
