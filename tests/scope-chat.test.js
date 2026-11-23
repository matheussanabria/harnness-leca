const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { Readable } = require("node:stream");

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "harness-scope-chat-"));
fs.mkdirSync(path.join(dir, "alfa", "chats"), { recursive: true });
process.env.HARNESS_PROJECTS_DIR = dir;
process.env.HARNESS_CHAT_STORE = "file"; // the .md write is what this test checks
const { apiChatSave } = require("../ui/server/controllers/chat.controller");
test.after(() => fs.rmSync(dir, { recursive: true, force: true }));

async function save(body) {
  const req = Readable.from([Buffer.from(JSON.stringify(body))]);
  let status = 0;
  let out = "";
  const res = { writeHead: (s) => { status = s; }, setHeader() {}, end: (b) => { out = String(b || ""); } };
  await apiChatSave({ req, res });
  return { status, json: JSON.parse(out) };
}

const turns = [{ role: "user", text: "ola" }, { role: "assistant", text: "oi" }];

test("a chat saved without a project lands in projects/_pessoal/chats", async () => {
  const { status, json } = await save({ slug: "_pessoal", engine: "claude", title: "Conversa solta", turns, sessionId: "s-1" });
  assert.equal(status, 200, JSON.stringify(json));
  assert.ok(fs.existsSync(path.join(dir, "_pessoal", "chats", json.fileName)));
});

test("a chat saved in a real project is unchanged", async () => {
  const { status, json } = await save({ slug: "alfa", engine: "claude", title: "No projeto", turns, sessionId: "s-2" });
  assert.equal(status, 200, JSON.stringify(json));
  assert.ok(fs.existsSync(path.join(dir, "alfa", "chats", json.fileName)));
});

test("reserved and unknown slugs are still rejected", async () => {
  assert.equal((await save({ slug: "_template", engine: "claude", title: "x", turns })).status, 404);
  assert.equal((await save({ slug: "nao-existe", engine: "claude", title: "x", turns })).status, 404);
});
