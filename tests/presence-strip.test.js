// @ts-check
// Header presence strip: states, n/d on failure (never idle), escaping, no emoji, teardown.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const mod = () => import(pathToFileURL(path.resolve("ui", "public", "js", "modules", "presence-strip.js")).href);
const EMOJI = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2726}\u{25C6}]/u;
const summary = (over = {}) => ({ agents: {
  claude: { status: "active", activeCount: 2, icon: "\u{1F916}" },
  gemini: { status: "idle", activeCount: 0 },
  opencode: { status: "idle", activeCount: 0 }, ...over } });

test("renders active, idle and unknown states without emoji from the API", async () => {
  const { renderPresenceStrip } = await mod();
  const html = renderPresenceStrip(summary({ opencode: undefined }));
  assert.ok(html.includes("pres-item--active") && html.includes("2 ativos"));
  assert.ok(html.includes("pres-item--idle") && html.includes("ocioso"));
  assert.ok(html.includes("pres-item--unknown") && html.includes("n/d"));
  assert.ok(!EMOJI.test(html));
});

test("a failed read shows n/d for every engine, never idle", async () => {
  const { renderPresenceStrip } = await mod();
  const html = renderPresenceStrip(null);
  assert.equal((html.match(/pres-item--unknown/g) || []).length, 3);
  assert.ok(!html.includes("ocioso"));
});

test("mount: paints, recovers to n/d on error, stops after destroy", async () => {
  const { mountPresenceStrip } = await mod();
  const attrs = {};
  const mk = () => ({ innerHTML: "", setAttribute: (k, v) => { attrs[k] = v; } });
  const root = mk();
  const ok = mountPresenceStrip(root, { doc: { hidden: false }, pollMs: 1e9, fetchImpl: async () => ({ ok: true, json: async () => summary() }) });
  await ok.first;
  assert.ok(root.innerHTML.includes("2 ativos"));
  assert.equal(attrs.role, "status");
  ok.destroy();

  const bad = mk();
  const failing = mountPresenceStrip(bad, { doc: { hidden: false }, pollMs: 1e9, fetchImpl: async () => { throw new Error("down"); } });
  await failing.first;
  assert.ok(bad.innerHTML.includes("n/d"));
  failing.destroy();

  const gone = mk();
  const late = mountPresenceStrip(gone, { doc: { hidden: false }, pollMs: 1e9, fetchImpl: async () => ({ ok: true, json: async () => summary() }) });
  late.destroy();
  await late.first;
  assert.ok(!gone.innerHTML.includes("ativos"));
});

test("wiring: index has the mount point and boot mounts it", () => {
  const fs = require("node:fs");
  assert.match(fs.readFileSync("ui/public/index.html", "utf8"), /id="presenceStrip"/);
  assert.match(fs.readFileSync("ui/public/js/boot.js", "utf8"), /presence-strip\.js/);
});
