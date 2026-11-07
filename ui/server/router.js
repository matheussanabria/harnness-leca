// @ts-check
const { PIN, send, getActiveAppUrl, sendPinLoginPage } = require("./config");
const netLib = require("../../tools/lib/network");
const { serveStatic } = require("./controllers/static.controller");
const { ROUTES } = require("./routes");

async function handle(req, res) {
  const url = new URL(req.url, "http://x");
  const p = decodeURIComponent(url.pathname);
  if (p.includes("\0")) return send(res, 400, { error: "requisição inválida" });

  // 1. PIN de Acesso Remoto: só o loopback direto passa livre; proxy/túnel e rede exigem sessão ou PIN.
  // O envio do PIN pelo formulário (POST /api/remote/pin) é autorizado e limitado pelo próprio controller.
  const isPinLogin = req.method === "POST" && p === "/api/remote/pin";
  const auth = isPinLogin ? { ok: true, reason: "local", retryAfterSec: 0 } : netLib.authorizeRemote(req, PIN, url);
  if (!auth.ok) {
    if (auth.reason === "locked") {
      res.setHeader("Retry-After", String(auth.retryAfterSec || 900));
      return send(res, 429, { error: "Muitas tentativas de PIN. Tente de novo mais tarde.", retryAfterSec: auth.retryAfterSec });
    }
    if (auth.reason === "unprotected-proxy") {
      return send(res, 403, { error: "Acesso por túnel ou proxy exige iniciar o Harness com --remote (PIN)." });
    }
    if (p.startsWith("/api/")) {
      return send(res, 401, { error: "PIN de acesso remoto obrigatório", authRequired: true });
    }
    return sendPinLoginPage(res);
  }

  // PIN aceito pelo link/QR: troca por cookie de sessão e remove o PIN da URL (histórico, logs, Referer).
  if (auth.reason === "pin" && url.searchParams.has("pin")) {
    res.setHeader("Set-Cookie", netLib.buildSessionCookie(req, netLib.issueSessionToken(PIN)));
    if (req.method === "GET" || req.method === "HEAD") {
      url.searchParams.delete("pin");
      // Uma barra só: "//host" viraria redirecionamento para outro site.
      res.writeHead(302, { Location: `/${url.pathname.replace(/^\/+/, "")}${url.search}`, "Cache-Control": "no-store" });
      return res.end();
    }
  }

  // 2. Rota de Proxy do App em Desenvolvimento: /preview ou /preview/*
  if (p === "/preview" || p.startsWith("/preview/")) {
    const appUrl = getActiveAppUrl();
    const subpath = p.replace(/^\/preview/, "") || "/";
    return netLib.proxyAppRequest(req, res, appUrl, subpath + (url.search || ""));
  }

  const method = req.method === "HEAD" ? "GET" : req.method;
  let pathKnown = false;
  for (const route of ROUTES) {
    const m = typeof route.path === "string" ? (p === route.path ? [p] : null) : p.match(route.path);
    if (!m) continue;
    pathKnown = true;
    if (route.method === method) return /** @type {any} */ (route.handler)({ req, res, url, params: m.slice(1) });
  }

  // 3. Proxy de assets e submódulos do app dev (Vite, React, Angular, Webpack)
  const referer = req.headers.referer || "";
  const isAppReferer =
    referer.includes("/preview") ||
    referer.includes("/@vite") ||
    referer.includes("/@") ||
    referer.includes("/src/") ||
    referer.includes("/node_modules/");
  const isKnownDevPrefix =
    p.startsWith("/@") ||
    p.startsWith("/src/") ||
    p.startsWith("/node_modules/") ||
    p.startsWith("/assets/");
  const isDevAssetExt = /\.(tsx?|jsx?|mjs|cjs|vue|svelte|css|scss|less|wasm|svg|png|jpe?g|gif|webp|ico|woff2?|ttf|eot|json|map)($|\?)/i.test(p);
  const isAppDevAsset = !p.includes("..") && (isKnownDevPrefix || (isAppReferer && isDevAssetExt));

  if (!p.startsWith("/api/") && isAppDevAsset) {
    const appUrl = getActiveAppUrl();
    return netLib.proxyAppRequest(req, res, appUrl, p + (url.search || ""));
  }

  return pathKnown ? send(res, 405, { error: "método não permitido" }) : serveStatic(res, p);
}

module.exports = {
  ROUTES,
  handle,
};
