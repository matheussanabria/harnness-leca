"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { scanVault, parseFrontmatter } = require("../tools/lib/vault/scan");
const { findNotes, vaultStats } = require("../tools/lib/vault/query");

function makeVault() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "vault-"));
  const k = path.join(root, "Conhecimento");
  fs.mkdirSync(path.join(k, "Conceitos"), { recursive: true });
  fs.mkdirSync(path.join(root, "06 - Skills"), { recursive: true });
  const prose = "Normalizacao organiza tabelas para reduzir redundancia e anomalias de atualizacao. ".repeat(4);
  fs.writeFileSync(path.join(k, "Conceitos", "Normalizacao.md"), `---\nnome: "Normalização de Dados"\nclassificacao:\n  area: dados\n  tema: modelagem\ntags:\n  - conhecimento/sql\n---\n# Normalização\n\n${prose}\n`);
  fs.writeFileSync(path.join(k, "Conceitos", "Vazia.md"), "# Vazia\n\n## O Cerne\n- **What:** \n- **Why:** \n\n> *(Cole aqui o resumo)*\n");
  fs.writeFileSync(path.join(root, "06 - Skills", "Normalizacao.md"), `# Normalizacao\n\n${prose}`);
  return root;
}

test("parseFrontmatter reads scalars, nested keys and block tags", () => {
  const { meta, tags } = parseFrontmatter('---\nnome: "X"\nclassificacao:\n  area: a\ntags:\n  - t1\n  - t2\n---\ncorpo');
  assert.equal(meta.nome, "X");
  assert.equal(meta.area, "a");
  assert.deepEqual(tags, ["t1", "t2"]);
});

test("scan skips excluded folders and flags template skeletons as stubs", () => {
  const notes = scanVault(makeVault());
  assert.equal(notes.length, 2);
  assert.equal(notes.find((n) => n.rel.endsWith("Vazia.md")).stub, true);
  assert.equal(notes.find((n) => n.rel.endsWith("Normalizacao.md")).stub, false);
});

test("findNotes ranks by accent-insensitive keywords and never returns stubs", () => {
  const notes = scanVault(makeVault());
  const hits = findNotes(notes, "normalização dados");
  assert.equal(hits.length, 1);
  assert.match(hits[0].note.rel, /Normalizacao\.md$/);
  assert.deepEqual(findNotes(notes, "vazia"), []);
  assert.equal(vaultStats(notes).stubs, 1);
});
