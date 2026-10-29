// Runs the shipped Atelier prompt (real bridge code, live server) through OpenCode and saves the reply like the chat does.
// Usage: node quality-run.js <protoId> <model> <briefingFile> <outJson> [prefix]   (prefix e.g. "/directions ")
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { pathToFileURL } = require("url");

const ROOT = "C:/Users/matheuss.rodrigues/git/harness-leca";
const BASE = "http://localhost:4321";
const [protoId, model, briefingFile, outJson, prefix = ""] = process.argv.slice(2);
const projectDir = path.join(ROOT, "projects", "harness-leca");

const { initPrototype, savePrototypeFiles } = require(`${ROOT}/ui/server/services/prototype-storage.service.js`);
const { parseDelimitedFiles } = require(`${ROOT}/ui/server/services/prototype-sanitizer.service.js`);
const History = require(`${ROOT}/ui/server/services/prototype-history.service.js`);
const { qualityMetadata } = require(`${ROOT}/ui/server/services/atelier-quality.service.js`);

(async () => {
  initPrototype(projectDir, protoId, `Run ${protoId}`);
  const realFetch = global.fetch;
  const LEGACY = process.env.LEGACY === "1"; // today's flow: legacy prompt, no Design System, no component CSS
  global.fetch = (url, opts) => (LEGACY && String(url).includes("quality-context")
    ? Promise.resolve({ json: async () => ({ enabled: false, reason: "flag-off" }) })
    : realFetch(String(url).startsWith("/") ? BASE + url : url, opts));
  const bridge = await import(pathToFileURL(`${ROOT}/ui/public/js/modules/prototype-chat-bridge.js`).href);
  bridge.setAtelierChatContext({ slug: "harness-leca", protoId, getScreen: () => "home", reload() {} });
  bridge.resetAtelierPromptState();
  const briefing = fs.readFileSync(briefingFile, "utf8").trim();
  const prompt = await bridge.wrapAtelierPrompt(prefix + briefing, { resumed: false });
  const promptFile = outJson.replace(/\.json$/, "-prompt.txt");
  fs.writeFileSync(promptFile, prompt);

  const t0 = Date.now();
  const r = spawnSync("opencode", ["run", "-m", model, ...(process.env.VARIANT ? ["--variant", process.env.VARIANT] : []), "--format", "json", "Answer the request described in the attached file, following the output format it requires.", "-f", promptFile], {
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
  let saved = null, saveError = null;
  if (files.length) {
    try {
      saved = History.withHistory(projectDir, protoId, { label: "Quality run", kind: "files", detail: files.map((f) => f.path).join(", ") },
        () => savePrototypeFiles(projectDir, protoId, files, { engine: "opencode", author: "quality-run", message: "Quality run", ...(process.env.LEGACY === "1" ? {} : qualityMetadata(projectDir)) }));
    } catch (e) { saveError = String(e.message || e); }
  }
  const screens = files.filter((f) => f.path.startsWith("screens/")).map((f) => path.basename(f.path, ".html"));
  const gotoTargets = [...new Set(files.flatMap((f) => [...f.content.matchAll(/data-action="goto:([\w-]+)"/g)].map((m) => m[1])))];
  const brokenGoto = gotoTargets.filter((t) => ![...screens, "home"].includes(t));
  const closing = text.replace(/<arquivo[\s\S]*?<\/arquivo>/gi, "").trim();
  const summary = {
    protoId, model, prefix: prefix.trim() || "(compose)", seconds, exit: r.status, promptChars: prompt.length,
    replyChars: text.length, files: files.map((f) => ({ path: f.path, chars: f.content.length })),
    savedOk: !!saved && saved.ok !== false, saveError, tokens: usage.length ? usage : "unavailable", closing, screens, gotoTargets, brokenGoto,
  };
  fs.writeFileSync(outJson, JSON.stringify(summary, null, 2));
  fs.writeFileSync(outJson.replace(/\.json$/, "-reply.txt"), text);
  console.log(JSON.stringify(summary, null, 2));
})().catch((e) => { console.error("FAILED", e); process.exit(1); });
