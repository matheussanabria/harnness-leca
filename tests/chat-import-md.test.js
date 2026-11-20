// EP-17.02 RF5: idempotent import of projects/<slug>/chats/*.md, with the two 2026-11-01 PRD chats of the incident.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { createTestDatabase } = require("../ui/server/db/connection");
const { createChatRepo } = require("../ui/server/db/repos/chat.repo");
const { importProjects } = require("../tools/migrate/chat-import");
const { parseChatFile } = require("../ui/server/services/chat/md-import");

const TITLE = "Quero criar um prompt para detalhar um prd usando";
const chatMd = (session, minute) => `---
titulo: "${TITLE}"
sessao: ${session}
origem: "harness-ui"
inicio: 2026-11-01T14:${minute}:00.000Z
fim: 2026-11-01T14:${minute}:30.000Z
agente: "opencode"
---

# ${TITLE}

## Você

${TITLE} o template da empresa

## opencode

:::thinking
Planejar as seções do PRD.
:::

Aqui está a estrutura do prompt.

:::tool Read | template.md
--- entrada
template.md
:::
`;

const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "harness-chat-import-"));
test.after(() => fs.rmSync(ROOT, { recursive: true, force: true }));
const chats = path.join(ROOT, "inv", "chats");
fs.mkdirSync(chats, { recursive: true });
fs.writeFileSync(path.join(chats, "2026-11-01-quero-criar-um-prompt-e6811a9c.md"), chatMd("ses_e6811a9cffe0001", "02"));
fs.writeFileSync(path.join(chats, "2026-11-01-quero-criar-um-prompt-e6805743.md"), chatMd("ses_e68057437ffe002", "06"));
fs.writeFileSync(path.join(chats, "vazio.md"), "---\ntitulo: \"x\"\n---\n\n# x\n");
fs.mkdirSync(path.join(ROOT, "_template", "chats"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "_template", "chats", "ignored.md"), chatMd("ses_template", "00"));

test("parse: speakers, thinking apart, tool blocks out", () => {
  const chat = parseChatFile(chatMd("ses_x", "02"));
  assert.equal(chat.title, TITLE);
  assert.equal(chat.sessionId, "ses_x");
  assert.equal(chat.engine, "opencode");
  assert.deepEqual(chat.messages.map((m) => [m.role, m.engine || null]), [["user", null], ["assistant", "opencode"]]);
  assert.equal(chat.messages[1].content, "Aqui está a estrutura do prompt.");
  assert.equal(chat.messages[1].thinking, "Planejar as seções do PRD.");
});

test("both PRD chats import once; a second run changes nothing", () => {
  const db = createTestDatabase();
  try {
    const repo = createChatRepo(db);
    assert.deepEqual(importProjects(repo, ROOT), { imported: 2, skipped: 0, empty: 1, failed: [] });
    assert.deepEqual(importProjects(repo, ROOT), { imported: 0, skipped: 2, empty: 1, failed: [] });
    const list = repo.listConversations("inv");
    assert.equal(list.length, 2, "two conversations, no duplicates; the user can link or merge them");
    const sessions = list.map((c) => repo.getEngineSessions(c.id)[0].engineSessionId).sort();
    assert.deepEqual(sessions, ["ses_e68057437ffe002", "ses_e6811a9cffe0001"]);
    assert.equal(repo.countMessages(list[0].id), 2);
    assert.deepEqual(repo.listConversations("_template"), [], "the template project is never imported");
  } finally {
    db.close();
  }
});

test("content is redacted on import", () => {
  const db = createTestDatabase();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "harness-chat-redact-"));
  try {
    fs.mkdirSync(path.join(dir, "p", "chats"), { recursive: true });
    const secret = "sk-ant-api03-" + "A".repeat(80);
    fs.writeFileSync(path.join(dir, "p", "chats", "s.md"), chatMd("ses_s", "01").replace("o template da empresa", `chave ${secret}`));
    const repo = createChatRepo(db);
    importProjects(repo, dir);
    const [c] = repo.listConversations("p");
    assert.ok(!repo.readMessages(c.id)[0].content.includes(secret));
  } finally {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
