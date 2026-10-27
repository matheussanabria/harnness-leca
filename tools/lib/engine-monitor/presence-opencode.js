// @ts-check
// Detecção de presença e saúde do servidor local do OpenCode (EP-09.06).
// Proibido de consultar /config/* (que expõe chaves em texto puro).
const { detectOpenCodeUrl } = require("../opencode-detect");

/**
 * Avalia presença do OpenCode, porta e se a porta foi fixada por configuração.
 * @param {{ env?: NodeJS.ProcessEnv }} [opts]
 * @returns {Promise<{
 *   presenca: "online" | "offline",
 *   porta?: number,
 *   url?: string,
 *   portaFixada: boolean,
 *   detalhe?: string
 * }>}
 */
async function checkOpenCodePresence({ env = process.env } = {}) {
  const isFixed = Boolean(env.OPENCODE_URL);

  try {
    const res = await detectOpenCodeUrl({ env });
    if (res.url) {
      const u = new URL(res.url);
      const port = Number(u.port) || (u.protocol === "https:" ? 443 : 80);
      return {
        presenca: "online",
        porta: port,
        url: res.url,
        portaFixada: isFixed,
        detalhe: isFixed ? "porta fixada por configuração" : "auto-detectado",
      };
    }

    return {
      presenca: "offline",
      portaFixada: isFixed,
      detalhe: isFixed
        ? "porta fixada não respondeu"
        : (res.discoveryErrors.length > 0 ? res.discoveryErrors.join("; ") : "nenhum servidor ativo detectado"),
    };
  } catch (err) {
    return {
      presenca: "offline",
      portaFixada: isFixed,
      detalhe: `erro na detecção (${err.message})`,
    };
  }
}

module.exports = {
  checkOpenCodePresence,
};
