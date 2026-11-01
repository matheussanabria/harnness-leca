// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");

// Unit-test mode: no disk telemetry, no server probing. The opencode turn is replaced by a fake that streams a reply.
process.env.HARNESS_ROOT = process.env.HARNESS_ROOT || process.cwd();
let reply = "";
const turnPath = require.resolve("../tools/lib/opencode-v2-turn");
require.cache[turnPath] = {
  id: turnPath, filename: turnPath, loaded: true,
  exports: {
    TurnError: class TurnError extends Error {},
    runTurn: async (_base, _sid, _text, o) => { o.onText(reply); return { text: reply, reasoning: "", aborted: false, finish: "stop" }; },
  },
};
const V2 = require("../tools/lib/opencode-v2");
V2.createSession = async () => "ses_fake";
const engine = require("../tools/lib/engines/opencode");

const F = "```";

/** Runs one engine turn and returns what the chat would have received. */
function turn(text) {
  reply = text;
  return new Promise((resolve) => {
    const chunks = [];
    engine.stream({
      prompt: "oi", slug: "harness-leca", model: "9router/harness-testes",
      onChunk: (c) => chunks.push(c),
      onDone: (d) => resolve({ done: d, chunks }),
      onError: (e) => resolve({ error: e, chunks }),
    });
  });
}

test("engine sensors - a broken JSON block adds a short notice and sensors in the done event", async () => {
  const { done, chunks } = await turn(`Here:\n${F}json\n{ "a": 1, }\n${F}\n`);
  assert.ok(done, "the turn finishes");
  assert.ok(chunks.some((c) => c.type === "thinking" && /\[Sensors\].*invalid JSON/.test(c.text)));
  assert.equal(done.sensors.findings[0].sensor, "syntax");
  assert.equal(done.fullText.includes("invalid JSON"), false, "the answer text itself is never changed");
});

test("engine sensors - a clean answer has no notice", async () => {
  const { done, chunks } = await turn(`Use this:\n${F}json\n{ "a": 1 }\n${F}\n`);
  assert.ok(!chunks.some((c) => /\[Sensors\]/.test(c.text || "")));
  assert.deepEqual(done.sensors.findings, []);
  assert.equal(done.qualityGate.ok, true);
});

test("engine sensors - HIA_SENSORS=false leaves the done event as before", async (t) => {
  process.env.HIA_SENSORS = "false";
  t.after(() => { delete process.env.HIA_SENSORS; });
  const { done } = await turn(`${F}json\n{ "a": 1, }\n${F}\n`);
  assert.equal(done.sensors, undefined);
});
