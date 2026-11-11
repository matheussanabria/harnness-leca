// @ts-check
// Regression: the chat is a modal <dialog> (top layer), so the autocomplete popover must be
// appended inside it, otherwise it renders behind the dialog and is invisible.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const { pathToFileURL } = require("url");

function fakeEl(tag) {
  return {
    tag, id: "", className: "", hidden: true, style: {}, innerHTML: "", parentElement: null, children: [],
    appendChild(child) { child.parentElement = this; this.children.push(child); return child; },
    getBoundingClientRect() { return { left: 10, width: 300, top: 400 }; },
  };
}

test("popover is appended inside the closest dialog, not the body", async () => {
  const body = fakeEl("body");
  const dialog = fakeEl("dialog");
  const input = Object.assign(fakeEl("textarea"), { id: "chatInput", value: "/work", closest: (sel) => (sel === "dialog" ? dialog : null) });
  const listeners = {};
  /** @type {any} */ (globalThis).document = {
    body,
    createElement: fakeEl,
    getElementById: (id) => [...body.children, ...dialog.children].find((e) => e.id === id) || null,
    addEventListener: (name, fn) => { listeners[name] = fn; },
  };
  /** @type {any} */ (globalThis).window = { innerHeight: 800 };
  /** @type {any} */ (globalThis).fetch = async () => ({
    ok: true,
    json: async () => ({ commands: [{ command: "/workflows", description: "x" }], workflows: [] }),
  });

  const mod = await import(pathToFileURL(path.join(__dirname, "..", "ui", "public", "js", "modules", "chat-workflow-suggest.js")).href);
  mod.installWorkflowSuggest();
  await listeners.input({ target: input });

  const box = dialog.children.find((e) => e.id === "wfSuggest");
  assert.ok(box, "popover must live inside the dialog");
  assert.equal(body.children.some((e) => e.id === "wfSuggest"), false, "popover must not be on the body");
  assert.equal(box.hidden, false);
});
