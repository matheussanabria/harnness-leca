// Revision as a CSS override patch: the model returns only the rules to add, the harness appends them to styles/proto.css.
// HTML is copied unchanged, so text, prices and the flow cannot drift. The source prototype is never touched.
// Usage: node revise-patch.js <srcId> <newId> <model> <reviewDir> <outJson>     env: VARIANT=low, EXTRA="extra problem; another"
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = "C:/Users/matheuss.rodrigues/git/harness-leca";
const BASE = "http://localhost:4321";
const [srcId, newId, model, reviewDir, outJson] = process.argv.slice(2);
const projectDir = path.join(ROOT, "projects", "harness-leca");
const protos = path.join(projectDir, "design", "prototypes");

const { initPrototype, savePrototypeFiles } = require(`${ROOT}/ui/server/services/prototype-storage.service.js`);
const { parseDelimitedFiles } = require(`${ROOT}/ui/server/services/prototype-sanitizer.service.js`);
const History = require(`${ROOT}/ui/server/services/prototype-history.service.js`);
const { reviewUrl, summarize, launchEdge } = require(`${ROOT}/tools/atelier-pilot/render-review.js`);

const read = (id, rel) => fs.readFileSync(path.join(protos, id, rel), "utf8");
const textOf = (html) => html.replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const usable = (css) => !/@import|url\s*\(|expression\s*\(|<\/?script|javascript:/i.test(css); // a patch may only restyle

(async () => {
  const issues = [];
  for (const screen of ["home", "confirmacao"]) {
    const j = JSON.parse(fs.readFileSync(path.join(reviewDir, `${srcId}-${screen}-review.json`), "utf8"));
    for (const i of j.issues) issues.push(`[${screen}] ${i.severity}: ${i.text}`);
  }
  for (const extra of (process.env.EXTRA || "").split(";").map((s) => s.trim()).filter(Boolean)) issues.push(`[home] requested: ${extra}`);
  const unique = [...new Set(issues)];

  const prompt = `You are revising the CSS of an existing prototype. Return ONLY one block in this exact format and nothing else except one short sentence after it:
<arquivo caminho="styles/patch.css">
...override rules...
</arquivo>
The block holds only the rules to ADD after the existing stylesheet. Do not repeat rules that stay the same. Use selectors at least as specific as the existing ones so the overrides win. Do not touch layout, text, typography or backgrounds beyond what a problem requires. Do not use @import, url() or external resources.
For a contrast problem on a filled button, darken the button background and keep the label colour; never make a label darker than its background.

Existing stylesheet (styles/proto.css):
${read(srcId, "styles/proto.css")}

Markup of the screens, for the class names only (do not return it):
--- screens/home.html
${read(srcId, "screens/home.html")}
--- screens/confirmacao.html
${read(srcId, "screens/confirmacao.html")}

Problems to fix:
${unique.map((u) => `- ${u}`).join("\n")}`;
  const promptFile = outJson.replace(/\.json$/, "-prompt.txt");
  fs.writeFileSync(promptFile, prompt);

  const t0 = Date.now();
  const r = spawnSync("opencode", ["run", "-m", model, ...(process.env.VARIANT ? ["--variant", process.env.VARIANT] : []), "--format", "json", "Apply the CSS revision described in the attached file, following the output format it requires.", "-f", promptFile], { cwd: ROOT, encoding: "utf8", shell: true, maxBuffer: 64 * 1024 * 1024, timeout: 540000 });
  const seconds = Math.round((Date.now() - t0) / 1000);
  let text = "";
  const usage = [];
  for (const line of (r.stdout || "").split(/\r?\n/)) {
    if (!line.trim().startsWith("{")) continue;
    try { const ev = JSON.parse(line); const p = ev.part || {}; if (ev.type === "text" && p.text) text += p.text; if (p.tokens) usage.push(p.tokens); } catch { /* noise */ }
  }
  const patch = (parseDelimitedFiles(text).find((f) => f.path === "styles/patch.css") || {}).content || "";
  const patchOk = !!patch.trim() && usable(patch);

  initPrototype(projectDir, newId, `CSS patch revision of ${srcId}`);
  let savedOk = false, saveError = null;
  if (patchOk) {
    const files = [
      { path: "screens/home.html", content: read(srcId, "screens/home.html") },
      { path: "screens/confirmacao.html", content: read(srcId, "screens/confirmacao.html") },
      { path: "styles/proto.css", content: `${read(srcId, "styles/proto.css").trimEnd()}\n\n/* Revision patch */\n${patch.trim()}\n` },
    ];
    try {
      const res = History.withHistory(projectDir, newId, { label: "CSS patch revision", kind: "files", detail: files.map((f) => f.path).join(", ") }, () => savePrototypeFiles(projectDir, newId, files, { engine: "opencode", author: "revise-patch", message: "CSS patch revision" }));
      savedOk = res.ok !== false;
    } catch (e) { saveError = String(e.message || e); }
  }

  const diff = {};
  if (savedOk) {
    for (const s of ["home", "confirmacao"]) diff[s] = { textUnchanged: textOf(read(srcId, `screens/${s}.html`)) === textOf(read(newId, `screens/${s}.html`)) };
    diff.patchLines = patch.trim().split(/\r?\n/).length;
    diff.patchChars = patch.trim().length;
  }

  const review = {};
  if (savedOk) {
    const browser = await launchEdge();
    try {
      for (const screen of ["home", "confirmacao"]) {
        const results = await reviewUrl(browser, `${BASE}/api/project/harness-leca/design/prototypes/${newId}/render/${screen}`, { widths: [360, 390, 768, 1440], outDir: reviewDir, name: `${newId}-${screen}` });
        const found = summarize(results);
        fs.writeFileSync(path.join(reviewDir, `${newId}-${screen}-review.json`), JSON.stringify({ proto: newId, screen, issues: found, results }, null, 2));
        review[screen] = { high: found.filter((i) => i.severity === "high").length, medium: found.filter((i) => i.severity === "medium").length, issues: found.slice(0, 8).map((i) => `${i.severity} @${i.at}: ${i.text}`) };
      }
    } finally { await browser.close(); }
  }

  const tok = usage.length ? usage.reduce((n, u) => n + (u.total || 0), 0) : null;
  const summary = { srcId, newId, model, exit: r.status, revision: { seconds, tokens: usage.length ? usage : "unavailable", tokensTotal: tok }, issuesSent: unique, patchReturned: !!patch.trim(), patchUsable: patchOk, patch: patch.trim().slice(0, 1500), savedOk, saveError, diff, review };
  fs.writeFileSync(outJson, JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
})().catch((e) => { console.error("FAILED", e); process.exit(1); });
