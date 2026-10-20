// @ts-check
// Coletor Periódico e Sob Demanda dos Adaptadores do M2
const { eventEngine } = require("./event-engine");
const { collectClaudeEvents } = require("./adapters/claude-adapter");
const { collectGeminiEvents } = require("./adapters/gemini-adapter");
const { collectOpenCodeEvents } = require("./adapters/opencode-adapter");
const { collectServicesEvents } = require("./adapters/services-adapter");

/**
 * Executa uma rodada completa de coleta em todos os adaptadores de forma isolada
 * @param {string} [projectId]
 * @returns {{ collected: number, errors: string[] }}
 */
function pollAllSources(projectId) {
  let total = 0;
  const errors = [];

  // 1. Claude Code
  try {
    const claudeEvts = collectClaudeEvents({ projectId });
    for (const e of claudeEvts) {
      if (eventEngine.ingest(e).accepted) total++;
    }
  } catch (err) {
    errors.push(`Claude: ${err.message}`);
  }

  // 2. Gemini Antigravity
  try {
    const geminiEvts = collectGeminiEvents({ projectId });
    for (const e of geminiEvts) {
      if (eventEngine.ingest(e).accepted) total++;
    }
  } catch (err) {
    errors.push(`Gemini: ${err.message}`);
  }

  // 3. OpenCode
  try {
    const opencodeEvts = collectOpenCodeEvents({ projectId });
    for (const e of opencodeEvts) {
      if (eventEngine.ingest(e).accepted) total++;
    }
  } catch (err) {
    errors.push(`OpenCode: ${err.message}`);
  }

  // 4. Serviços de Desenvolvimento Locais
  try {
    const servicesEvts = collectServicesEvents(projectId);
    for (const e of servicesEvts) {
      if (eventEngine.ingest(e).accepted) total++;
    }
  } catch (err) {
    errors.push(`Services: ${err.message}`);
  }

  return { collected: total, errors };
}

module.exports = {
  pollAllSources
};
