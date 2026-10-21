// @ts-check
// Testes — Descoberta e reconciliação de sessões (EP-09.01)

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const ROOT = path.resolve(".");

/**
 * @returns {{ dir: string, cleanup: () => void }}
 */
function tempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "harness-discovery-"));
  return { dir, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

/**
 * @param {string} dir
 * @param {string} name
 * @param {string} frontmatter
 */
function writeChat(dir, name, frontmatter) {
  fs.mkdirSync(path.join(dir, "chats"), { recursive: true });
  fs.writeFileSync(path.join(dir, "chats", name), `---\n${frontmatter}\n---\n\n## Você\n\nOlá.\n`, "utf8");
}

test("descoberta - porta Markdown lê as conversas sem alterar as fontes", async () => {
  const { dir, cleanup } = tempDir();
  try {
    const { discoverMarkdownSessions } = require("../ui/server/services/canonical-sessions/discovery/markdown-discovery");
    writeChat(dir, "2026-10-21-conversa.md", "titulo: Conversa de teste\nsessao: sessao-abc\ninicio: 2026-10-21T10:00:00Z");
    const before = fs.readdirSync(path.join(dir, "chats")).sort();

    const result = discoverMarkdownSessions(dir);
    assert.equal(result.providerSessions.length, 1);
    assert.equal(result.providerSessions[0].nativeSessionId, "sessao-abc");
    assert.equal(result.providerSessions[0].sourceKind, "markdown");
    assert.equal(result.providerSessions[0].sourceLocator, "chats/2026-10-21-conversa.md");
    assert.equal(result.artifacts.length, 1);
    assert.ok(result.artifacts[0].hash);
    assert.equal(result.artifacts[0].declaredSession, "sessao-abc");

    const after = fs.readdirSync(path.join(dir, "chats")).sort();
    assert.deepEqual(after, before, "a descoberta não pode escrever nas fontes");
  } finally {
    cleanup();
  }
});

test("descoberta - o orquestrador deduplica por fingerprint e isola portas com erro", async () => {
  const { dir, cleanup } = tempDir();
  try {
    const { discoverSessions } = require("../ui/server/services/canonical-sessions/discovery/session-discovery.service");
    const ports = [
      {
        id: "a",
        discover: () => ({
          providerSessions: [
            { provider: "claude", nativeSessionId: "x1", sourceKind: "cli", sourceLocator: "a/x1" },
            { provider: "claude", nativeSessionId: "x1", sourceKind: "cli", sourceLocator: "a/x1-outra" },
          ],
          artifacts: [],
        }),
      },
      {
        id: "b",
        discover: () => {
          throw new Error("porta fora do ar");
        },
      },
    ];

    const result = discoverSessions(dir, { ports });
    assert.equal(result.providerSessions.length, 1, "fingerprint repetido vira uma sessão só");
    assert.equal(result.warnings.length, 1);
    assert.match(result.warnings[0], /porta fora do ar/);
  } finally {
    cleanup();
  }
});

test("reconciliação - sessão exata reaproveita o registro; inferida vira candidata", async () => {
  const { dir, cleanup } = tempDir();
  try {
    const { reconcile } = require("../ui/server/services/canonical-sessions/session-reconciler.service");
    const existing = [
      {
        id: "exata",
        title: "Já registrada",
        primaryProvider: "claude",
        projectConfidence: "explicit",
        providerSessions: [{ fingerprint: "claude|x1|cli" }],
      },
    ];

    const result = reconcile(
      [
        { provider: "claude", nativeSessionId: "x1", sourceKind: "cli" },
        { provider: "gemini", nativeSessionId: "y1", sourceKind: "sqlite" },
      ],
      { existing, projectId: "meu-projeto" },
    );

    const exata = result.sessions.find((item) => item.id === "exata");
    assert.equal(exata.title, "Já registrada", "sessão com fingerprint exato preserva o registro");
    assert.equal(exata.providerSessions.length, 2);

    const inferida = result.sessions.find((item) => item.primaryProvider === "gemini");
    assert.equal(inferida.projectConfidence, "inferred");
    assert.equal(inferida.projectId, "meu-projeto");
    assert.equal(result.candidates.length, 1);
    assert.match(result.candidates[0].reason, /inferido/);
  } finally {
    cleanup();
  }
});

test("reconciliação - sem evidência e sem projeto, a sessão fica sem vínculo", async () => {
  const { dir, cleanup } = tempDir();
  try {
    const { reconcile } = require("../ui/server/services/canonical-sessions/session-reconciler.service");
    const result = reconcile([{ provider: "codex", nativeSessionId: "z1", sourceKind: "cli" }], {});
    assert.equal(result.sessions.length, 1);
    assert.equal(result.sessions[0].projectId, null);
    assert.equal(result.sessions[0].projectConfidence, "unknown");
    assert.equal(result.candidates.length, 0);
    assert.equal(result.warnings.length, 1);
  } finally {
    cleanup();
  }
});

test("reconciliação - metadado explícito associa com confiança observada", async () => {
  const { dir, cleanup } = tempDir();
  try {
    const { reconcile } = require("../ui/server/services/canonical-sessions/session-reconciler.service");
    const result = reconcile(
      [{ provider: "claude", nativeSessionId: "sessao-declarada", sourceKind: "markdown" }],
      { artifacts: [{ declaredSession: "sessao-declarada", projectId: "projeto-real" }] },
    );
    assert.equal(result.sessions[0].projectId, "projeto-real");
    assert.equal(result.sessions[0].projectConfidence, "observed");
  } finally {
    cleanup();
  }
});
