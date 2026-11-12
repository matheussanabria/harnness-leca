const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const code = fs.readFileSync(path.resolve(__dirname, "..", "ui", "public", "js", "modules", "prototype-bridge-flags.js"), "utf8");

function setup() {
  const attrs = new Map();
  const el = {
    getAttribute: (n) => (attrs.has(n) ? attrs.get(n) : null),
    setAttribute: (n, v) => attrs.set(n, v),
    removeAttribute: (n) => attrs.delete(n),
  };
  attrs.set("data-pid", "p-7");
  const sent = [];
  let trees = 0;
  let listener = null;
  const win = {
    top: {},
    __harnessBridge: { send: (type, payload) => sent.push({ type, ...payload }), find: (id) => (id === "p-7" ? el : null), sendTree: () => { trees += 1; } },
    addEventListener: (_t, fn) => { listener = fn; },
  };
  vm.runInNewContext(code, { window: win });
  return { el, attrs, sent, post: (data) => listener({ data }), trees: () => trees };
}

test("CP-hide: o olho liga e desliga data-hidden e avisa o Ateliê para gravar", () => {
  const { attrs, sent, post, trees } = setup();
  post({ type: "HARNESS_PROTO_TOGGLE_VISIBILITY", pid: "p-7" });
  assert.equal(attrs.get("data-hidden"), "true");
  assert.deepEqual(sent.at(-1), { type: "HARNESS_PROTO_FLAG", pid: "p-7", name: "data-hidden", value: "true" });
  post({ type: "HARNESS_PROTO_TOGGLE_VISIBILITY", pid: "p-7" });
  assert.equal(attrs.has("data-hidden"), false);
  assert.equal(sent.at(-1).value, "");
  assert.equal(trees(), 2);
});

test("CP-hide: o cadeado usa data-locked e mensagens de outros tipos ou de elementos inexistentes são ignoradas", () => {
  const { attrs, sent, post } = setup();
  post({ type: "HARNESS_PROTO_TOGGLE_LOCK", pid: "p-7" });
  assert.equal(attrs.get("data-locked"), "true");
  post({ type: "HARNESS_PROTO_TOGGLE_LOCK", pid: "nao-existe" });
  post({ type: "HARNESS_PROTO_SELECT", pid: "p-7" });
  post(null);
  assert.equal(sent.length, 1);
});

test("CP-hide: o script faz parte da ponte carregada no iframe", () => {
  const src = fs.readFileSync(path.resolve(__dirname, "..", "ui", "server", "services", "prototype-sandbox-common.service.js"), "utf8");
  assert.match(src, /"prototype-bridge-flags\.js"/);
});
