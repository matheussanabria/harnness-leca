const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { buildPermissions, buildConfig, comboName, delegate } = require("../tools/lib/opencode-delegate");

test("OpenCode delegate is read-only by default and keeps sensitive/external access denied", () => {
  const permission = buildPermissions();
  assert.equal(permission.edit, "deny");
  assert.equal(permission.external_directory, "deny");
  assert.equal(permission.task, "deny");
  assert.equal(permission.read["*.env"], "deny");
  assert.equal(permission.bash["*"], "deny");
});

test("OpenCode delegate enables only explicit write and bash capabilities", () => {
  const permission = buildPermissions({ write: true, bash: ["node --test *"] });
  assert.equal(permission.edit, "allow");
  assert.equal(permission.bash["node --test *"], "allow");
  assert.equal(permission.websearch, "deny");
});

test("OpenCode delegate passes inline governed config without creating opencode.json", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "oc-delegate-test-"));
  const promptFile = path.join(dir, "prompt.md");
  fs.writeFileSync(promptFile, "Inspect only.");
  try {
    let call;
    const result = delegate({ dir, promptFile }, {
      resolveBin: () => "opencode-test",
      spawnSync: (bin, args, options) => {
        call = { bin, args, options };
        return { status: 0, stdout: JSON.stringify({ type: "text", part: { type: "text", text: "done" } }) };
      },
    });
    assert.equal(result.answer, "done");
    assert.equal(call.options.env.OPENCODE_DISABLE_DEFAULT_PLUGINS, "true");
    assert.equal(JSON.parse(call.options.env.OPENCODE_PERMISSION).edit, "deny");
    assert.equal(fs.existsSync(path.join(dir, "opencode.json")), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("OpenCode delegate refuses paid models before spawning", () => {
  assert.throws(() => delegate({ dir: __dirname, promptFile: __filename, model: "openai/paid" }), /Refused non-free/);
});

test("OpenCode delegate reports a bounded timeout clearly", () => {
  assert.throws(() => delegate({ dir: __dirname, promptFile: __filename, timeoutMinutes: 2 }, {
    resolveBin: () => "opencode-test",
    spawnSync: () => ({ status: null, stdout: "", error: Object.assign(new Error("timed out"), { code: "ETIMEDOUT" }) }),
  }), /timed out after 2 minute/);
});

test("OpenCode delegate refuses a 9Router combo without the explicit opt-in", () => {
  assert.throws(() => delegate({ dir: __dirname, promptFile: __filename, model: "9router/harness-testes" }), /without --allow-combo/);
});

test("OpenCode delegate accepts only harness-* combos and keeps other 9Router models refused", () => {
  assert.equal(comboName("9router/harness-review"), "harness-review");
  assert.equal(comboName("9router/Harness"), null);
  assert.equal(comboName("9router/claudflare-codigo"), null);
  assert.throws(() => delegate({ dir: __dirname, promptFile: __filename, model: "9router/Harness", allowCombo: true }), /Refused non-free/);
});

test("OpenCode delegate registers the combo inline and audits the run", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "oc-delegate-combo-"));
  const promptFile = path.join(dir, "prompt.md");
  const auditFile = path.join(dir, "audit.jsonl");
  fs.writeFileSync(promptFile, "Inspect only.");
  try {
    let call;
    const result = delegate({ dir, promptFile, model: "9router/harness-testes", allowCombo: true }, {
      resolveBin: () => "opencode-test",
      auditFile,
      spawnSync: (bin, args, options) => {
        call = { args, options };
        return { status: 0, stdout: JSON.stringify({ type: "text", part: { type: "text", text: "ok" } }) };
      },
    });
    assert.equal(result.answer, "ok");
    const config = JSON.parse(call.options.env.OPENCODE_CONFIG_CONTENT);
    assert.deepEqual(Object.keys(config.provider["9router"].models), ["harness-testes"]);
    assert.ok(call.args.includes("9router/harness-testes"));
    const entry = JSON.parse(fs.readFileSync(auditFile, "utf8").trim());
    assert.equal(entry.combo, "harness-testes");
    assert.equal(entry.status, 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("OpenCode delegate config has no provider block for free models", () => {
  assert.equal(buildConfig({ model: "opencode/deepseek-v4.1-flash-free" }).provider, undefined);
});
