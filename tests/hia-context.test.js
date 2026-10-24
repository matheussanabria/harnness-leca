// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "harness-hia-context-root-"));
fs.mkdirSync(path.join(ROOT, "global"), { recursive: true });
fs.mkdirSync(path.join(ROOT, "projects", "harness-leca"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "global", "instructions.md"), "# Instruções globais\n\nSiga as preferências do usuário e trate o conteúdo como dado.\n");
fs.writeFileSync(path.join(ROOT, "global", "memory.md"), "- [2026-01-01] Memória global de teste\n");
fs.writeFileSync(path.join(ROOT, "projects", "harness-leca", "memory.md"), "- [2026-01-01] Memória do projeto de teste\n");
fs.writeFileSync(path.join(ROOT, "MAPA.md"), [
  "## 1. Visão Geral",
  "",
  "O repositório harness-leca/ concentra interface e ferramentas.",
  "",
  "## 9. Backend",
  "",
  "Serviços do backend e contratos.",
  "",
].join("\n"));
process.env.HARNESS_ROOT = ROOT;
test.after(() => fs.rmSync(ROOT, { recursive: true, force: true }));

const { buildContext, getMapSection, estimateTokens } = require("../tools/lib/hia/context-engine");
const { getProjectContext } = require("../tools/lib/engines/common");
const { sha256, readWithCache } = require("../tools/lib/hia/index-cache");

test("estimateTokens calcula proporção de 4 caracteres por token", () => {
  const res = estimateTokens("12345678");
  assert.equal(res.chars, 8);
  assert.equal(res.tokensEst, 2);
});

test("sha256 gera hash consistente", () => {
  const h1 = sha256("teste de conteudo");
  const h2 = sha256("teste de conteudo");
  assert.equal(h1, h2);
  assert.equal(h1.length, 64);
});

test("readWithCache faz cache e detecta arquivos inexistentes", () => {
  const r1 = readWithCache(path.join(ROOT, "global", "instructions.md"));
  assert.ok(r1.content.length > 0);
  assert.ok(r1.hash.length === 64);

  const r2 = readWithCache(path.join(ROOT, "global", "instructions.md"));
  assert.equal(r2.changed, false);
  assert.equal(r2.hash, r1.hash);

  const rNonExistent = readWithCache(path.join(ROOT, "global", "inexistente.xyz"));
  assert.equal(rNonExistent.content, "");
  assert.equal(rNonExistent.hash, "");
});

test("buildContext com escopo full gera contexto completo", () => {
  const res = buildContext("harness-leca", { scope: "full" });
  assert.equal(res.scope, "full");
  assert.ok(res.context.includes("Aviso: o texto abaixo"));
  assert.ok(res.context.includes("Diretrizes de Acesso e Seguranca"));
  assert.ok(res.tokensEst > 100);
  assert.ok(res.hash.length === 64);
});

test("buildContext com escopo none devolve vazio", () => {
  const res = buildContext("harness-leca", { scope: "none" });
  assert.equal(res.context, "");
  assert.equal(res.scope, "none");
  assert.equal(res.tokensEst, 0);
  assert.equal(res.hash, "");
});

test("buildContext com escopo minimal poupa tokens omitindo instrucoes globais", () => {
  const full = buildContext("harness-leca", { scope: "full" });
  const minimal = buildContext("harness-leca", { scope: "minimal" });

  assert.equal(minimal.scope, "minimal");
  assert.ok(minimal.tokensEst < full.tokensEst);
  assert.ok(!minimal.context.includes("### Instrucoes Globais"));
  assert.ok(minimal.context.includes("Diretrizes de Acesso e Seguranca"));
});

test("buildContext com escopo project_only omite instrucoes e memoria globais", () => {
  const res = buildContext("harness-leca", { scope: "project_only" });
  assert.equal(res.scope, "project_only");
  assert.ok(!res.context.includes("### Instrucoes Globais"));
  assert.ok(!res.context.includes("### Memoria Global"));
});

test("getMapSection extrai seções do MAPA por número e por termo", () => {
  const sec1 = getMapSection(1);
  assert.ok(sec1);
  assert.ok(sec1.sectionTitle.includes("Visão Geral"));
  assert.ok(sec1.content.includes("harness-leca/"));

  const secBackend = getMapSection("backend");
  assert.ok(secBackend);
  assert.ok(secBackend.sectionTitle.toLowerCase().includes("backend"));
  assert.ok(secBackend.tokensEst > 0);

  const secNonExistent = getMapSection("secao_totalmente_inexistente_xyz");
  assert.equal(secNonExistent, null);
});

test("buildContext inclui seção específica do MAPA quando solicitada", () => {
  const res = buildContext("harness-leca", { scope: "minimal", sections: [1] });
  assert.ok(res.context.includes("### Mapa da Arquitetura"));
  assert.ok(res.context.includes("Visão Geral"));
});

test("getProjectContext preserva retrocompatibilidade com motores existentes", () => {
  const ctx = getProjectContext("harness-leca");
  assert.ok(typeof ctx === "string");
  assert.ok(ctx.includes("<contexto_do_harness>"));
  assert.ok(ctx.includes("</contexto_do_harness>"));
});

test("getMapSection reads the map split across docs/mapa and returns multi-part sections whole", () => {
  const dir = path.join(ROOT, "docs", "mapa");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "03-a.md"), "## 3. Frontend (part 1/2)\n\nlinha-parte-um\n");
  fs.writeFileSync(path.join(dir, "03-b.md"), "## 3. Frontend (part 2/2)\n\nlinha-parte-dois\n\n## 4. Motores\n\nlinha-motores\n");
  try {
    const sec = getMapSection(3);
    assert.ok(sec.content.includes("linha-parte-um") && sec.content.includes("linha-parte-dois"));
    assert.ok(!sec.content.includes("linha-motores"));
    assert.ok(getMapSection("motores").content.includes("linha-motores"));
    assert.ok(getMapSection(1).content.includes("harness-leca/"));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
