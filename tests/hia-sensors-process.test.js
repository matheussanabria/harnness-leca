// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { biomeSensor, biomeBin, parseDiagnostics } = require("../tools/lib/hia/sensors/biome");
const { jsonSensor, pythonSensor, javaSensor } = require("../tools/lib/hia/sensors/syntax");
const { runSensors } = require("../tools/lib/hia/sensors");

// These tests call real checkers; a machine without one skips its tests instead of failing.
/** @param {string} cmd @param {string[]} args */
const has = (cmd, args) => { const r = spawnSync(cmd, args, { encoding: "utf8", windowsHide: true }); return !r.error && r.status === 0; };
const NO_BIOME = !biomeBin() && "biome is not installed";
const NO_PYTHON = !(has("python", ["--version"]) || has("python3", ["--version"])) && "python is not available";
const NO_JAVAC = !has("javac", ["-version"]) && "javac is not available";

test("sensors/biome - parse errors are errors and carry the line", { skip: NO_BIOME }, async () => {
  const r = await biomeSensor({ lang: "ts", code: "const a = 1;\nfunction f( {\n" });
  assert.ok(r.findings.some((f) => f.severity === "error" && f.sensor === "syntax"));
});

test("sensors/biome - lint warnings for real defects, none for unused names in a partial snippet", { skip: NO_BIOME }, async () => {
  const r = await biomeSensor({ lang: "js", code: "const unused = 1;\ndebugger;\n" });
  assert.ok(r.findings.some((f) => f.sensor === "lint" && /noDebugger/.test(f.message)));
  assert.ok(!r.findings.some((f) => /noUnused/.test(f.message)));
  assert.ok(r.findings.every((f) => f.severity === "warning"));
});

test("sensors/biome - clean code and unsupported languages report nothing", { skip: NO_BIOME }, async () => {
  assert.deepEqual((await biomeSensor({ lang: "ts", code: "export const a: number = 1;\n" })).findings, []);
  assert.match((await biomeSensor({ lang: "java", code: "class A {}" })).skipped || "", /no biome support/);
});

test("sensors/biome - the diagnostics parser ignores other files", () => {
  const out = "biome.json:1:11 deserialize  DEPRECATED  ---\n\n  i note\n\nsnippet.js:2:1 lint/suspicious/noDebugger  FIXABLE  ---\n\n  × This is an unexpected use of the debugger statement.\n";
  assert.deepEqual(parseDiagnostics(out, "snippet.js"), [{ line: 2, category: "lint/suspicious/noDebugger", message: "This is an unexpected use of the debugger statement." }]);
});

test("sensors/json - invalid JSON is an error; comments and placeholders are illustrations", async () => {
  assert.equal((await jsonSensor({ code: '{ "a": 1, }' })).findings[0].severity, "error");
  assert.deepEqual((await jsonSensor({ code: '{ "a": 1 }' })).findings, []);
  assert.deepEqual((await jsonSensor({ code: '{ "a": 1, // note\n "b": 2 }' })).findings, []);
  assert.deepEqual((await jsonSensor({ code: '{ "items": [ ... ] }' })).findings, []);
});

test("sensors/python - syntax error with its line; valid code is clean", { skip: NO_PYTHON }, async () => {
  const bad = await pythonSensor({ code: "x = 1\ndef f(:\n  pass\n" });
  assert.equal(bad.findings[0].severity, "error");
  assert.equal(bad.findings[0].line, 2);
  assert.deepEqual((await pythonSensor({ code: "def f(x):\n    return x * 2\n" })).findings, []);
});

test("sensors/python - the line is still found when the environment forces colors (git hooks do)", { skip: NO_PYTHON }, async (t) => {
  const before = process.env.FORCE_COLOR;
  process.env.FORCE_COLOR = "1";
  t.after(() => { if (before === undefined) delete process.env.FORCE_COLOR; else process.env.FORCE_COLOR = before; });
  const bad = await pythonSensor({ code: "x = 1\ndef f(:\n  pass\n" });
  assert.equal(bad.findings[0].line, 2);
  assert.doesNotMatch(bad.findings[0].message, /\x1b/);
});

test("sensors/java - syntax errors count; unresolved imports and symbols do not", { skip: NO_JAVAC }, async () => {
  const bad = await javaSensor({ code: "public class Bad { void f() { int x = ; } }" });
  assert.equal(bad.findings[0].severity, "error");
  assert.deepEqual((await javaSensor({ code: "import com.acme.Missing;\npublic class Good { void f() { Missing m = null; } }" })).findings, []);
});

test("sensors/java - a snippet without a class is checked as members or as statements", { skip: NO_JAVAC }, async () => {
  assert.deepEqual((await javaSensor({ code: "int twice(int x) { return x * 2; }" })).findings, [], "members");
  assert.deepEqual((await javaSensor({ code: "int x = 2;\nSystem.out.println(x);" })).findings, [], "statements");
  assert.ok((await javaSensor({ code: "int x = ;" })).findings.length > 0);
});

test("sensors/index - end to end over a mixed answer", { skip: NO_BIOME }, async () => {
  const F = "```";
  const r = await runSensors(`${F}ts\nconst a = (;\n${F}\n${F}json\n{ "a": 1, }\n${F}\n`, { env: {} });
  assert.deepEqual(r.findings.filter((f) => f.severity === "error").map((f) => f.lang).sort(), ["json", "ts"]);
  assert.equal(r.blocks, 2);
});
