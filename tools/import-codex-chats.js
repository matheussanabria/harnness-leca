#!/usr/bin/env node
// Importa sessões locais do Codex (~/.codex/sessions) para projects/<slug>/chats.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { ROOT } = require("./lib/root");
const { redact } = require("./lib/redact");
const { slugify } = require("./lib/text");
const { renderChat } = require("./lib/chat-format");
const { writeChat } = require("./lib/chat-store");
const { flag, opt, CliError, runAsScript } = require("./lib/cli");

const SESSIONS = path.join(os.homedir(), ".codex", "sessions");
const iso = (value) => value || "";
const textOf = (content) => (Array.isArray(content) ? content : []).filter((part) => part.type === "input_text" || part.type === "output_text").map((part) => part.text || "").join("\n").trim();

function sessionFiles() {
  if (!fs.existsSync(SESSIONS)) return [];
  return fs.readdirSync(SESSIONS, { recursive: true }).filter((file) => file.endsWith(".jsonl")).map((file) => path.join(SESSIONS, file));
}

function parseSession(file) {
  let raw;
  try { raw = fs.readFileSync(file, "utf8"); } catch { return null; }
  const events = raw.split(/\r?\n/).filter(Boolean).flatMap((line) => { try { return [JSON.parse(line)]; } catch { return []; } });
  const meta = events.find((event) => event.type === "session_meta")?.payload || {};
  const turns = [];
  let firstUser = "";
  for (const event of events) {
    const message = event.type === "response_item" && event.payload?.type === "message" ? event.payload : null;
    if (!message || (message.role !== "user" && message.role !== "assistant")) continue;
    const text = textOf(message.content);
    if (!text) continue;
    const who = message.role === "user" ? "user" : "assistant";
    if (who === "user" && !firstUser) firstUser = text;
    const previous = turns.at(-1);
    if (previous?.who === who) previous.parts.push({ kind: "text", text });
    else turns.push({ who, parts: [{ kind: "text", text }] });
  }
  if (!turns.length) return null;
  const sessionId = meta.session_id || meta.id || path.basename(file, ".jsonl");
  return { sessionId, directory: meta.cwd || "", first: meta.timestamp || events[0]?.timestamp || "", last: events.at(-1)?.timestamp || "", title: firstUser.replace(/\s+/g, " ").slice(0, 70) || "Conversa Codex", turns };
}

function convert(file) {
  const session = parseSession(file);
  if (!session) return null;
  return renderChat({ title: session.title, sessionId: session.sessionId, origin: session.directory, first: iso(session.first), last: iso(session.last), agent: "codex", assistantLabel: "Codex" }, session.turns);
}

function run(argv, io = console, options = {}) {
  const project = opt("project", argv);
  if (!project) throw new CliError("Use --project <slug>.");
  const match = opt("from", argv) || project;
  const dryRun = flag("dry-run", argv);
  const candidates = (options.files || sessionFiles()).filter((file) => file.toLowerCase().includes(match.toLowerCase()) || (parseSession(file)?.directory || "").toLowerCase().includes(match.toLowerCase()));
  let nova = 0; let atualizada = 0; let igual = 0;
  for (const file of candidates) {
    const content = convert(file);
    const parsed = parseSession(file);
    if (!content || !parsed) continue;
    const shortId = slugify(parsed.sessionId).slice(-12) || "codex";
    const name = `${String(parsed.first || new Date().toISOString()).slice(0, 10)}-${slugify(parsed.title).slice(0, 60) || "conversa-codex"}-${shortId}.md`;
    const result = writeChat({ chatsDir: path.join(ROOT, "projects", project, "chats"), name, sessionId: parsed.sessionId, shortId, text: redact(content), mtime: parsed.last, dryRun });
    if (result.state === "nova") nova++;
    else if (result.state === "atualizada") atualizada++;
    else igual++;
  }
  io.log(`Codex ${project}: ${nova} nova(s), ${atualizada} atualizada(s), ${igual} sem mudança.`);
  return { nova, atualizada, igual };
}

module.exports = { parseSession, convert, run };
if (require.main === module) runAsScript(run);
