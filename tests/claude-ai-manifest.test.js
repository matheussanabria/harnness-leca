// claude.ai export manifest: download of the chat zips (fake fetch, no network) and import from the manifest path.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { Readable } = require("stream");

const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "harness-caim-"));
process.env.HARNESS_ROOT = TMP_ROOT;
for (const p of ["_template/chats", "demo/chats"]) fs.mkdirSync(path.join(TMP_ROOT, "projects", p), { recursive: true });
test.after(() => fs.rmSync(TMP_ROOT, { recursive: true, force: true }));

const { IMPORTERS } = require("./helpers/fixtures");
const { makeZip } = require("./helpers/zip");
const manifest = require("../tools/lib/claude-ai-manifest");
const ctrl = require("../ui/server/controllers/claude-ai-import.controller");

const URL_BASE = "https://claude.ai/export/x/download/";

/** Fixture export zipped in memory plus a manifest pointing at fake claude.ai links. */
function setup(t, { createdAt = new Date().toISOString(), host = "claude.ai" } = {}) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "caim-home-"));
  IMPORTERS["claude-ai"].make(home, "Conversa via manifest");
  const src = path.join(home, "export");
  const designName = fs.readdirSync(path.join(src, "design_chats"))[0];
  makeZip(path.join(home, "z", "c.zip"), { "conversations.json": fs.readFileSync(path.join(src, "conversations.json")) });
  makeZip(path.join(home, "z", "d.zip"), { [designName]: fs.readFileSync(path.join(src, "design_chats", designName)) });
  const zips = { conv: fs.readFileSync(path.join(home, "z", "c.zip")), design: fs.readFileSync(path.join(home, "z", "d.zip")) };
  const file = (category, id, filename) => ({ category, part: 0, filename, export_url: `https://${host}/export/x/download/${id}` });
  const m = { created_at: createdAt, version: "1.0", data_files: [
    file("memories", "mem", "memories-000.zip"), file("conversations", "conv", "conversations-000.zip"), file("design_chats", "design", "design_chats-000.zip"),
  ] };
  const mpath = path.join(home, `manifest-test-${Date.now()}-${Math.random().toString(16).slice(2)}.json`);
  fs.writeFileSync(mpath, JSON.stringify(m));
  t.after(() => {
    try { fs.rmSync(manifest.readManifest(mpath).dir, { recursive: true, force: true }); } catch { /* invalid manifest */ }
    fs.rmSync(home, { recursive: true, force: true });
  });
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    const id = url.slice(URL_BASE.length);
    return new Response(Readable.toWeb(Readable.from([zips[id]])), { status: 200, headers: { "content-type": "application/zip" } });
  };
  return { home, mpath, calls, fetchImpl };
}

test("CP-07: the manifest downloads only the conversations and design zips, once", async (t) => {
  const { mpath, calls, fetchImpl } = setup(t);
  assert.equal(manifest.isManifest(mpath), true);
  assert.equal(manifest.manifestDir(mpath), null);
  const dir = await manifest.downloadManifest(mpath, { fetchImpl });
  assert.deepEqual(calls.map((u) => u.slice(URL_BASE.length)).sort(), ["conv", "design"]);
  assert.deepEqual(fs.readdirSync(dir).sort(), ["conversations-000.zip", "design_chats-000.zip"]);
  await manifest.downloadManifest(mpath, { fetchImpl });
  assert.equal(calls.length, 2, "a cached file is never fetched again (links may be single-use)");
});

test("CP-08: the dialog accepts the manifest path (also quoted) and imports from it", async (t) => {
  const { mpath, fetchImpl } = setup(t);
  ctrl.deps.fetch = fetchImpl;
  t.after(() => { ctrl.deps.fetch = (...a) => fetch(...a); });
  const call = async (handler, body, params = []) => {
    const res = { code: 0, body: null, headersSent: false, writableEnded: false,
      writeHead(c) { this.code = c; }, end(b) { this.body = JSON.parse(String(b)); } };
    await handler({ req: Readable.from([JSON.stringify(body)]), res, params });
    return res;
  };
  const list = await call(ctrl.apiClaudeAiList, { exportPath: `"${mpath}"` });
  assert.equal(list.code, 200, JSON.stringify(list.body));
  assert.equal(list.body.total, 2);
  const id = list.body.items.find((i) => i.kind === "chat").id;
  const imp = await call(ctrl.apiClaudeAiImport, { exportPath: mpath, ids: [id] }, ["demo"]);
  assert.equal(imp.code, 200, JSON.stringify(imp.body));
  assert.equal(imp.body.nova, 1);
});

test("CP-09: the manifest zip wrapper is accepted", async (t) => {
  const { home, mpath, fetchImpl } = setup(t);
  const wrapped = path.join(home, path.basename(mpath).replace(/\.json$/, ".zip"));
  makeZip(wrapped, { [path.basename(mpath)]: fs.readFileSync(mpath) });
  assert.equal(manifest.isManifest(wrapped), true);
  const dir = await manifest.downloadManifest(wrapped, { fetchImpl });
  assert.equal(fs.readdirSync(dir).length, 2);
});

test("CP-10: refused, expired, non-zip or foreign links fail with a readable message and leave no file", async (t) => {
  const old = setup(t, { createdAt: new Date(Date.now() - 48 * 3600000).toISOString() });
  const deny = async () => new Response("no", { status: 403 });
  await assert.rejects(manifest.downloadManifest(old.mpath, { fetchImpl: deny }), /HTTP 403.*gere um export novo/);
  assert.equal(manifest.manifestDir(old.mpath), null);

  const html = setup(t);
  const page = async () => new Response("<html></html>", { status: 200, headers: { "content-type": "text/html" } });
  await assert.rejects(manifest.downloadManifest(html.mpath, { fetchImpl: page }), /página em vez do zip/);
  const junk = async () => new Response("not a zip", { status: 200, headers: { "content-type": "application/octet-stream" } });
  await assert.rejects(manifest.downloadManifest(html.mpath, { fetchImpl: junk }), /não é um zip/);
  assert.deepEqual(fs.readdirSync(manifest.readManifest(html.mpath).dir), []);

  const foreign = setup(t, { host: "evil.example" });
  assert.throws(() => manifest.readManifest(foreign.mpath), /fora do claude.ai/);
});
