#!/usr/bin/env node
// Converte chats do Harness em sessões JSONL que o Codex pode retomar localmente.
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { ROOT } = require("./lib/root");
const { existingSlugs } = require("./lib/projects");
const { readMeta, stripFrontmatter, splitTurns } = require("./lib/chat-format");
const { flag, opt, CliError, runAsScript } = require("./lib/cli");

const SESSIONS = path.join(os.homedir(), ".codex", "sessions");
const safeDate = (value) => Number.isNaN(Date.parse(value)) ? new Date() : new Date(value);

function convertChatMdToJsonl(file, defaultCwd) {
  const raw = fs.readFileSync(file, "utf8");
  const meta = readMeta(raw);
  const title = meta("titulo") || path.basename(file, ".md");
  const start = safeDate(meta("inicio"));
  const sessionId = crypto.randomUUID();
  const turns = splitTurns(stripFrontmatter(raw).replace(/^# .*\r?\n/, ""));
  if (!turns.length) return null;
  const lines = [JSON.stringify({ timestamp: start.toISOString(), type: "session_meta", payload: { session_id: sessionId, id: sessionId, timestamp: start.toISOString(), cwd: meta("origem") || defaultCwd, originator: "harness-leca", source: "harness-leca" } })];
  let timestamp = start.getTime();
  for (const turn of turns) {
    const role = /^voc[eê]$/i.test(turn.speaker) ? "user" : "assistant";
    lines.push(JSON.stringify({ timestamp: new Date(timestamp).toISOString(), type: "response_item", payload: { type: "message", id: crypto.randomUUID(), role, content: [{ type: role === "user" ? "input_text" : "output_text", text: turn.text }] } }));
    timestamp += 1000;
  }
  return { sessionId, title, date: start, lines };
}

function outputFile(converted) {
  const date = converted.date;
  const parts = [String(date.getFullYear()), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")];
  return path.join(SESSIONS, ...parts, `rollout-${date.toISOString().replace(/[:.]/g, "-")}-${converted.sessionId}.jsonl`);
}

function run(argv, io = console) {
  const dryRun = flag("dry-run", argv); const project = opt("project", argv); const force = flag("force", argv);
  const slugs = project ? [project] : existingSlugs();
  if (project && !existingSlugs().includes(project)) throw new CliError(`Projeto "${project}" não encontrado.`);
  let exported = 0; let skipped = 0;
  for (const slug of slugs) {
    const directory = path.join(ROOT, "projects", slug, "chats");
    if (!fs.existsSync(directory)) continue;
    for (const name of fs.readdirSync(directory).filter((entry) => entry.endsWith(".md"))) {
      const converted = convertChatMdToJsonl(path.join(directory, name), path.join(ROOT, "projects", slug));
      if (!converted) continue;
      const destination = outputFile(converted);
      if (!force && fs.existsSync(destination)) { skipped++; continue; }
      if (!dryRun) fs.mkdirSync(path.dirname(destination), { recursive: true });
      if (!dryRun) fs.writeFileSync(destination, `${converted.lines.join("\n")}\n`, "utf8");
      exported++;
    }
  }
  io.log(`Codex: ${exported} sessão(ões) exportada(s), ${skipped} preservada(s).`);
  return { exported, skipped };
}

module.exports = { convertChatMdToJsonl, run };
if (require.main === module) runAsScript(run);
