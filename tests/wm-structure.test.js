// @ts-check
import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

async function jsFiles(dir) {
  const entries = await readdir(new URL(dir, root), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) files.push(...await jsFiles(path));
    else if (entry.name.endsWith(".js")) files.push(path);
  }
  return files;
}

test("EP-01.11: nenhum window.confirm permanece em ui/public/js", async () => {
  const files = await jsFiles("ui/public/js");
  for (const file of files) {
    const source = await read(file);
    assert.doesNotMatch(source, /window\.confirm\s*\(/, `${file} ainda usa window.confirm`);
  }
});

test("EP-01.11: arquivos do window-manager respeitam o limite de 300 linhas", async () => {
  const files = await jsFiles("ui/public/js/window-manager");
  for (const file of files) {
    const source = await read(file);
    assert.ok(source.split(/\r?\n/).length <= 300, `${file} passou de 300 linhas`);
  }
});

test("EP-01.11: novos arquivos da fiação não usam emoji", async () => {
  const files = [
    "ui/public/js/window-manager/wm-bootstrap.js",
    "ui/public/js/window-manager/window-store-focus.js",
    "ui/public/js/window-manager/window-store-instance.js",
    "ui/public/js/shared/unsaved-dialog.js",
    "ui/public/js/shared/confirm-dialog.js",
    "ui/public/js/office/office-wm-controller.js",
    "ui/public/js/office/workspace-menu.js"
  ];
  for (const file of files) {
    assert.doesNotMatch(await read(file), EMOJI, `${file} contém emoji`);
  }
});
