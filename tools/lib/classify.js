// @ts-check
// Classificador de temas de uma conversa, SEM modelo e sem rede: lê a conversa inteira (título, pedidos do usuário,
// respostas) e a atividade registrada nos blocos :::tool (skills, agentes, arquivos editados, comandos) e devolve
// os nós da árvore de tools/lib/taxonomy.js que se aplicam. Uma conversa pode ter vários temas.
// Medido contra um gabarito feito à mão (29 conversas): F1 por pai 0,22 (heurística antiga) -> ~0,5.
const { flatNodes, norm } = require("./taxonomy");
const { splitTurns, stripFrontmatter, stripBlocks, readMeta } = require("./chat-format");

const NODES = flatNodes();
const esc = (/** @type {string} */ s) => s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
// Cada palavra-chave vira um regex de palavra inteira (ou de prefixo, se terminar com "*"), sobre texto sem acento.
const COMPILED = NODES.map((n) => ({
  id: n.id,
  res: n.kw.map((k) => {
    const prefix = k.endsWith("*"), w = esc(norm(prefix ? k.slice(0, -1) : k)).replace(/\s+/g, "\\s+");
    return new RegExp(`(?<![a-z0-9])${w}${prefix ? "[a-z]*" : ""}(?![a-z0-9])`, "g");
  }),
}));

// Corte medido no gabarito: nó só entra com pontuação mínima e com pelo menos metade da pontuação do primeiro.
const MIN_SCORE = 2, REL_SCORE = 0.5;
const SIGNAL_BONUS = 4; // um sinal objetivo (comando, arquivo, skill) vale mais que uma palavra solta

const count = (/** @type {RegExp} */ re, /** @type {string} */ s) => (s.match(re) || []).length;

// ---------- sinais de atividade (os mesmos blocos que o Diário lê) ----------

const PATH_KEYS = ["AbsolutePath", "TargetFile", "file_path", "filePath", "path"];
const CMD_KEYS = ["CommandLine", "command"];
const WRITE_TOOLS = /edit|write|replace|create/i;

/** @param {string} body @returns {{ skills: Set<string>, agents: Set<string>, files: string[], cmds: string[] }} */
function activity(body) {
  const out = { skills: new Set(), agents: new Set(), files: /** @type {string[]} */ ([]), cmds: /** @type {string[]} */ ([]) };
  for (const m of body.matchAll(/^:::tool ([^|\n]+?)\s*(?:\|[^\n]*)?\n([\s\S]*?)^:::$/gm)) {
    const tool = m[1].trim(), entry = (m[2].split(/^--- resultado/m)[0] || "").replace(/^--- entrada\s*/m, "");
    /** @type {Record<string, unknown>} */ let json = {};
    try { json = JSON.parse(entry); } catch { /* entrada truncada: segue sem campos */ }
    if (/^skill$/i.test(tool)) out.skills.add(String(json.skill || json.name || "?"));
    if (/^(agent|task)$/i.test(tool)) out.agents.add(String(json.subagent_type || json.agent || "?"));
    for (const k of PATH_KEYS) if (typeof json[k] === "string" && WRITE_TOOLS.test(tool)) out.files.push(String(json[k]).split("\\").join("/"));
    for (const k of CMD_KEYS) if (typeof json[k] === "string") out.cmds.push(String(json[k]));
  }
  return out;
}

/** Nós sugeridos só pela atividade, com o motivo de cada um. @returns {Map<string, string>} */
function signalNodes(/** @type {ReturnType<typeof activity>} */ a) {
  const out = new Map(), cmds = a.cmds.join("\n"), files = a.files;
  const has = (/** @type {RegExp} */ re) => files.some((f) => re.test(f));
  if (a.skills.size || a.agents.size) out.set("ia/agentes", "usou skills/subagentes");
  if (has(/(^|\/)(\.claude|agents|skills)\//) || has(/SKILL\.md$|CLAUDE\.md$/)) out.set("ia/prompt", "editou skills/instruções");
  if (/\bgit (commit|push|merge|rebase|checkout|branch|stash|cherry-pick)\b/.test(cmds)) out.set("entrega/git", "rodou comandos git");
  if (/\bdocker|compose\b/.test(cmds)) out.set("entrega/infra", "rodou docker");
  if (has(/\.github\/workflows|Jenkinsfile/)) out.set("entrega/cicd", "editou pipeline");
  if (has(/\.(spec|test)\.[jt]sx?$|Test\.java$|\.feature$/i) || /\b(newman|jest|vitest|ng test|npm (run )?test|mvn\b.*\btest)\b/.test(cmds)) out.set("qualidade/testes", "editou/rodou testes");
  if (has(/\.(scss|css|html|tsx)$/)) out.set("frontend/telas", "editou telas/estilos");
  if (has(/\.java$/)) out.set("backend/api", "editou Java");
  if (has(/\.sql$|liquibase|migration/i)) out.set("backend/banco", "editou SQL/migrations");
  if (files.some((f) => /\.md$/i.test(f) && /(^|\/)(docs?|dossie|readme)/i.test(f))) out.set("doc/docs", "editou documentação");
  return out;
}

// ---------- pontuação por palavra-chave ----------

/**
 * @typedef {{ id: string, score: number, signal?: string }} Hit
 * @param {{ title?: string, user?: string, rest?: string, activityBody?: string }} c
 * @returns {Hit[]} nós aplicáveis, do mais forte para o mais fraco
 */
function classify(c) {
  const T = norm(c.title || ""), U = norm(c.user || ""), R = norm(c.rest || "");
  const scored = COMPILED.map((n) => {
    let s = 0;
    for (const re of n.res) s += 3 * Math.log(1 + count(re, T)) + 2 * Math.log(1 + count(re, U)) + Math.log(1 + count(re, R));
    return { id: n.id, score: s };
  }).sort((a, b) => b.score - a.score);
  const top = scored[0] ? scored[0].score : 0;
  /** @type {Map<string, Hit>} */ const hits = new Map();
  for (const x of scored) if (x.score >= MIN_SCORE && x.score >= REL_SCORE * top) hits.set(x.id, x);
  if (c.activityBody) {
    for (const [id, why] of signalNodes(activity(c.activityBody))) {
      const h = hits.get(id) || { id, score: scored.find((x) => x.id === id)?.score || 0 };
      hits.set(id, { ...h, score: h.score + SIGNAL_BONUS, signal: why });
    }
  }
  return [...hits.values()].sort((a, b) => b.score - a.score);
}

/** Lê o .md inteiro de uma conversa e classifica. @param {string} raw */
function classifyRaw(raw) {
  const title = readMeta(raw)("titulo");
  const body = stripFrontmatter(raw), turns = splitTurns(body);
  const isUser = (/** @type {{ speaker: string }} */ t) => /^Você$/i.test(t.speaker);
  return classify({
    title,
    user: turns.filter(isUser).map((t) => stripBlocks(t.text)).join("\n"),
    rest: turns.filter((t) => !isUser(t)).map((t) => stripBlocks(t.text)).join("\n"),
    activityBody: body,
  });
}

module.exports = { classify, classifyRaw, activity, signalNodes, NODES };
