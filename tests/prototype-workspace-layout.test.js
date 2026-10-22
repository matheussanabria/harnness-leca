// @ts-check
import test from "node:test";
import assert from "node:assert/strict";

const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value))
};

const { setPanelCollapsed, applyAllWidths } = await import("../ui/public/js/modules/prototype-workspace-layout.js");

function fakeRoot() {
  const cols = {};
  return {
    cols,
    querySelector: (sel) => {
      const name = sel.replace(".proto-col-", "");
      cols[name] ||= {
        collapsed: false,
        style: {},
        classList: { toggle(_c, on) { cols[name].collapsed = on; } }
      };
      return cols[name];
    }
  };
}

test("Ateliê: minimizar o chat recolhe a coluna e é idempotente", () => {
  const root = fakeRoot();
  applyAllWidths(root);
  setPanelCollapsed(root, "chat", true);
  assert.equal(root.cols.chat.collapsed, true);
  assert.equal(root.cols.chat.style.width, "36px");

  setPanelCollapsed(root, "chat", true);
  assert.equal(root.cols.chat.collapsed, true, "Segunda chamada não deve reexpandir");

  setPanelCollapsed(root, "chat", false);
  assert.equal(root.cols.chat.collapsed, false);
});
