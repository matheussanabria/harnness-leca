// Targeted revision round: copy a prototype, send the code plus the render-review findings back to the model,
// save the result as a NEW prototype (the original is never touched), then review and diff it.
// Usage: node revise-run.js <srcId> <newId> <model> <reviewDir> <outJson>      env: VARIANT=low
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

const RELS = ["screens/home.html", "screens/confirmacao.html", "styles/proto.css"];
const read = (id, rel) => fs.readFileSync(path.join(protos, id, rel), "utf8");
const bridge = fs.readFileSync(`${ROOT}/ui/public/js/modules/prototype-chat-bridge.js`, "utf8");
const RULES = bridge.match(/const RULES = `([\s\S]*?)`;/)[1];
const textOf = (html) => html.replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const lines = (css) => new Set(css.split(/\r?\n/).map((l) => l.trim()).filter(Boolean));

(async () => {
  // 1. findings of the original, from the review JSON written earlier
  const issues = [];
  for (const screen of ["home", "confirmacao"]) {
    const j = JSON.parse(fs.readFileSync(path.join(reviewDir, `${srcId}-${screen}-review.json`), "utf8"));
    for (const i of j.issues) issues.push(`[${screen}] ${i.severity}: ${i.text}`);
  }
  const unique = [...new Set(issues)];

  // 2. prompt: legacy output rules, current code, targeted request
  const code = RELS.map((rel) => `<arquivo caminho="${rel}">\n${read(srcId, rel)}\n</arquivo>`).join("\n");
  const request = `This is a TARGETED REVISION of the prototype above, not a redesign. Fix only these problems:
- Every contrast problem listed below: change only the colour of the listed element (its text or its background), as little as needed to reach the required ratio.
- The spacing between the last benefit and the button inside the Barista plan card, and make the buttons of the three plan cards sit on the same line.
Keep exactly the same: layout, all text, prices, badges, typography, backgrounds, navigation, both screens and every data-action. Return all three files in full.
Problems found by the render review:
${unique.map((u) => `- ${u}`).join("\n")}`;
  const prompt = `${RULES}\n\nProtótipo: ${srcId}\nCódigo atual:\n${code}\n\nPedido do usuário:\n${request}`;
  const promptFile = outJson.replace(/\.json$/, "-prompt.txt");
  fs.writeFileSync(promptFile, prompt);

  // 3. model run
  const t0 = Date.now();
  const r = spawnSync("opencode", ["run", "-m", model, ...(process.env.VARIANT ? ["--variant", process.env.VARIANT] : []), "--format", "json", "Apply the targeted revision described in the attached file, following the output format it requires.", "-f", promptFile], { cwd: ROOT, encoding: "utf8", shell: true, maxBuffer: 64 * 1024 * 1024, timeout: 540000 });
  const seconds = Math.round((Date.now() - t0) / 1000);
  let text = "";
  const usage = [];
  for (const line of (r.stdout || "").split(/\r?\n/)) {
    if (!line.trim().startsWith("{")) continue;
    try { const ev = JSON.parse(line); const p = ev.part || {}; if (ev.type === "text" && p.text) text += p.text; if (p.tokens) usage.push(p.tokens); } catch { /* noise */ }
  }
  const files = parseDelimitedFiles(text);

  // 4. save as a new prototype; the original stays as it is
  initPrototype(projectDir, newId, `Revision of ${srcId}`);
  let savedOk = false, saveError = null;
  if (files.length) {
    try {
      const res = History.withHistory(projectDir, newId, { label: "Targeted revision", kind: "files", detail: files.map((f) => f.path).join(", ") }, () => savePrototypeFiles(projectDir, newId, files, { engine: "opencode", author: "revise-run", message: "Targeted revision" }));
      savedOk = res.ok !== false;
    } catch (e) { saveError = String(e.message || e); }
  }

  // 5. what changed, and did the identity survive
  const diff = { screens: {}, css: {} };
  if (savedOk) {
    for (const rel of RELS.filter((x) => x.startsWith("screens/"))) {
      const a = textOf(read(srcId, rel)), b = textOf(read(newId, rel));
      diff.screens[rel] = { textUnchanged: a === b, wordsBefore: a.split(" ").length, wordsAfter: b.split(" ").length };
    }
    const a = lines(read(srcId, "styles/proto.css")), b = lines(read(newId, "styles/proto.css"));
    diff.css = { linesBefore: a.size, linesAfter: b.size, removed: [...a].filter((l) => !b.has(l)).length, added: [...b].filter((l) => !a.has(l)).length };
    const all = RELS.map((rel) => read(newId, rel)).join("\n");
    diff.prices = ["79", "129", "189"].every((p) => all.includes(p));
    const targets = [...new Set([...all.matchAll(/data-action="goto:([\w-]+)"/g)].map((m) => m[1]))];
    diff.gotoTargets = targets; diff.brokenGoto = targets.filter((t) => !["home", "confirmacao"].includes(t));
  }

  // 6. render review of the revision at four widths
  const review = {};
  if (savedOk) {
    const browser = await launchEdge();
    try {
      for (const screen of ["home", "confirmacao"]) {
        const url = `${BASE}/api/project/harness-leca/design/prototypes/${newId}/render/${screen}`;
        const results = await reviewUrl(browser, url, { widths: [360, 390, 768, 1440], outDir: reviewDir, name: `${newId}-${screen}` });
        const found = summarize(results);
        fs.writeFileSync(path.join(reviewDir, `${newId}-${screen}-review.json`), JSON.stringify({ proto: newId, screen, issues: found, results }, null, 2));
        review[screen] = { high: found.filter((i) => i.severity === "high").length, medium: found.filter((i) => i.severity === "medium").length, issues: found.slice(0, 8).map((i) => `${i.severity} @${i.at}: ${i.text}`), screenshots: results.map((x) => x.screenshot) };
      }
    } finally { await browser.close(); }
  }

  const orig = JSON.parse(fs.readFileSync(path.join(path.dirname(outJson), "v2-legacy.json"), "utf8"));
  const tok = usage.length ? usage.reduce((n, u) => n + (u.total || 0), 0) : null;
  const summary = {
    srcId, newId, model, exit: r.status, revision: { seconds, tokens: usage.length ? usage : "unavailable", tokensTotal: tok },
    originalGeneration: { seconds: orig.seconds, tokensTotal: orig.tokens[0].total },
    combined: { seconds: orig.seconds + seconds, tokensTotal: tok == null ? null : orig.tokens[0].total + tok },
    issuesSent: unique, filesReturned: files.map((f) => f.path), savedOk, saveError, diff, review,
  };
  fs.writeFileSync(outJson, JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
})().catch((e) => { console.error("FAILED", e); process.exit(1); });
