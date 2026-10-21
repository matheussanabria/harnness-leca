// @ts-check
const PROVIDERS = {
  claude: {
    label: "Claude Code",
    enabled: false,
    autoDispatch: false,
    transport: "inbox",
    reason: "Atuando em design e outras funcoes; atualmente inativo na fila.",
  },
  gemini: {
    label: "Gemini / Antigravity",
    enabled: true,
    autoDispatch: false,
    transport: "inbox",
    reason: "Frente visual e experiencia.",
  },
  opencode: {
    label: "OpenCode",
    enabled: true,
    autoDispatch: false,
    transport: "inbox",
    reason: "Tarefas deterministicas, plataforma e extracao em lote.",
  },
  codex: {
    label: "Codex",
    enabled: false,
    autoDispatch: false,
    transport: "inbox",
    reason: "Limite de cota/tokens estourado; temporariamente inativo.",
  },
};

const EPIC_OWNERS = {
  "EP-00": "codex",
  "EP-01": "codex",
  "EP-02": "gemini",
  "EP-03": "gemini",
  "EP-04": "codex",
  "EP-05": "codex",
  "EP-06": "gemini",
  "EP-07": "codex",
  "EP-08": "codex",
  "EP-09": "gemini",
  "EP-10": "codex",
  "EP-11": "codex",
  "EP-12": "codex",
};

const PROVIDER_ALIASES = {
  antigravity: "gemini",
  "claude-code": "claude",
  "open-code": "opencode",
};

function normalizeProvider(value) {
  const key = String(value || "").trim().toLowerCase();
  return PROVIDER_ALIASES[key] || key;
}

module.exports = { PROVIDERS, EPIC_OWNERS, normalizeProvider };
