#!/usr/bin/env node
// @ts-check
// One-time, idempotent import of projects/<slug>/chats/*.md into the host database (EP-17.02 RF5).
// A file already linked to a conversation (project + source_file) is skipped, so running it again changes nothing.
// The .md files are only read. Content is redacted with the same rules as the .md writer.
//
//   node tools/migrate/chat-import.js [--projects <dir>] [--project <slug>] [--dry-run]
const fs = require("fs");
const path = require("path");
const { openCliDatabase } = require("../lib/db-client");
const { createChatRepo } = require("../../ui/server/db/repos/chat.repo");
const { parseChatFile } = require("../../ui/server/services/chat/md-import");
const { redact } = require("../lib/redact");
const { ROOT } = require("../lib/root");

const SESSION_ID = /^[\w.:-]{1,200}$/;

/**
 * Imports one file. @param {ReturnType<typeof createChatRepo>} repo @param {string} slug @param {string} fileName @param {string} raw
 * @returns {"imported"|"skipped"|"empty"}
 */
function importChatFile(repo, slug, fileName, raw) {
  if (repo.findByFile(slug, fileName)) return "skipped";
  const chat = parseChatFile(raw);
  if (!chat.messages.length) return "empty";
  repo.transaction(() => {
    const conversation = repo.createConversation({ projectId: slug, sourceFile: fileName, title: chat.title || fileName.replace(/\.md$/, "") });
    if (SESSION_ID.test(chat.sessionId)) repo.setEngineSession(conversation.id, chat.engine, chat.sessionId);
    repo.appendMessages(conversation.id, chat.messages.map((m) => ({ ...m, content: redact(m.content), thinking: m.thinking ? redact(m.thinking) : null })));
  });
  return "imported";
}

/**
 * @param {ReturnType<typeof createChatRepo>} repo @param {string} projectsDir @param {{ project?: string }} [options]
 * @returns {{ imported: number, skipped: number, empty: number, failed: string[] }}
 */
function importProjects(repo, projectsDir, options = {}) {
  const totals = { imported: 0, skipped: 0, empty: 0, failed: /** @type {string[]} */ ([]) };
  const slugs = fs.readdirSync(projectsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== "_template" && (!options.project || d.name === options.project))
    .map((d) => d.name);
  for (const slug of slugs) {
    const chatsDir = path.join(projectsDir, slug, "chats");
    if (!fs.existsSync(chatsDir)) continue;
    for (const fileName of fs.readdirSync(chatsDir).filter((f) => f.endsWith(".md")).sort()) {
      try {
        totals[importChatFile(repo, slug, fileName, fs.readFileSync(path.join(chatsDir, fileName), "utf8"))] += 1;
      } catch (error) {
        totals.failed.push(`${slug}/${fileName}: ${/** @type {any} */ (error).message}`);
      }
    }
  }
  return totals;
}

function main(argv = process.argv.slice(2)) {
  const arg = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
  const projectsDir = path.resolve(arg("--projects") || process.env.HARNESS_PROJECTS_DIR || path.join(ROOT, "projects"));
  const db = openCliDatabase();
  try {
    const repo = createChatRepo(db);
    const run = () => importProjects(repo, projectsDir, { project: arg("--project") });
    if (!argv.includes("--dry-run")) return console.log(JSON.stringify(run(), null, 2));
    // Dry run: the whole import runs inside a transaction that is always rolled back.
    let totals;
    try {
      repo.transaction(() => { totals = run(); throw new Error("dry-run"); });
    } catch (error) {
      if (!totals) throw error;
    }
    console.log(JSON.stringify({ dryRun: true, ...totals }, null, 2));
  } finally {
    db.close();
  }
}

if (require.main === module) main();

module.exports = { importChatFile, importProjects };
