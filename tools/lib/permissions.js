// @ts-check
// Pedidos de permissão do Claude Code respondidos pela interface do harness.
//
// O chat roda `claude -p`, em que ninguém responde a pedidos de permissão: o que não está liberado é negado. Com
// `--permission-prompt-tool`, o Claude chama uma ferramenta MCP (tools/permission-mcp.js) a cada pedido; ela chama
// o servidor da interface, que cai aqui: o pedido vira um cartão no chat e a resposta da pessoa volta ao Claude.
//
// Escopos da resposta: "once" (só este pedido), "chat" (até a conversa acabar) e "project" (fica em
// projects/<slug>/permissions.json). Permissão de arquivo vale para a PASTA (leitura, ou leitura e escrita).
// Comandos nunca viram regra do projeto; caminhos sensíveis (.env, .ssh...) só valem uma vez.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { ROOT } = require("./root");

const TIMEOUT_MS = Number(process.env.HARNESS_PERM_TIMEOUT_MS) || 10 * 60 * 1000;
const READ_TOOLS = new Set(["Read", "Glob", "Grep"]);
const WRITE_TOOLS = new Set(["Edit", "Write", "NotebookEdit", "MultiEdit"]);
const COMMAND_TOOLS = new Set(["Bash", "PowerShell"]);
const SENSITIVE = /(^|\/)(\.env(\.[^/]*)?|\.ssh|\.aws|\.gnupg|\.npmrc|\.netrc|id_rsa[^/]*|id_ed25519[^/]*|credentials[^/]*|\.git\/config|\.claude\/(settings[^/]*|\.credentials[^/]*))(\/|$)/i;

/** @typedef {{ kind: "dir", dir: string, access: "read" | "write" } | { kind: "tool", tool: string }} Rule */
/** @typedef {{ id: string, chatId: string, slug: string, tool: string, input: Record<string, unknown>, view: PermissionView, resolve: (d: Decision) => void, timer: NodeJS.Timeout }} Pending */
/** @typedef {{ behavior: "allow" | "deny", message?: string }} Decision */
/**
 * @typedef {object} PermissionView
 * @property {string} id
 * @property {string} tool
 * @property {"file" | "command" | "other"} kind
 * @property {"read" | "write" | ""} access
 * @property {string} summary    texto curto para o cartão
 * @property {string} [path]     arquivo ou pasta pedido
 * @property {string} [dir]      pasta que a permissão cobriria
 * @property {string} [command]
 * @property {boolean} sensitive
 * @property {string[]} scopes   escopos que a pessoa pode escolher: once, chat, project
 */

/** @type {Map<string, Pending>} */ const pending = new Map();
/** @type {Map<string, { slug: string, emit: (e: object) => void, rules: Rule[] }>} */ const chats = new Map();

// ---------- caminhos ----------

const slash = (/** @type {string} */ p) => String(p).split("\\").join("/");
const fold = (/** @type {string} */ p) => (process.platform === "win32" ? p.toLowerCase() : p);
const normPath = (/** @type {string} */ p) => slash(path.resolve(p)).replace(/\/+$/, "");
const under = (/** @type {string} */ dir, /** @type {string} */ p) => { const d = fold(normPath(dir)), x = fold(normPath(p)); return x === d || x.startsWith(d + "/"); };

/** Caminho pedido por uma ferramenta de arquivo, ou "". */
function requestedPath(/** @type {Record<string, unknown>} */ input) {
  for (const k of ["file_path", "notebook_path", "path"]) if (typeof input[k] === "string" && input[k]) return String(input[k]);
  return "";
}

/** Pasta que uma permissão de arquivo cobriria: a do arquivo, ou o próprio caminho se for pasta. */
function dirOf(/** @type {string} */ p) {
  const abs = path.resolve(p);
  try { if (fs.statSync(abs).isDirectory()) return normPath(abs); } catch { /* não existe ainda (Write novo) */ }
  return normPath(path.dirname(abs));
}

// ---------- visão do pedido ----------

/** @param {string} id @param {string} tool @param {Record<string, unknown>} input @returns {PermissionView} */
function describe(id, tool, input) {
  const isRead = READ_TOOLS.has(tool), isWrite = WRITE_TOOLS.has(tool), p = requestedPath(input);
  if ((isRead || isWrite) && p) {
    const sensitive = SENSITIVE.test(slash(path.resolve(p)));
    const verb = isWrite ? (tool === "Write" ? "Gravar" : "Editar") : tool === "Read" ? "Ler" : tool === "Glob" ? "Listar" : "Buscar em";
    return {
      id, tool, kind: "file", access: isWrite ? "write" : "read", summary: `${verb}: ${slash(p)}`, path: slash(p), dir: dirOf(p), sensitive,
      scopes: sensitive ? ["once"] : ["once", "chat", "project"],
    };
  }
  if (COMMAND_TOOLS.has(tool) && typeof input.command === "string") {
    return { id, tool, kind: "command", access: "", summary: `Executar (${tool}): ${input.command}`, command: input.command, sensitive: false, scopes: ["once", "chat"] };
  }
  return { id, tool, kind: "other", access: "", summary: `Usar a ferramenta ${tool}`, sensitive: false, scopes: ["once", "chat", "project"] };
}

// ---------- regras ----------

const rulesFile = (/** @type {string} */ slug) => path.join(ROOT, "projects", slug, "permissions.json");

/** @param {string} slug @returns {Rule[]} */
function projectRules(slug) {
  try {
    const j = JSON.parse(fs.readFileSync(rulesFile(slug), "utf8").replace(/^\uFEFF/, ""));
    return (Array.isArray(j.allow) ? j.allow : []).filter((/** @type {any} */ r) => r && (r.kind === "dir" ? typeof r.dir === "string" : r.kind === "tool" && typeof r.tool === "string"));
  } catch { return []; }
}

function saveProjectRules(/** @type {string} */ slug, /** @type {Rule[]} */ allow) {
  fs.writeFileSync(rulesFile(slug), JSON.stringify({ allow }, null, 2), "utf8");
}

const sameRule = (/** @type {Rule} */ a, /** @type {Rule} */ b) =>
  a.kind === b.kind && (a.kind === "dir" ? fold(a.dir) === fold(/** @type {any} */ (b).dir) && a.access === /** @type {any} */ (b).access : a.tool === /** @type {any} */ (b).tool);

/** Já existe regra (do projeto ou da conversa) que cobre este pedido? */
function covered(/** @type {Rule[]} */ rules, /** @type {PermissionView} */ v) {
  if (v.sensitive) return false;
  if (v.kind === "command") return rules.some((r) => r.kind === "tool" && r.tool === `${v.tool}:${v.command}`); // só o mesmo comando, e só na conversa
  return rules.some((r) => {
    if (v.kind === "file" && r.kind === "dir") return (r.access === "write" || v.access === "read") && under(r.dir, v.path || "");
    return v.kind === "other" && r.kind === "tool" && r.tool === v.tool;
  });
}

/** Regra que a resposta cria para o escopo escolhido; null quando o escopo não cria regra. */
function ruleFor(/** @type {PermissionView} */ v) {
  if (v.kind === "file") return /** @type {Rule} */ ({ kind: "dir", dir: v.dir || "", access: v.access === "write" ? "write" : "read" });
  if (v.kind === "other") return /** @type {Rule} */ ({ kind: "tool", tool: v.tool });
  return null;
}

/** @param {string} slug */
function listRules(slug) { return projectRules(slug); }

/** @param {string} slug @param {number} index @returns {boolean} */
function removeRule(slug, index) {
  const rules = projectRules(slug);
  if (!Number.isInteger(index) || index < 0 || index >= rules.length) return false;
  rules.splice(index, 1);
  saveProjectRules(slug, rules);
  return true;
}

// ---------- conversas e pedidos ----------

/** Liga uma conversa do chat à interface: `emit` recebe os eventos do cartão (permission / permission_resolved). */
function attachChat(/** @type {string} */ chatId, /** @type {string} */ slug, /** @type {(e: object) => void} */ emit) {
  chats.set(chatId, { slug, emit, rules: [] });
}

/** Fim da conversa: pedidos ainda abertos são negados (ninguém mais vai responder). */
function detachChat(/** @type {string} */ chatId) {
  for (const p of [...pending.values()]) if (p.chatId === chatId) settle(p, { behavior: "deny", message: "A conversa foi encerrada antes da resposta." }, "deny", "once", false);
  chats.delete(chatId);
}

function settle(/** @type {Pending} */ p, /** @type {Decision} */ d, /** @type {string} */ decision, /** @type {string} */ scope, /** @type {boolean} */ auto) {
  if (!pending.delete(p.id)) return;
  clearTimeout(p.timer);
  const chat = chats.get(p.chatId);
  if (chat) { try { chat.emit({ type: "permission_resolved", id: p.id, decision, scope, auto }); } catch { /* conexão fechada */ } }
  p.resolve(d);
}

/**
 * Pedido vindo do Claude. Responde na hora se uma regra cobre; senão mostra o cartão e espera a pessoa.
 * @param {{ chatId: string, tool: string, input?: Record<string, unknown> }} req
 * @returns {Promise<Decision>}
 */
function request({ chatId, tool, input = {} }) {
  const chat = chats.get(chatId);
  if (!chat) return Promise.resolve({ behavior: "deny", message: "Conversa desconhecida: o pedido não pôde ser mostrado na interface." });
  if (typeof tool !== "string" || !tool) return Promise.resolve({ behavior: "deny", message: "Pedido de permissão inválido." });

  const id = crypto.randomUUID();
  const view = describe(id, tool, input && typeof input === "object" ? input : {});
  if (covered([...projectRules(chat.slug), ...chat.rules], view)) {
    try { chat.emit({ type: "permission", ...view, auto: true }); chat.emit({ type: "permission_resolved", id, decision: "allow", scope: "rule", auto: true }); } catch { /* fechada */ }
    return Promise.resolve({ behavior: "allow" });
  }
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      const p = pending.get(id);
      if (p) settle(p, { behavior: "deny", message: "Sem resposta da interface a tempo: pedido negado." }, "deny", "timeout", false);
    }, TIMEOUT_MS);
    if (timer.unref) timer.unref();
    pending.set(id, { id, chatId, slug: chat.slug, tool, input, view, resolve, timer });
    try { chat.emit({ type: "permission", ...view }); } catch { /* fechada: o timeout nega */ }
  });
}

/**
 * Resposta da pessoa. Retorna { ok, error }.
 * @param {string} id @param {{ decision?: string, scope?: string }} answer
 */
function answer(id, { decision, scope } = {}) {
  const p = pending.get(id);
  if (!p) return { ok: false, error: "Pedido não encontrado (já respondido ou expirado)." };
  if (decision !== "allow" && decision !== "deny") return { ok: false, error: "decision deve ser allow ou deny." };
  if (decision === "deny") {
    settle(p, { behavior: "deny", message: "O usuário negou esta permissão na interface." }, "deny", "once", false);
    return { ok: true };
  }
  // O escopo pedido é limitado ao que o cartão oferecia: sensível e comando não passam de "chat".
  const sc = p.view.scopes.includes(String(scope)) ? String(scope) : "once";
  const rule = sc === "once" ? null : ruleFor(p.view);
  const chat = chats.get(p.chatId);
  if (rule && sc === "chat" && chat && !chat.rules.some((r) => sameRule(r, rule))) chat.rules.push(rule);
  if (rule && sc === "project") {
    const rules = projectRules(p.slug);
    if (!rules.some((r) => sameRule(r, rule))) { rules.push(rule); saveProjectRules(p.slug, rules); }
  }
  // Comando liberado "na conversa": vale só o mesmo comando, à parte das regras de pasta/ferramenta.
  if (sc === "chat" && p.view.kind === "command" && chat) chat.rules.push({ kind: "tool", tool: `${p.tool}:${p.view.command}` });
  settle(p, { behavior: "allow" }, "allow", sc, false);
  return { ok: true };
}

/** Pedidos abertos de uma conversa (a interface mostra de novo se a página recarregar). */
function pendingFor(/** @type {string} */ chatId) { return [...pending.values()].filter((p) => p.chatId === chatId).map((p) => p.view); }

module.exports = { request, answer, attachChat, detachChat, pendingFor, listRules, removeRule, describe, covered, TIMEOUT_MS };
