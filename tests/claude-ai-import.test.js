// Import of a claude.ai data export from the UI: zip reader, export locator and the list/import endpoints.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const zlib = require("zlib");
const { Readable } = require("stream");

// Temp root BEFORE loading tools/ (root.js reads HARNESS_ROOT once).
const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "harness-cai-"));
process.env.HARNESS_ROOT = TMP_ROOT;
for (const p of ["_template/chats", "demo/chats", "outro/chats"]) fs.mkdirSync(path.join(TMP_ROOT, "projects", p), { recursive: true });
test.after(() => fs.rmSync(TMP_ROOT, { recursive: true, force: true }));

const { IMPORTERS } = require("./helpers/fixtures");
const { listZip, extractZip } = require("../tools/lib/zip-read");
const { locateExport } = require("../tools/lib/claude-ai-export");
const ctrl = require("../ui/server/controllers/claude-ai-import.controller");

const CONV_ID = "aaaaaaaa-1111-4222-8333-444444444444";
const DESIGN_ID = "bbbbbbbb-1111-4222-8333-444444444444";

/** Builds a zip (deflate) from { name: string|Buffer }. */
function makeZip(file, entries) {
  const locals = [], cds = [];
  let offset = 0;
  for (const [name, content] of Object.entries(entries)) {
    const raw = Buffer.from(content), comp = zlib.deflateRawSync(raw), nm = Buffer.from(name);
    const crc = zlib.crc32(raw);
    const loc = Buffer.alloc(30);
    loc.writeUInt32LE(0x04034b50, 0); loc.writeUInt16LE(20, 4); loc.writeUInt16LE(8, 8);
    loc.writeUInt32LE(crc, 14); loc.writeUInt32LE(comp.length, 18); loc.writeUInt32LE(raw.length, 22); loc.writeUInt16LE(nm.length, 26);
    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0); cd.writeUInt16LE(20, 4); cd.writeUInt16LE(20, 6); cd.writeUInt16LE(8, 10);
    cd.writeUInt32LE(crc, 16); cd.writeUInt32LE(comp.length, 20); cd.writeUInt32LE(raw.length, 24); cd.writeUInt16LE(nm.length, 28);
    cd.writeUInt32LE(offset, 42);
    locals.push(loc, nm, comp); cds.push(cd, nm);
    offset += 30 + nm.length + comp.length;
  }
  const cdBuf = Buffer.concat(cds), eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(cds.length / 2, 8); eocd.writeUInt16LE(cds.length / 2, 10);
  eocd.writeUInt32LE(cdBuf.length, 12); eocd.writeUInt32LE(offset, 16);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.concat([...locals, cdBuf, eocd]));
}

/** Writes the fixture export as raw zips (what claude.ai hands out) into a fresh folder. */
function zippedExport(t) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "cai-home-"));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  IMPORTERS["claude-ai"].make(home, "Conversa do inventario");
  const src = path.join(home, "export");
  const dir = path.join(home, "downloads");
  makeZip(path.join(dir, "conversations-000.zip"), { "conversations.json": fs.readFileSync(path.join(src, "conversations.json")) });
  makeZip(path.join(dir, "design_chats-000.zip"), { [`${DESIGN_ID}.json`]: fs.readFileSync(path.join(src, "design_chats", `${DESIGN_ID}.json`)) });
  makeZip(path.join(dir, "memories-000.zip"), { "memories.json": "[]" });
  return { home, src, dir };
}

async function call(handler, body, params = []) {
  const req = Readable.from([JSON.stringify(body)]);
  const res = { headersSent: false, writableEnded: false, code: 0, body: null,
    writeHead(c) { this.code = c; }, end(b) { this.body = JSON.parse(String(b)); this.writableEnded = true; } };
  await handler({ req, res, params });
  return res;
}

const chats = (slug) => fs.readdirSync(path.join(TMP_ROOT, "projects", slug, "chats"));

test("CP-01: the zip reader lists and extracts deflate entries and blocks zip-slip names", (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cai-zip-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const zip = path.join(dir, "a.zip");
  makeZip(zip, { "x/ok.json": '{"a":1}', "../evil.txt": "no" });
  assert.deepEqual(listZip(zip).map((e) => e.name), ["x/ok.json", "../evil.txt"]);
  const written = extractZip(zip, path.join(dir, "out"));
  assert.equal(written.length, 1);
  assert.equal(fs.readFileSync(path.join(dir, "out", "x", "ok.json"), "utf8"), '{"a":1}');
  assert.equal(fs.existsSync(path.join(dir, "evil.txt")), false);
});

test("CP-02: the locator accepts the folder with raw zips, one of the zips or the extracted folder", (t) => {
  const { src, dir } = zippedExport(t);
  for (const input of [dir, path.join(dir, "conversations-000.zip"), `"${dir}"`]) {
    const found = locateExport(input);
    assert.equal(found.convFiles.length, 1, input);
    assert.equal(found.designDirs.length, 1, input);
  }
  assert.equal(locateExport(src).convFiles.length, 1);
  assert.throws(() => locateExport(path.join(dir, "memories-000.zip")), /export folder/);
});

test("CP-03: list returns the export chats and marks the ones already imported", async (t) => {
  const { dir } = zippedExport(t);
  const r = await call(ctrl.apiClaudeAiList, { exportPath: dir });
  assert.equal(r.code, 200);
  assert.equal(r.body.total, 2);
  const conv = r.body.items.find((i) => i.id === CONV_ID);
  assert.equal(conv.kind, "chat");
  assert.equal(conv.title, "Conversa do inventario");
  assert.deepEqual(conv.importedIn, []);
  assert.equal(r.body.items.find((i) => i.id === DESIGN_ID).project, "Framework de componentes");

  const imp = await call(ctrl.apiClaudeAiImport, { exportPath: dir, ids: [CONV_ID] }, ["demo"]);
  assert.equal(imp.code, 200);
  const again = await call(ctrl.apiClaudeAiList, { exportPath: dir });
  assert.deepEqual(again.body.items.find((i) => i.id === CONV_ID).importedIn, ["demo"]);
  assert.deepEqual(again.body.items.find((i) => i.id === DESIGN_ID).importedIn, []);
});

test("CP-04: import writes only the picked chats into the chosen project; re-import reports no change", async (t) => {
  const { dir } = zippedExport(t);
  const r = await call(ctrl.apiClaudeAiImport, { exportPath: dir, ids: [DESIGN_ID], withTools: false }, ["outro"]);
  assert.equal(r.code, 200);
  assert.equal(r.body.nova, 1);
  assert.match(r.body.mensagem, /1 conversa/);
  assert.deepEqual(chats("outro").filter((n) => n.endsWith("-bbbbbbbb.md")).length, 1);
  assert.equal(chats("outro").some((n) => n.endsWith("-aaaaaaaa.md")), false);
  const again = await call(ctrl.apiClaudeAiImport, { exportPath: dir, ids: [DESIGN_ID], withTools: false }, ["outro"]);
  assert.equal(again.body.igual, 1);
});

test("CP-05: errors come back as 4xx with a readable message", async (t) => {
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), "cai-empty-"));
  t.after(() => fs.rmSync(empty, { recursive: true, force: true }));
  const { dir } = zippedExport(t);
  assert.equal((await call(ctrl.apiClaudeAiList, { exportPath: "" })).code, 400);
  const none = await call(ctrl.apiClaudeAiList, { exportPath: empty });
  assert.equal(none.code, 400);
  assert.match(none.body.error, /conversations/);
  assert.equal((await call(ctrl.apiClaudeAiImport, { exportPath: dir, ids: [] }, ["demo"])).code, 400);
  assert.equal((await call(ctrl.apiClaudeAiImport, { exportPath: dir, ids: ["../x"] }, ["demo"])).code, 400);
  assert.equal((await call(ctrl.apiClaudeAiImport, { exportPath: dir, ids: [CONV_ID] }, ["nao-existe"])).code, 404);
  const miss = await call(ctrl.apiClaudeAiImport, { exportPath: dir, ids: ["cccccccc"] }, ["demo"]);
  assert.equal(miss.code, 400);
  assert.match(miss.body.error, /Nada casou/);
});
