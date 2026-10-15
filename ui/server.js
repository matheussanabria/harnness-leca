// Servidor local sem dependências: lê as pastas do harness e serve a interface.
const http = require("http");
const fs = require("fs");
const path = require("path");

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
  };
}

// Respostas de chat em andamento ao mesmo tempo (cada uma pode ser um processo do Claude com MCPs e comandos).
const MAX_CHATS = 2;
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

async function handle(req, res) {
  const url = new URL(req.url, "http://x");
  const p = decodeURIComponent(url.pathname);
  if (p.includes("\0")) return send(res, 400, { error: "requisição inválida" });

  if (p === "/api/state") {
    return send(res, 200, {
      active: active(),
      projects: slugs(),
      global: {
        instructions: read(path.join(ROOT, "global", "instructions.md")),
        memory: read(path.join(ROOT, "global", "memory.md")),
      },
    });
  }

  if (p === "/api/engines") {
    const status = await E.getEnginesStatus();
    return send(res, 200, status);
  }

  if (p === "/api/chat" && req.method === "POST") {
    let body;
    try { body = await readJsonBody(req); } catch { return send(res, 400, { error: "JSON inválido" }); }
    const { engine, prompt, slug, sessionId, history, model, effort, temperature } = body;
    const eff = E.safeEffort(effort || (temperature !== undefined && temperature !== null ? (Number(temperature) <= 0.35 ? "low" : Number(temperature) >= 0.75 ? "high" : "medium") : "medium"));
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
    const signal = ac.signal;

    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Content-Type-Options": "nosniff",
      ...HEADERS,
    });

    const onChunk = (data) => {
      if (!res.writableEnded && !res.destroyed) {
        try { res.write(`data: ${JSON.stringify(data)}\n\n`); } catch {}
      }
    };
    const onDone = (data) => {
      if (!res.writableEnded && !res.destroyed) {
        try {
          res.write(`data: ${JSON.stringify({ type: "done", ...data })}\n\n`);
          res.end();
        } catch {}
      }
    };
    const onError = (err) => {
      if (!res.writableEnded && !res.destroyed) {
        try {
          // Só mensagens nossas vão ao navegador; stderr do CLI e respostas de APIs ficam no log (podem ter caminhos locais).
          const isPublic = err instanceof E.PublicError;
          if (!isPublic) console.error("[chat]", engine, (err && err.stack) || err);
          const error = isPublic ? err.message : "Falha ao falar com o motor. O detalhe está no terminal do servidor.";
          res.write(`data: ${JSON.stringify({ type: "error", error })}\n\n`);
          res.end();
        } catch {}
      }
    };

    if (engine === "claude") {
      E.streamClaude({ prompt, slug, sessionId, model, effort: eff, signal, onChunk, onDone, onError });
    } else if (engine === "opencode") {
      E.streamOpenCode({ prompt, slug, sessionId, model, effort: eff, signal, onChunk, onDone, onError });
    } else if (engine === "gemini") {
      E.streamGemini({ prompt, slug, sessionId, history, model, effort: eff, signal, onChunk, onDone, onError });
    } else {
      onError(new E.PublicError(`Motor "${engine}" não suportado.`));
    }
    return;
  }

  if (p === "/api/chat/save" && req.method === "POST") {
    let body;
    try { body = await readJsonBody(req); } catch { return send(res, 400, { error: "JSON inválido" }); }
    const { slug, engine, title, turns, sessionId } = body;
    if (!slug || !Array.isArray(turns)) return send(res, 400, { error: "slug e turnos são obrigatórios" });
    if (!slugs().includes(slug)) return send(res, 404, { error: "projeto não encontrado" });
    try {
      const saved = E.saveChatToProject({ slug, engine, title, turns, sessionId });
      return send(res, 200, { ok: true, ...saved });
    } catch (err) {
      console.error("[chat/save]", (err && err.stack) || err);
      return send(res, 500, { error: "Não foi possível salvar a conversa. O detalhe está no terminal do servidor." });
    }
  }

  const m = p.match(/^\/api\/project\/([\w-]+)$/);
  if (m && slugs().includes(m[1])) return send(res, 200, project(m[1]));

  if (p === "/api/file") {
    // Só <slug>/<chats|context|scheduled>/<arquivo> ou <slug>/<instructions|memory>.md, sem sair de projects/.
    const rel = url.searchParams.get("path") || "";
    const target = path.resolve(PROJECTS, rel);
    const ok = /^[\w-]+\/(chats|context|scheduled)\/[^\/\\]+$|^[\w-]+\/(instructions|memory)\.md$/.test(rel);
    if (!ok || !target.startsWith(PROJECTS + path.sep) || !inside(PROJECTS, target)) return send(res, 404, { error: "não encontrado" });
    return send(res, 200, { content: read(target) });
  }

  const file = path.resolve(PUBLIC, "." + path.sep + (p === "/" ? "index.html" : p.replace(/^[\/\\]+/, "")));
  const type = TYPES[path.extname(file).toLowerCase()];
  if (type && file.startsWith(PUBLIC + path.sep) && inside(PUBLIC, file)) {
    return send(res, 200, fs.readFileSync(file), type);
  }
  send(res, 404, "404", "text/plain");
}

http.createServer(async (req, res) => {
  try {
    if (req.method !== "GET" && req.method !== "HEAD" && req.method !== "POST") return send(res, 405, { error: "método não permitido" });
    if (!hostOk(req)) return send(res, 403, { error: "host não permitido" });
    if (req.method === "POST" && !postOk(req)) return send(res, 403, { error: "origem não permitida" });
    await handle(req, res);
  } catch (err) {
    if (!res.headersSent && !res.writableEnded) send(res, 400, { error: "requisição inválida" });
  }
}).listen(PORT, "127.0.0.1", () => console.log(`Harness UI: http://localhost:${PORT}`));
