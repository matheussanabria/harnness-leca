#!/usr/bin/env node
// Local preview for this handoff bundle. No dependencies: `npm run preview` (PORT=4400 by default).
// Lists the standalone prototypes and serves them, plus the design-system files, read-only.
const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const PORT = Number(process.env.PORT) || 4400;
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".md": "text/plain; charset=utf-8" };
const SERVED = ["standalone", "design-system", "prototypes"];

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

function indexPage() {
  const dir = path.join(ROOT, "standalone");
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".html")) : [];
  const items = files.map((f) => `<li><a href="/standalone/${esc(f)}">${esc(f.replace(/\.html$/, ""))}</a></li>`).join("") || "<li>No standalone previews in this bundle.</li>";
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Handoff preview</title>
<style>body{font:16px system-ui;margin:0;padding:32px 16px;background:#0f172a;color:#e2e8f0}main{max-width:640px;margin:auto}a{color:#93c5fd;display:block;padding:12px 0;border-bottom:1px solid #334155}ul{list-style:none;padding:0}</style>
<main><h1>Prototypes</h1><ul>${items}</ul><p>Read AGENTS.md and MAPA.md before editing with an agent.</p></main></html>`;
}

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  if (urlPath === "/" || urlPath === "/index.html") {
    res.writeHead(200, { "Content-Type": TYPES[".html"] });
    return res.end(indexPage());
  }
  const file = path.resolve(ROOT, "." + urlPath);
  const top = path.relative(ROOT, file).split(path.sep)[0];
  if (!file.startsWith(ROOT + path.sep) || !SERVED.includes(top) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    return res.end("Not found");
  }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});

server.listen(PORT, "127.0.0.1", () => {
  const url = `http://localhost:${PORT}/`;
  console.log(`Preview running at ${url}`);
  if (process.argv.includes("--open")) {
    const [cmd, args] = process.platform === "win32" ? ["cmd", ["/c", "start", "", url]] : [process.platform === "darwin" ? "open" : "xdg-open", [url]];
    spawn(cmd, args, { stdio: "ignore", detached: true }).unref();
  }
});
