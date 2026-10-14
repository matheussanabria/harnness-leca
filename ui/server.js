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
const active = () => read(path.join(PROJECTS, ".active")).trim();

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

function send(res, code, body, type = "application/json; charset=utf-8") {
  res.writeHead(code, { "Content-Type": type });
  res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  const p = decodeURIComponent(url.pathname);

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
    const target = path.resolve(PROJECTS, url.searchParams.get("path") || "");
    if (!target.startsWith(PROJECTS + path.sep) || !fs.existsSync(target)) return send(res, 404, { error: "não encontrado" });
    return send(res, 200, { content: read(target) });
  }

  const file = path.join(PUBLIC, p === "/" ? "index.html" : p);
  if (file.startsWith(PUBLIC) && fs.existsSync(file) && fs.statSync(file).isFile()) {
    return send(res, 200, fs.readFileSync(file), "text/html; charset=utf-8");
  }
  send(res, 404, "404", "text/plain");
}).listen(PORT, "127.0.0.1", () => console.log(`Harness UI: http://localhost:${PORT}`));
