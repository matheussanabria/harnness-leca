// Servidor local sem dependências: lê as pastas do harness e serve a interface.
const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const { ROOT } = require("../tools/lib/root");
const PROJECTS = path.join(ROOT, "projects");
const PUBLIC = path.join(__dirname, "public");
const PORT = process.env.PORT || 4321;

const read = (p) => { try { return fs.readFileSync(p, "utf8").replace(/^﻿/, ""); } catch { return ""; } };
const slugs = () => fs.readdirSync(PROJECTS, { withFileTypes: true })
  .filter((d) => d.isDirectory() && d.name !== "_template").map((d) => d.name);
// Mesma regra do hook: última linha preenchida, sem diferenciar maiúsculas.
const active = () => {
  const want = read(path.join(PROJECTS, ".active")).split(/\r?\n/).map((l) => l.trim()).filter(Boolean).pop() || "";
  return slugs().find((s) => s.toLowerCase() === want.toLowerCase()) || "";
};

const S = require("../tools/lib/state");
const E = require("../tools/lib/engines");
const MR = require("../tools/lib/memory-review");
const syncCore = require("../tools/lib/sync-core");
const DAI = require("../tools/lib/dai");

function listDir(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true })
      .filter((f) => f.isFile() && f.name !== ".gitkeep")
      .map((f) => {
        const st = fs.statSync(path.join(dir, f.name));
        const head = read(path.join(dir, f.name)).slice(0, 600);
        const t = head.match(/^titulo: "(.*)"$/m);
        const ag = head.match(/^agente: "(.*)"$/m);
        return { name: f.name, title: t ? t[1] : "", agent: ag ? ag[1] : "", size: st.size, mtime: st.mtimeMs };
      })
      .sort((a, b) => b.mtime - a.mtime);
  } catch { return []; }
}

// Quantas sugestões de memória esperam revisão (a lista completa só sai em /api/project/:slug/review).
function reviewSummary(slug) {
  try { return { pendentes: MR.pending(slug).length }; } catch { return { pendentes: 0 }; }
}

function project(slug) {
  const dir = path.join(PROJECTS, slug);
  let extraction = { total: 0, ok: 0, nova: 0, alterada: 0, rows: [] };
  let scanMap = new Map();
  try {
    const rows = S.scan(slug);
    extraction = {
      total: rows.length,
      ok: rows.filter((r) => r.status === "ok").length,
      nova: rows.filter((r) => r.status === "nova").length,
      alterada: rows.filter((r) => r.status === "alterada").length,
      rows: rows.map((r) => ({
        name: r.name,
        titulo: r.titulo,
        data: r.data,
        turnos: r.turnos,
        turnosAntes: r.antes ? r.antes.turnos : null,
        status: r.status,
        por: r.antes ? r.antes.por : null,
        analisadoEm: r.antes && r.antes.analisadoEm ? r.antes.analisadoEm.slice(0, 10) : null,
      })),
    };
    scanMap = new Map(rows.map((r) => [r.name, r]));
  } catch {}

  const rawChats = listDir(path.join(dir, "chats"));
  const chats = rawChats.map((c) => {
    const sc = scanMap.get(c.name);
    return {
      ...c,
      status: sc ? sc.status : "nova",
      analyzedBy: sc && sc.antes ? sc.antes.por : null,
      analyzedAt: sc && sc.antes && sc.antes.analisadoEm ? sc.antes.analisadoEm.slice(0, 10) : null,
      turns: sc ? sc.turnos : 0,
    };
  });

  return {
    slug,
    instructions: read(path.join(dir, "instructions.md")),
    memory: read(path.join(dir, "memory.md")),
    context: listDir(path.join(dir, "context")),
    chats,
    scheduled: listDir(path.join(dir, "scheduled")),
    extraction,
    review: reviewSummary(slug),
  };
}

// Respostas de chat em andamento ao mesmo tempo (cada uma pode ser um processo do Claude com MCPs e comandos).
// Por padrão permite até 6 respostas em paralelo para suportar o modo comparação entre múltiplos motores.
const MAX_CHATS = Number(process.env.HARNESS_MAX_CHATS) || 6;
let runningChats = 0;

const HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "Cross-Origin-Resource-Policy": "same-origin",
  "X-Frame-Options": "DENY",
  // A interface usa script/estilo inline; bloqueia todo o resto (sem rede externa, sem frames).
  "Content-Security-Policy": "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
};

function send(res, code, body, type = "application/json; charset=utf-8") {
  if (res.headersSent || res.writableEnded) return;
  res.writeHead(code, { "Content-Type": type, ...HEADERS });
  res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

// Defesa contra DNS rebinding: só aceita Host local (e Origin local, quando enviado).
const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;
const hostOk = (req) => LOCAL.test(req.headers.host || "") &&
  (!req.headers.origin || LOCAL.test(req.headers.origin.replace(/^https?:\/\//i, "")));

// POST muda estado (dispara o motor, grava chats). Além do Host local, exige:
// - Origin presente e igual ao próprio endereço do servidor, com a mesma porta (outra página em localhost:<outra porta>
//   é outra origem e seria aceita pela regra frouxa acima);
// - Content-Type application/json (text/plain é "requisição simples" e dispensa o preflight do CORS).
const postOk = (req) => {
  const origin = (req.headers.origin || "").replace(/\/+$/, "").toLowerCase();
  const host = (req.headers.host || "").toLowerCase();
  const json = /^application\/json\s*(;|$)/i.test(req.headers["content-type"] || "");
  return json && (origin === `http://${host}`);
};

// Só serve arquivos regulares cujo caminho real fica dentro de `base` (bloqueia symlinks que escapam).
function inside(base, target) {
  try {
    const real = fs.realpathSync(target), b = fs.realpathSync(base);
    return real.startsWith(b + path.sep) && fs.statSync(real).isFile();
  } catch { return false; }
}

const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon" };

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 5 * 1024 * 1024) {
        req.destroy();
        reject(new Error("corpo muito grande"));
      }
    });
    req.on("end", () => {
      try { resolve(body ? JSON.parse(body) : {}); } catch (err) { reject(err); }
    });
    req.on("error", reject);
  });
}

// ---------- rotas da API ----------
// Cada handler recebe ctx = { req, res, url, params } (params: grupos do caminho, quando a rota é uma RegExp).

const apiState = ({ res }) => send(res, 200, {
  active: active(),
  projects: slugs(),
  global: {
    instructions: read(path.join(ROOT, "global", "instructions.md")),
    memory: read(path.join(ROOT, "global", "memory.md")),
  },
});

const apiEngines = async ({ res }) => send(res, 200, await E.getEnginesStatus());

const apiProject = ({ res, params: [slug] }) =>
  slugs().includes(slug) ? send(res, 200, project(slug)) : send(res, 404, { error: "projeto não encontrado" });

// Revisão das sugestões de memória (tools/lib/memory-review.js): lista o que falta revisar e aplica promover/descartar.
const apiReviewList = ({ res, params: [slug] }) => {
  if (!slugs().includes(slug)) return send(res, 404, { error: "projeto não encontrado" });
  const memoriaBytes = Buffer.byteLength(read(path.join(PROJECTS, slug, "memory.md")));
  return send(res, 200, { pendentes: MR.pending(slug), memoriaBytes });
};

async function apiReviewApply({ req, res, params: [slug] }) {
  if (!slugs().includes(slug)) return send(res, 404, { error: "projeto não encontrado" });
  let body;
  try { body = await readJsonBody(req); } catch { return send(res, 400, { error: "JSON inválido" }); }
  try {
    const result = MR.apply(slug, body && body.acoes);
    return send(res, 200, { ...result, pendentes: MR.pending(slug).length, memoriaBytes: Buffer.byteLength(read(path.join(PROJECTS, slug, "memory.md"))) });
  } catch (err) {
    if (err instanceof MR.ReviewError) return send(res, 400, { error: err.message });
    console.error("[review]", (err && err.stack) || err);
    return send(res, 500, { error: "Não foi possível aplicar a revisão. O detalhe está no terminal do servidor." });
  }
}

// Só <slug>/<chats|context|scheduled>/<arquivo> ou <slug>/<instructions|memory>.md, sem sair de projects/.
function apiFile({ res, url }) {
  const rel = url.searchParams.get("path") || "";
  const target = path.resolve(PROJECTS, rel);
  const ok = /^[\w-]+\/(chats|context|scheduled)\/[^\/\\]+$|^[\w-]+\/(instructions|memory)\.md$/.test(rel);
  if (!ok || !target.startsWith(PROJECTS + path.sep) || !inside(PROJECTS, target)) return send(res, 404, { error: "não encontrado" });
  return send(res, 200, { content: read(target) });
}

// Clientes antigos mandavam "temperature"; hoje o controle é o nível de esforço.
const effortFromTemperature = (t) => (Number(t) <= 0.35 ? "low" : Number(t) >= 0.75 ? "high" : "medium");

// Resposta em SSE: devolve os três callbacks que todo motor usa (texto/raciocínio, fim, erro).
function sseWriter(res, engineId) {
  const open = () => !res.writableEnded && !res.destroyed;
  const emit = (data) => { try { res.write(`data: ${JSON.stringify(data)}\n\n`); } catch { /* conexão já foi fechada pelo cliente */ } };
  return {
    onChunk: (data) => { if (open()) emit(data); },
    onDone: (data) => { if (open()) { emit({ type: "done", ...data }); res.end(); } },
    onError: (err) => {
      if (!open()) return;
      // Só mensagens nossas vão ao navegador; stderr do CLI e respostas de APIs ficam no log (podem ter caminhos locais).
      const isPublic = err instanceof E.PublicError;
      if (!isPublic) console.error("[chat]", engineId, (err && err.stack) || err);
      emit({ type: "error", error: isPublic ? err.message : "Falha ao falar com o motor. O detalhe está no terminal do servidor." });
      res.end();
    },
  };
}

const apiDai = ({ res }) => send(res, 200, {
  available: !!DAI.getDaiPath(),
  path: DAI.getDaiPath(),
  agents: DAI.listDaiAgents(),
  workflows: DAI.DAI_WORKFLOWS,
});

async function apiChat({ req, res }) {
  let body;
  try { body = await readJsonBody(req); } catch { return send(res, 400, { error: "JSON inválido" }); }
  const { engine, prompt, slug, sessionId, history, model, effort, temperature, daiAgent } = body;
  const eff = E.safeEffort(effort || (temperature != null ? effortFromTemperature(temperature) : "medium"));
  if (typeof prompt !== "string" || !prompt || !slug) return send(res, 400, { error: "prompt e slug são obrigatórios" });
  if (!slugs().includes(slug)) return send(res, 404, { error: "projeto não encontrado" });
  if (runningChats >= MAX_CHATS) return send(res, 429, { error: `Já há ${MAX_CHATS} respostas em andamento. Aguarde uma terminar.` });

  // Fechar a aba (ou a conexão cair) cancela o motor: o processo do Claude e a consulta ao opencode não ficam soltos.
  runningChats++;
  const ac = new AbortController();
  res.on("close", () => {
    if (!res.writableFinished) ac.abort();
    runningChats--;
  });

  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Content-Type-Options": "nosniff",
    ...HEADERS,
  });
  const sink = sseWriter(res, engine);

  // Cada motor tem a mesma interface (tools/lib/engines/index.js): o servidor não precisa conhecer nenhum pelo nome.
  // engines.get() devolve undefined para qualquer id desconhecido (inclusive "__proto__" e afins).
  const impl = E.engines.get(engine);
  if (impl) impl.stream({ prompt, slug, sessionId, history, model, effort: eff, daiAgent, signal: ac.signal, ...sink });
  else sink.onError(new E.PublicError(`Motor "${engine}" não suportado.`));
}

async function apiChatSave({ req, res }) {
  let body;
  try { body = await readJsonBody(req); } catch { return send(res, 400, { error: "JSON inválido" }); }
  const { slug, engine, title, turns, sessionId } = body;
  if (!slug || !Array.isArray(turns)) return send(res, 400, { error: "slug e turnos são obrigatórios" });
  if (!slugs().includes(slug)) return send(res, 404, { error: "projeto não encontrado" });
  try {
    return send(res, 200, { ok: true, ...E.saveChatToProject({ slug, engine, title, turns, sessionId }) });
  } catch (err) {
    console.error("[chat/save]", (err && err.stack) || err);
    return send(res, 500, { error: "Não foi possível salvar a conversa. O detalhe está no terminal do servidor." });
  }
}

async function apiProjectSync({ req, res, params: [slug] }) {
  if (!slugs().includes(slug)) return send(res, 404, { error: "projeto não encontrado" });
  let body = {};
  try { body = await readJsonBody(req); } catch {}
  const engine = body && body.engine ? body.engine : "all";
  try {
    const engines = engine === "all" ? ["claude", "gemini", "opencode"] : [engine];
    const result = syncCore.syncProject({ slug, engines });
    return send(res, 200, result);
  } catch (err) {
    console.error("[sync]", (err && err.stack) || err);
    return send(res, 500, { error: "Falha ao sincronizar conversas." });
  }
}

// ---------- visão geral: resumo paginado de todos os projetos ----------

// Chave de ordenação barata (só stat dos arquivos de chats/): a página inteira é ordenada sem reler as conversas.
function activityMs(slug) {
  try {
    const dir = path.join(PROJECTS, slug, "chats");
    let max = 0;
    for (const f of fs.readdirSync(dir)) max = Math.max(max, fs.statSync(path.join(dir, f)).mtimeMs);
    return max;
  } catch { return 0; }
}

// Resumo de um projeto para a lista da visão geral (mesmas contagens da página do projeto).
function overviewProject(slug) {
  const dir = path.join(PROJECTS, slug);
  let rows = null;
  try { rows = S.scan(slug); } catch { /* chats ilegíveis: cai para a contagem de arquivos abaixo */ }
  const list = rows || [];
  return {
    slug,
    chats: rows ? rows.length : listDir(path.join(dir, "chats")).filter((c) => c.name.endsWith(".md")).length,
    lastChat: list.length && list[0].fim ? list[0].fim.slice(0, 10) : null,
    extraction: {
      total: list.length,
      ok: list.filter((r) => r.status === "ok").length,
      nova: list.filter((r) => r.status === "nova").length,
      alterada: list.filter((r) => r.status === "alterada").length,
    },
    review: reviewSummary(slug),
    context: listDir(path.join(dir, "context")).length,
    scheduled: listDir(path.join(dir, "scheduled")).length,
    memoryBytes: Buffer.byteLength(read(path.join(dir, "memory.md"))),
    instructionsBytes: Buffer.byteLength(read(path.join(dir, "instructions.md"))),
  };
}

// O resumo relê todas as conversas (scan com hash), o que custa ~200 ms por projeto cheio. Guarda por uma impressão
// digital dos arquivos que entram no cálculo: mudou algum, o projeto é resumido de novo na hora.
const OV_CACHE = new Map();
const fpFile = (p) => { try { const st = fs.statSync(p); return `${st.mtimeMs}:${st.size}`; } catch { return ""; } };
const fpDir = (dir) => {
  try {
    const files = fs.readdirSync(dir);
    let sum = 0, max = 0;
    for (const f of files) { try { const st = fs.statSync(path.join(dir, f)); sum += st.size; max = Math.max(max, st.mtimeMs); } catch { /* arquivo sumiu no meio */ } }
    return `${files.length}:${max}:${sum}`;
  } catch { return ""; }
};

function overviewCached(slug, isActive) {
  const dir = path.join(PROJECTS, slug);
  const fp = [
    fpDir(path.join(dir, "chats")),
    fpFile(path.join(dir, "extraction-state.json")),
    fpFile(path.join(dir, "memory.md")),
    fpFile(path.join(dir, "instructions.md")),
    fpFile(path.join(dir, "memory-review.json")),
    fpDir(path.join(dir, "context")), // sugestões extraídas e consolidadas moram aqui
    fpDir(path.join(dir, "scheduled")),
  ].join("|");
  const hit = OV_CACHE.get(slug);
  const summary = hit && hit.fp === fp ? hit.value : overviewProject(slug);
  if (!hit || hit.fp !== fp) OV_CACHE.set(slug, { fp, value: summary });
  return { ...summary, active: isActive };
}

const OV_PAGE_SIZE = 10;
const OV_MAX_PAGE_SIZE = 50;
const ovInt = (raw, fallback, min, max) => {
  const n = Number(raw);
  return Number.isFinite(n) && n >= min ? Math.min(Math.floor(n), max) : fallback;
};

// page/pageSize vêm da query string; valores inválidos caem nos limites em vez de quebrar a página.
function apiOverview({ res, url }) {
  const act = active();
  const order = slugs()
    .map((slug) => ({ slug, at: activityMs(slug) }))
    .sort((a, b) => b.at - a.at || a.slug.localeCompare(b.slug));
  const pageSize = ovInt(url.searchParams.get("pageSize"), OV_PAGE_SIZE, 1, OV_MAX_PAGE_SIZE);
  const pages = Math.max(1, Math.ceil(order.length / pageSize));
  const page = ovInt(url.searchParams.get("page"), 1, 1, pages);
  const start = (page - 1) * pageSize;
  return send(res, 200, {
    total: order.length,
    page,
    pageSize,
    pages,
    active: act,
    projects: order.slice(start, start + pageSize).map((o) => overviewCached(o.slug, o.slug === act)),
  });
}

// ---------- ações do sistema: sincronização de todos os projetos/motores ----------

const SYNC_ENGINES = ["claude", "gemini", "opencode"];
// Uma sincronização por vez: duas execuções simultâneas do importador gravariam os mesmos arquivos.
let syncRunning = false;

async function apiSync({ req, res }) {
  let body = {};
  try { body = await readJsonBody(req); } catch { return send(res, 400, { error: "JSON inválido" }); }

  const raw = body && body.engines != null ? body.engines : "all";
  const parts = (Array.isArray(raw) ? raw : String(raw).split(",")).map((s) => String(s).trim().toLowerCase()).filter(Boolean);
  // Vazio ou "all" = todos os motores; qualquer nome fora da lista é recusado antes de disparar o processo.
  const engines = !parts.length || parts.includes("all") ? SYNC_ENGINES.slice() : parts;
  if (engines.some((e) => !SYNC_ENGINES.includes(e))) {
    return send(res, 400, { error: `Motor inválido. Use: ${SYNC_ENGINES.join(", ")} ou "all".` });
  }
  if (!slugs().length) return send(res, 400, { error: "Nenhum projeto em projects/ para sincronizar." });
  if (syncRunning) return send(res, 409, { error: "Já há uma sincronização em andamento." });

  const dryRun = body && body.dryRun === true;
  // O script vive no repositório (ROOT pode ser outra pasta quando HARNESS_ROOT aponta para um harness de teste).
  const syncScript = path.resolve(__dirname, "..", "tools", "sync.js");
  const args = ["--no-warnings", syncScript, "--engine", engines.join(",")];
  if (dryRun) args.push("--dry-run");

  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Content-Type-Options": "nosniff",
    ...HEADERS,
  });

  syncRunning = true;
  const started = Date.now();
  let finished = false;
  let buf = "";
  const emit = (data) => { try { res.write(`data: ${JSON.stringify(data)}\n\n`); } catch { /* conexão caiu */ } };
  const finish = (code) => {
    if (finished) return;
    finished = true;
    syncRunning = false;
    if (buf.trim()) emit({ type: "log", line: buf.trimEnd() });
    emit({ type: "done", code, ms: Date.now() - started });
    res.end();
  };

  // tools/sync.js faz uma passada por motor em todos os projetos (e a extração local do que mudou).
  let child;
  try {
    child = spawn(process.execPath, args, { cwd: ROOT, env: process.env, windowsHide: true });
  } catch (err) {
    console.error("[sync]", (err && err.stack) || err);
    emit({ type: "error", error: "Não foi possível executar tools/sync.js. O detalhe está no terminal do servidor." });
    finish(-1);
    return;
  }
  const onChunk = (chunk) => {
    buf += chunk;
    let i;
    while ((i = buf.search(/[\r\n]/)) >= 0) {
      const line = buf.slice(0, i).replace(/\r$/, "");
      buf = buf.slice(i + 1);
      if (line.trim()) emit({ type: "log", line });
    }
  };
  child.stdout.on("data", onChunk);
  child.stderr.on("data", onChunk);
  child.on("error", (err) => {
    console.error("[sync]", (err && err.stack) || err);
    emit({ type: "error", error: "Não foi possível executar tools/sync.js. O detalhe está no terminal do servidor." });
    finish(-1);
  });
  child.on("close", (code) => finish(code));
  // Fechar a aba cancela a execução: o processo filho não fica solto.
  res.on("close", () => {
    if (finished) return;
    finished = true;
    syncRunning = false;
    try { child.kill(); } catch { /* já encerrou */ }
  });
}

// method + caminho (texto exato ou RegExp). HEAD usa a rota do GET.
const ROUTES = [
  { method: "GET", path: "/api/state", handler: apiState },
  { method: "GET", path: "/api/engines", handler: apiEngines },
  { method: "GET", path: "/api/overview", handler: apiOverview },
  { method: "POST", path: "/api/sync", handler: apiSync },
  { method: "GET", path: /^\/api\/project\/([\w-]+)$/, handler: apiProject },
  { method: "GET", path: /^\/api\/project\/([\w-]+)\/review$/, handler: apiReviewList },
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/review$/, handler: apiReviewApply },
  { method: "POST", path: /^\/api\/project\/([\w-]+)\/sync$/, handler: apiProjectSync },
  { method: "GET", path: "/api/file", handler: apiFile },
  { method: "GET", path: "/api/dai", handler: apiDai },
  { method: "POST", path: "/api/chat", handler: apiChat },
  { method: "POST", path: "/api/chat/save", handler: apiChatSave },
];

function serveStatic(res, p) {
  // /overview sem .html, para o endereço da visão geral ficar limpo.
  const rel = p === "/" ? "index.html" : p === "/overview" ? "overview.html" : p.replace(/^[\/\\]+/, "");
  const file = path.resolve(PUBLIC, "." + path.sep + rel);
  const type = TYPES[path.extname(file).toLowerCase()];
  if (type && file.startsWith(PUBLIC + path.sep) && inside(PUBLIC, file)) return send(res, 200, fs.readFileSync(file), type);
  return send(res, 404, "404", "text/plain");
}

async function handle(req, res) {
  const url = new URL(req.url, "http://x");
  const p = decodeURIComponent(url.pathname);
  if (p.includes("\0")) return send(res, 400, { error: "requisição inválida" });

  const method = req.method === "HEAD" ? "GET" : req.method;
  let pathKnown = false;
  for (const route of ROUTES) {
    const m = typeof route.path === "string" ? (p === route.path ? [p] : null) : p.match(route.path);
    if (!m) continue;
    pathKnown = true;
    if (route.method === method) return route.handler({ req, res, url, params: m.slice(1) });
  }
  return pathKnown ? send(res, 405, { error: "método não permitido" }) : serveStatic(res, p);
}

function createServer() {
  return http.createServer(async (req, res) => {
    try {
      if (req.method !== "GET" && req.method !== "HEAD" && req.method !== "POST") return send(res, 405, { error: "método não permitido" });
      if (!hostOk(req)) return send(res, 403, { error: "host não permitido" });
      if (req.method === "POST" && !postOk(req)) return send(res, 403, { error: "origem não permitida" });
      await handle(req, res);
    } catch (err) {
      if (!res.headersSent && !res.writableEnded) send(res, 400, { error: "requisição inválida" });
    }
  });
}

module.exports = { createServer, MAX_CHATS };
if (require.main === module) createServer().listen(PORT, "127.0.0.1", () => console.log(`Harness UI: http://localhost:${PORT}`));
