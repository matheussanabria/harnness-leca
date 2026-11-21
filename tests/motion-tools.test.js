// @ts-check
// EP-24.04: Atelier agent tools for motion timelines (ADR-018).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { executeAtelierTool, ATELIER_TOOL_DEFINITIONS } = require("../ui/server/services/atelier-tools.service");
const { parseToolTags } = require("../ui/server/services/atelier-tool-tags.service");
const { TOOL_INSTRUCTION } = require("../ui/server/services/atelier-tool-instruction.service");
const { MOTION_TOOL_DEFINITIONS } = require("../ui/server/services/motion-tools.service");

const root = fs.mkdtempSync(path.join(os.tmpdir(), "motion-tools-"));
test.after(() => fs.rmSync(root, { recursive: true, force: true }));
const PROTO = "cards";
const protoDir = path.join(root, "design", "prototypes", PROTO);
fs.mkdirSync(path.join(protoDir, "screens"), { recursive: true });
fs.writeFileSync(path.join(protoDir, "proto.json"), JSON.stringify({ schema: 1, id: PROTO, screens: [{ id: "home", file: "screens/home.html" }] }));
fs.writeFileSync(path.join(protoDir, "screens", "home.html"), '<main data-pid="p-1"><div data-pid="p-3">A</div><div data-pid="p-4">B</div><div data-pid="p-5">C</div></main>');
const motionFile = path.join(protoDir, "screens", "home.motion.json");
const ctx = { projectDir: root, protoId: PROTO };

/** @param {string} name @param {any} args */
const run = (name, args) => executeAtelierTool(name, args, ctx);
const fadeIn = (/** @type {number} */ start) => [{ t: start, props: { opacity: 0, transform: "translateY(16px)" } }, { t: start + 600, props: { opacity: 1, transform: "translateY(0)" }, ease: "ease-out" }];

test("CP-12: the model's motion_write_timeline tag creates the timeline", async () => {
  fs.rmSync(motionFile, { force: true });
  const doc = { schema: "motion@1", duration: 1200, fps: 30, tracks: ["p-3", "p-4", "p-5"].map((target, i) => ({ target, keys: fadeIn(i * 300) })) };
  const answer = `Vou animar os cards em cascata.\n<tool name="motion_write_timeline">${JSON.stringify({ screen: "home", doc })}</tool>`;
  const { toolCalls, errors } = parseToolTags(answer);
  assert.deepEqual(errors, []);
  assert.equal(toolCalls[0].name, "motion_write_timeline");
  const res = await run(toolCalls[0].name, toolCalls[0].args);
  assert.equal(res.ok, true, res.error);
  assert.equal(res.result.tracks, 3);
  assert.deepEqual(JSON.parse(fs.readFileSync(motionFile, "utf8")), doc);
});

test("CP-13: an invalid prop goes back to the model and nothing is written", async () => {
  fs.rmSync(motionFile, { force: true });
  const res = await run("motion_set_keys", { screen: "home", target: "p-3", keys: [{ t: 0, props: { top: "10px" } }] });
  assert.equal(res.ok, false);
  assert.match(res.error, /nada foi gravado/);
  assert.match(res.error, /tracks\[0\]\.keys\[0\]\.props\.top: prop "top" is not in the allowed list/);
  assert.equal(fs.existsSync(motionFile), false);
});

test("motion_set_keys creates the timeline, then replaces one track and keeps the others", async () => {
  fs.rmSync(motionFile, { force: true });
  const first = await run("motion_set_keys", { screen: "home", target: "p-3", keys: fadeIn(0), duration: 2000 });
  assert.equal(first.ok, true, first.error);
  await run("motion_set_keys", { screen: "home", target: "p-4", keys: fadeIn(300) });
  const again = await run("motion_set_keys", { screen: "home", target: "p-3", keys: [{ t: 0, props: { opacity: 1 } }] });
  assert.equal(again.ok, true, again.error);
  const doc = JSON.parse(fs.readFileSync(motionFile, "utf8"));
  assert.equal(doc.duration, 2000);
  assert.deepEqual(doc.tracks.map((/** @type {any} */ t) => t.target), ["p-4", "p-3"]);
  assert.deepEqual(doc.tracks[1].keys, [{ t: 0, props: { opacity: 1 } }]);
});

test("motion_set_keys without duration ends at the last key and grows to fit later keys", async () => {
  fs.rmSync(motionFile, { force: true });
  await run("motion_set_keys", { screen: "home", target: "p-3", keys: fadeIn(0) });
  assert.equal(JSON.parse(fs.readFileSync(motionFile, "utf8")).duration, 600);
  await run("motion_set_keys", { screen: "home", target: "p-4", keys: fadeIn(500) });
  assert.equal(JSON.parse(fs.readFileSync(motionFile, "utf8")).duration, 1100);
  await run("motion_set_keys", { screen: "home", target: "p-5", keys: fadeIn(0) });
  assert.equal(JSON.parse(fs.readFileSync(motionFile, "utf8")).duration, 1100, "never shrinks");
  fs.rmSync(motionFile, { force: true });
  await run("motion_set_keys", { screen: "home", target: "p-3", keys: [{ t: 0, props: { opacity: 1 } }] });
  assert.equal(JSON.parse(fs.readFileSync(motionFile, "utf8")).duration, 3000, "a single key at 0 falls back to 3 s");
});

test("motion_remove_track removes one track and reports a missing one", async () => {
  fs.rmSync(motionFile, { force: true });
  await run("motion_set_keys", { screen: "home", target: "p-3", keys: fadeIn(0) });
  await run("motion_set_keys", { screen: "home", target: "p-4", keys: fadeIn(200) });
  const removed = await run("motion_remove_track", { screen: "home", target: "p-3" });
  assert.equal(removed.ok, true, removed.error);
  assert.equal(removed.result.tracks, 1);
  const missing = await run("motion_remove_track", { screen: "home", target: "p-9" });
  assert.equal(missing.ok, false);
  assert.match(missing.error, /não tem faixa para 'p-9'/);
});

test("motion tools: orphan target is saved with a warning, missing screen and unknown screen fail", async () => {
  fs.rmSync(motionFile, { force: true });
  const orphan = await run("motion_set_keys", { screen: "home", target: "p-77", keys: fadeIn(0) });
  assert.equal(orphan.ok, true, orphan.error);
  assert.match(orphan.result.warnings[0], /p-77/);
  assert.match((await run("motion_set_keys", { target: "p-3", keys: fadeIn(0) })).error, /screen é obrigatório/);
  assert.match((await run("motion_write_timeline", { screen: "nope", doc: {} })).error, /Screen 'nope' not found/);
});

test("motion tools are in the shared catalog and the tag instruction", () => {
  const names = ATELIER_TOOL_DEFINITIONS.map((d) => d.name);
  for (const d of MOTION_TOOL_DEFINITIONS) assert.ok(names.includes(d.name), d.name);
  assert.match(TOOL_INSTRUCTION, /motion_write_timeline/);
  assert.match(TOOL_INSTRUCTION, /motion_set_keys/);
  assert.match(TOOL_INSTRUCTION, /Props permitidas: opacity, transform/);
});
