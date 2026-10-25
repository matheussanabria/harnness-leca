const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { buildPermissions, delegate } = require("../tools/lib/opencode-delegate");

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
