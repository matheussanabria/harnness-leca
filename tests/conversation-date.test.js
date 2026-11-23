// Canonical conversation date (fim -> inicio -> mtime) and the Diario order (most recent first).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

// Temporary roots BEFORE loading modules: root.js and config.js read these variables when loaded.
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "harness-convdate-"));
process.env.HARNESS_ROOT = TMP;
process.env.HARNESS_PROJECTS_DIR = path.join(TMP, "projects");
const CHATS = path.join(TMP, "projects", "demo", "chats");
fs.mkdirSync(CHATS, { recursive: true });
test.after(() => fs.rmSync(TMP, { recursive: true, force: true }));

const { listDir, activityMs } = require("../ui/server/services/project.service");
const journal = require("../tools/daily-journal");

function chat(name, { inicio = "", fim = "", agente = "claude", prompt = "pedido" }, mtime) {
  const file = path.join(CHATS, name);
  fs.writeFileSync(file, `---\ntitulo: "${name}"\nsessao: ${name}\norigem: "x"\ninicio: ${inicio}\nfim: ${fim}\nagente: "${agente}"\n---\n\n# ${name}\n\n## Você\n\n${prompt}\n`);
  if (mtime) fs.utimesSync(file, new Date(mtime), new Date(mtime));
  return file;
}
const SYNC_DAY = "2026-11-23T12:00:00.000Z"; // file mtime that a sync would leave behind

test("conversationAt uses fim, then inicio, then the file mtime", () => {
  chat("a-fim.md", { inicio: "2026-11-10T10:00:00Z", fim: "2026-11-10T11:00:00Z" }, SYNC_DAY);
  chat("b-inicio.md", { inicio: "2026-11-12T10:00:00Z" }, SYNC_DAY);
  chat("c-legado.md", {}, "2026-11-01T09:00:00.000Z");
  const by = Object.fromEntries(listDir(CHATS).map((c) => [c.name, c.conversationAt]));
  assert.equal(by["a-fim.md"], Date.parse("2026-11-10T11:00:00Z"));
  assert.equal(by["b-inicio.md"], Date.parse("2026-11-12T10:00:00Z"));
  assert.equal(by["c-legado.md"], Date.parse("2026-11-01T09:00:00.000Z"));
});

test("a sync that rewrites the file mtime does not move the conversation in the list", () => {
  const before = listDir(CHATS).map((c) => c.name);
  // The sync rewrites files that carry metadata; a legacy file without dates keeps its mtime as the only date it has.
  for (const f of fs.readdirSync(CHATS).filter((n) => n !== "c-legado.md")) fs.utimesSync(path.join(CHATS, f), new Date(SYNC_DAY), new Date(SYNC_DAY));
  assert.deepEqual(listDir(CHATS).map((c) => c.name), before);
  assert.deepEqual(before, ["b-inicio.md", "a-fim.md", "c-legado.md"]); // newest conversation first
});

test("activityMs follows the newest conversation date, not the sync time", () => {
  assert.equal(activityMs("demo"), Date.parse("2026-11-12T10:00:00Z"));
});

test("journal lists days and sessions of a day from the most recent to the oldest", () => {
  fs.rmSync(CHATS, { recursive: true, force: true });
  fs.mkdirSync(CHATS, { recursive: true });
  chat("d1-manha.md", { inicio: "2026-11-20T08:00:00Z", fim: "2026-11-20T08:30:00Z" });
  chat("d1-tarde.md", { inicio: "2026-11-20T15:00:00Z", fim: "2026-11-20T15:30:00Z", agente: "codex" });
  chat("d2-unica.md", { inicio: "2026-11-22T12:00:00Z", fim: "2026-11-22T12:10:00Z" });
  const days = journal.collect("demo");
  assert.deepEqual(days.map((d) => d.day), [...days.map((d) => d.day)].sort().reverse());
  assert.equal(days.length, 2);
  const busy = days.find((d) => d.sessions.length === 2);
  assert.deepEqual(busy.sessions.map((s) => s.file), ["d1-tarde.md", "d1-manha.md"]);
  assert.equal(busy.sessions[0].agente, "codex");
});
