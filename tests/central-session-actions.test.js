// @ts-check
// Testes — Decisão de ações e capacidades da sessão (EP-09.04).

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const ROOT = path.resolve(".");
const RESOLVER_PATH = path.join(ROOT, "ui", "public", "js", "modules", "session-capability-resolver.js");
const ACTIONS_PATH = path.join(ROOT, "ui", "public", "js", "modules", "central-session-actions.js");

async function loadModules() {
  const resolver = await import(pathToFileURL(RESOLVER_PATH).href);
  const actions = await import(pathToFileURL(ACTIONS_PATH).href);
  return { resolver, actions };
}

test("RF1, RF2, RF4: Sessão Claude com nativeSessionId gera retomada nativa", async () => {
  const { resolver, actions } = await loadModules();

  const session = {
    id: "s-claude-1",
    primaryProvider: "claude",
    nativeSessionId: "uuid-12345",
    artifacts: [{ path: "projects/test/chats/sessao1.md" }],
  };

  const cap = resolver.resolveSessionCapabilities(session);
  assert.equal(cap.provider, "claude");
  assert.equal(cap.resumeMode, "native");
  assert.equal(cap.canResume, true);
  assert.equal(cap.canReplay, false);

  const actList = actions.determineSessionActions(session, { capabilities: cap });
  const ids = actList.map((a) => a.id);
  assert.ok(ids.includes("open_chat"), "Deve permitir abrir conversa");
  assert.ok(ids.includes("resume_session"), "Deve permitir retomar sessão nativa");
  assert.ok(!ids.includes("continue_context"), "Não deve sugerir replay de contexto se há retomada nativa");
});

test("RF1, RF5: Sessão Gemini com artefato gera continuidade por contexto (context_replay)", async () => {
  const { resolver, actions } = await loadModules();

  const session = {
    id: "s-gemini-1",
    primaryProvider: "gemini",
    nativeSessionId: "trans-abc",
    artifacts: [{ path: "projects/test/chats/gemini-chat.md" }],
  };

  const cap = resolver.resolveSessionCapabilities(session);
  assert.equal(cap.provider, "gemini");
  assert.equal(cap.resumeMode, "context_replay");
  assert.equal(cap.canResume, false);
  assert.equal(cap.canReplay, true);

  const actList = actions.determineSessionActions(session, { capabilities: cap });
  const ids = actList.map((a) => a.id);
  assert.ok(ids.includes("open_chat"), "Deve permitir abrir conversa");
  assert.ok(!ids.includes("resume_session"), "NUNCA deve rotular retomada nativa para Gemini");
  assert.ok(ids.includes("continue_context"), "Deve sugerir continuar com contexto");
});

test("RF3: Sessão sem artefato não exibe 'Abrir conversa'", async () => {
  const { resolver, actions } = await loadModules();

  const session = {
    id: "s-codex-no-art",
    primaryProvider: "codex",
    nativeSessionId: "codex-99",
    artifacts: [],
  };

  const cap = resolver.resolveSessionCapabilities(session);
  const actList = actions.determineSessionActions(session, { capabilities: cap });
  const ids = actList.map((a) => a.id);
  assert.ok(!ids.includes("open_chat"), "Sem artefato Markdown, não pode ter Abrir conversa");
  assert.ok(ids.includes("resume_session"), "Codex tem ID nativo então pode retomar");
});

test("RF12: Cancelar execução só aparece se a execução pertence ao Harness (harnessOwned)", async () => {
  const { resolver, actions } = await loadModules();

  const externalSession = {
    id: "s-ext",
    primaryProvider: "claude",
    harnessOwned: false,
    artifacts: [{ path: "chat.md" }],
  };
  const capExt = resolver.resolveSessionCapabilities(externalSession);
  const actExt = actions.determineSessionActions(externalSession, { capabilities: capExt });
  assert.ok(!actExt.map((a) => a.id).includes("cancel_execution"), "Sessão externa não pode ser cancelada");

  const ownedSession = {
    id: "s-owned",
    primaryProvider: "claude",
    harnessOwned: true,
    artifacts: [{ path: "chat.md" }],
  };
  const capOwned = resolver.resolveSessionCapabilities(ownedSession);
  assert.equal(capOwned.canCancel, true);
  const actOwned = actions.determineSessionActions(ownedSession, { capabilities: capOwned });
  assert.ok(actOwned.map((a) => a.id).includes("cancel_execution"), "Sessão Harness pode ser cancelada");
});

test("RF6: Nova conversa relacionada é sempre oferecida preservando vínculo", async () => {
  const { actions } = await loadModules();
  const session = { id: "s-any", primaryProvider: "ollama" };
  const actList = actions.determineSessionActions(session);
  const newChat = actList.find((a) => a.id === "new_chat");
  assert.ok(newChat, "new_chat deve estar presente");
});

test("Renderização de botões não contém emojis e tem acessibilidade", async () => {
  const { actions } = await loadModules();
  const html = actions.renderActionButtons(
    [
      { id: "open_chat", label: "Abrir conversa", icon: "fa-book-open", tone: "primary", tooltip: "Abrir" },
    ],
    "s-123"
  );
  assert.ok(html.includes('data-session-action="open_chat"'));
  assert.ok(html.includes("fa-book-open"));
  assert.ok(!/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}]/u.test(html), "Zero emojis");
});
