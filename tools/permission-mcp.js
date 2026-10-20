#!/usr/bin/env node
// @ts-check
// Servidor MCP (stdio) com uma única ferramenta, `approve`, usada pelo Claude Code como --permission-prompt-tool:
// quando o Claude precisa de permissão, chama `approve`, que pergunta à interface do harness e devolve a decisão.
// Sem dependências: o MCP por stdio é JSON-RPC, uma mensagem por linha.
//
// Ambiente (preenchido por tools/lib/engines/claude.js):
//   HARNESS_PERM_URL   endereço do servidor da interface, ex.: http://127.0.0.1:4321
//   HARNESS_PERM_CHAT  identificador da conversa no servidor
const http = require("http");
const readline = require("readline");

const URL_BASE = process.env.HARNESS_PERM_URL || "";
const CHAT = process.env.HARNESS_PERM_CHAT || "";
const WAIT_MS = (Number(process.env.HARNESS_PERM_TIMEOUT_MS) || 10 * 60 * 1000) + 30_000;

const TOOL = {
  name: "approve",
  description: "Pergunta ao usuário, pela interface do harness, se uma ferramenta pode ser usada. Chamada só pelo Claude Code.",
  inputSchema: {
    type: "object",
    properties: {
      tool_name: { type: "string", description: "Ferramenta que pede permissão" },
      input: { type: "object", description: "Argumentos da chamada" },
      tool_use_id: { type: "string" },
    },
    required: ["tool_name", "input"],
  },
};

const reply = (/** @type {object} */ msg) => process.stdout.write(JSON.stringify({ jsonrpc: "2.0", ...msg }) + "\n");

/** Pergunta ao servidor da interface. Qualquer falha vira negação, nunca permissão. */
function ask(/** @type {string} */ tool, /** @type {unknown} */ input) {
  return new Promise((resolve) => {
    const deny = (/** @type {string} */ message) => resolve({ behavior: "deny", message });
    let u;
    try { u = new URL(URL_BASE); } catch { return deny("HARNESS_PERM_URL ausente ou inválida."); }
    if (!CHAT) return deny("HARNESS_PERM_CHAT ausente.");
    const body = JSON.stringify({ chatId: CHAT, tool, input });
    const req = http.request({
      hostname: u.hostname, port: u.port, path: "/api/permissions/request", method: "POST", timeout: WAIT_MS,
      // A interface só aceita POST com Origin igual ao Host.
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body), Origin: u.origin },
    }, (res) => {
      let data = "";
      res.on("data", (c) => { data += c; });
      res.on("end", () => {
        try {
          const j = JSON.parse(data);
          if (res.statusCode === 200 && (j.behavior === "allow" || j.behavior === "deny")) return resolve(j);
          deny(j.error || `Resposta inesperada da interface (HTTP ${res.statusCode}).`);
        } catch { deny("Resposta ilegível da interface."); }
      });
    });
    req.on("timeout", () => { req.destroy(); deny("A interface não respondeu a tempo."); });
    req.on("error", () => deny("Não foi possível falar com a interface do harness."));
    req.end(body);
  });
}

async function handle(/** @type {any} */ m) {
  const { id, method, params } = m;
  if (method === "initialize") {
    return reply({ id, result: { protocolVersion: (params && params.protocolVersion) || "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "harness-permissions", version: "1.0.0" } } });
  }
  if (method === "ping") return reply({ id, result: {} });
  if (method === "tools/list") return reply({ id, result: { tools: [TOOL] } });
  if (method === "tools/call") {
    const a = (params && params.arguments) || {};
    if (!params || params.name !== "approve") return reply({ id, error: { code: -32602, message: "ferramenta desconhecida" } });
    const d = /** @type {any} */ (await ask(String(a.tool_name || ""), a.input || {}));
    // Formato esperado pelo Claude Code: JSON no texto, com a entrada devolvida em updatedInput quando permite.
    const out = d.behavior === "allow" ? { behavior: "allow", updatedInput: a.input || {} } : { behavior: "deny", message: d.message || "Permissão negada." };
    return reply({ id, result: { content: [{ type: "text", text: JSON.stringify(out) }] } });
  }
  if (id !== undefined) reply({ id, error: { code: -32601, message: `método não suportado: ${method}` } }); // notificações (sem id) são ignoradas
}

readline.createInterface({ input: process.stdin }).on("line", (line) => {
  if (!line.trim()) return;
  let m;
  try { m = JSON.parse(line); } catch { return; }
  handle(m).catch((e) => { if (m && m.id !== undefined) reply({ id: m.id, error: { code: -32603, message: String(e && e.message) } }); });
});
