// @ts-check
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const netLib = require("../../tools/lib/network");
const procManager = require("../../tools/lib/proc-manager");

const PUBLIC = path.join(__dirname, "..", "public");

const PORT = Number(process.env.PORT) || 4321;
const IS_REMOTE = process.argv.includes("--remote") || process.argv.includes("--lan") || process.argv.includes("--host") || !!process.env.HARNESS_REMOTE;
const PIN_ARG_IDX = process.argv.indexOf("--pin");
const RAW_PIN = String((PIN_ARG_IDX !== -1 ? process.argv[PIN_ARG_IDX + 1] : process.env.HARNESS_PIN) || "").trim();
// Alcançável fora do loopback (remoto, LAN ou HARNESS_HOST público): nunca sem PIN e nunca com PIN curto.
const EXPOSED = IS_REMOTE || (!!process.env.HARNESS_HOST && !/^(127\.|localhost$|::1$|\[::1\]$)/i.test(process.env.HARNESS_HOST));
const MIN_PIN_LENGTH = 6;
let PIN = RAW_PIN;
if (EXPOSED && RAW_PIN.length < MIN_PIN_LENGTH) {
  PIN = String(crypto.randomInt(100000, 1000000));
  if (RAW_PIN) console.warn(`[remote] PIN com menos de ${MIN_PIN_LENGTH} caracteres foi recusado; usando um PIN aleatório.`);
}
const HOST = process.env.HARNESS_HOST || (IS_REMOTE ? "0.0.0.0" : "127.0.0.1");

// 0 = sem limite de respostas simultâneas (padrão); defina HARNESS_MAX_CHATS=N para reativar o teto.
const MAX_CHATS = Number(process.env.HARNESS_MAX_CHATS) || 0;

const HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "Cross-Origin-Resource-Policy": "same-origin",
  "X-Frame-Options": "SAMEORIGIN",
  "Content-Security-Policy": "default-src 'none'; script-src 'unsafe-inline' 'self'; style-src 'unsafe-inline' 'self' https://cdnjs.cloudflare.com; font-src 'self' data: https://cdnjs.cloudflare.com; img-src 'self' data:; connect-src 'self' http: https:; frame-src 'self' http: https:; base-uri 'none'; form-action 'none'; frame-ancestors 'self'",
};

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
};

const getRoot = () => require("../../tools/lib/root").ROOT;
const getProjects = () => process.env.HARNESS_PROJECTS_DIR
  ? path.resolve(process.env.HARNESS_PROJECTS_DIR)
  : path.join(getRoot(), "projects");

const read = (p) => {
  try {
    return fs.readFileSync(p, "utf8").replace(/^﻿/, "");
  } catch {
    return "";
  }
};

const slugs = () => {
  try {
    return fs.readdirSync(getProjects(), { withFileTypes: true })
      .filter((d) => d.isDirectory() && d.name !== "_template")
      .map((d) => d.name);
  } catch {
    return [];
  }
};

const active = () => {
  const want = read(path.join(getProjects(), ".active")).split(/\r?\n/).map((l) => l.trim()).filter(Boolean).pop() || "";
  return slugs().find((s) => s.toLowerCase() === want.toLowerCase()) || "";
};

function inside(base, target) {
  try {
    const real = fs.realpathSync(target), b = fs.realpathSync(base);
    return real.startsWith(b + path.sep) && fs.statSync(real).isFile();
  } catch {
    return false;
  }
}

function send(res, code, body, type = "application/json; charset=utf-8", headers = {}) {
  if (res.headersSent || res.writableEnded) return;
  res.writeHead(code, { "Content-Type": type, ...HEADERS, ...headers });
  res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

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
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

const hostOk = (req) => {
  const h = req.headers.host || "";
  if (!netLib.isAllowedHost(h)) return false;
  const origin = req.headers.origin;
  if (!origin) return true;
  const cleanOrigin = origin.replace(/^https?:\/\//i, "").toLowerCase();
  return netLib.isAllowedHost(cleanOrigin);
};

const postOk = (req) => {
  const origin = (req.headers.origin || "").replace(/\/+$/, "").toLowerCase();
  const host = (req.headers.host || "").toLowerCase();
  const ct = req.headers["content-type"] || "";
  // Uploads de anexos e artefatos mandam o binário cru; as outras rotas POST continuam exigindo JSON.
  const upload = /^\/api\/(?:chat\/upload|project\/[\w-]+\/artifacts\/import|canvas\/boards\/[\w-]+\/assets)(?:\?|$)/.test(req.url || "")
    && /^application\/octet-stream\s*(;|$)/i.test(ct);
  const json = /^application\/json\s*(;|$)/i.test(ct) || upload;
  return json && (origin === `http://${host}` || origin === `https://${host}`);
};

function getActiveAppUrl() {
  try {
    const act = active();
    if (act) {
      const p = require("./services/project.service").project(act);
      if (p && p.app && p.app.url) return p.app.url;
      const docsConfig = procManager.extractAppConfigFromDocs(act);
      if (docsConfig && docsConfig.url) return docsConfig.url;
    }
  } catch {}
  return "http://127.0.0.1:4200";
}

function sendPinLoginPage(res) {
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Acesso Remoto - Harness Leca</title>
  <style>
    :root { --bg: #090d16; --panel: #131b2e; --line: #1e293b; --text: #f1f5f9; --mute: #94a3b8; --primary: #6366f1; --primary-hover: #4f46e5; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: var(--bg); color: var(--text); display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
    .auth-card { background: var(--panel); border: 1px solid var(--line); border-radius: 16px; padding: 36px 28px; max-width: 380px; width: 100%; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
    .icon { font-size: 40px; margin-bottom: 12px; }
    h1 { font-size: 1.35rem; margin: 0 0 8px; font-weight: 700; }
    p { font-size: 0.9rem; color: var(--mute); line-height: 1.5; margin: 0 0 24px; }
    .pin-input { width: 100%; box-sizing: border-box; background: #0b1120; border: 2px solid var(--line); border-radius: 10px; color: #fff; font-size: 1.8rem; font-weight: 700; letter-spacing: 6px; text-align: center; padding: 12px; margin-bottom: 16px; outline: none; transition: border-color 0.2s; }
    .pin-input:focus { border-color: var(--primary); }
    .btn-submit { width: 100%; background: var(--primary); color: #fff; border: none; border-radius: 10px; padding: 14px; font-size: 1rem; font-weight: 600; cursor: pointer; transition: background 0.2s; }
    .btn-submit:hover { background: var(--primary-hover); }
    .hint { margin-top: 20px; font-size: 0.8rem; color: var(--mute); background: rgba(255,255,255,0.03); padding: 8px; border-radius: 8px; }
    .err-msg { color: #f87171; font-size: 0.85rem; margin-bottom: 14px; display: none; }
  </style>
</head>
<body>
  <div class="auth-card">
    <div class="icon">🔐</div>
    <h1>Acesso Remoto</h1>
    <p>Digite o PIN de 6 dígitos exibido no terminal do seu computador para desbloquear o Harness no celular.</p>
    <div class="err-msg" id="errMsg">PIN incorreto. Tente novamente.</div>
    <form onsubmit="handleAuth(event)">
      <input type="tel" id="pinInput" class="pin-input" maxlength="8" placeholder="••••••" autofocus required autocomplete="off">
      <button type="submit" class="btn-submit">Desbloquear e Entrar ➤</button>
    </form>
    <div class="hint">💡 Dica: Se você escanear o QR Code impresso no terminal ou na UI, o login é automático sem precisar digitar!</div>
  </div>
  <script>
    async function submitPin(pin) {
      const err = document.getElementById('errMsg');
      err.style.display = 'none';
      try {
        const res = await fetch('/api/remote/pin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin })
        });
        if (res.ok) {
          window.location.reload();
          return;
        }
        err.textContent = res.status === 429 ? 'Muitas tentativas. Aguarde alguns minutos e tente de novo.' : 'PIN incorreto. Tente novamente.';
      } catch {
        err.textContent = 'Erro ao verificar PIN. Verifique a rede.';
      }
      err.style.display = 'block';
    }
    function handleAuth(e) {
      e.preventDefault();
      submitPin(document.getElementById('pinInput').value.trim());
    }
    // O QR e o link do túnel levam o PIN no fragmento (#pin=...): o navegador não o envia ao servidor, então ele
    // não aparece em logs, no Cloudflare nem no Referer. Aqui ele vira cookie de sessão e some da barra de endereço.
    (function autoLogin() {
      const m = /[#&]pin=([^&]+)/.exec(window.location.hash);
      if (!m) return;
      history.replaceState(null, '', window.location.pathname + window.location.search);
      submitPin(decodeURIComponent(m[1]));
    })();
  </script>
</body>
</html>`;
  return send(res, 200, html, "text/html; charset=utf-8");
}

module.exports = {
  PUBLIC,
  PORT,
  IS_REMOTE,
  PIN,
  HOST,
  MAX_CHATS,
  HEADERS,
  TYPES,
  getRoot,
  getProjects,
  read,
  slugs,
  active,
  inside,
  send,
  readJsonBody,
  hostOk,
  postOk,
  getActiveAppUrl,
  sendPinLoginPage,
};
