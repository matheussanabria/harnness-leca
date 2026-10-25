// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { makeTempDir } = require("./helpers/temp-dir");
const service = require("../tools/lib/coordination/service");
const { PROVIDERS } = require("../tools/lib/coordination/config");

// A política de provedores é configurável pelo usuário. Estes testes cobrem a mecânica
// do ledger, não a política: por isso todos os provedores são ativados durante o cenário.
function withActiveProviders(fn) {
  const previous = Object.fromEntries(Object.entries(PROVIDERS).map(([id, p]) => [id, p.enabled]));
  for (const p of Object.values(PROVIDERS)) p.enabled = true;
  try {
    return fn();
  } finally {
    for (const [id, enabled] of Object.entries(previous)) PROVIDERS[id].enabled = enabled;
  }
}

function fixture() {
  const root = makeTempDir("harness-coordination-", test);
  fs.mkdirSync(path.join(root, "projects", "demo", "context"), { recursive: true });
  fs.mkdirSync(path.join(root, "docs", "harness-evolution"), { recursive: true });
  fs.writeFileSync(path.join(root, "docs", "harness-evolution", "00-index.md"), [
    "- [x] [02.01](02-epics/02.01.md) Historia pronta",
    "- [ ] 02.02 Historia visual",
    "- [x] 05.01 Historia backend pronta",
    "- [ ] 05.02 Historia backend",
    "- [ ] 05.03 Historia backend dependente",
  ].join("\n"));
  return root;
}

test("inicializa os oito provedores com politica ativa explicita", () => {
  const root = fixture();
  const state = service.init(root, "demo");
  assert.equal(Object.keys(state.providers).length, 8);
  for (const [id, provider] of Object.entries(state.providers)) {
    assert.equal(provider.enabled, PROVIDERS[id].enabled, `politica de ${id} refletida no estado`);
  }
  assert.equal(state.stories["EP-02.02"].owner, "gemini");
});

test("claim e evento idempotente preservam uma unica revisao", () => withActiveProviders(() => {
  const root = fixture();
  service.init(root, "demo");
  const input = { type: "story.claimed", provider: "codex", storyId: "EP-05.02", payload: {}, eventId: "claim-1" };
  const first = service.mutate(root, "demo", input);
  const second = service.mutate(root, "demo", input);
  assert.equal(first.changed, true);
  assert.equal(second.changed, false);
  assert.equal(second.state.revision, 1);
}));

test("handoff cria mensagem e projecao na caixa do destino", () => withActiveProviders(() => {
  const root = fixture();
  service.init(root, "demo");
  service.mutate(root, "demo", {
    type: "handoff.created",
    provider: "codex",
    storyId: "EP-05.02",
    payload: { to: "gemini", message: "Revisar o contrato visual" },
  });
  const messages = service.inbox(root, "demo", "gemini");
  assert.equal(messages.length, 1);
  const inbox = path.join(root, "projects", "demo", "coordination", "inbox", "gemini.md");
  assert.match(fs.readFileSync(inbox, "utf8"), /Revisar o contrato visual/);
}));

test("provedor inativo nao pode assumir trabalho", () => {
  const { PROVIDERS } = require("../tools/lib/coordination/config");
  const previous = PROVIDERS.claude.enabled;
  PROVIDERS.claude.enabled = false;
  try {
    const root = fixture();
    service.init(root, "demo");
    assert.throws(() => service.mutate(root, "demo", {
      type: "story.claimed",
      provider: "claude",
      storyId: "EP-05.02",
      payload: {},
    }), /inativo/);
  } finally {
    PROVIDERS.claude.enabled = previous;
  }
});

test("claim respeita dependencia anterior ainda pendente", () => withActiveProviders(() => {
  const root = fixture();
  service.init(root, "demo");
  assert.throws(() => service.mutate(root, "demo", {
    type: "story.claimed",
    provider: "codex",
    storyId: "EP-05.03",
    payload: {},
  }), /EP-05.02/);
}));

test("notificacao comunica sem transferir responsabilidade", () => withActiveProviders(() => {
  const root = fixture();
  service.init(root, "demo");
  service.mutate(root, "demo", {
    type: "message.sent",
    provider: "codex",
    storyId: "EP-05.02",
    payload: { to: "gemini", message: "Apenas um aviso" },
  });
  const state = service.get(root, "demo");
  assert.equal(state.stories["EP-05.02"].owner, "codex");
  assert.equal(service.inbox(root, "demo", "gemini").length, 1);
}));

test("conclusao exige evidencia", () => withActiveProviders(() => {
  const root = fixture();
  service.init(root, "demo");
  assert.throws(() => service.mutate(root, "demo", {
    type: "story.completed",
    provider: "codex",
    storyId: "EP-05.02",
    payload: {},
  }), /evidence/);
}));
