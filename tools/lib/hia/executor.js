// @ts-check
const { getTool } = require("./registry");

/**
 * Valida argumentos contra tentativas de path traversal e comandos perigosos
 * @param {any} args
 */
function sanitizeArgs(args) {
  if (!args || typeof args !== "object") return;
  for (const [key, val] of Object.entries(args)) {
    if (typeof val === "string") {
      // Bloqueia tentativas de path traversal grosseiro
      if (val.includes("..\\..\\..") || val.includes("../../../")) {
        throw new Error(`Argumento '${key}' contem caminho suspeito (path traversal bloqueado)`);
      }
      // Bloqueia comandos de destruição em argumentos de texto
      if (/\b(rm\s+-rf|rmdir\s+\/s|del\s+\/f|drop\s+database|format\s+[a-z]:)\b/i.test(val)) {
        throw new Error(`Argumento '${key}' contem padrao de acao destrutiva nao autorizada`);
      }
    } else if (typeof val === "object") {
      sanitizeArgs(val);
    }
  }
}

/**
 * Executa uma ferramenta com controle de timeout e captura de métricas
 * @param {string} toolId
 * @param {any} [args]
 * @param {{ timeoutMs?: number }} [options]
 * @returns {Promise<{ ok: boolean, data?: any, error?: { code: string, message: string, detail?: string }, durationMs: number }>}
 */
async function executeTool(toolId, args = {}, options = {}) {
  const start = Date.now();
  const tool = getTool(toolId);
  if (!tool) {
    return {
      ok: false,
      error: { code: "NOT_FOUND", message: `Ferramenta '${toolId}' nao encontrada no Automation Registry.` },
      durationMs: Date.now() - start,
    };
  }

  try {
    sanitizeArgs(args);
  } catch (err) {
    return {
      ok: false,
      error: { code: "SECURITY_VIOLATION", message: err.message },
      durationMs: Date.now() - start,
    };
  }

  const timeoutMs = options.timeoutMs || tool.timeoutMs || 30000;

  try {
    /** @type {Promise<any>} */
    const taskPromise = Promise.resolve().then(() => tool.handler(args));

    let timer;
    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`Tempo limite excedido (${timeoutMs}ms) ao executar '${toolId}'`));
      }, timeoutMs);
    });

    const data = await Promise.race([taskPromise, timeoutPromise]);
    clearTimeout(timer);

    return {
      ok: true,
      data,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    return {
      ok: false,
      error: {
        code: err.message && err.message.includes("Tempo limite") ? "TIMEOUT" : "EXECUTION_ERROR",
        message: err.message || "Erro desconhecido durante a execucao",
        detail: err.stack,
      },
      durationMs: Date.now() - start,
    };
  }
}

module.exports = { executeTool, sanitizeArgs };
