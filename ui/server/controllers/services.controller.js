// @ts-check
const { slugs, send, readJsonBody, HEADERS } = require("../config");
const procManager = require("../../../tools/lib/proc-manager");

function apiProjectServicesGet({ res, params: [slug] }) {
  if (!slugs().includes(slug)) return send(res, 404, { error: "projeto não encontrado" });
  return send(res, 200, {
    services: procManager.listProjectServices(slug),
    suggested: procManager.extractCommandsFromDocs(slug),
  });
}

async function apiProjectServicesStart({ req, res, params: [slug] }) {
  if (!slugs().includes(slug)) return send(res, 404, { error: "projeto não encontrado" });
  let body = {};
  try {
    body = await readJsonBody(req);
  } catch {}
  const serviceId = body.serviceId || "default";
  const result = await procManager.startService(slug, serviceId);
  return send(res, result.ok ? 200 : 500, result);
}

async function apiProjectServicesStop({ req, res, params: [slug] }) {
  if (!slugs().includes(slug)) return send(res, 404, { error: "projeto não encontrado" });
  let body = {};
  try {
    body = await readJsonBody(req);
  } catch {}
  const result = procManager.stopService(slug, body.serviceId);
  return send(res, 200, result);
}

function apiProjectServicesLogs({ req, res, url, params: [slug] }) {
  if (!slugs().includes(slug)) return send(res, 404, { error: "projeto não encontrado" });
  const serviceId = url.searchParams.get("serviceId") || "default";
  const stream = url.searchParams.get("stream") === "1";

  if (stream) {
    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      ...HEADERS,
    });
    const current = procManager.getServiceLogs(slug, serviceId);
    for (const l of current.logs) {
      res.write(`data: ${JSON.stringify({ type: "stdout", text: l })}\n\n`);
    }
    const unsubscribe = procManager.subscribeLogs(slug, serviceId, (chunk) => {
      try {
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      } catch {}
    });
    req.on("close", () => unsubscribe());
    return;
  }

  return send(res, 200, procManager.getServiceLogs(slug, serviceId));
}

async function apiProjectServicesConfig({ req, res, params: [slug] }) {
  if (!slugs().includes(slug)) return send(res, 404, { error: "projeto não encontrado" });
  let body = {};
  try {
    body = await readJsonBody(req);
  } catch {
    return send(res, 400, { error: "JSON inválido" });
  }
  const saved = procManager.saveProjectAppConfig(slug, body);
  return send(res, 200, { ok: true, config: saved });
}

module.exports = {
  apiProjectServicesGet,
  apiProjectServicesStart,
  apiProjectServicesStop,
  apiProjectServicesLogs,
  apiProjectServicesConfig,
};
