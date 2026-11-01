// @ts-check
// Syntax sensors for json, python and java. None of them runs the code: JSON.parse, python's ast.parse and
// javac -proc:none (no annotation processors, class files discarded). A checker that is not installed is skipped.
const fs = require("fs");
const path = require("path");
const { run, withTempDir } = require("./exec");

/** @typedef {{ sensor: string, severity: "error" | "warning", line: number, message: string }} Finding */
/** @typedef {{ findings: Finding[], skipped?: string }} SensorResult */

/** @param {{ code: string }} block @returns {Promise<SensorResult>} */
async function jsonSensor({ code }) {
  // Chat answers often show JSON with comments or "..." placeholders; those are illustrations, not data.
  if (/(?:^|[\s,{[])\/\/|\/\*|\.\.\./m.test(code)) return { findings: [] };
  try {
    JSON.parse(code);
    return { findings: [] };
  } catch (e) {
    const msg = String(/** @type {Error} */ (e).message);
    const pos = Number((msg.match(/position (\d+)/) || [])[1]);
    const line = Number.isFinite(pos) ? code.slice(0, pos).split("\n").length : 1;
    return { findings: [{ sensor: "syntax", severity: "error", line, message: `invalid JSON: ${msg.slice(0, 120)}` }] };
  }
}

let pythonCmd = /** @type {string | null | undefined} */ (undefined);
/** First working python executable (the Windows Store alias does not count), cached. */
async function findPython() {
  if (pythonCmd !== undefined) return pythonCmd;
  for (const cmd of ["python", "python3", "py"]) {
    const r = await run(cmd, ["-c", "import sys; sys.stdout.write('ok')"], { timeoutMs: 4000 });
    if (!r.missing && r.code === 0 && r.stdout === "ok") return (pythonCmd = cmd);
  }
  return (pythonCmd = null);
}

/** @param {{ code: string }} block @returns {Promise<SensorResult>} */
async function pythonSensor({ code }) {
  const cmd = await findPython();
  if (!cmd) return { findings: [], skipped: "python not available" };
  const r = await run(cmd, ["-c", "import ast,sys; ast.parse(sys.stdin.read())"], { input: code, timeoutMs: 6000 });
  if (r.code === 0) return { findings: [] };
  if (r.timedOut) return { findings: [], skipped: "python timed out" };
  // The traceback also lists python's own frames; the snippet is the one read from stdin ("<unknown>").
  const err = r.stderr.replace(/\x1b\[[0-9;]*m/g, ""); // belt and braces: never parse ANSI-wrapped numbers
  const line = Number((err.match(/File "<unknown>", line (\d+)/) || [])[1]) || 1;
  const msg = (err.trim().split("\n").pop() || "SyntaxError").slice(0, 140);
  return { findings: [{ sensor: "syntax", severity: "error", line, message: msg }] };
}

// javac cannot stop after parsing, and a snippet that imports classes we do not have fails with "package does not
// exist" or "cannot find symbol". Only messages of the parse kind count as syntax errors.
const JAVA_SYNTAX = /expected|illegal start|not a statement|unclosed|unterminated|reached end of file|invalid method declaration|orphaned|malformed|illegal character|without if|empty character literal|<identifier>|illegal escape/i;
const JAVA_TYPE_DECL = /\b(class|interface|enum|record)\s+\w+/;

/** @param {string} source @param {string} dir @param {string} name @param {number} offset */
async function javac(source, dir, name, offset) {
  const file = path.join(dir, `${name}.java`);
  fs.writeFileSync(file, source);
  const r = await run("javac", ["-proc:none", "-Xmaxerrs", "20", "-d", dir, file], { timeoutMs: 15000 });
  if (r.missing) return { missing: true, errors: /** @type {Finding[]} */ ([]) };
  const errors = [...r.stderr.matchAll(/\.java:(\d+): error: ([^\n]+)/g)]
    .filter((m) => JAVA_SYNTAX.test(m[2]))
    .map((m) => /** @type {Finding} */ ({ sensor: "syntax", severity: "error", line: Math.max(1, Number(m[1]) - offset), message: m[2].slice(0, 140) }));
  return { missing: false, errors };
}

/** @param {{ code: string }} block @returns {Promise<SensorResult>} */
async function javaSensor({ code }) {
  return withTempDir(async (dir) => {
    const named = code.match(/\bpublic\s+(?:final\s+|abstract\s+)?(?:class|interface|enum|record)\s+(\w+)/);
    if (JAVA_TYPE_DECL.test(code)) {
      const r = await javac(code, dir, named ? named[1] : "Snippet", 0);
      return r.missing ? { findings: [], skipped: "javac not available" } : { findings: r.errors.slice(0, 5) };
    }
    // A snippet with no type: first as class members, then as statements inside a method; keep the cleaner result.
    const asMembers = await javac(`class Snippet {\n${code}\n}\n`, dir, "Snippet", 1);
    if (asMembers.missing) return { findings: [], skipped: "javac not available" };
    if (!asMembers.errors.length) return { findings: [] };
    const asStatements = await javac(`class Snippet {\nvoid run() throws Exception {\n${code}\n}\n}\n`, dir, "Snippet", 2);
    const best = asStatements.errors.length < asMembers.errors.length ? asStatements : asMembers;
    return { findings: best.errors.slice(0, 5) };
  });
}

module.exports = { jsonSensor, pythonSensor, javaSensor };
