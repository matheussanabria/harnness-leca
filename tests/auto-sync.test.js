// Sync automatico: desligavel por env, exclusao mutua com o sync manual e cache de impressao digital.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "harness-autosync-"));
process.env.HARNESS_ROOT = TMP;
test.after(() => fs.rmSync(TMP, { recursive: true, force: true }));

const auto = require("../ui/server/services/auto-sync.service");
const fingerprints = require("../tools/lib/sync-fingerprint");
const { stripEnvelope, isEnvelopeTitle } = require("../tools/lib/envelope");

test("HARNESS_AUTOSYNC=0 nao inicia nada", () => {
  assert.equal(auto.startAutoSync({ root: TMP, env: { HARNESS_AUTOSYNC: "0" } }), null);
  assert.equal(auto.getAutoSyncStats().enabled, false);
});

test("sync manual e automatico se excluem", () => {
  assert.equal(auto.acquireManual(), true);
  assert.equal(auto.acquireManual(), false, "segunda reserva recusada");
  assert.equal(auto.isBusy(), true);
  auto.releaseManual();
  assert.equal(auto.isBusy(), false);
});

test("fingerprint: so pula quando a impressao digital bate e o .md ainda existe", () => {
  const dir = path.join(TMP, "chats");
  fs.mkdirSync(dir, { recursive: true });
  const c = fingerprints.open();
  c.remember("claude:abc", "1:2", dir);
  c.save();
  const again = fingerprints.open();
  assert.equal(again.unchanged("claude:abc", "1:2", dir, "abcd1234"), "", "sem .md nao pula");
  fs.writeFileSync(path.join(dir, "2026-01-01-x-abcd1234.md"), "x");
  assert.equal(again.unchanged("claude:abc", "1:2", dir, "abcd1234"), "2026-01-01-x-abcd1234.md");
  assert.equal(again.unchanged("claude:abc", "9:9", dir, "abcd1234"), "", "fonte mudou");
});

test("envelope: remove o contexto do harness e reconhece titulo contaminado", () => {
  assert.equal(stripEnvelope("<contexto_do_harness>\nlixo\n</contexto_do_harness>\n\nOla"), "Ola");
  assert.equal(isEnvelopeTitle("<contexto_do_harness> Aviso"), true);
  assert.equal(isEnvelopeTitle("- <contexto_do_harness> Aviso"), true);
  assert.equal(isEnvelopeTitle("Titulo normal"), false);
});

test("watchRoots covers the four engines, Codex included, and skips folders that do not exist", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "harness-watch-home-"));
  try {
    assert.deepEqual(auto.watchRoots(home), []);
    const dirs = [[".claude", "projects"], [".gemini", "antigravity-ide", "brain"], [".local", "share", "opencode"], [".codex", "sessions"]];
    for (const d of dirs) fs.mkdirSync(path.join(home, ...d), { recursive: true });
    assert.deepEqual(auto.watchRoots(home), dirs.map((d) => path.join(home, ...d)));
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});
