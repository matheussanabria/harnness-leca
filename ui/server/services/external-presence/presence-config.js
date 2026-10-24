// @ts-check
// Constantes e raizes do scanner de presenca externa (T2.4, docs/harness-telemetria/06-external-presence-design.md).
//
// Tudo que e limiar, intervalo ou caminho padrao mora aqui; os demais modulos so importam.
// O scanner le apenas METADADOS (mtime, nomes de arquivo, colunas de id/cwd/data). Nunca o conteudo
// de transcritos.
const os = require("os");
const path = require("path");

/** Limiares de idade do ultimo sinal (design 06, tabela de inferencia). */
const THRESHOLDS = Object.freeze({
  /** Abaixo disto: activity=processing, presence=connected. */
  processingMs: 30 * 1000,
  /** Abaixo disto: activity=idle, presence=connected. */
  idleMs: 15 * 60 * 1000,
  /** Abaixo disto: activity=unknown, presence=no_recent_signal. Acima: nao publica. */
  noRecentSignalMs: 8 * 60 * 60 * 1000,
});

/** Enquanto processing, um novo evento no maximo a cada janela (mantem o sinal vivo no cliente). */
const HEARTBEAT_MS = 60 * 1000;

/** Arquivo ja antigo demais (frio) so volta a ser consultado (stat) apos esta janela. */
const COLD_SWEEP_MS = 60 * 1000;

const DEFAULT_INTERVAL_MS = 5000;
const MIN_INTERVAL_MS = 1000;

/** Janela de cache dos casadores de projeto (relê projects/ e .sources.json). */
const MATCHER_TTL_MS = 60 * 1000;

/**
 * Ids de motor publicados. Antigravity usa "gemini" (id do catalogo e do painel do escritorio;
 * `coordination/config.js` mapeia o apelido antigravity -> gemini).
 */
const ENGINES = Object.freeze({
  claude: "claude",
  codex: "codex",
  antigravity: "gemini",
  opencode: "opencode",
});

const SOURCE_KIND = "presence-scanner";
const SIGNAL = "mtime";

/**
 * Raizes padrao dos quatro motores. Os testes injetam diretorios temporarios no lugar destas.
 * @param {string} [home]
 * @returns {PresenceRoots}
 */
function defaultRoots(home = os.homedir()) {
  return {
    claudeProjects: path.join(home, ".claude", "projects"),
    codexHome: path.join(home, ".codex"),
    antigravityBrains: [
      path.join(home, ".gemini", "antigravity-ide", "brain"),
      path.join(home, ".gemini", "antigravity", "brain"),
    ],
    antigravitySummaryDbs: [path.join(home, ".gemini", "antigravity", "conversation_summaries.db")],
    opencodeDb: path.join(home, ".local", "share", "opencode", "opencode.db"),
  };
}

/**
 * @typedef {Object} PresenceRoots
 * @property {string} claudeProjects  ~/.claude/projects
 * @property {string} codexHome       ~/.codex (sessions/YYYY/MM/DD/rollout-*.jsonl e state_5.sqlite)
 * @property {string[]} antigravityBrains  raizes `brain` (IDE e segundo runtime)
 * @property {string[]} antigravitySummaryDbs  conversation_summaries.db (cwd por conversa; so metadados)
 * @property {string} opencodeDb      opencode.db (somente leitura)
 */

/**
 * @typedef {Object} Candidate
 * @property {string} engine      id publicado (ENGINES)
 * @property {string} nativeId    id nativo da sessao
 * @property {number} signalMs    mtime do ultimo sinal (epoch ms)
 * @property {string} hint        texto de cwd/pasta para atribuir o projeto (nunca conteudo de transcrito)
 */

module.exports = {
  THRESHOLDS,
  HEARTBEAT_MS,
  COLD_SWEEP_MS,
  DEFAULT_INTERVAL_MS,
  MIN_INTERVAL_MS,
  MATCHER_TTL_MS,
  ENGINES,
  SOURCE_KIND,
  SIGNAL,
  defaultRoots,
};
