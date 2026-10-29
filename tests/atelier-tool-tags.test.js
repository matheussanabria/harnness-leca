// Interpretação das tags <tool> do ateliê: JSON, JSON com quebras de linha cruas, conteúdo bruto, erro explícito.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { parseToolTags, escapeControlCharsInStrings } = require("../ui/server/services/atelier-tool-tags.service");
const { executeAtelierTool } = require("../ui/server/services/atelier-tools.service");

test("JSON válido continua funcionando e a tag sai do texto", () => {
  const r = parseToolTags('Vou planejar.\n<tool name="atelier_plan">{"steps":[{"id":"1","title":"a","status":"pending"}]}</tool>\nPronto.');
  assert.equal(r.toolCalls.length, 1);
  assert.equal(r.toolCalls[0].name, "atelier_plan");
  assert.equal(r.toolCalls[0].args.steps[0].id, "1");
  assert.equal(r.errors.length, 0);
  assert.ok(!r.text.includes("<tool"));
  assert.match(r.text, /Vou planejar/);
});

test("JSON com quebras de linha e tabs cruas dentro da string é reparado (o erro comum dos modelos)", () => {
  const body = '{"screenId":"home","htmlContent":"<main>\n\t<h1>Produtos</h1>\n</main>"}';
  assert.throws(() => JSON.parse(body), "o JSON puro realmente falha");
  const r = parseToolTags(`<tool name="atelier_write_screen">${body}</tool>`);
  assert.equal(r.errors.length, 0);
  assert.equal(r.toolCalls[0].args.htmlContent, "<main>\n\t<h1>Produtos</h1>\n</main>");
});

test("HTML cru no corpo: sem JSON, com aspas, atributos e quebras; screenId vem do atributo", () => {
  const html = '<main class="page">\n  <h1 data-x="1">Produtos</h1>\n  <p>"aspas" e \\barra</p>\n</main>';
  const r = parseToolTags(`<tool name="atelier_write_screen" screenId="produtos">\n${html}\n</tool>`);
  assert.equal(r.errors.length, 0);
  assert.deepEqual(r.toolCalls[0], { name: "atelier_write_screen", args: { screenId: "produtos", htmlContent: html } });
});

test("CSS cru: modo vem do atributo (padrão append) e cerca de markdown é removida", () => {
  const css = ".card { padding: 16px; }\n@media (max-width: 600px) { .card { padding: 8px; } }";
  const a = parseToolTags(`<tool name="atelier_patch_styles" mode="replace">\n\`\`\`css\n${css}\n\`\`\`\n</tool>`);
  assert.deepEqual(a.toolCalls[0].args, { cssContent: css, mode: "replace" });
  const b = parseToolTags(`<tool name="atelier_patch_styles">${css}</tool>`);
  assert.equal(b.toolCalls[0].args.mode, "append");
});

test("tag ilegível vira erro explícito (não some em silêncio) e as legíveis seguem", () => {
  const r = parseToolTags('<tool name="atelier_plan">{isso nao e json}</tool><tool name="atelier_complete">{"summary":"ok"}</tool>');
  assert.equal(r.toolCalls.length, 1);
  assert.equal(r.toolCalls[0].name, "atelier_complete");
  assert.equal(r.errors.length, 1);
  assert.equal(r.errors[0].tool, "atelier_plan");
  assert.ok(r.errors[0].reason);
});

test("texto sem tags volta intacto; entrada vazia não quebra", () => {
  assert.deepEqual(parseToolTags("só conversa"), { text: "só conversa", toolCalls: [], errors: [] });
  assert.deepEqual(parseToolTags(""), { text: "", toolCalls: [], errors: [] });
  assert.equal(escapeControlCharsInStrings('{"a":"x\ny"}\n'), '{"a":"x\\ny"}\n', "quebra fora de string é preservada");
});

function proto() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "atl-"));
  fs.mkdirSync(path.join(dir, "design", "prototypes", "p1"), { recursive: true });
  return { dir, ctx: { projectDir: dir, protoId: "p1" } };
}

test("atelier_patch_styles aceita cssRules e cssContent (o prompt usava um nome e a ferramenta outro)", async (t) => {
  const { dir, ctx } = proto();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const a = await executeAtelierTool("atelier_patch_styles", { cssRules: ".a{color:red}" }, ctx);
  const b = await executeAtelierTool("atelier_patch_styles", { cssContent: ".b{color:blue}", mode: "append" }, ctx);
  assert.equal(a.ok, true);
  assert.equal(b.ok, true, b.error);
  const css = fs.readFileSync(path.join(dir, "design", "prototypes", "p1", "styles", "proto.css"), "utf8");
  assert.match(css, /\.a\{color:red\}/);
  assert.match(css, /\.b\{color:blue\}/);
  const bad = await executeAtelierTool("atelier_patch_styles", {}, ctx);
  assert.equal(bad.ok, false);
});

test("atelier_parse_error devolve ao modelo o que fazer", async (t) => {
  const { dir, ctx } = proto();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const r = await executeAtelierTool("atelier_parse_error", { tool: "atelier_write_screen", reason: "Unexpected token" }, ctx);
  assert.equal(r.ok, false);
  assert.match(r.error, /atelier_write_screen/);
  assert.match(r.error, /CRU/);
});
