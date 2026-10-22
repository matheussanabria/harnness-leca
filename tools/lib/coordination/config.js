// @ts-check
// Frentes de trabalho do ledger. Tres chats usam o motor OpenCode; o que os diferencia
// e a FRENTE, nao o nome do motor. Por isso o owner e sempre "opencode/<frente>".
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
    enabled: false,
    autoDispatch: false,
    transport: "inbox",
    reason: "Limite de cota/tokens estourado; temporariamente inativo.",
  },
  "opencode/qualidade": {
    label: "OpenCode — Qualidade e Sessoes",
    enabled: true,
    autoDispatch: false,
    transport: "inbox",
    reason: "Regressao automatizada, divida de tipos, registro canonico de sessoes e event log.",
  },
  "opencode/jira": {
    label: "OpenCode — Jira",
    enabled: true,
    autoDispatch: false,
    transport: "inbox",
    reason: "Integracao com o Jira: snapshot, consulta e sincronizacao com o quadro.",
  },
  "opencode/deploy": {
    label: "OpenCode — Deploy",
    enabled: true,
    autoDispatch: false,
    transport: "inbox",
    reason: "Datacenter e deploys: pipelines, ambientes, saude, historico e acoes autorizadas.",
  },
  "claude/memoria": {
    label: "Claude Code — Memoria",
    enabled: true,
    autoDispatch: false,
    transport: "inbox",
    reason: "EP-13: export nao destrutivo e projecao da memoria para os motores.",
  },
  "opencode/memoria": {
    label: "OpenCode — Memoria",
    enabled: true,
    autoDispatch: false,
    transport: "inbox",
    reason: "EP-13: contrato, indice e ferramentas da memoria curada.",
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
  "EP-09": "opencode/qualidade",
  "EP-10": "opencode/deploy",
  "EP-11": "opencode/qualidade",
  "EP-12": "codex",
  "EP-13": "opencode/memoria",
};

/**
 * Owner por historia, quando a frente muda dentro de um epic.
 * O `sync` reconcilia esse mapa com o ledger, sem derrubarclaim ativo.
 */
const STORY_OWNERS = {
  "EP-05.07": "opencode/jira",
  "EP-09.01": "opencode/qualidade",
  "EP-09.02": "opencode/qualidade",
  "EP-09.03": "opencode/qualidade",
  "EP-09.04": "opencode/qualidade",
  "EP-09.05": "opencode/qualidade",
  "EP-10.01": "opencode/deploy",
  "EP-10.02": "opencode/deploy",
  "EP-10.03": "opencode/deploy",
  "EP-10.04": "opencode/deploy",
  "EP-10.05": "opencode/deploy",
  "EP-11.01": "opencode/qualidade",
  "EP-11.02": "opencode/qualidade",
  "EP-11.03": "opencode/qualidade",
  "EP-11.04": "opencode/qualidade",
  "EP-11.05": "opencode/qualidade",
  "EP-13.01": "claude/memoria",
  "EP-13.02": "opencode/memoria",
};

const PROVIDER_ALIASES = {
  antigravity: "gemini",
  "claude-code": "claude",
  "open-code": "opencode/qualidade",
  opencode: "opencode/qualidade",
  qualidade: "opencode/qualidade",
  jira: "opencode/jira",
  deploy: "opencode/deploy",
};

function normalizeProvider(value) {
  const key = String(value || "").trim().toLowerCase();
  return PROVIDER_ALIASES[key] || key;
}

module.exports = { PROVIDERS, EPIC_OWNERS, STORY_OWNERS, normalizeProvider };
