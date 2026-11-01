// @ts-check
// Syntax and lint sensor for js, jsx, ts, tsx, json and css through Biome (already a dev dependency). One process
// per block, in a temp dir with its own minimal config so the repository's biome.json never applies. Parse errors are
// errors; lint findings are warnings, limited to rules that point at real defects in partial snippets (unused or
// undeclared names and style rules are noise there, so they are dropped).
const fs = require("fs");
const path = require("path");
const { run, withTempDir } = require("./exec");

const EXT = { js: "js", jsx: "jsx", ts: "ts", tsx: "tsx", json: "json", css: "css" };
const CONFIG = JSON.stringify({ formatter: { enabled: false }, assist: { enabled: false }, linter: { enabled: true } });
const MAX_LINT = 5;
const KEEP = /^lint\/(correctness|suspicious|security)\//;
const DROP = /noUnused|noUndeclared|noUnresolved|noExplicitAny|noConsole|noEmptyBlock|noImplicitAnyLet|noAssignInExpressions/;

let binCache = /** @type {string | null | undefined} */ (undefined);
/** Path of the Biome executable script, or null when it is not installed. */
function biomeBin() {
  if (binCache !== undefined) return binCache;
  try {
    const pkg = require.resolve("@biomejs/biome/package.json");
    const bin = path.join(path.dirname(pkg), "bin", "biome");
    binCache = fs.existsSync(bin) ? bin : null;
  } catch {
    binCache = null;
  }
  return binCache;
}

/**
 * Reads Biome's text diagnostics for the snippet file.
 * @param {string} output
 * @param {string} file
 */
function parseDiagnostics(output, file) {
  const clean = output.replace(/\x1b\[[0-9;]*m/g, "").replace(/\r/g, "");
  const header = new RegExp(`^${file.replace(".", "\\.")}:(\\d+):(\\d+) ([\\w/.-]+)[^\\n]*$`, "gm");
  const hits = [...clean.matchAll(header)];
  return hits.map((h, i) => {
    const body = clean.slice((h.index || 0) + h[0].length, hits[i + 1]?.index ?? clean.length);
    const msg = body.match(/^\s*[×x!]\s+([^\n]+)/m);
    return { line: Number(h[1]), category: h[3], message: msg ? msg[1].trim() : h[3] };
  });
}

/**
 * @param {{ lang: string, code: string }} block
 * @returns {Promise<{ findings: Array<{ sensor: string, severity: "error" | "warning", line: number, message: string }>, skipped?: string }>}
 */
async function biomeSensor({ lang, code }) {
  const ext = EXT[/** @type {keyof typeof EXT} */ (lang)];
  const bin = biomeBin();
  if (!ext || !bin) return { findings: [], skipped: !bin ? "biome not installed" : `no biome support for ${lang}` };
  return withTempDir(async (dir) => {
    const file = `snippet.${ext}`;
    fs.writeFileSync(path.join(dir, "biome.json"), CONFIG);
    fs.writeFileSync(path.join(dir, file), code);
    const r = await run(process.execPath, [bin, "lint", file, "--colors=off", "--max-diagnostics=30"], { cwd: dir, timeoutMs: 10000 });
    if (r.timedOut) return { findings: [], skipped: "biome timed out" };
    const all = parseDiagnostics(`${r.stdout}\n${r.stderr}`, file);
    const parse = all.filter((d) => d.category === "parse" || d.category.startsWith("parse/"));
    const lint = all.filter((d) => KEEP.test(d.category) && !DROP.test(d.category)).slice(0, MAX_LINT);
    return {
      findings: [
        ...parse.map((d) => ({ sensor: "syntax", severity: /** @type {const} */ ("error"), line: d.line, message: d.message })),
        // A file that does not parse yields cascading lint noise; report lint only for code that parses.
        ...(parse.length ? [] : lint.map((d) => ({ sensor: "lint", severity: /** @type {const} */ ("warning"), line: d.line, message: `${d.category.replace(/^lint\//, "")}: ${d.message}` }))),
      ],
    };
  });
}

module.exports = { biomeSensor, parseDiagnostics, biomeBin };
