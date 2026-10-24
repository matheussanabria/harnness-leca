// @ts-check
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("EP-01.11: CSS responsivo usa os seletores reais da taskbar e da gaveta", async () => {
  const css = await read("ui/public/css/office/14-responsive-wm.css");

  assert.match(css, /\.window-taskbar\b/);
  assert.match(css, /\.office-drawer\.floating\b/);
  assert.match(css, /\.drawer-actions button\b/);
  assert.doesNotMatch(css, /\.dai-taskbar\b/);
  assert.doesNotMatch(css, /\.floating-window\b/);
  assert.doesNotMatch(css, /\.drawer-header-actions\b/);
});

test("EP-01.11: office.html tem o ponto de montagem do menu e importa o CSS parcial", async () => {
  const html = await read("ui/public/office.html");
  const officeCss = await read("ui/public/css/office.css");

  assert.match(html, /id="workspaceMenu"/);
  assert.match(officeCss, /19-workspace-menu\.css/);
});

test("EP-01.11: office-app.js não cresce além do tamanho da história", async () => {
  const source = await read("ui/public/js/office-app.js");
  assert.ok(source.split(/\r?\n/).length <= 287, "Fachada do escritório deve permanecer enxuta");
});
