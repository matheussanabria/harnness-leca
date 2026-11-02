// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { initSandboxRepo } = require("./helpers/git-sandbox");

const root = fs.mkdtempSync(path.join(os.tmpdir(), "harness-hia-registry-"));
const projectDir = path.join(root, "projects", "harness-leca");
fs.mkdirSync(path.join(projectDir, "context"), { recursive: true });
fs.writeFileSync(path.join(projectDir, "context", "extraido-conversas.md"), "# Conversas\n", "utf8");
fs.mkdirSync(path.join(projectDir, "coordination"), { recursive: true });
fs.writeFileSync(path.join(projectDir, "coordination", "state.json"), JSON.stringify({
  schemaVersion: 1,
  project: "harness-leca",
  revision: 7,
  providers: {
    "opencode/qualidade": { enabled: true },
    "opencode/jira": { enabled: true },
    "opencode/deploy": { enabled: true },
    claude: { enabled: false },
  },
  stories: {},
}, null, 2), "utf8");
fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ name: "harness-fixture" }, null, 2), "utf8");
fs.writeFileSync(path.join(root, "sample.js"), "module.exports = 1;\n", "utf8");
initSandboxRepo(root);

process.env.HARNESS_ROOT = root;
test.after(() => fs.rmSync(root, { recursive: true, force: true }));

const { listTools, getTool, registerTool } = require("../tools/lib/hia/registry");
const { executeTool } = require("../tools/lib/hia/executor");

test("lista e recupera ferramentas registradas", () => {
  const tools = listTools();
  assert.ok(tools.length >= 5);
  const ids = tools.map((t) => t.id);
  assert.ok(ids.includes("git.status"));
  assert.ok(ids.includes("repo.check"));
  assert.ok(ids.includes("taxonomy.classify"));
  assert.ok(ids.includes("coordination.status"));
  assert.ok(ids.includes("context.list"));

  const tool = getTool("git.status");
  assert.ok(tool);
  assert.equal(tool.category, "git");
  assert.equal(tool.isDeterministic, true);
});

test("executa repo.check de forma deterministica sem LLM", async () => {
  const res = await executeTool("repo.check");
  assert.equal(res.ok, true);
  assert.ok(res.data.js > 0);
  assert.ok(res.data.json > 0);
  assert.equal(typeof res.durationMs, "number");
});

test("executa git.status e devolve estrutura limpa", async () => {
  const res = await executeTool("git.status");
  assert.equal(res.ok, true);
  assert.ok(typeof res.data.branch === "string");
  assert.ok(Array.isArray(res.data.modified));
  assert.ok(Array.isArray(res.data.untracked));
});

test("executa taxonomy.classify para analisar texto estatico", async () => {
  const sample = ":::tool skill\n{\"skill\":\"angular18-expert\"}\n:::\n:::tool write_to_file\n{\"TargetFile\":\"src/app.component.ts\"}\n:::";
  const res = await executeTool("taxonomy.classify", { text: sample });
  assert.equal(res.ok, true);
  assert.ok(res.data.skills.includes("angular18-expert"));
  assert.ok(res.data.files.includes("src/app.component.ts"));
});

test("executa coordination.status sem travar ledger", async () => {
  const res = await executeTool("coordination.status");
  assert.equal(res.ok, true);
  assert.ok(typeof res.data.revision === "number");
  assert.ok(Array.isArray(res.data.activeProviders));
  assert.ok(res.data.activeProviders.includes("opencode/qualidade"));
  assert.ok(res.data.activeProviders.includes("opencode/jira"));
  assert.ok(res.data.activeProviders.includes("opencode/deploy"));
});

test("executa context.list para o projeto harness-leca", async () => {
  const res = await executeTool("context.list", { project: "harness-leca" });
  assert.equal(res.ok, true);
  assert.equal(res.data.project, "harness-leca");
  assert.ok(Array.isArray(res.data.files));
  assert.ok(res.data.files.some((f) => f.name.includes("extraido-conversas.md")));
});

test("trata ferramenta inexistente com erro NOT_FOUND", async () => {
  const res = await executeTool("inexistente.tool");
  assert.equal(res.ok, false);
  assert.equal(res.error?.code, "NOT_FOUND");
});

test("bloqueia tentativas de path traversal suspeitas", async () => {
  const res = await executeTool("git.status", { cwd: "../../../windows/system32" });
  assert.equal(res.ok, false);
  assert.equal(res.error?.code, "SECURITY_VIOLATION");
});

test("bloqueia comandos destrutivos nao autorizados", async () => {
  const res = await executeTool("taxonomy.classify", { text: "rm -rf /" });
  assert.equal(res.ok, false);
  assert.equal(res.error?.code, "SECURITY_VIOLATION");
});

test("respeita timeout e rejeita execucoes travadas", async () => {
  registerTool({
    id: "test.slow",
    name: "Slow Tool",
    description: "Ferramenta para testar timeout",
    category: "diagnostics",
    entrypoint: "test",
    isDeterministic: true,
    isDestructive: false,
    timeoutMs: 100,
    permissions: { filesystem: "none", network: "none", allowExecution: false },
    inputSchema: {},
    outputSchema: {},
    handler: async () => {
      await new Promise((r) => setTimeout(r, 500));
      return { done: true };
    },
  });

  const res = await executeTool("test.slow", {}, { timeoutMs: 50 });
  assert.equal(res.ok, false);
  assert.equal(res.error?.code, "TIMEOUT");
});
