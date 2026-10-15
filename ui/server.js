// Servidor local sem dependências: lê as pastas do harness e serve a interface.
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
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
  res.writeHead(code, { "Content-Type": type, ...HEADERS });
  res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

// Defesa contra DNS rebinding: só aceita Host local (e Origin local, quando enviado).
const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;
const hostOk = (req) => LOCAL.test(req.headers.host || "") &&
  (!req.headers.origin || LOCAL.test(req.headers.origin.replace(/^https?:\/\//i, "")));

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
    const { engine, prompt, slug, sessionId, apiKey, model, effort, temperature } = body;
    const eff = effort || (temperature !== undefined && temperature !== null ? (Number(temperature) <= 0.35 ? "low" : Number(temperature) >= 0.75 ? "high" : "medium") : "medium");
    if (!prompt || !slug) return send(res, 400, { error: "prompt e slug são obrigatórios" });

    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Content-Type-Options": "nosniff",
      ...HEADERS,
    });

    const onChunk = (data) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };
    const onDone = (data) => {
      res.write(`data: ${JSON.stringify({ type: "done", ...data })}\n\n`);
      res.end();
    };
    const onError = (err) => {
      res.write(`data: ${JSON.stringify({ type: "error", error: err.message || String(err) })}\n\n`);
      res.end();
    };

    if (engine === "claude") {
      E.streamClaude({ prompt, slug, sessionId, model, effort: eff, onChunk, onDone, onError });
    } else if (engine === "opencode") {
      E.streamOpenCode({ prompt, slug, sessionId, model, effort: eff, onChunk, onDone, onError });
    } else if (engine === "gemini") {
      E.streamGemini({ prompt, slug, sessionId, apiKey, model, effort: eff, onChunk, onDone, onError });
    } else {
      onError(new Error(`Motor "${engine}" não suportado.`));
    }
    return;
  }

  if (p === "/api/chat/save" && req.method === "POST") {
    let body;
    try { body = await readJsonBody(req); } catch { return send(res, 400, { error: "JSON inválido" }); }
    const { slug, engine, title, turns, sessionId } = body;
    if (!slug || !Array.isArray(turns)) return send(res, 400, { error: "slug e turnos são obrigatórios" });
    try {
      const saved = E.saveChatToProject({ slug, engine, title, turns, sessionId });
      return send(res, 200, { ok: true, ...saved });
    } catch (err) {
      return send(res, 500, { error: err.message });
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
    await handle(req, res);
  } catch (err) { send(res, 400, { error: "requisição inválida" }); }
}).listen(PORT, "127.0.0.1", () => console.log(`Harness UI: http://localhost:${PORT}`));
