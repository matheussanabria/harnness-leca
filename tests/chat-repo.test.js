// EP-17.02: chat conversations repository (migration 002) on an in-memory database.
const test = require("node:test");
const assert = require("node:assert/strict");

const { createTestDatabase } = require("../ui/server/db/connection");
const { createChatRepo } = require("../ui/server/db/repos/chat.repo");

function fixture() {
  const db = createTestDatabase();
  return { db, repo: createChatRepo(db) };
}

test("seq is assigned by the server, unique and monotonic across appends", () => {
  const { db, repo } = fixture();
  try {
    const c = repo.createConversation({ projectId: "p", title: "t" });
    assert.deepEqual(repo.appendMessages(c.id, [{ role: "user", content: "a" }, { role: "assistant", engine: "claude", content: "b" }]), [0, 1]);
    assert.deepEqual(repo.appendMessages(c.id, [{ role: "user", content: "c" }]), [2]);
    // Interleaved appends from two callers (the web server handles requests one at a time per connection).
    for (let i = 0; i < 20; i++) repo.appendMessages(c.id, [{ role: i % 2 ? "assistant" : "user", content: String(i) }]);
    const seqs = repo.readMessages(c.id, { limit: 1000 }).map((m) => m.seq);
    assert.deepEqual(seqs, Array.from({ length: 23 }, (_, i) => i));
    assert.equal(repo.countMessages(c.id), 23);
  } finally {
    db.close();
  }
});

test("a duplicate seq is refused by the database", () => {
  const { db, repo } = fixture();
  try {
    const c = repo.createConversation({ projectId: "p" });
    repo.appendMessages(c.id, [{ role: "user", content: "a" }]);
    assert.throws(() => db.prepare("INSERT INTO chat_messages (conversation_id, seq, role, content, created_at) VALUES (?, 0, 'user', 'x', 'now')").run(c.id), /UNIQUE/);
  } finally {
    db.close();
  }
});

test("messages page by seq", () => {
  const { db, repo } = fixture();
  try {
    const c = repo.createConversation({ projectId: "p" });
    repo.appendMessages(c.id, Array.from({ length: 5 }, (_, i) => ({ role: "user", content: `m${i}`, toolEvents: i === 0 ? [{ name: "Read" }] : undefined })));
    assert.deepEqual(repo.readMessages(c.id, { after: 1, limit: 2 }).map((m) => m.content), ["m2", "m3"]);
    assert.deepEqual(repo.readMessages(c.id, { limit: 1 })[0].toolEvents, [{ name: "Read" }]);
  } finally {
    db.close();
  }
});

test("ensureForFile is idempotent per project and file", () => {
  const { db, repo } = fixture();
  try {
    const a = repo.ensureForFile("p", "x.md", { title: "X" });
    const b = repo.ensureForFile("p", "x.md");
    const other = repo.ensureForFile("q", "x.md");
    assert.equal(a.id, b.id);
    assert.notEqual(a.id, other.id);
    assert.equal(a.title, "X");
  } finally {
    db.close();
  }
});

test("one engine session per conversation and engine; the latest wins", () => {
  const { db, repo } = fixture();
  try {
    const c = repo.createConversation({ projectId: "p" });
    repo.setEngineSession(c.id, "opencode", "ses_1");
    repo.setEngineSession(c.id, "opencode", "ses_2");
    repo.setEngineSession(c.id, "claude", "cl_1", "expired");
    const sessions = repo.getEngineSessions(c.id);
    assert.deepEqual(sessions.map((s) => [s.engine, s.engineSessionId, s.status]), [["claude", "cl_1", "expired"], ["opencode", "ses_2", "active"]]);
  } finally {
    db.close();
  }
});

test("list is newest activity first; archive hides; rename keeps the id", () => {
  const { db, repo } = fixture();
  try {
    const old = repo.createConversation({ projectId: "p", title: "old" });
    const recent = repo.createConversation({ projectId: "p", title: "recent" });
    db.prepare("UPDATE chat_conversations SET updated_at = '2026-01-01T00:00:00.000Z'").run(); // both older than the append
    repo.appendMessages(old.id, [{ role: "user", content: "back to the old one" }]);
    assert.deepEqual(repo.listConversations("p").map((c) => c.title), ["old", "recent"]);
    repo.updateConversation(recent.id, { archived: true, title: "renamed" });
    assert.deepEqual(repo.listConversations("p").map((c) => c.title), ["old"]);
    assert.deepEqual(repo.listConversations("p", { includeArchived: true }).map((c) => c.title).sort(), ["old", "renamed"]);
    assert.equal(repo.updateConversation(recent.id, { archived: false }).archivedAt, null);
  } finally {
    db.close();
  }
});
