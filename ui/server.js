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

function listDir(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true })
      .filter((f) => f.isFile() && f.name !== ".gitkeep")
      .map((f) => {
        const st = fs.statSync(path.join(dir, f.name));
        const t = read(path.join(dir, f.name)).slice(0, 400).match(/^titulo: "(.*)"$/m);
        return { name: f.name, title: t ? t[1] : "", size: st.size, mtime: st.mtimeMs };
      })
      .sort((a, b) => b.mtime - a.mtime);
  } catch { return []; }
}

function project(slug) {
  const dir = path.join(PROJECTS, slug);
  return {
    slug,
    instructions: read(path.join(dir, "instructions.md")),
    memory: read(path.join(dir, "memory.md")),
    context: listDir(path.join(dir, "context")),
    chats: listDir(path.join(dir, "chats")),
    scheduled: listDir(path.join(dir, "scheduled")),
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

function handle(req, res) {
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

http.createServer((req, res) => {
  try {
    if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, { error: "método não permitido" });
    if (!hostOk(req)) return send(res, 403, { error: "host não permitido" });
    handle(req, res);
  } catch { send(res, 400, { error: "requisição inválida" }); }
}).listen(PORT, "127.0.0.1", () => console.log(`Harness UI: http://localhost:${PORT}`));
