const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const pub = path.join(__dirname, "..", "ui", "public");
const read = (...p) => fs.readFileSync(path.join(pub, ...p), "utf8").replace(/\r\n/g, "\n");

test("overview sync panel: technical details and log live inside a collapsed <details>", () => {
  const html = read("overview.html");
  const details = html.match(/<details class="sync-details"[\s\S]*?<\/details>/);
  assert.ok(details, "details block");
  assert.ok(!/\sopen[\s>]/.test(details[0].split(">")[0]), "collapsed by default");
  assert.match(details[0], /id="log"/);
  assert.match(details[0], /node tools\/sync\.js/);
  assert.ok(!/node tools\/sync\.js/.test(html.replace(details[0], "")), "command is not shown outside the details");
});

test("overview page has no emojis and announces run state", () => {
  const html = read("overview.html");
  assert.ok(!/[\u{1F300}-\u{1FAFF}☀-➿✱✦◆]/u.test(html), "no emojis or dingbat icons");
  assert.match(html, /id="runState"[^>]*aria-live="polite"/);
  assert.match(html, /id="rowMsg"[^>]*aria-live="polite"/);
});

test("system sync that writes is blocked when the confirmation dialog cannot open", async () => {
  const els = new Map();
  const el = () => ({ innerHTML: "", textContent: "", className: "", value: "", checked: false, disabled: false, hidden: false, open: false, scrollTop: 0, scrollHeight: 0, setAttribute() {} });
  const calls = [];
  const sandbox = {
    $: (id) => { if (!els.has(id)) els.set(id, el()); return els.get(id); },
    document: {
      getElementById: (id) => sandbox.$(id),
      querySelectorAll: (sel) => (sel === ".eng:checked" ? [{ value: "claude" }] : []),
      addEventListener() {},
      body: { classList: { add() {}, remove() {} } },
    },
    location: { search: "", pathname: "/overview" },
    fetch: async (url) => { calls.push(url); return { ok: false, json: async () => ({}) }; },
    URLSearchParams, TextDecoder, JSON, Number, String, Math, Array, Date, setTimeout, clearTimeout,
  };
  const ctx = vm.createContext(sandbox);
  vm.runInContext(read("js", "overview.js"), ctx);
  await new Promise((r) => setTimeout(r, 20));
  calls.length = 0;
  vm.runInContext(read("js", "overview-sync.js"), ctx);

  sandbox.$("dryRun").checked = false;
  await vm.runInContext("runSyncAll()", ctx);
  assert.deepEqual(calls.filter((u) => u === "/api/sync"), [], "no POST /api/sync without confirmation");
  assert.match(sandbox.$("runState").className, /err/);
  assert.equal(sandbox.$("btnRun").disabled, false, "button is usable again");
});
