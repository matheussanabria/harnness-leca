const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const { pathToFileURL } = require("url");

const load = () => import(pathToFileURL(path.resolve(__dirname, "..", "ui", "public", "js", "modules", "prototype-history-model.js")).href);

test("historyShortcut: Ctrl/Cmd+Z desfaz, Ctrl+Shift+Z e Ctrl+Y refazem, resto é ignorado", async () => {
  const { historyShortcut } = await load();
  assert.equal(historyShortcut({ key: "z", ctrlKey: true }), "undo");
  assert.equal(historyShortcut({ key: "Z", metaKey: true }), "undo");
  assert.equal(historyShortcut({ key: "z", ctrlKey: true, shiftKey: true }), "redo");
  assert.equal(historyShortcut({ key: "y", ctrlKey: true }), "redo");
  assert.equal(historyShortcut({ key: "y", ctrlKey: true, shiftKey: true }), null);
  assert.equal(historyShortcut({ key: "z" }), null);
  assert.equal(historyShortcut({ key: "z", ctrlKey: true, altKey: true }), null);
});

test("isEditableTarget: campos de texto mantêm o Ctrl+Z nativo", async () => {
  const { isEditableTarget } = await load();
  assert.equal(isEditableTarget({ tagName: "INPUT" }), true);
  assert.equal(isEditableTarget({ tagName: "textarea" }), true);
  assert.equal(isEditableTarget({ tagName: "DIV", isContentEditable: true }), true);
  assert.equal(isEditableTarget({ tagName: "DIV" }), false);
  assert.equal(isEditableTarget(null), false);
});

test("historyRows: mais recente primeiro, marca atual e futuro", async () => {
  const { historyRows, timeAgo } = await load();
  const now = Date.parse("2026-10-23T12:00:00Z");
  const data = {
    cursor: 1,
    entries: [
      { index: 0, label: "Estado inicial", kind: "baseline", ts: "2026-10-23T11:00:00Z" },
      { index: 1, label: "Mover botão", kind: "structure", ts: "2026-10-23T11:55:00Z", changed: ["screens/home.html"] },
      { index: 2, label: "Mudar cor", kind: "edit", ts: "2026-10-23T11:59:50Z", changed: ["a", "b"] },
    ],
  };
  const rows = historyRows(data, now);
  assert.deepEqual(rows.map((r) => r.index), [2, 1, 0]);
  assert.equal(rows[0].future, true);
  assert.equal(rows[1].current, true);
  assert.equal(rows[1].files, "home.html");
  assert.equal(rows[0].files, "2 arquivos");
  assert.equal(rows[1].when, "há 5 min");
  assert.equal(timeAgo(now - 1000, now), "agora");
});

test("historyRows: ponto nomeado vira estrela", async () => {
  const { historyRows } = await load();
  const rows = historyRows({ cursor: 0, entries: [{ index: 0, label: "Alterar estilo", kind: "edit", ts: "2026-10-23T11:00:00Z", checkpoint: "Antes da Nova prescrição" }] });
  assert.equal(rows[0].checkpoint, "Antes da Nova prescrição");
  assert.equal(rows[0].icon, "fa-star");
});

test("moveToast: mensagens por ação", async () => {
  const { moveToast } = await load();
  assert.equal(moveToast("undo", "X"), "Desfeito: X");
  assert.equal(moveToast("redo", "X"), "Refeito: X");
  assert.equal(moveToast("goto", "X"), "Voltou para: X");
});
