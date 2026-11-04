// @ts-check
// Canvas workspace skeleton (EP-19.06): same ids and classes as the Atelier so its layout helpers and chat dock apply.
import test from "node:test";
import assert from "node:assert/strict";
import { canvasWorkspaceHtml } from "../ui/public/js/modules/design-canvas-workspace.js";

for (const [view, rail, icon] of [["canvas-mindmap", "Mapas mentais", "fa-sitemap"], ["canvas-board", "Quadros", "fa-chalkboard"]]) {
  test(`${view}: three columns with the Atelier ids, resizers and a per-view catalog rail`, () => {
    const html = canvasWorkspaceHtml(view);
    for (const id of ["protoWorkspaceRoot", "canvasCatalogHost", "atelierChatHost", "canvasStage"]) {
      assert.equal(html.split(`id="${id}"`).length, 2, `${id} appears once`);
    }
    for (const cls of ["proto-col-catalog", "proto-col-chat", "proto-col-preview"]) assert.match(html, new RegExp(cls));
    assert.equal((html.match(/class="proto-resizer"/g) || []).length, 2);
    assert.match(html, new RegExp(`${rail}</span>`));
    assert.match(html, new RegExp(icon));
    assert.equal(html.includes("proto-col-inspector"), false, "no inspector column in the canvas views");
  });
}

test("the chat column keeps the minimize and collapse controls of the Atelier", () => {
  const html = canvasWorkspaceHtml("canvas-mindmap");
  assert.match(html, /minimizeCurrentChat\('atelier'\)/);
  assert.match(html, /btn-collapse-panel" data-panel="chat"/);
});

test("new files stay small and use no emoji", async () => {
  const fs = await import("node:fs");
  for (const file of ["design-canvas-workspace.js", "design-canvas-catalog.js", "design-canvas-api.js"]) {
    const text = fs.readFileSync(new URL(`../ui/public/js/modules/${file}`, import.meta.url), "utf8");
    assert.ok(text.split("\n").length <= 300, `${file} has more than 300 lines`);
    assert.equal(/\p{Extended_Pictographic}/u.test(text), false, `${file} has an emoji`);
  }
});
