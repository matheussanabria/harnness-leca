// @ts-check
// Testes — Registro canônico de sessões (EP-09.01)

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "harness-sessions-root-"));
process.env.HARNESS_ROOT = ROOT;
test.after(() => fs.rmSync(ROOT, { recursive: true, force: true }));
const REGISTRY_REL = "canonical-sessions.json";

/**
 * Cria um projeto temporário e devolve o slug (o registro vive em projects/<slug>).
 * @returns {{ slug: string, dir: string, cleanup: () => void }}
 */
function tempProject() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "harness-sessions-"));
  const slug = `tmp-sessoes-${path.basename(dir).replace(/[^a-z0-9]/gi, "").slice(0, 12).toLowerCase()}`;
  const proj = path.join(ROOT, "projects", slug);
  fs.mkdirSync(path.join(proj, "chats"), { recursive: true });
  return { slug, dir, cleanup: () => fs.rmSync(proj, { recursive: true, force: true }) };
}

function registryFile(slug) {
  return path.join(ROOT, "projects", slug, REGISTRY_REL);
}

test("registro canônico - grava, lê e atualiza sessões pelo id", async () => {
  const { slug, cleanup } = tempProject();
  try {
    const registry = require("../ui/server/services/canonical-sessions/session-registry.service");
    const first = registry.upsertSessions(slug, [
      { id: "s1", title: "Sessão um", primaryProvider: "claude", projectConfidence: "explicit" },
    ]);
    assert.equal(first.inserted, 1);
    assert.equal(first.updated, 0);
    assert.ok(fs.existsSync(registryFile(slug)));

    const second = registry.upsertSessions(slug, [
      { id: "s1", title: "Sessão um (renomeada)", primaryProvider: "claude", projectConfidence: "explicit" },
      { id: "s2", title: "Sessão dois", primaryProvider: "gemini", projectConfidence: "unknown" },
    ]);
    assert.equal(second.inserted, 1);
    assert.equal(second.updated, 1);

    const stored = registry.getSession(slug, "s1");
    assert.equal(stored.title, "Sessão um (renomeada)");
    assert.equal(stored.schemaVersion, registry.SCHEMA_VERSION || stored.schemaVersion);
    assert.equal(registry.getSession(slug, "nao-existe"), null);
  } finally {
    cleanup();
  }
});

test("registro canônico - leitura tolerante a arquivo corrompido ou ausente", async () => {
  const { slug, cleanup } = tempProject();
  try {
    const registry = require("../ui/server/services/canonical-sessions/session-registry.service");

    const empty = registry.readRegistry(slug);
    assert.deepEqual(empty.sessions, []);
    assert.equal(empty.warnings.length, 0);

    fs.writeFileSync(registryFile(slug), "{isto nao e json", "utf8");
    const broken = registry.readRegistry(slug);
    assert.deepEqual(broken.sessions, []);
    assert.equal(broken.warnings.length, 1);

    fs.writeFileSync(registryFile(slug), JSON.stringify({ schemaVersion: 99, sessions: [] }), "utf8");
    const future = registry.readRegistry(slug);
    assert.deepEqual(future.sessions, []);
    assert.match(future.warnings[0], /versão futura/);
  } finally {
    cleanup();
  }
});

test("registro canônico - migração aditiva preenche campos novos sem perder dados", async () => {
  const { slug, cleanup } = tempProject();
  try {
    const registry = require("../ui/server/services/canonical-sessions/session-registry.service");
    fs.writeFileSync(
      registryFile(slug),
      JSON.stringify({ schemaVersion: 1, sessions: [{ id: "antiga", title: "Do formato antigo" }] }),
      "utf8",
    );
    const { migrateSession } = require("../ui/server/services/canonical-sessions/session-model");
    const migrated = migrateSession({ id: "antiga", title: "Do formato antigo" });
    assert.equal(migrated.title, "Do formato antigo");
    assert.equal(migrated.projectConfidence, "unknown");
    assert.equal(migrated.executionStatus, "unknown");
    assert.equal(migrated.workflowStatus, "none");
    assert.equal(migrated.attentionStatus, "none");
    assert.ok(migrated.createdAt);
  } finally {
    cleanup();
  }
});

test("registro canônico - vínculo exige evidência e devolve projeto explícito", async () => {
  const { slug, cleanup } = tempProject();
  try {
    const registry = require("../ui/server/services/canonical-sessions/session-registry.service");
    registry.upsertSessions(slug, [{ id: "s1", title: "Sem vínculo", primaryProvider: "claude" }]);

    const semEvidencia = registry.linkSession(slug, "s1", { projectId: "outro", evidence: "" });
    assert.equal(semEvidencia.ok, false);
    assert.match(semEvidencia.error, /evidência/);

    const inexistente = registry.linkSession(slug, "nao-existe", { projectId: "outro", evidence: "sessao:123" });
    assert.equal(inexistente.ok, false);

    const ok = registry.linkSession(slug, "s1", { projectId: "outro", evidence: "sessao:123" });
    assert.equal(ok.ok, true);
    assert.equal(ok.session.projectId, "outro");
    assert.equal(ok.session.projectConfidence, "explicit");
  } finally {
    cleanup();
  }
});

test("registro canônico - filtros de listagem por motor, estado e busca", async () => {
  const { slug, cleanup } = tempProject();
  try {
    const registry = require("../ui/server/services/canonical-sessions/session-registry.service");
    registry.upsertSessions(slug, [
      { id: "s1", title: "Auditoria do quadro", primaryProvider: "claude", executionStatus: "running" },
      { id: "s2", title: "Deploy do protótipo", primaryProvider: "gemini", executionStatus: "failed" },
    ]);

    assert.equal(registry.listSessions(slug, { provider: "claude" }).length, 1);
    assert.equal(registry.listSessions(slug, { executionStatus: "failed" }).length, 1);
    assert.equal(registry.listSessions(slug, { q: "quadro" }).length, 1);
    assert.equal(registry.listSessions(slug, {}).length, 2);
  } finally {
    cleanup();
  }
});
