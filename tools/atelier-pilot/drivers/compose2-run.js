// Composite generation, compact prompt: full BASE page plus only the HTML fragments of two references that the spec names.
// A prompt this size stays well under the length at which the free model starts reading the file with its own tools.
// Usage: node compose2-run.js <baseId> <newId> <specFile> <model> <outJson>     env: VARIANT=low
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = "C:/Users/matheuss.rodrigues/git/harness-leca";
const [baseId, newId, specFile, model, outJson] = process.argv.slice(2);
const projectDir = path.join(ROOT, "projects", "harness-leca");
const protos = path.join(projectDir, "design", "prototypes");
const { initPrototype, savePrototypeFiles } = require(`${ROOT}/ui/server/services/prototype-storage.service.js`);
const { parseDelimitedFiles } = require(`${ROOT}/ui/server/services/prototype-sanitizer.service.js`);
const History = require(`${ROOT}/ui/server/services/prototype-history.service.js`);

const read = (id, rel) => fs.readFileSync(path.join(protos, id, rel), "utf8");
const RULES = fs.readFileSync(`${ROOT}/ui/public/js/modules/prototype-chat-bridge.js`, "utf8").match(/const RULES = `([\s\S]*?)`;/)[1];
const noPid = (html) => html.replace(/ data-pid="[^"]*"/g, "");
const minCss = (css) => css.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\s+/g, " ").replace(/\s*([{};:,])\s*/g, "$1").trim();

/** First element whose opening tag matches `open`, up to its closing tag (sections and footers are flat in these pages). */
function fragment(html, open, closeTag) {
  const start = html.search(open);
  if (start < 0) return `<!-- fragment not found: ${open} -->`;
  const end = html.indexOf(closeTag, start);
  return noPid(html.slice(start, end + closeTag.length)).replace(/\n\s*\n/g, "\n");
}
const REFS = {
  A: ["v2-legacy-r2", [["header with the logo mark", /<header class="tn-nav"/, "</header>"], ["hero (label above the headline, background)", /<section class="tn-hero"/, "</section>"], ["testimonials section", /<section class="tn-voices"/, "</section>"], ["footer with contact", /<footer class="tn-footer"/, "</footer>"]]],
  B: ["v2-quality", [["hero with the info row", /<section class="hero"/, "</section>"], ["testimonials with quotation icon", /<section class="section section--tint"/, "</section>"], ["closing CTA card", /<section class="section" aria-labelledby="cta-title"/, "</section>"]]],
};

(async () => {
  const spec = fs.readFileSync(specFile, "utf8").trim();
  const refText = Object.entries(REFS).map(([label, [id, parts]]) => {
    const html = read(id, "screens/home.html");
    return `===== REFERENCE ${label} (${id}), HTML fragments only =====\n${parts.map(([what, open, close]) => `--- ${what}\n${fragment(html, open, close)}`).join("\n")}`;
  }).join("\n\n");
  const base = `===== BASE (${baseId}): keep this page and change it as the request says =====\n<arquivo caminho="screens/home.html">\n${noPid(read(baseId, "screens/home.html"))}\n</arquivo>\n<arquivo caminho="styles/proto.css">\n${minCss(read(baseId, "styles/proto.css"))}\n</arquivo>`;
  const prompt = `${RULES}\n\nReturn only screens/home.html and styles/proto.css, complete, as the new page. Write all CSS yourself; the references are for structure and ideas only.\n\n${base}\n\n${refText}\n\nPedido do usuário:\n${spec}`;
  const promptFile = outJson.replace(/\.json$/, "-prompt.txt");
  fs.writeFileSync(promptFile, prompt);

  const t0 = Date.now();
  const r = spawnSync("opencode", ["run", "-m", model, ...(process.env.VARIANT ? ["--variant", process.env.VARIANT] : []), "--format", "json", "Do the task described in the attached file, following the output format it requires. Do not use tools; answer directly.", "-f", promptFile], { cwd: ROOT, encoding: "utf8", shell: true, maxBuffer: 128 * 1024 * 1024, timeout: 600000 });
  const seconds = Math.round((Date.now() - t0) / 1000);
  fs.writeFileSync(outJson.replace(/\.json$/, "-raw.txt"), `${r.stdout || ""}\n--- STDERR ---\n${r.stderr || ""}`);
  let text = "";
  const usage = [];
  const toolEvents = [];
  for (const line of (r.stdout || "").split(/\r?\n/)) {
    if (!line.trim().startsWith("{")) continue;
    try { const ev = JSON.parse(line); const p = ev.part || {}; if (ev.type === "text" && p.text) text += p.text; if (ev.type === "tool_use") toolEvents.push(p.tool); if (p.tokens) usage.push(p.tokens); } catch { /* noise */ }
  }
  const files = parseDelimitedFiles(text);
  initPrototype(projectDir, newId, `${newId} - best-of composite on ${baseId}`);
  let savedOk = false, saveError = null;
  if (files.length) {
    try {
      const res = History.withHistory(projectDir, newId, { label: "Composite", kind: "files", detail: files.map((f) => f.path).join(", ") }, () => savePrototypeFiles(projectDir, newId, files, { engine: "opencode", author: "compose2-run", message: "Composite" }));
      savedOk = res.ok !== false;
    } catch (e) { saveError = String(e.message || e); }
  }
  const summary = { newId, model, seconds, exit: r.status, promptChars: prompt.length, toolCallsByModel: toolEvents, files: files.map((f) => ({ path: f.path, chars: f.content.length })), savedOk, saveError, tokens: usage.length ? usage : "unavailable", closing: text.replace(/<arquivo[\s\S]*?<\/arquivo>/gi, "").trim().slice(0, 900) };
  fs.writeFileSync(outJson, JSON.stringify(summary, null, 2));
  fs.writeFileSync(outJson.replace(/\.json$/, "-reply.txt"), text);
  console.log(JSON.stringify({ promptChars: summary.promptChars, seconds, files: summary.files, savedOk, toolCallsByModel: toolEvents }));
})().catch((e) => { console.error("FAILED", e); process.exit(1); });
