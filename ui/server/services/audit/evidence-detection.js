// @ts-check
// Deteccao de artefatos de teste reais no projeto (EP-11.01).
const fs = require("fs");
const path = require("path");
const crypto = require("node:crypto");

const MAX_FILES = 800;
const MAX_READ = 64 * 1024;
const MAX_DEPTH = 6;
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", "coverage", ".next", "vendor", "target"]);
const TEST_EXTENSIONS = [
  ".feature", ".test.js", ".test.ts", ".spec.js", ".spec.ts", ".test.tsx", ".spec.tsx",
  ".test.java", "_test.java", ".test.cs", ".test.py", ".test.go", ".cy.js",
];
const STOP_WORDS = new Set([
  "deve", "dever", "devera", "quando", "entao", "sistema", "aplicacao", "usuario", "cliente",
  "validar", "validacao", "cadastro", "opcao", "opcao", "processo", "dados", "informacoes",
]);

/**
 * @param {string} dir
 * @param {string} base
 * @param {Object[]} out
 * @param {number} depth
 */
function collectFiles(dir, base, out, depth) {
  if (depth > MAX_DEPTH || out.length >= MAX_FILES) return;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (out.length >= MAX_FILES) return;
    if (entry.name.startsWith(".") || SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    let stat;
    try {
      stat = fs.lstatSync(full);
    } catch {
      continue;
    }
    if (stat.isSymbolicLink()) continue;
    if (stat.isDirectory()) {
      collectFiles(full, base, out, depth + 1);
      continue;
    }
    if (!stat.isFile()) continue;
    if (!TEST_EXTENSIONS.some((ext) => entry.name.endsWith(ext))) continue;
    out.push({ full, rel: path.relative(base, full).split(path.sep).join("/"), size: stat.size, mtime: stat.mtime });
  }
}

/**
 * Tokens significativos do titulo da regra, usados para associar artefatos.
 * @param {string} title
 * @returns {string[]}
 */
function ruleTokens(title) {
  const words = String(title || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 7 && !STOP_WORDS.has(word));
  return [...new Set(words)].slice(0, 6);
}

/**
 * Detecta artefatos de teste e associa cada regra ao artefato encontrado.
 * @param {string} projectDir
 * @param {Array<{ screenId: string, screenName: string, title: string }>} rules
 * @returns {{ artifacts: Object[], byRule: Map<string, Object>, scanned: number, warnings: string[] }}
 */
function detectTestArtifacts(projectDir, rules = []) {
  const artifacts = [];
  collectFiles(projectDir, projectDir, artifacts, 0);

  const contents = artifacts.map((file) => {
    let content = "";
    try {
      content = fs.readFileSync(file.full, "utf8").slice(0, MAX_READ).toLowerCase();
    } catch {
      content = "";
    }
    return { ...file, content };
  });

  const byRule = new Map();
  const warnings = [];
  for (const rule of rules) {
    const tokens = ruleTokens(rule.title);
    const screenToken = String(rule.screenName || "").toLowerCase().trim();
    let best = null;
    for (const file of contents) {
      const hitTokens = tokens.filter((token) => file.content.includes(token));
      const hitScreen = screenToken.length >= 6 && file.rel.toLowerCase().includes(screenToken.split(/\s+/)[0]);
      if (!hitTokens.length && !hitScreen) continue;
      const score = hitTokens.length + (hitScreen ? 1 : 0);
      if (!best || score > best.score) best = { file, score };
    }
    if (!best) continue;
    const hash = crypto.createHash("sha256").update(best.file.full).digest("hex").slice(0, 16);
    byRule.set(`${rule.screenId}|${rule.title}`, {
      file: best.file.rel,
      hash,
      at: best.file.mtime.toISOString(),
      size: best.file.size,
    });
  }

  if (contents.length >= MAX_FILES) warnings.push("Limite de arquivos inspecionado atingido.");
  return { artifacts: contents.map(({ full, content, ...rest }) => rest), byRule, scanned: contents.length, warnings };
}

module.exports = { MAX_FILES, TEST_EXTENSIONS, ruleTokens, detectTestArtifacts };
