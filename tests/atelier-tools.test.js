// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const {
  ATELIER_TOOL_DEFINITIONS,
  getGeminiFunctionDeclarations,
  getOpenCodeTools,
  executeAtelierTool,
} = require("../ui/server/services/atelier-tools.service");

test("atelier-tools: schemas exportados corretamente para Gemini e OpenCode", () => {
  assert.equal(ATELIER_TOOL_DEFINITIONS.length, 5);

  const geminiDecls = getGeminiFunctionDeclarations();
  assert.equal(geminiDecls.length, 5);
  assert.ok(geminiDecls.some((d) => d.name === "atelier_write_screen"));
  assert.ok(geminiDecls.some((d) => d.name === "atelier_plan"));
  assert.ok(geminiDecls.some((d) => d.name === "atelier_ask_user"));

  const openCodeTools = getOpenCodeTools();
  assert.equal(openCodeTools.length, 5);
  assert.equal(openCodeTools[0].type, "function");
  assert.ok(openCodeTools[0].function.name);
});

test("atelier-tools: execução de atelier_plan grava em scratch/plan.json", async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "harness-tool-test-"));
  t.after(() => {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  });

  const protoDir = path.join(tmpDir, "design", "prototypes", "p1");
  fs.mkdirSync(protoDir, { recursive: true });

  const res = await executeAtelierTool("atelier_plan", {
    steps: [{ id: "s1", title: "Shell de navegação", status: "in_progress" }],
    assumptions: ["Foco em desktop e mobile"],
  }, { projectDir: tmpDir, protoId: "p1" });

  assert.equal(res.ok, true);
  assert.equal(res.result.stepCount, 1);

  const planFile = path.join(protoDir, "scratch", "plan.json");
  assert.ok(fs.existsSync(planFile));
  const plan = JSON.parse(fs.readFileSync(planFile, "utf8"));
  assert.equal(plan.steps[0].id, "s1");
});

test("atelier-tools: execução de atelier_write_screen sanitiza e injeta data-pid", async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "harness-tool-test-write-"));
  t.after(() => {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  });

  const protoDir = path.join(tmpDir, "design", "prototypes", "p1");
  fs.mkdirSync(protoDir, { recursive: true });
  fs.writeFileSync(path.join(protoDir, "proto.json"), JSON.stringify({ schema: 1, id: "p1", screens: [] }), "utf8");

  const rawHtml = `<div class="card" onclick="malicious()"><script src="http://evil.com/evil.js"></script><h1>Título</h1></div>`;
  const res = await executeAtelierTool("atelier_write_screen", {
    screenId: "produtos",
    htmlContent: rawHtml,
  }, { projectDir: tmpDir, protoId: "p1" });

  assert.equal(res.ok, true);
  const screenPath = path.join(protoDir, "screens", "produtos.html");
  assert.ok(fs.existsSync(screenPath));
  const saved = fs.readFileSync(screenPath, "utf8");
  assert.ok(!saved.includes("onclick"));
  assert.ok(!saved.includes("evil.com"));
  assert.ok(saved.includes("data-pid="));
  assert.ok(saved.includes("Título"));

  // proto.json registrou a nova tela
  const pj = JSON.parse(fs.readFileSync(path.join(protoDir, "proto.json"), "utf8"));
  assert.ok(pj.screens.some((s) => s.id === "produtos"));
});

test("atelier-tools: execução de atelier_patch_styles em modo append e replace", async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "harness-tool-test-styles-"));
  t.after(() => {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  });

  const protoDir = path.join(tmpDir, "design", "prototypes", "p1");
  fs.mkdirSync(path.join(protoDir, "styles"), { recursive: true });
  fs.writeFileSync(path.join(protoDir, "styles", "proto.css"), ".base { color: red; }\n", "utf8");

  // Append
  const res1 = await executeAtelierTool("atelier_patch_styles", {
    cssRules: ".card { padding: 16px; }",
    mode: "append",
  }, { projectDir: tmpDir, protoId: "p1" });
  assert.equal(res1.ok, true);

  let css = fs.readFileSync(path.join(protoDir, "styles", "proto.css"), "utf8");
  assert.ok(css.includes(".base"));
  assert.ok(css.includes(".card"));

  // Replace
  const res2 = await executeAtelierTool("atelier_patch_styles", {
    cssRules: ".novobase { margin: 0; }",
    mode: "replace",
  }, { projectDir: tmpDir, protoId: "p1" });
  assert.equal(res2.ok, true);

  css = fs.readFileSync(path.join(protoDir, "styles", "proto.css"), "utf8");
  assert.ok(!css.includes(".base"));
  assert.ok(css.includes(".novobase"));
});

test("atelier-tools: atelier_ask_user sinaliza yieldsControl", async () => {
  const res = await executeAtelierTool("atelier_ask_user", {
    question: "Qual paleta de cores primária prefere?",
    options: ["Azul Corporativo", "Verde Esmeralda"],
  }, { projectDir: "proj", protoId: "p1" }, {
    fs: { existsSync: () => true },
    path: path,
  });

  assert.equal(res.ok, true);
  assert.equal(res.yieldsControl, true);
  assert.equal(res.result.type, "question");
  assert.equal(res.result.options.length, 2);
});
