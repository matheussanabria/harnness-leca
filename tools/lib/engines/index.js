// Os motores de chat da interface e o que há de comum entre eles. Cada motor é um módulo com a mesma forma:
//   { id, stream(req), status(catalogo) }
//   stream({ prompt, slug, sessionId, history, model, effort, signal, onChunk, onDone, onError })
//   status(catalogo) -> parte dinâmica do que a interface mostra (disponibilidade, modelos, texto de autenticação);
//   o resto (nome, ícone, cor, modelos de reserva...) vem de catalog.json.
// Para acrescentar um motor: criar o módulo, listá-lo aqui e acrescentar a entrada em catalog.json. O servidor
// escolhe o motor por `engines.get(id)` e não precisa mudar.
const { loadEnv } = require("../env");
const { saveChatToProject } = require("../chat-save");
const catalog = require("./catalog.json");
const common = require("./common");
const claude = require("./claude");
const opencode = require("./opencode");
const gemini = require("./gemini");

const engines = new Map([claude, opencode, gemini].map((e) => [e.id, e]));

// Chaves do catálogo que começam com "_" são de uso interno dos motores e não vão para a interface.
const publicPart = (entry) => Object.fromEntries(Object.entries(entry).filter(([k]) => !k.startsWith("_")));

// Disponibilidade e modelos dos motores (consultas em paralelo; cada uma tem o próprio limite de tempo).
async function getEnginesStatus() {
  loadEnv();
  const entries = await Promise.all([...engines.values()].map(async (e) => [e.id, { id: e.id, ...publicPart(catalog[e.id]), ...(await e.status(catalog[e.id])) }]));
  return Object.fromEntries(entries);
}

module.exports = {
  engines,
  getEnginesStatus,
  saveChatToProject,
  // Compatibilidade com quem chamava as funções direto
  streamClaude: claude.stream,
  streamOpenCode: opencode.stream,
  streamGemini: gemini.stream,
  PublicError: common.PublicError,
  safeModel: common.safeModel,
  safeEffort: common.safeEffort,
  getProjectContext: common.getProjectContext,
  createClaudeStreamParser: claude.createClaudeStreamParser,
  claudeSession: claude.claudeSession,
  killTree: claude.killTree,
};
