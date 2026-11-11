// @ts-check
// Chat attachments by clipboard and drag-and-drop: pure helpers and document-level drop delegation.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const { pathToFileURL } = require("url");

const load = () => import(pathToFileURL(path.join(__dirname, "..", "ui", "public", "js", "modules", "chat-attachments-input.js")).href);
const file = (name, type) => ({ name, type });

test("transferHasFiles detects Files in types or files list", async () => {
  const m = await load();
  assert.equal(m.transferHasFiles({ types: ["text/plain"] }), false);
  assert.equal(m.transferHasFiles({ types: ["Files"] }), true);
  assert.equal(m.transferHasFiles({ types: [], files: [file("a.png", "image/png")] }), true);
  assert.equal(m.transferHasFiles(null), false);
});

test("filesFromTransfer falls back to items when files is empty", async () => {
  const m = await load();
  const f = file("x.png", "image/png");
  assert.deepEqual(m.filesFromTransfer({ files: [f] }), [f]);
  const viaItems = { files: [], items: [{ kind: "file", getAsFile: () => f }, { kind: "string", getAsFile: () => null }] };
  assert.deepEqual(m.filesFromTransfer(viaItems), [f]);
  assert.deepEqual(m.filesFromTransfer(null), []);
});

test("pastedFileName renames the generic clipboard image and keeps real names", async () => {
  const m = await load();
  assert.equal(m.pastedFileName(file("image.png", "image/png"), 0, 7), "colado-7-0.png");
  assert.equal(m.pastedFileName(file("", "image/jpeg"), 1, 7), "colado-7-1.jpg");
  assert.equal(m.pastedFileName(file("print.png", "image/png"), 0, 7), "print.png");
  assert.equal(m.droppedFileName(file("foto.jpg", "image/jpeg"), 0, 7), "foto.jpg");
  assert.equal(m.droppedFileName(file("", "image/png"), 2, 7), "colado-7-2.png");
});

function fakeDoc() {
  const handlers = {};
  const active = new Set();
  return {
    handlers, active,
    addEventListener(t, h) { handlers[t] = h; },
    removeEventListener(t) { delete handlers[t]; },
    querySelectorAll() { return [...active].map((z) => ({ classList: { remove: () => active.delete(z) } })); },
  };
}
const inside = {};

test("drop on a composer zone uploads the files and clears the highlight", async () => {
  const m = await load();
  const doc = fakeDoc();
  const z = { classList: { add: () => doc.active.add(z), remove: () => doc.active.delete(z) }, contains: (n) => n === inside };
  const got = [];
  m.bindChatDrop((files) => got.push(...files), /** @type {any} */ (doc));
  const f = file("a.png", "image/png");
  const dt = { types: ["Files"], files: [f] };
  let prevented = 0;
  const ev = { target: { closest: () => z }, dataTransfer: dt, relatedTarget: null, preventDefault: () => prevented++ };
  doc.handlers.dragover(ev);
  assert.equal(doc.active.size, 1);
  assert.equal(dt.dropEffect, "copy");
  doc.handlers.dragleave({ target: { closest: () => z }, relatedTarget: inside });
  assert.equal(doc.active.size, 1, "moving inside the zone keeps the highlight");
  doc.handlers.dragleave({ target: { closest: () => z }, relatedTarget: null });
  assert.equal(doc.active.size, 0);
  doc.handlers.dragover(ev);
  doc.handlers.drop(ev);
  assert.deepEqual(got, [f]);
  assert.equal(doc.active.size, 0);
  assert.equal(prevented, 3);
});

test("drops outside a chat zone or without files are ignored", async () => {
  const m = await load();
  const doc = fakeDoc();
  const got = [];
  m.bindChatDrop((files) => got.push(...files), /** @type {any} */ (doc));
  let prevented = 0;
  const preventDefault = () => prevented++;
  doc.handlers.drop({ target: { closest: () => null }, dataTransfer: { types: ["Files"], files: [file("a", "x")] }, preventDefault });
  doc.handlers.drop({ target: { closest: () => ({ classList: { add() {}, remove() {} } }) }, dataTransfer: { types: ["text/plain"] }, preventDefault });
  assert.deepEqual(got, []);
  assert.equal(prevented, 0);
});
