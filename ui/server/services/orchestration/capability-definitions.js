// @ts-check
// Definições declarativas das capacidades por provedor. Sem I/O de projeto, ambiente ou segredos.
const ENGINE_CATALOG = require("../../../../tools/lib/engines/catalog.json");

const OPERATIONS = {
  "execution.discover": { label: "Descobrir sessões", group: "execution" },
  "execution.send": { label: "Enviar mensagem", group: "execution" },
  "execution.stream": { label: "Transmitir resposta", group: "execution" },
  "execution.cancel": { label: "Cancelar execução", group: "execution" },
  "execution.resume": { label: "Retomar sessão", group: "execution" },
  "execution.pause": { label: "Pausar execução", group: "execution" },
  "execution.approval": { label: "Aprovação interativa", group: "execution" },
  "service.start": { label: "Iniciar serviço", group: "process" },
  "service.stop": { label: "Parar serviço", group: "process" },
  "service.logs": { label: "Transmitir logs", group: "process" },
  "service.killTree": { label: "Encerrar árvore de processos", group: "process" },
  "routine.list": { label: "Listar rotinas", group: "routine" },
  "routine.trigger": { label: "Disparar rotina", group: "routine" },
};

const DEFAULT_CAPABILITY = {
  state: "unavailable",
  mode: "unsupported",
  scope: "unknown",
  reason: "Sem mecanismo comprovado no Harness.",
};

/** @typedef {"available" | "degraded" | "unavailable" | "unknown"} CapabilityState */
/** @typedef {{ state: CapabilityState, mode: string, scope: string, reason: string }} Capability */

/** @param {Partial<Capability>} [extra] @returns {Capability} */
function capability(extra = {}) {
  return { ...DEFAULT_CAPABILITY, ...extra };
}

const execution = {
  discover: {
    claude: capability({ state: "available", mode: "native", scope: "provider", reason: "Lê sessões JSONL locais do Claude Code." }),
    gemini: capability({ state: "degraded", mode: "native", scope: "provider", reason: "Lê apenas transcripts locais do Antigravity; sem descoberta remota." }),
    opencode: capability({ state: "available", mode: "native", scope: "provider", reason: "Lê sessões no SQLite local do OpenCode." }),
    codex: capability({ state: "available", mode: "native", scope: "provider", reason: "Lê sessões JSONL locais do Codex." }),
    ollama: capability({ state: "unavailable", mode: "unsupported", scope: "provider", reason: "O daemon não mantém sessões de conversa." }),
  },
  send: {
    claude: capability({ state: "available", mode: "native", scope: "provider", reason: "Executa o Claude Code CLI local." }),
    gemini: capability({ state: "degraded", mode: "async_queue", scope: "provider", reason: "Com chave usa AI Studio; sem chave apenas enfileira na Bridge local." }),
    opencode: capability({ state: "available", mode: "native", scope: "provider", reason: "Envia pela porta HTTP local do OpenCode." }),
    codex: capability({ state: "available", mode: "native", scope: "provider", reason: "Executa o Codex CLI local." }),
    ollama: capability({ state: "available", mode: "local_daemon", scope: "provider", reason: "Envia ao daemon Ollama local quando há memória suficiente." }),
  },
  stream: {
    claude: capability({ state: "available", mode: "native", scope: "provider", reason: "Streaming do processo CLI." }),
    gemini: capability({ state: "available", mode: "native", scope: "provider", reason: "Streaming SSE do AI Studio; a Bridge não responde em tempo real." }),
    opencode: capability({ state: "available", mode: "native", scope: "provider", reason: "Streaming da porta HTTP local." }),
    codex: capability({ state: "available", mode: "native", scope: "provider", reason: "Streaming JSONL do processo CLI." }),
    ollama: capability({ state: "available", mode: "local_daemon", scope: "provider", reason: "Streaming do daemon Ollama local." }),
  },
  cancel: {
    claude: capability({ state: "degraded", mode: "owned_process", scope: "harness_owned", reason: "Só cancela execução iniciada pelo Harness; sessão externa não é cancelável." }),
    gemini: capability({ state: "degraded", mode: "owned_process", scope: "harness_owned", reason: "Cancela o AbortSignal do pedido atual; a Bridge não é cancelável." }),
    opencode: capability({ state: "degraded", mode: "owned_process", scope: "harness_owned", reason: "Cancela execução iniciada pelo Harness via /abort; execução externa não é presumida." }),
    codex: capability({ state: "degraded", mode: "owned_process", scope: "harness_owned", reason: "Cancela o subprocesso iniciado pelo Harness; execução externa não é cancelável." }),
    ollama: capability({ state: "degraded", mode: "owned_process", scope: "harness_owned", reason: "Cancela o AbortSignal do pedido atual." }),
  },
  resume: {
    claude: capability({ state: "available", mode: "native", scope: "provider", reason: "Retoma pelo UUID nativo do Claude Code." }),
    gemini: capability({ state: "unavailable", mode: "unsupported", scope: "provider", reason: "A API não guarda sessão nativa; continuidade usa replay de contexto." }),
    opencode: capability({ state: "degraded", mode: "native", scope: "provider", reason: "Retoma por ses_* em melhor esforço." }),
    codex: capability({ state: "available", mode: "native", scope: "provider", reason: "Retoma pelo UUID nativo do Codex CLI." }),
    ollama: capability({ state: "unavailable", mode: "unsupported", scope: "provider", reason: "Não há sessão nativa no daemon." }),
  },
  pause: {
    claude: capability(),
    gemini: capability(),
    opencode: capability(),
    codex: capability(),
    ollama: capability(),
  },
  approval: {
    claude: capability({ state: "available", mode: "native", scope: "harness_owned", reason: "Aprovação interativa via MCP do Claude Code." }),
    gemini: capability(),
    opencode: capability(),
    codex: capability(),
    ollama: capability(),
  },
};

const processes = {
  "service.start": capability({ state: "available", mode: "owned_process", scope: "project", reason: "Inicia serviços configurados no projeto." }),
  "service.stop": capability({ state: "available", mode: "owned_process", scope: "project", reason: "Para serviços iniciados pelo Harness." }),
  "service.logs": capability({ state: "available", mode: "native", scope: "project", reason: "Transmite logs dos serviços em execução." }),
  "service.killTree": capability({ state: "available", mode: "owned_process", scope: "project", reason: "Encerra o processo e seus descendentes." }),
};

const routines = {
  "routine.list": capability({ state: "available", mode: "native", scope: "project", reason: "Lê as rotinas declaradas em scheduled/*.md." }),
  "routine.trigger": capability({ state: "available", mode: "owned_process", scope: "project", reason: "Dispara a rotina em segundo plano com argumentos validados." }),
};

/** @param {string} engineId @param {Record<string, Capability>} operations */
function engineProvider(engineId, operations) {
  const entry = ENGINE_CATALOG[engineId] || {};
  return {
    id: engineId,
    label: entry.name || engineId,
    kind: "chat_engine",
    description: entry.description || "",
    auth: entry.auth || "",
    operations: { ...operations },
  };
}

const EXECUTION_KEYS = [
  ["execution.discover", "discover"],
  ["execution.send", "send"],
  ["execution.stream", "stream"],
  ["execution.cancel", "cancel"],
  ["execution.resume", "resume"],
  ["execution.pause", "pause"],
  ["execution.approval", "approval"],
];

/** @param {string} engineId */
function engineOperations(engineId) {
  return Object.fromEntries(EXECUTION_KEYS.map(([key, name]) => [
    key,
    execution[/** @type {keyof typeof execution} */ (name)][engineId],
  ]));
}

function buildProviders() {
  return {
    claude: engineProvider("claude", engineOperations("claude")),
    gemini: engineProvider("gemini", engineOperations("gemini")),
    opencode: engineProvider("opencode", engineOperations("opencode")),
    codex: engineProvider("codex", engineOperations("codex")),
    ollama: engineProvider("ollama", engineOperations("ollama")),
    proc_manager: {
      id: "proc_manager",
      label: "Gerenciador de Processos Locais",
      kind: "process_manager",
      description: "Serviços de desenvolvimento dos projetos.",
      auth: "",
      operations: { ...processes },
    },
    routines: {
      id: "routines",
      label: "Rotinas Agendadas DAI",
      kind: "routine_runner",
      description: "Rotinas declarativas em projects/<slug>/scheduled.",
      auth: "",
      operations: { ...routines },
    },
  };
}

module.exports = {
  OPERATIONS,
  buildProviders,
};
