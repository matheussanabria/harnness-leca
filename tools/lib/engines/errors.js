// @ts-check
// Erros dos motores de chat, traduzidos para a pessoa que está usando a interface: o que aconteceu, o que fazer
// e (para erros não reconhecidos) um trecho técnico já limpo de segredos e caminhos da máquina.
//
//   describeError(erro, { engine }) -> { code, title, message, hint?, detail?, retryable, expected }
//
// `message` e `hint` são textos nossos, seguros para ir ao navegador. `detail` é o trecho original depois de
// passar pelo redact, sem caminhos absolutos e sem stack trace. `expected: false` marca o erro que não
// reconhecemos (esse o servidor ainda registra por inteiro no terminal).
const { redact } = require("../redact");
const { PublicError } = require("./common");

const ENGINE_NAME = { claude: "Claude Code", gemini: "Gemini", opencode: "OpenCode" };

/** Como entrar de novo em cada motor. */
const LOGIN_HINT = {
  claude: "Abra um terminal, rode `claude` e faça /login (ou configure ANTHROPIC_API_KEY em global/.env).",
  gemini: "Defina GEMINI_API_KEY em global/.env e reinicie a interface.",
  opencode: "Rode `opencode auth login` no terminal e tente de novo.",
};

/**
 * Cada regra casa com o texto do erro (em minúsculas). A primeira que casar vence, então as mais específicas ficam antes.
 * @type {Array<{ code: string, re: RegExp, engines?: string[], title: string, message: (e: string) => string, hint?: (e: string) => string, retryable?: boolean }>}
 */
const RULES = [
  { code: "session", re: /no conversation found|session (id )?.*(not found|does not exist|invalid)|sess[aã]o .*(n[aã]o encontrada|inv[aá]lida)/,
    title: "Sessão não encontrada", message: () => "A conversa anterior deste motor não existe mais, então não dá para continuá-la.", hint: () => "Clique em “Novo Chat” e envie de novo." },
  { code: "context", re: /prompt is too long|context (length|window)|too many tokens|maximum context|exceeds the (maximum|context)|input is too long/,
    title: "Conversa grande demais", message: () => "A conversa passou do tamanho que o modelo consegue ler de uma vez.", hint: () => "Comece um novo chat e cole só o resumo do que importa." },
  { code: "limit", re: /usage limit|limit reached|rate.?limit|429|too many requests|quota|resource.?exhausted|you.ve hit your limit|credit balance/,
    title: "Limite de uso atingido", message: (e) => `O plano ou a cota deste motor acabou por agora${resetOf(e)}.`, hint: (e) => (/credit balance/.test(e) ? "Adicione créditos na conta do provedor." : "Espere o limite renovar ou troque de motor."), retryable: true },
  { code: "overloaded", re: /overloaded|\b529\b|\b503\b|service unavailable|temporarily unavailable|try again later/,
    title: "Serviço sobrecarregado", message: () => "O serviço do modelo está sobrecarregado ou fora do ar neste momento.", hint: () => "Tente de novo em alguns instantes.", retryable: true },
  { code: "auth", re: /not logged in|please run \/?login|invalid api key|invalid x-api-key|authentication[_ ]error|unauthorized|\b401\b|\b403\b.*(key|permission)|api key not valid|oauth token|credentials/,
    title: "Não autenticado", message: (_e) => "O motor não está autenticado ou a chave de acesso foi recusada.", hint: undefined },
  { code: "model", re: /model.*(not found|does not exist|not available|invalid)|invalid model|unknown model|not_found_error.*model|\b404\b.*model/,
    title: "Modelo indisponível", message: () => "O modelo escolhido não existe ou a sua conta não tem acesso a ele.", hint: () => "Escolha outro modelo na lista do chat." },
  { code: "not_found", re: /n[aã]o encontrado no path|spawn .* enoent|enoent|command not found|n[aã]o foi poss[ií]vel iniciar/,
    title: "Motor não encontrado", message: () => "O programa deste motor não foi encontrado nesta máquina.", hint: () => "Confira a instalação e o caminho (CLAUDE_BIN / OPENCODE_BIN em global/.env)." },
  { code: "upstream", re: /upstream (connection )?(lost|closed|reset|error|disconnected|failed)|connection (lost|closed|reset) (by|from|to) upstream/,
    title: "Conexão com o provedor caiu", message: () => "A conexão entre o OpenCode (ou o 9router) e o provedor do modelo caiu no meio da resposta.",
    hint: () => "Envie “continue” ou tente de novo. Se repetir com o modelo Harness, confira o 9router e o provedor ou troque de modelo.", retryable: true },
  { code: "server_down", re: /econnrefused.*(63186|opencode)|opencode.*(econnrefused|n[aã]o est[aá] rodando|fetch failed)/,
    title: "OpenCode desligado", message: () => "O servidor do OpenCode não está rodando.", hint: () => "Inicie com `npm run opencode` e tente de novo.", retryable: true },
  { code: "server_down", engines: ["opencode"], re: /fetch failed|econnrefused|econnreset|socket hang up|failed to fetch|network/,
    title: "OpenCode desligado", message: () => "O servidor do OpenCode (ou o 9router, se o modelo for o Harness) não está respondendo.",
    hint: () => "Ligue com `npm run opencode` e, para o modelo Harness, rode `9router`. A interface tenta ligar os dois ao iniciar (HARNESS_AUTOSTART=0 desliga).", retryable: true },
  { code: "local_offline", engines: ["ollama"], re: /enotfound|econnrefused|econnreset|etimedout|eai_again|fetch failed|network|socket hang up|getaddrinfo|failed to fetch/,
    title: "Ollama desligado", message: () => "O modelo local roda na sua própria máquina e o serviço do Ollama não respondeu.", hint: () => "Instale o Ollama (ollama.com/download) e rode `ollama serve`; para baixar o modelo: `ollama pull qwen2.5-coder:1.5b`.", retryable: true },
  { code: "network", re: /enotfound|econnrefused|econnreset|etimedout|eai_again|fetch failed|network|socket hang up|getaddrinfo|failed to fetch/,
    title: "Sem conexão", message: () => "Não foi possível falar com o serviço do modelo (rede, VPN ou firewall).", hint: () => "Confira a internet e tente de novo.", retryable: true },
  { code: "mcp", re: /mcp\.json|mcp server|mcp.*(failed|error|invalid|n[aã]o)|servidor ".*" n[aã]o est[aá] em/,
    title: "Problema nos MCPs do projeto", message: () => "A configuração dos MCPs deste projeto (projects/<slug>/mcp.json) tem um problema.", hint: () => "Veja o detalhe abaixo e corrija o mcp.json." },
  { code: "max_turns", re: /error_max_turns|max.?turns/,
    title: "Passos demais", message: () => "O Claude atingiu o limite de passos desta resposta antes de terminar.", hint: () => "Peça para continuar de onde parou.", retryable: true },
  { code: "permission", re: /permission|not allowed|requires approval|was blocked|permiss[aã]o/,
    title: "Ação bloqueada", message: () => "O motor tentou fazer algo que não está liberado para este projeto.", hint: () => "Responda ao cartão de permissão no chat, ou ajuste o modo em mcp.json (“completo” permite editar e rodar comandos)." },
  { code: "timeout", re: /tempo limite|timed? ?out|timeout|deadline/,
    title: "Tempo esgotado", message: () => "O motor demorou demais para responder.", hint: () => "Tente de novo; para tarefas longas, divida em passos menores.", retryable: true },
  { code: "refused", re: /content policy|safety|blocked by|refus|recusou/,
    title: "Pedido recusado", message: () => "O modelo recusou este pedido.", hint: () => "Reescreva o pedido com mais contexto ou outro enfoque." },
  { code: "execution_error", re: /error_during_execution/,
    title: "Falha na execução do Claude Code", message: () => "O Claude Code encontrou um erro durante a execução da instrução.", hint: () => "Verifique se já existe outra sessão do Claude Code ativa no terminal (conflito de lock) ou tente um Novo Chat.", retryable: true },
  { code: "http", re: /\bhttp (4\d\d|5\d\d)\b|status (4\d\d|5\d\d)/,
    title: "O serviço devolveu um erro", message: () => "O serviço do modelo respondeu com um erro.", hint: () => "Tente de novo; se continuar, veja o detalhe abaixo.", retryable: true },
];

/** “resets at 3pm” / “reset em 14h” viram um complemento curto; vazio se não houver. */
function resetOf(/** @type {string} */ e) {
  const m = e.match(/resets?(?: at| in| em| às)?\s+([^.\n|]{2,30})/);
  return m ? ` (renova ${m[1].trim()})` : "";
}

/** Texto técnico seguro para mostrar: sem segredos, sem caminhos absolutos, sem stack trace, curto. */
function sanitize(/** @type {unknown} */ raw, max = 400) {
  const lines = String(raw == null ? "" : raw).split(/\r?\n/).filter((l) => !/^\s+at\s/.test(l));
  let t = redact(lines.join(" ")).replace(/\s+/g, " ").trim();
  // C:\Users\x\git\proj\arquivo.js ou /home/x/proj/arquivo.js -> …/arquivo.js
  t = t.replace(/(?:[A-Za-z]:)?(?:[\\/][^\s\\/:"'<>|]+){2,}[\\/]([^\s\\/:"'<>|]+)/g, "…/$1");
  return t.length > max ? t.slice(0, max - 1) + "…" : t;
}

/**
 * @param {unknown} err  Error, string ou { message }
 * @param {{ engine?: string, status?: number }} [ctx]
 * @returns {{ code: string, title: string, message: string, hint?: string, detail?: string, retryable: boolean, expected: boolean }}
 */
function describeError(err, ctx = {}) {
  const raw = err && typeof err === "object" && "message" in err ? String(/** @type {any} */ (err).message) : String(err == null ? "" : err);
  const text = raw.toLowerCase() + (ctx.status ? ` http ${ctx.status}` : "");
  const engine = ctx.engine || "";
  const who = ENGINE_NAME[engine] || "O motor";
  const isPublic = err instanceof PublicError;

  for (const r of RULES) {
    if (!r.re.test(text)) continue;
    if (r.engines && !r.engines.includes(engine)) continue;
    let hint = r.hint ? r.hint(text) : undefined;
    if (r.code === "auth") hint = LOGIN_HINT[engine] || "Confira a chave ou o login deste motor.";
    // Erros do próprio harness (PublicError) já vêm com texto claro: mantém o texto e só ganha o título/dica.
    const message = isPublic ? raw : r.message(text).replace(/^O motor/, who);
    const detail = isPublic ? undefined : sanitize(raw);
    return { code: r.code, title: r.title, message, hint, detail: detail && detail !== message ? detail : undefined, retryable: !!r.retryable, expected: true };
  }
  if (isPublic) return { code: "public", title: "Aviso do harness", message: raw, retryable: false, expected: true };
  return {
    code: "unknown", title: "Erro inesperado", message: `${who} devolveu um erro que o harness não reconheceu.`,
    hint: "O detalhe completo está no terminal do servidor.", detail: sanitize(raw) || undefined, retryable: false, expected: false,
  };
}

/** O que vai ao navegador: `error` continua sendo a mensagem (compatível com quem só lê esse campo).
 * @param {ReturnType<typeof describeError>} info
 * @returns {import("../types").ErrorEvent} */
function errorEvent(info) {
  return { type: "error", error: info.message, code: info.code, title: info.title, hint: info.hint, detail: info.detail, retryable: info.retryable };
}

module.exports = { describeError, errorEvent, sanitize, RULES };
