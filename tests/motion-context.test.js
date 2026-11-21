// @ts-check
// EP-24.04: timeline summary in the agent context (about 200 tokens, with a hash).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { buildMotionSummary, estimateTokens, readMotionFiles } = require("../ui/server/services/motion-context.service");
const { buildProtoContext } = require("../ui/server/services/atelier-proto-context.service");

/** @param {number} n */
function timeline(n) {
  return {
    schema: "motion@1", duration: 4000, fps: 30, loop: true,
    tracks: Array.from({ length: n }, (_, i) => ({ target: `p-${i + 1}`, keys: [{ t: i * 10, props: { opacity: 0, transform: "scale(0.9)" } }, { t: i * 10 + 600, props: { opacity: 1 } }] })),
  };
}
const entry = (/** @type {string} */ screen, /** @type {any} */ doc) => ({ screen, doc, text: JSON.stringify(doc) });

test("motion-context: one header per screen and one line per track", () => {
  const { text, hash, omitted } = buildMotionSummary([entry("home", timeline(2))]);
  assert.match(hash, /^[0-9a-f]{12}$/);
  assert.equal(omitted, 0);
  assert.equal(text, [
    `## Timelines de motion (hash ${hash})`,
    "home: 4000 ms, 30 fps, loop, 2 faixa(s)",
    "- p-1: opacity,transform 0-600ms",
    "- p-2: opacity,transform 10-610ms",
  ].join("\n"));
});

test("CP-14: the summary stays within 200 tokens and says how many tracks were left out", () => {
  const { text, omitted } = buildMotionSummary([entry("home", timeline(200))]);
  assert.ok(estimateTokens(text) <= 200, `tokens: ${estimateTokens(text)}`);
  assert.ok(omitted > 150, `omitted: ${omitted}`);
  assert.match(text, new RegExp(`\\(${omitted} faixa\\(s\\) omitidas por tamanho`));
});

test("motion-context: the hash changes with the content and an empty list gives no block", () => {
  const a = buildMotionSummary([entry("home", timeline(1))]).hash;
  const b = buildMotionSummary([entry("home", timeline(2))]).hash;
  assert.notEqual(a, b);
  assert.deepEqual(buildMotionSummary([]), { text: "", hash: "", omitted: 0 });
});

test("motion-context: the proto context includes the timelines read from disk", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "motion-context-"));
  try {
    const protoDir = path.join(root, "design", "prototypes", "p");
    fs.mkdirSync(path.join(protoDir, "screens"), { recursive: true });
    fs.writeFileSync(path.join(protoDir, "screens", "home.html"), '<main data-pid="p-1">x</main>');
    assert.doesNotMatch(buildProtoContext({ projectDir: root, protoId: "p" }), /Timelines de motion/);
    fs.writeFileSync(path.join(protoDir, "screens", "home.motion.json"), JSON.stringify(timeline(1)));
    fs.writeFileSync(path.join(protoDir, "screens", "bad.motion.json"), "{ not json");
    assert.equal(readMotionFiles(protoDir).length, 1);
    assert.match(buildProtoContext({ projectDir: root, protoId: "p" }), /home: 4000 ms, 30 fps, loop, 1 faixa\(s\)/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
