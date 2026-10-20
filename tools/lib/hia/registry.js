// @ts-check
const path = require("path");
const { ROOT } = require("../root");
const { check: runRepoCheck } = require("../../../scripts/check");
const { activity: classifyActivity } = require("../classify");
const coordService = require("../coordination/service");
const fs = require("fs");
const { spawnSync } = require("child_process");

/**
 * @typedef {Object} ToolDefinition
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {string} category
 * @property {string} entrypoint
 * @property {boolean} isDeterministic
 * @property {boolean} isDestructive
 * @property {number} timeoutMs
 * @property {{ filesystem: string, network: string, allowExecution: boolean }} permissions
 * @property {Object} inputSchema
 * @property {Object} outputSchema
 * @property {(args: any) => Promise<any> | any} handler
 */

/** @type {Map<string, ToolDefinition>} */
const registry = new Map();

/**
 * @param {ToolDefinition} def
 */
function registerTool(def) {
  if (!def || !def.id) throw new Error("Ferramenta invalida: id obrigatorio");
  registry.set(def.id, def);
}

/**
 * @param {string} id
 * @returns {ToolDefinition | undefined}
 */
function getTool(id) {
  return registry.get(id);
}

/**
 * @returns {Array<Omit<ToolDefinition, "handler">>}
 */
function listTools() {
  return Array.from(registry.values()).map(({ handler, ...meta }) => meta);
}

// 1. git.status
registerTool({
  id: "git.status",
  name: "Git Status Summary",
  description: "Obtem status do repositorio git (branch atual, modificados, adicionados) de forma estruturada.",
  category: "git",
  entrypoint: "git status --porcelain -b",
  isDeterministic: true,
  isDestructive: false,
  timeoutMs: 10000,
  permissions: { filesystem: "read_only", network: "none", allowExecution: true },
  inputSchema: { type: "object", properties: { cwd: { type: "string" } } },
  outputSchema: {
    type: "object",
    properties: {
      branch: { type: "string" },
      clean: { type: "boolean" },
      modified: { type: "array", items: { type: "string" } },
      untracked: { type: "array", items: { type: "string" } },
    },
  },
  handler: (args = {}) => {
    const cwd = args.cwd ? path.resolve(ROOT, args.cwd) : ROOT;
    const r = spawnSync("git", ["status", "--porcelain", "-b"], { cwd, encoding: "utf8", windowsHide: true });
    if (r.status !== 0) throw new Error(r.stderr || "Falha ao executar git status");
    const lines = r.stdout.split(/\r?\n/).filter(Boolean);
    const branchLine = lines[0] || "";
    const branch = branchLine.replace(/^##\s*/, "").split("...")[0].trim();
    const modified = [];
    const untracked = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const code = line.slice(0, 2);
      const file = line.slice(3).trim();
      if (code.includes("?")) untracked.push(file);
      else modified.push(file);
    }
    return { branch, clean: lines.length <= 1, modified, untracked, totalChanges: modified.length + untracked.length };
  },
});

// 2. repo.check
registerTool({
  id: "repo.check",
  name: "Repository Syntax & JSON Check",
  description: "Executa checagem rapida de sintaxe em todos os arquivos .js e integridade de .json.",
  category: "testing",
  entrypoint: "scripts/check.js",
  isDeterministic: true,
  isDestructive: false,
  timeoutMs: 30000,
  permissions: { filesystem: "read_only", network: "none", allowExecution: true },
  inputSchema: { type: "object", properties: {} },
  outputSchema: {
    type: "object",
    properties: {
      js: { type: "number" },
      json: { type: "number" },
      problems: { type: "array", items: { type: "string" } },
      ok: { type: "boolean" },
    },
  },
  handler: () => {
    const res = runRepoCheck(ROOT);
    return { ...res, ok: res.problems.length === 0 };
  },
});

// 3. taxonomy.classify
registerTool({
  id: "taxonomy.classify",
  name: "Static Taxonomy & Activity Classifier",
  description: "Classifica temas e sinais de atividade em um texto ou chat sem gastar tokens com LLM.",
  category: "indexing",
  entrypoint: "tools/lib/classify.js",
  isDeterministic: true,
  isDestructive: false,
  timeoutMs: 5000,
  permissions: { filesystem: "none", network: "none", allowExecution: false },
  inputSchema: { type: "object", required: ["text"], properties: { text: { type: "string" } } },
  outputSchema: {
    type: "object",
    properties: {
      skills: { type: "array", items: { type: "string" } },
      agents: { type: "array", items: { type: "string" } },
      files: { type: "array", items: { type: "string" } },
      cmds: { type: "array", items: { type: "string" } },
    },
  },
  handler: (args) => {
    if (!args || typeof args.text !== "string") throw new Error("Parametro 'text' obrigatorio");
    const act = classifyActivity(args.text);
    return {
      skills: Array.from(act.skills),
      agents: Array.from(act.agents),
      files: act.files,
      cmds: act.cmds,
    };
  },
});

// 4. coordination.status
registerTool({
  id: "coordination.status",
  name: "Coordination Ledger Status",
  description: "Consulta o estado canônico de coordenação entre agentes do projeto ativo.",
  category: "diagnostics",
  entrypoint: "tools/lib/coordination/service.js",
  isDeterministic: true,
  isDestructive: false,
  timeoutMs: 5000,
  permissions: { filesystem: "read_only", network: "none", allowExecution: false },
  inputSchema: { type: "object", properties: { project: { type: "string" } } },
  outputSchema: {
    type: "object",
    properties: {
      project: { type: "string" },
      revision: { type: "number" },
      totalStories: { type: "number" },
      activeProviders: { type: "array", items: { type: "string" } },
    },
  },
  handler: (args = {}) => {
    let proj = args.project;
    if (!proj) {
      const activePath = path.join(ROOT, "projects", ".active");
      if (fs.existsSync(activePath)) {
        proj = fs.readFileSync(activePath, "utf8").trim().split(/\r?\n/).filter(Boolean).pop();
      }
    }
    proj = (proj || "harness-leca").toLowerCase();
    const st = coordService.get(ROOT, proj);
    const stories = Object.values(st.stories || {});
    const activeProviders = Object.entries(st.providers || {})
      .filter(([, p]) => p.enabled)
      .map(([id]) => id);
    return {
      project: proj,
      revision: st.revision,
      totalStories: stories.length,
      doneStories: stories.filter((s) => s.status === "done").length,
      inProgressStories: stories.filter((s) => s.status === "in_progress").length,
      activeProviders,
    };
  },
});

// 5. context.list
registerTool({
  id: "context.list",
  name: "List Project Context Files",
  description: "Lista os arquivos de contexto disponiveis para um projeto com tamanhos e contagem de itens.",
  category: "indexing",
  entrypoint: "projects/<slug>/context/",
  isDeterministic: true,
  isDestructive: false,
  timeoutMs: 5000,
  permissions: { filesystem: "read_only", network: "none", allowExecution: false },
  inputSchema: { type: "object", properties: { project: { type: "string" } } },
  outputSchema: {
    type: "object",
    properties: {
      project: { type: "string" },
      files: { type: "array", items: { type: "object" } },
      totalBytes: { type: "number" },
    },
  },
  handler: (args = {}) => {
    let proj = args.project;
    if (!proj) {
      const activePath = path.join(ROOT, "projects", ".active");
      if (fs.existsSync(activePath)) {
        proj = fs.readFileSync(activePath, "utf8").trim().split(/\r?\n/).filter(Boolean).pop();
      }
    }
    proj = (proj || "harness-leca").toLowerCase();
    const ctxDir = path.join(ROOT, "projects", proj, "context");
    if (!fs.existsSync(ctxDir)) return { project: proj, files: [], totalBytes: 0 };
    const entries = fs.readdirSync(ctxDir, { withFileTypes: true });
    let totalBytes = 0;
    const files = [];
    for (const ent of entries) {
      if (ent.isFile() && ent.name !== ".gitkeep") {
        const full = path.join(ctxDir, ent.name);
        const sz = fs.statSync(full).size;
        totalBytes += sz;
        files.push({ name: ent.name, sizeBytes: sz });
      }
    }
    return { project: proj, files, totalBytes };
  },
});

module.exports = { registerTool, getTool, listTools };
