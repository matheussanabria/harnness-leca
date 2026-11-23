// Codex leg of the conversation sync: cwd -> project mapping, import, idempotency and the 4-engine list.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

// Temporary root BEFORE loading anything from tools/: root.js reads HARNESS_ROOT once, at load time.
const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "harness-codex-sync-"));
process.env.HARNESS_ROOT = TMP_ROOT;
for (const p of ["_template/chats", "demo/chats", "other/chats"]) fs.mkdirSync(path.join(TMP_ROOT, "projects", p), { recursive: true });
test.after(() => fs.rmSync(TMP_ROOT, { recursive: true, force: true }));

const { matchers } = require("../tools/lib/projects");
const { codexSessionsBySlug, syncCodexFiles } = require("../tools/lib/sync-codex");
const { SYNC_ENGINES } = require("../tools/lib/sync-core");
const { sessionCwd } = require("../tools/import-codex-chats");

const SESSION_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "codex-sessions-"));
test.after(() => fs.rmSync(SESSION_DIR, { recursive: true, force: true }));
const chatsOf = (slug) => path.join(TMP_ROOT, "projects", slug, "chats");

function session(name, { cwd, id, first = "2026-11-20T10:00:00.000Z", last = "2026-11-20T10:05:00.000Z" }) {
  const line = (o) => JSON.stringify(o);
  const msg = (role, type, text, timestamp) => line({ timestamp, type: "response_item", payload: { type: "message", role, content: [{ type, text }] } });
  const body = [
    line({ timestamp: first, type: "session_meta", payload: { id, cwd, timestamp: first } }),
    msg("user", "input_text", "Quero sincronizar os motores", first),
    msg("assistant", "output_text", "Feito, sincronizando.", last),
  ];
  const file = path.join(SESSION_DIR, name);
  fs.writeFileSync(file, `${body.join("\n")}\n`);
  return file;
}

test("SYNC_ENGINES lists the four engines, codex included", () => {
  assert.deepEqual(SYNC_ENGINES, ["claude", "gemini", "opencode", "codex"]);
});

test("sessionCwd reads the cwd from the first line only", () => {
  const f = session("cwd.jsonl", { cwd: "C:\\work\\demo", id: "11111111-1111-1111-1111-111111111111" });
  assert.equal(sessionCwd(f), "C:\\work\\demo");
  assert.equal(sessionCwd(path.join(SESSION_DIR, "missing.jsonl")), "");
});

test("sessions are grouped by project through the cwd; unknown or empty cwd is reported, not assigned", () => {
  const demo = session("a.jsonl", { cwd: "C:\\git\\demo", id: "22222222-2222-2222-2222-222222222222" });
  const other = session("b.jsonl", { cwd: "C:\\git\\other", id: "33333333-3333-3333-3333-333333333333" });
  const stray = session("c.jsonl", { cwd: "C:\\git\\nowhere", id: "44444444-4444-4444-4444-444444444444" });
  const nocwd = session("d.jsonl", { cwd: "", id: "55555555-5555-5555-5555-555555555555" });
  const { bySlug, unmatched } = codexSessionsBySlug(matchers(), { files: [demo, other, stray, nocwd] });
  assert.deepEqual(bySlug.get("demo"), [demo]);
  assert.deepEqual(bySlug.get("other"), [other]);
  assert.equal(bySlug.size, 2);
  assert.deepEqual([...unmatched].sort(), ["(sem cwd)", "nowhere"]);
  assert.ok(!fs.existsSync(path.join(TMP_ROOT, "projects", "nowhere")), "no project is created for unmatched sessions");
});

test("import writes agent codex, keeps the conversation date, and a second run changes nothing", () => {
  const f = session("e.jsonl", { cwd: "C:\\git\\demo", id: "66666666-6666-6666-6666-666666666666" });

  assert.deepEqual(syncCodexFiles("demo", [f], true).n, { nova: 1, atualizada: 0, igual: 0 });
  assert.equal(fs.readdirSync(chatsOf("demo")).length, 0, "dry-run writes nothing");

  assert.deepEqual(syncCodexFiles("demo", [f]).n, { nova: 1, atualizada: 0, igual: 0 });
  const [name] = fs.readdirSync(chatsOf("demo"));
  const text = fs.readFileSync(path.join(chatsOf("demo"), name), "utf8");
  assert.match(text, /agente: "codex"/);
  assert.match(text, /fim: 2026-11-20T10:05:00/);

  const before = fs.statSync(path.join(chatsOf("demo"), name)).mtimeMs;
  assert.deepEqual(syncCodexFiles("demo", [f]).n, { nova: 0, atualizada: 0, igual: 1 });
  assert.equal(fs.statSync(path.join(chatsOf("demo"), name)).mtimeMs, before, "idempotent run does not touch the file");
});

test("a project with no Codex sessions reports zeros without error", () => {
  assert.deepEqual(syncCodexFiles("other", []), { ok: true, n: { nova: 0, atualizada: 0, igual: 0 }, err: "" });
});
