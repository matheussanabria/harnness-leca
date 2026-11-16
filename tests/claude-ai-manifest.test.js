// claude.ai export manifest: the server never downloads the links (they need the user's browser session); it lists
// the missing ones and then picks up the zips the browser saved, ignoring older exports with the same name.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { Readable } = require("stream");

const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "harness-caim-"));
process.env.HARNESS_ROOT = TMP_ROOT;
// Fake home, so ~/Downloads of the machine running the tests is never scanned.
const FAKE_HOME = path.join(TMP_ROOT, "home");
fs.mkdirSync(path.join(FAKE_HOME, "Downloads"), { recursive: true });
process.env.USERPROFILE = FAKE_HOME;
process.env.HOME = FAKE_HOME;
for (const p of ["_template/chats", "demo/chats"]) fs.mkdirSync(path.join(TMP_ROOT, "projects", p), { recursive: true });
const realFetch = global.fetch;
global.fetch = () => { throw new Error("the server must not fetch export links"); };
test.after(() => { global.fetch = realFetch; fs.rmSync(TMP_ROOT, { recursive: true, force: true }); });

const { IMPORTERS } = require("./helpers/fixtures");
const { makeZip } = require("./helpers/zip");
const manifest = require("../tools/lib/claude-ai-manifest");
const ctrl = require("../ui/server/controllers/claude-ai-import.controller");

/** A manifest folder with the fixture export ready to be "downloaded" by the test. */
function setup(t, { host = "claude.ai" } = {}) {
  const folder = fs.mkdtempSync(path.join(TMP_ROOT, "dl-"));
  const src = path.join(folder, "_src");
  IMPORTERS["claude-ai"].make(src, "Conversa via manifest");
  const designName = fs.readdirSync(path.join(src, "export", "design_chats"))[0];
  const file = (category, id, filename) => ({ category, part: 0, filename, export_url: `https://${host}/export/x/download/${id}` });
  const m = { created_at: new Date(Date.now() - 60000).toISOString(), version: "1.0", data_files: [
    file("memories", "mem", "memories-000.zip"), file("design_chats", "design", "design_chats-000.zip"), file("conversations", "conv", "conversations-000.zip"),
  ] };
  const mpath = path.join(folder, `manifest-${path.basename(folder)}.json`);
  fs.writeFileSync(mpath, JSON.stringify(m));
  const save = (name, kind) => {
    const out = path.join(folder, name);
    if (kind === "conv") makeZip(out, { "conversations.json": fs.readFileSync(path.join(src, "export", "conversations.json")) });
    else makeZip(out, { [designName]: fs.readFileSync(path.join(src, "export", "design_chats", designName)) });
    return out;
  };
  t.after(() => { try { fs.rmSync(manifest.readManifest(mpath).dir, { recursive: true, force: true }); } catch { /* foreign host */ } });
  return { folder, mpath, save };
}

async function call(handler, body, params = []) {
  const res = { code: 0, body: null, headersSent: false, writableEnded: false,
    writeHead(c) { this.code = c; }, end(b) { this.body = JSON.parse(String(b)); } };
  await handler({ req: Readable.from([JSON.stringify(body)]), res, params });
  return res;
}

test("CP-07: a manifest without the zips returns only the two chat links and fetches nothing", async (t) => {
  const { mpath } = setup(t);
  const r = await call(ctrl.apiClaudeAiList, { exportPath: mpath });
  assert.equal(r.code, 200);
  assert.equal(r.body.needsDownload, true);
  assert.deepEqual(r.body.missing.map((m) => m.filename).sort(), ["conversations-000.zip", "design_chats-000.zip"]);
  assert.ok(r.body.missing.every((m) => m.url.startsWith("https://claude.ai/")));
  const imp = await call(ctrl.apiClaudeAiImport, { exportPath: mpath, ids: ["aaaaaaaa"] }, ["demo"]);
  assert.equal(imp.code, 400);
  assert.match(imp.body.error, /navegador/);
});

test("CP-08: zips saved by the browser (also renamed with (1)) are found; older ones are ignored", async (t) => {
  const { mpath, save } = setup(t);
  const old = save("conversations-000.zip", "conv");
  const past = new Date(Date.now() - 30 * 24 * 3600000);
  fs.utimesSync(old, past, past);
  save("design_chats-000.zip", "design");
  let r = await call(ctrl.apiClaudeAiList, { exportPath: mpath });
  assert.deepEqual(r.body.missing.map((m) => m.filename), ["conversations-000.zip"], "old export zip does not count");

  save("conversations-000 (1).zip", "conv");
  r = await call(ctrl.apiClaudeAiList, { exportPath: `"${mpath}"` });
  assert.equal(r.code, 200, JSON.stringify(r.body));
  assert.equal(r.body.needsDownload, undefined);
  assert.equal(r.body.total, 2);
  const id = r.body.items.find((i) => i.kind === "chat").id;
  const imp = await call(ctrl.apiClaudeAiImport, { exportPath: mpath, ids: [id] }, ["demo"]);
  assert.equal(imp.code, 200, JSON.stringify(imp.body));
  assert.equal(imp.body.nova, 1);
});

test("CP-09: the manifest zip wrapper is accepted", (t) => {
  const { folder, mpath } = setup(t);
  const wrapped = path.join(folder, path.basename(mpath).replace(/\.json$/, ".zip"));
  makeZip(wrapped, { [path.basename(mpath)]: fs.readFileSync(mpath) });
  assert.equal(manifest.isManifest(wrapped), true);
  assert.equal(manifest.collectManifest(wrapped).missing.length, 2);
});

test("CP-10: links outside claude.ai are refused with a readable message", async (t) => {
  const { mpath } = setup(t, { host: "evil.example" });
  assert.throws(() => manifest.readManifest(mpath), /fora do claude.ai/);
  const r = await call(ctrl.apiClaudeAiList, { exportPath: mpath });
  assert.equal(r.code, 400);
  assert.match(r.body.error, /fora do claude.ai/);
});
