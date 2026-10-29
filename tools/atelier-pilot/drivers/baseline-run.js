// Reproduces the current Atelier flow headlessly: fresh-session prompt -> OpenCode -> parse -> save with history.
// Usage: node baseline-run.js <protoId> <model> <briefingFile> <outJson>
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = "C:/Users/matheuss.rodrigues/git/harness-leca";
const [protoId, model, briefingFile, outJson] = process.argv.slice(2);
const projectDir = path.join(ROOT, "projects", "harness-leca");

const { initPrototype, savePrototypeFiles } = require(`${ROOT}/ui/server/services/prototype-storage.service.js`);
const { parseDelimitedFiles } = require(`${ROOT}/ui/server/services/prototype-sanitizer.service.js`);
const History = require(`${ROOT}/ui/server/services/prototype-history.service.js`);

// Real RULES text, extracted from the shipped source so the baseline cannot drift from it.
const bridge = fs.readFileSync(`${ROOT}/ui/public/js/modules/prototype-chat-bridge.js`, "utf8");
const RULES = bridge.match(/const RULES = `([\s\S]*?)`;/)[1];

const init = initPrototype(projectDir, protoId, `Baseline ${protoId}`);
const screen = (init.proto && init.proto.activeScreen) || "home";
const base = path.join(projectDir, "design", "prototypes", protoId);
const html = fs.readFileSync(path.join(base, "screens", `${screen}.html`), "utf8");
const css = fs.readFileSync(path.join(base, "styles", "proto.css"), "utf8");
const briefing = fs.readFileSync(briefingFile, "utf8").trim();

const code = `Protótipo: ${protoId} (tela ativa: ${screen})\nCódigo atual:\n<arquivo caminho="screens/${screen}.html">\n${html}\n</arquivo>\n<arquivo caminho="styles/proto.css">\n${css}\n</arquivo>`;
const prompt = `${RULES}\n\n${code}\n\nPedido do usuário:\n${briefing}`;
const promptFile = outJson.replace(/\.json$/, "-prompt.txt");
fs.writeFileSync(promptFile, prompt);

const t0 = Date.now();
const r = spawnSync("opencode", ["run", "-m", model, "--format", "json", "Responda ao pedido descrito no arquivo anexo, seguindo o formato exigido nele.", "-f", promptFile], {
  cwd: ROOT, encoding: "utf8", shell: true, maxBuffer: 64 * 1024 * 1024, timeout: 540000,
});
const seconds = Math.round((Date.now() - t0) / 1000);

let text = "";
const usage = [];
for (const line of (r.stdout || "").split(/\r?\n/)) {
  if (!line.trim().startsWith("{")) continue;
  try {
    const ev = JSON.parse(line);
    const p = ev.part || {};
    if (ev.type === "text" && p.text) text += p.text;
    if (p.tokens) usage.push(p.tokens);
  } catch { /* ignore non-JSON noise */ }
}

const files = parseDelimitedFiles(text);
let saved = null;
let saveError = null;
if (files.length) {
  try {
    saved = History.withHistory(projectDir, protoId, { label: "Baseline run", kind: "files", detail: files.map((f) => f.path).join(", ") },
      () => savePrototypeFiles(projectDir, protoId, files, { engine: "opencode", author: "baseline", message: "Baseline run" }));
  } catch (e) { saveError = String(e.message || e); }
}

const summary = {
  protoId, model, seconds, exit: r.status, stderrTail: (r.stderr || "").slice(-300),
  replyChars: text.length, files: files.map((f) => ({ path: f.path, chars: f.content.length })),
  savedOk: !!saved && saved.ok !== false, saveError, tokenEvents: usage.length ? usage : "unavailable",
};
fs.writeFileSync(outJson, JSON.stringify(summary, null, 2));
fs.writeFileSync(outJson.replace(/\.json$/, "-reply.txt"), text);
console.log(JSON.stringify(summary, null, 2));
