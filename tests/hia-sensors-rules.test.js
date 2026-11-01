// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");
const { extractBlocks, normalizeLang } = require("../tools/lib/hia/sensors/extract");
const { secretsRule, emojiRule, testRule, mermaidRule, fenceRule } = require("../tools/lib/hia/sensors/rules");
const { runSensors, summarizeErrors } = require("../tools/lib/hia/sensors");

const F = "```";

test("sensors/extract - finds fenced blocks with normalized language and answer line", () => {
  const { blocks, unclosedFence } = extractBlocks(`intro\n${F}TypeScript\nconst a = 1;\n${F}\ntext\n${F}py\nprint(1)\n${F}\n`);
  assert.deepEqual(blocks.map((b) => [b.lang, b.line]), [["ts", 3], ["python", 7]]);
  assert.equal(blocks[0].code, "const a = 1;\n");
  assert.equal(unclosedFence, false);
  assert.equal(normalizeLang("PowerShell"), "shell");
});

test("sensors/extract - detects an answer that ends inside a code block", () => {
  assert.equal(extractBlocks(`ok\n${F}ts\nconst a = 1;`).unclosedFence, true);
  assert.equal(extractBlocks(`${F}ts\nx\n${F}\n~~~js\ny\n~~~\n`).blocks.length, 2);
  assert.equal(fenceRule(true)[0].sensor, "truncated");
  assert.deepEqual(fenceRule(false), []);
});

test("sensors/rules - secrets are reported without the value", () => {
  const token = `ghp_${"a".repeat(36)}`; // allow-secret
  const [f] = secretsRule(`line one\nuse ${token} here`);
  assert.equal(f.severity, "error");
  assert.equal(f.line, 2);
  assert.ok(!f.message.includes(token));
  assert.deepEqual(secretsRule("nothing to see"), []);
});

test("sensors/rules - emoji only counts in code languages, symbols like the copyright sign do not", () => {
  assert.equal(emojiRule({ lang: "html", code: "<b>ok</b>\n<i>✔</i>" })[0].line, 2);
  assert.equal(emojiRule({ lang: "ts", code: "const x = '\u{1F680}';" }).length, 1);
  assert.deepEqual(emojiRule({ lang: "ts", code: "// © 2026 and → arrows" }), []);
  assert.deepEqual(emojiRule({ lang: "markdown", code: "\u{1F680}" }), []);
});

test("sensors/rules - test code needs an assertion", () => {
  assert.equal(testRule({ lang: "ts", code: "it('a', () => { run(); });" }).length, 1);
  assert.deepEqual(testRule({ lang: "ts", code: "it('a', () => { expect(run()).toBe(1); });" }), []);
  assert.deepEqual(testRule({ lang: "java", code: "@Test void a() { assertEquals(1, f()); }" }), []);
  assert.equal(testRule({ lang: "python", code: "def test_a():\n    f()" }).length, 1);
  assert.deepEqual(testRule({ lang: "ts", code: "export const a = 1;" }), []);
});

test("sensors/rules - mermaid structure", () => {
  assert.deepEqual(mermaidRule({ lang: "mermaid", code: "sequenceDiagram\n  A->>B: hi" }), []);
  assert.deepEqual(mermaidRule({ lang: "mermaid", code: "%% note\nflowchart TD\n  A[Start] --> B(End)" }), []);
  assert.match(mermaidRule({ lang: "mermaid", code: "A --> B" })[0].message, /known Mermaid/);
  assert.match(mermaidRule({ lang: "mermaid", code: "flowchart TD\n  A[Start --> B" })[0].message, /unbalanced/);
  assert.deepEqual(mermaidRule({ lang: "ts", code: "A --> B" }), []);
});

test("sensors/index - HIA_SENSORS=false does nothing; empty and plain answers are clean", async () => {
  const off = await runSensors(`${F}json\n{bad\n${F}`, { env: { HIA_SENSORS: "false" } });
  assert.equal(off.disabled, true);
  assert.deepEqual(off.findings, []);
  const plain = await runSensors("Just a sentence with no code.", { env: {} });
  assert.deepEqual(plain.findings, []);
  assert.equal(plain.blocks, 0);
});

test("sensors/index - rule findings carry the answer line and summarizeErrors keeps errors only", async () => {
  const text = `intro\n${F}mermaid\nA --> B\n${F}\nkey ghp_${"b".repeat(36)}\n`; // allow-secret
  const r = await runSensors(text, { env: {} });
  const mer = r.findings.find((f) => f.sensor === "mermaid");
  assert.equal(mer?.line, 3);
  assert.equal(mer?.lang, "mermaid");
  const lines = summarizeErrors(r.findings);
  assert.equal(lines.length, 1);
  assert.match(lines[0], /possible secret/);
});
