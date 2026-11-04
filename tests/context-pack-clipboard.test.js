// Clipboard helper (ui/web/src/features/context-pack/clipboard.ts). Node strips types, so the .ts source loads directly.
const test = require("node:test");
const assert = require("node:assert/strict");
const { pathToFileURL } = require("node:url");
const path = require("node:path");

const dir = path.join(__dirname, "..", "ui", "web", "src", "features", "context-pack");
const load = (name) => import(pathToFileURL(path.join(dir, name)).href);

/** Minimal document stub: records the textarea lifecycle and the execCommand result. */
function fakeDocument(execResult = true, execThrows = false) {
  const state = { value: null, appended: 0, removed: 0, execCalls: 0, focused: false, selected: false };
  const body = {
    appendChild(node) {
      state.appended += 1;
      state.value = node.value;
      return node;
    },
    removeChild(node) {
      state.removed += 1;
      state.value = null;
      return node;
    },
  };
  const document = {
    body,
    createElement() {
      return {
        value: "",
        style: {},
        setAttribute() {},
        focus() {
          state.focused = true;
        },
        select() {
          state.selected = true;
        },
      };
    },
    execCommand(command) {
      state.execCalls += 1;
      if (execThrows) throw new Error("copy blocked");
      assert.equal(command, "copy");
      return execResult;
    },
  };
  return { document, state };
}

test("modern path: navigator.clipboard.writeText succeeds", async () => {
  const { copyText } = await load("clipboard.ts");
  const { document, state } = fakeDocument();
  const calls = [];
  const navigator = {
    clipboard: {
      writeText(text) {
        calls.push(text);
        return Promise.resolve();
      },
    },
  };

  assert.equal(await copyText("hello", { navigator, document }), true);
  assert.deepEqual(calls, ["hello"]);
  assert.equal(state.execCalls, 0);
  assert.equal(state.appended, 0);
});

test("modern path rejects, then the fallback succeeds", async () => {
  const { copyText } = await load("clipboard.ts");
  const { document, state } = fakeDocument(true);
  const navigator = {
    clipboard: {
      writeText() {
        return Promise.reject(new Error("denied"));
      },
    },
  };

  assert.equal(await copyText("hello", { navigator, document }), true);
  assert.equal(state.execCalls, 1);
  assert.equal(state.appended, 1);
  assert.equal(state.removed, 1);
  assert.equal(state.value, null);
});

test("no navigator.clipboard uses the fallback", async () => {
  const { copyText } = await load("clipboard.ts");
  const { document, state } = fakeDocument(true);

  assert.equal(await copyText("fallback text", { navigator: {}, document }), true);
  assert.equal(state.execCalls, 1);
  assert.equal(state.focused, true);
  assert.equal(state.selected, true);
});

test("fallback failure returns false", async () => {
  const { copyText } = await load("clipboard.ts");
  const { document, state } = fakeDocument(false);

  assert.equal(await copyText("nope", { navigator: {}, document }), false);
  assert.equal(state.execCalls, 1);
  assert.equal(state.removed, 1);
});

test("copyText never throws", async () => {
  const { copyText } = await load("clipboard.ts");
  const { document } = fakeDocument(false, true);

  // The fallback throws inside execCommand.
  assert.equal(await copyText("boom", { navigator: {}, document }), false);

  // The modern path rejects and the fallback throws as well.
  const rejecting = {
    clipboard: {
      writeText() {
        return Promise.reject(new Error("denied"));
      },
    },
  };
  const other = fakeDocument(false, true);
  assert.equal(await copyText("boom", { navigator: rejecting, document: other.document }), false);
});