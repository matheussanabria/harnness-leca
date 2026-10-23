// @ts-check
// Read-only stack detection for an existing project folder. Looks only at well-known manifest files in the
// project root (and one level down for monorepos), never at source code, and never follows symlinks.
const fs = require("fs");
const path = require("path");

const MAX_MANIFEST_BYTES = 512 * 1024;
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", "target", "out", ".angular", ".next", "bin", "obj", "venv", ".venv"]);

/** Reads a small text file inside `dir`; returns "" when missing, too big, unreadable or a symlink. */
function readText(dir, name) {
  const file = path.join(dir, name);
  try {
    const st = fs.lstatSync(file);
    if (!st.isFile() || st.size > MAX_MANIFEST_BYTES) return "";
    return fs.readFileSync(file, "utf8").replace(/^﻿/, "");
  } catch { return ""; }
}

const exists = (dir, name) => { try { return fs.lstatSync(path.join(dir, name)).isFile(); } catch { return false; } };

// Dependency name -> label, checked in order (first match per group wins, except `tags` which collect all).
const NODE_FRAMEWORKS = [
  ["@angular/core", "Angular"], ["next", "Next.js"], ["react", "React"], ["vue", "Vue"], ["svelte", "Svelte"],
  ["@nestjs/core", "NestJS"], ["express", "Express"], ["fastify", "Fastify"],
];
const NODE_TOOLS = [
  ["vite", "Vite"], ["typescript", "TypeScript"], ["jest", "Jest"], ["vitest", "Vitest"], ["@playwright/test", "Playwright"],
  ["cypress", "Cypress"], ["eslint", "ESLint"], ["prettier", "Prettier"], ["@biomejs/biome", "Biome"], ["tailwindcss", "Tailwind CSS"],
];
const PY_FRAMEWORKS = [["django", "Django"], ["fastapi", "FastAPI"], ["flask", "Flask"], ["pytest", "pytest"]];

function nodeManager(dir) {
  if (exists(dir, "pnpm-lock.yaml")) return "pnpm";
  if (exists(dir, "yarn.lock")) return "yarn";
  if (exists(dir, "bun.lockb") || exists(dir, "bun.lock")) return "bun";
  return "npm";
}

function detectNode(dir, out) {
  const raw = readText(dir, "package.json");
  if (!raw) return;
  let pkg;
  try { pkg = JSON.parse(raw); } catch { out.notes.push(`${rel(out, dir)}package.json is not valid JSON`); return; }
  const deps = { ...(pkg.devDependencies || {}), ...(pkg.dependencies || {}) };
  const prefix = rel(out, dir);
  out.languages.add(deps.typescript ? "TypeScript" : "JavaScript");
  for (const [dep, label] of NODE_FRAMEWORKS) if (deps[dep]) { out.frameworks.add(`${label} ${String(deps[dep]).replace(/^[^\d]*/, "").split(".")[0] || ""}`.trim()); break; }
  for (const [dep, label] of NODE_TOOLS) if (deps[dep]) out.tools.add(label);
  const mgr = nodeManager(dir);
  out.managers.add(mgr);
  const run = mgr === "npm" ? "npm run" : mgr;
  for (const key of ["dev", "start", "build", "test", "lint", "typecheck"]) {
    if (pkg.scripts && pkg.scripts[key]) out.commands.push({ label: key, command: `${prefix ? `cd ${prefix.slice(0, -1)} && ` : ""}${run} ${key}` });
  }
  if (pkg.engines && pkg.engines.node) out.notes.push(`${prefix}package.json requires Node ${pkg.engines.node}`);
  if (pkg.name && !out.name) out.name = String(pkg.name);
}

function detectJava(dir, out) {
  const pom = readText(dir, "pom.xml");
  const gradle = readText(dir, "build.gradle") || readText(dir, "build.gradle.kts");
  const text = pom || gradle;
  if (!text) return;
  const prefix = rel(out, dir);
  out.languages.add("Java");
  out.managers.add(pom ? "Maven" : "Gradle");
  if (/spring-boot/i.test(text)) out.frameworks.add("Spring Boot");
  const ver = /<java\.version>\s*([\d.]+)/.exec(text) || /JavaVersion\.VERSION_(\d+)/.exec(text) || /sourceCompatibility\s*=\s*['"]?([\d.]+)/.exec(text);
  if (ver) out.notes.push(`${prefix}Java ${ver[1]}`);
  if (/junit/i.test(text)) out.tools.add("JUnit");
  if (/liquibase/i.test(text)) out.tools.add("Liquibase");
  if (/checkstyle/i.test(text)) out.tools.add("Checkstyle");
  const cd = prefix ? `cd ${prefix.slice(0, -1)} && ` : "";
  const wrapper = pom ? (exists(dir, "mvnw") ? "./mvnw" : "mvn") : (exists(dir, "gradlew") ? "./gradlew" : "gradle");
  out.commands.push({ label: "build", command: `${cd}${wrapper} ${pom ? "package" : "build"}` }, { label: "test", command: `${cd}${wrapper} test` });
}

function detectPython(dir, out) {
  const text = [readText(dir, "pyproject.toml"), readText(dir, "requirements.txt")].join("\n").toLowerCase();
  if (!text.trim()) return;
  out.languages.add("Python");
  out.managers.add(exists(dir, "poetry.lock") ? "Poetry" : exists(dir, "uv.lock") ? "uv" : "pip");
  for (const [dep, label] of PY_FRAMEWORKS) if (new RegExp(`(^|[^a-z])${dep}([^a-z]|$)`).test(text)) out.frameworks.add(label);
}

function detectOthers(dir, out) {
  if (exists(dir, "go.mod")) { out.languages.add("Go"); out.managers.add("Go modules"); }
  if (exists(dir, "Cargo.toml")) { out.languages.add("Rust"); out.managers.add("Cargo"); }
  try {
    if (fs.readdirSync(dir).some((f) => /\.(csproj|sln)$/i.test(f))) { out.languages.add("C#"); out.managers.add(".NET"); }
  } catch { /* unreadable directory: nothing to add */ }
  if (exists(dir, "Dockerfile")) out.tools.add("Docker");
  if (exists(dir, "docker-compose.yml") || exists(dir, "docker-compose.yaml") || exists(dir, "compose.yaml")) out.tools.add("Docker Compose");
}

const rel = (out, dir) => {
  const r = path.relative(out.root, dir).split(path.sep).join("/");
  return r ? `${r}/` : "";
};

/** First non-heading paragraph of the README, trimmed to 300 characters ("" when there is none). */
function readmeSummary(dir) {
  const name = ["README.md", "readme.md", "README.txt"].find((n) => exists(dir, n));
  if (!name) return "";
  const para = readText(dir, name).split(/\r?\n\s*\r?\n/).map((p) => p.trim()).find((p) => p && !/^(#|!\[|\[!|<|---|```)/.test(p));
  return para ? para.replace(/\s+/g, " ").slice(0, 300) : "";
}

/**
 * Detects the stack of `root`. Returns plain arrays so the result can be serialized or rendered as-is.
 * @param {string} root absolute path of the project folder
 */
function detectStack(root) {
  const out = { root, name: "", languages: new Set(), frameworks: new Set(), tools: new Set(), managers: new Set(), commands: [], notes: [] };
  const dirs = [root];
  try {
    for (const d of fs.readdirSync(root, { withFileTypes: true })) {
      if (d.isDirectory() && !d.isSymbolicLink() && !d.name.startsWith(".") && !SKIP_DIRS.has(d.name)) dirs.push(path.join(root, d.name));
    }
  } catch { /* unreadable root is reported by the caller */ }
  for (const dir of dirs) { detectNode(dir, out); detectJava(dir, out); detectPython(dir, out); detectOthers(dir, out); }
  return {
    name: out.name,
    summary: readmeSummary(root),
    languages: [...out.languages], frameworks: [...out.frameworks], tools: [...out.tools], managers: [...out.managers],
    commands: out.commands, notes: out.notes,
    hasGit: fs.existsSync(path.join(root, ".git")),
  };
}

module.exports = { detectStack };
