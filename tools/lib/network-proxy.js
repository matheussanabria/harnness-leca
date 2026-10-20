// @ts-check
// Proxy reverso HTTP e ponte WebSocket de HMR.
const http = require("http");
const net = require("net");

/**
 * Proxy HTTP transparente para o dev server do app ativo
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 * @param {string} targetUrlBase (ex: 'http://127.0.0.1:4200')
 * @param {string} [subpath]
 */
function proxyAppRequest(req, res, targetUrlBase, subpath) {
  try {
    const target = new URL(targetUrlBase);
    let pathname = subpath !== undefined ? subpath : req.url || "/";
    if (!pathname.startsWith("/")) pathname = "/" + pathname;

    const proxyHeaders = { ...req.headers };
    proxyHeaders.host = target.host;
    // Remove accept-encoding gzip se quisermos manipular, mas pipe transparente aceita tudo
    delete proxyHeaders["connection"];

    const reqOpts = {
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || (target.protocol === "https:" ? 443 : 80),
      path: pathname,
      method: req.method,
      headers: proxyHeaders,
      timeout: 10000,
    };

    const proxyReq = http.request(reqOpts, (proxyRes) => {
      // Ajusta cabeçalhos de resposta: remove restrições de iframe para permitir renderização fluida
      const resHeaders = { ...proxyRes.headers };
      delete resHeaders["x-frame-options"];
      const csp = resHeaders["content-security-policy"];
      if (typeof csp === "string") {
        resHeaders["content-security-policy"] = csp.replace(/frame-ancestors[^;]+;?/gi, "");
      } else if (Array.isArray(csp)) {
        resHeaders["content-security-policy"] = csp.map(c => c.replace(/frame-ancestors[^;]+;?/gi, ""));
      }
      res.writeHead(proxyRes.statusCode || 200, resHeaders);
      proxyRes.pipe(res);
    });

    proxyReq.on("error", (err) => {
      if (!res.headersSent && !res.writableEnded) {
        res.writeHead(502, { "Content-Type": "text/html; charset=utf-8" });
        res.end(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>App Offline - Harness</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #090d16; color: #f1f5f9; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; text-align: center; }
    .card { background: #131b2e; border: 1px solid #1e293b; border-radius: 16px; padding: 32px 24px; max-width: 440px; box-shadow: 0 10px 25px rgba(0,0,0,0.4); }
    h2 { font-size: 1.3rem; margin: 0 0 12px; color: #f87171; }
    p { font-size: 0.95rem; color: #94a3b8; line-height: 1.5; margin: 8px 0; }
    code { background: #1e293b; color: #38bdf8; padding: 3px 8px; border-radius: 6px; font-size: 0.88rem; }
    .btn { margin-top: 20px; background: #6366f1; color: white; border: none; padding: 10px 24px; border-radius: 8px; font-weight: 600; cursor: pointer; transition: 0.2s; }
    .btn:hover { background: #4f46e5; }
  </style>
</head>
<body>
  <div class="card">
    <h2>⚠️ Servidor Dev Offline</h2>
    <p>O Harness não conseguiu se conectar ao endereço local:</p>
    <p><code>${targetUrlBase}</code></p>
    <p>Certifique-se de que o servidor do seu projeto foi iniciado (ex.: <code>npm start</code> ou <code>npm run dev</code>).</p>
    <button class="btn" onclick="location.reload()">↻ Recarregar</button>
  </div>
</body>
</html>`);
      }
    });

    req.pipe(proxyReq);
  } catch (err) {
    if (!res.headersSent && !res.writableEnded) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Erro no proxy do app", detail: err.message }));
    }
  }
}

/**
 * Configura o proxy de WebSockets para Hot Module Replacement (HMR do Vite/Angular)
 * @param {http.Server} server
 * @param {() => string} getTargetUrl
 */
function setupWebSocketHmrProxy(server, getTargetUrl) {
  server.on("upgrade", (req, clientSocket, head) => {
    try {
      const targetBase = getTargetUrl();
      if (!targetBase) {
        clientSocket.destroy();
        return;
      }

      const target = new URL(targetBase);
      const targetPort = Number(target.port) || 80;
      const targetHost = target.hostname || "127.0.0.1";

      const targetSocket = net.connect(targetPort, targetHost, () => {
        // Reescreve a linha inicial do HTTP Upgrade
        const headersArr = [`${req.method} ${req.url} HTTP/${req.httpVersion}`];
        for (let i = 0; i < req.rawHeaders.length; i += 2) {
          const key = req.rawHeaders[i];
          const val = req.rawHeaders[i + 1];
          if (key.toLowerCase() === "host") {
            headersArr.push(`Host: ${target.host}`);
          } else {
            headersArr.push(`${key}: ${val}`);
          }
        }
        headersArr.push("", "");

        targetSocket.write(headersArr.join("\r\n"));
        if (head && head.length > 0) targetSocket.write(head);

        clientSocket.pipe(targetSocket);
        targetSocket.pipe(clientSocket);
      });

      targetSocket.on("error", () => clientSocket.destroy());
      clientSocket.on("error", () => targetSocket.destroy());
    } catch {
      clientSocket.destroy();
    }
  });
}

module.exports = { proxyAppRequest, setupWebSocketHmrProxy };
