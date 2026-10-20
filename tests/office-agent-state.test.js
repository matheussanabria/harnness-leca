// @ts-check
import test from "node:test";
import assert from "node:assert/strict";

import {
  AGENT_KEYS,
  STATUS_THEMES,
  OfficeAgentStateManager,
  officeAgentState
} from "../ui/public/js/office/office-agent-state.js";
import {
  avatarStateFor,
  bindChatExecutionTelemetry,
  bindOfficeStateTelemetry,
  mapChatExecutionStatus,
  padColorFor,
  syncAgentFromChatExecution,
  syncAgentsFromActivity
} from "../ui/public/js/office/office-agent-telemetry.js";
import {
  resetChatExecution,
  setChatExecutionStatus,
  setChatStreaming
} from "../ui/public/js/modules/chat-execution-store.js";

const EMOJI_REGEX = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]/u;

test("EP-03.05: catálogo canônico dos quatro motores e temas sem emojis", () => {
  assert.deepEqual([...AGENT_KEYS], ["claude", "gemini", "opencode", "codex"]);

  for (const [status, theme] of Object.entries(STATUS_THEMES)) {
    assert.ok(theme.label, `Estado ${status} deve ter rótulo`);
    assert.ok(theme.icon.startsWith("fa-solid"), `Estado ${status} deve usar FontAwesome`);
    assert.equal(EMOJI_REGEX.test(theme.label), false, `Rótulo de ${status} não pode ter emoji`);
    assert.equal(EMOJI_REGEX.test(theme.icon), false, `Ícone de ${status} não pode ter emoji`);
  }
});

test("EP-03.05: estado de fábrica, leitura isolada e agente desconhecido", () => {
  const manager = new OfficeAgentStateManager();

  assert.deepEqual(Object.keys(manager.getAllStates()).sort(), [...AGENT_KEYS].sort());
  for (const key of AGENT_KEYS) {
    const state = manager.getAgentState(key);
    assert.equal(state.status, "idle");
    assert.equal(state.activeCount, 0);
  }

  const snapshot = manager.getAgentState("claude");
  snapshot.status = "error";
  assert.equal(manager.getAgentState("claude").status, "idle", "Leitura não pode alterar o estado interno");

  const unknown = manager.getAgentState("inexistente");
  assert.equal(unknown.status, "offline");
  assert.equal(unknown.agentKey, "inexistente");
});

test("EP-03.05: atualização, validação de status e notificação de ouvintes", () => {
  const manager = new OfficeAgentStateManager();
  const received = [];
  const unsubscribe = manager.subscribe((states) => received.push(states.gemini.status));

  const updated = manager.setAgentState("gemini", { status: "thinking", currentTask: "Planejando" });
  assert.equal(updated.status, "thinking");
  assert.equal(updated.currentTask, "Planejando");
  assert.equal(received.at(-1), "thinking");

  manager.setAgentState("gemini", { status: "status-invalido" });
  assert.equal(manager.getAgentState("gemini").status, "thinking");

  unsubscribe();
  manager.setAgentState("gemini", { status: "streaming" });
  assert.equal(received.at(-1), "thinking", "Ouvinte removido não pode receber novas notificações");
});

test("EP-03.05: syncFromExecution mapeia telemetria de execução", () => {
  const manager = new OfficeAgentStateManager();

  assert.equal(manager.syncFromExecution("claude", { streaming: true }).status, "streaming");
  assert.equal(manager.syncFromExecution("claude", { status: "thinking" }).status, "thinking");
  assert.equal(manager.syncFromExecution("claude", { status: "waiting_approval" }).status, "waiting_approval");
  assert.equal(manager.syncFromExecution("claude", { status: "error" }).status, "error");
  assert.equal(manager.syncFromExecution("claude", { status: "offline" }).status, "offline");
  assert.equal(manager.syncFromExecution("claude", {}).status, "idle");
  assert.equal(manager.getAgentState("claude").activeCount, 0);
});

test("EP-03.05: telemetria traduz status do chat e visuais 3D", () => {
  assert.equal(mapChatExecutionStatus("streaming"), "streaming");
  assert.equal(mapChatExecutionStatus("waiting_approval"), "waiting_approval");
  assert.equal(mapChatExecutionStatus("cancelled"), "idle");
  assert.equal(mapChatExecutionStatus("error"), "error");
  assert.equal(mapChatExecutionStatus("desconhecido"), "idle");

  assert.equal(avatarStateFor("streaming"), "typing");
  assert.equal(avatarStateFor("thinking"), "typing");
  assert.equal(avatarStateFor("idle"), "sit");
  assert.equal(avatarStateFor("error"), "sit");

  officeAgentState.reset();
  syncAgentFromChatExecution("codex", { status: "streaming" });
  assert.equal(officeAgentState.getAgentState("codex").status, "streaming");
  assert.equal(officeAgentState.getAgentState("codex").activeCount, 1);
  assert.equal(padColorFor("streaming"), STATUS_THEMES.streaming.color);

  syncAgentFromChatExecution("codex", { status: "error" });
  assert.equal(officeAgentState.getAgentState("codex").activeCount, 0);
  assert.equal(syncAgentFromChatExecution("inexistente", { status: "error" }), null);
});

test("EP-03.05: resumo de atividade não sobrescreve execução transitória", () => {
  officeAgentState.reset();
  officeAgentState.setAgentState("gemini", { status: "streaming", activeCount: 1 });

  syncAgentsFromActivity({
    agents: {
      gemini: { status: "idle", activeCount: 0, currentTask: "Em espera" },
      codex: { status: "active", activeCount: 2, currentTask: "Dois chats" }
    }
  });

  assert.equal(officeAgentState.getAgentState("gemini").status, "streaming");
  assert.equal(officeAgentState.getAgentState("codex").status, "thinking");
  assert.equal(officeAgentState.getAgentState("codex").activeCount, 2);
  assert.equal(officeAgentState.getAgentState("claude").status, "idle");
});

test("EP-03.05: bindOfficeStateTelemetry assina, aplica e cancela sem efeitos colaterais", () => {
  officeAgentState.reset();
  const fakeState = {
    activeAgents: { agents: { claude: { status: "active", activeCount: 1 } } },
    listeners: [],
    subscribe(listener) {
      this.listeners.push(listener);
    }
  };

  const unbind = bindOfficeStateTelemetry(fakeState);
  assert.equal(fakeState.listeners.length, 1);
  assert.equal(officeAgentState.getAgentState("claude").status, "thinking");

  unbind();
  assert.equal(fakeState.listeners.length, 0);
});

test("EP-03.05: execuções reais do chat atualizam o agente e removem a assinatura", () => {
  officeAgentState.reset();
  const slug = "harness-leca";
  const chatId = `ep0305-${Date.now()}`;
  const unbind = bindChatExecutionTelemetry();

  setChatStreaming(slug, chatId, true, "opencode");
  assert.equal(officeAgentState.getAgentState("opencode").status, "streaming");
  assert.equal(officeAgentState.getAgentState("opencode").activeCount, 1);

  setChatExecutionStatus(slug, chatId, "waiting_approval");
  assert.equal(officeAgentState.getAgentState("opencode").status, "waiting_approval");

  setChatExecutionStatus(slug, chatId, "error");
  assert.equal(officeAgentState.getAgentState("opencode").status, "error");
  assert.equal(officeAgentState.getAgentState("opencode").activeCount, 0);

  unbind();
  setChatExecutionStatus(slug, chatId, "streaming");
  assert.equal(officeAgentState.getAgentState("opencode").status, "error");
  resetChatExecution(slug, chatId);
});
