// @ts-check
// modelTurn do Ateliê para qualquer motor de chat (claude, codex, gemini/antigravity, ollama): roda um turno pelo
// motor do harness em modo somente leitura (readOnly), junta o texto e extrai as tags <tool> que o loop executa.
const { TOOL_INSTRUCTION } = require("./atelier-tool-instruction.service");
const { parseToolTags } = require("./atelier-tool-tags.service");

/** Motores que não guardam sessão recebem o histórico inteiro a cada turno, em texto. */
function transcript(history) {
  return history.map((m) => {
    if (m.role === "user") return `Usuário:\n${m.text || ""}`;
    if (m.role === "model") return `Você respondeu:\n${m.text || ""}`;
    return `Resultados das ferramentas:\n${JSON.stringify(m.toolResults || [], null, 2)}`;
  }).join("\n\n");
}

function lastUserText(history) {
  const last = history[history.length - 1];
  if (last?.role === "tool" && Array.isArray(last.toolResults)) {
    return `Resultados das ferramentas executadas:\n${JSON.stringify(last.toolResults, null, 2)}\n\nContinue a execução do protótipo chamando a próxima ferramenta ou concluindo.`;
  }
  return last?.text || "";
}

/**
 * @param {object} config
 * @param {{ stream: (req: any) => void | Promise<void> }} config.impl motor de tools/lib/engines
 * @param {string} config.engine
 * @param {string} config.slug
 * @param {string} [config.model]
 * @param {string} [config.effort]
 * @param {string} [config.sessionId] sessão nativa do motor a retomar
 */
function buildEngineModelTurn({ impl, engine, slug, model, effort, sessionId }) {
  let session = sessionId || "";

  return async function engineModelTurn(history, signal, /** @type {(e: object) => void} */ emit = () => {}) {
    // Com sessão o motor já tem o histórico; sem ela (primeiro turno ou motor sem sessão) vai a conversa toda.
    const body = session ? lastUserText(history) : history.length > 1 ? transcript(history) : lastUserText(history);
    const prompt = `${TOOL_INSTRUCTION}\n\n${body}`;

    const text = await new Promise((resolve, reject) => {
      let acc = "";
      let failed = false;
      const onChunk = (d) => {
        if (d?.sessionId && d.sessionId !== session) { session = d.sessionId; emit({ type: "session", sessionId: session }); }
        if (d?.type === "text" && d.text) acc += d.text;
        else if (d?.type === "thinking" && d.text) emit({ type: "thinking", text: d.text });
        else if (d?.type === "error") { failed = true; reject(new Error(d.error || d.title || "Falha no motor")); }
      };
      const onDone = (d) => {
        if (d?.sessionId && d.sessionId !== session) { session = d.sessionId; emit({ type: "session", sessionId: session }); }
        if (!failed) resolve(acc || d?.fullText || "");
      };
      const onError = (err) => { failed = true; reject(err); };
      // Leituras de arquivo do motor levam tempo e não geram texto: sem isto a tela fica parada em "Iniciando...".
      const onToolUse = (info) => emit({ type: "thinking", text: `Consultando o projeto (${info?.name || "ferramenta"})...\n` });
      try {
        const run = impl.stream({ prompt, slug, sessionId: session || undefined, history: [], model, effort, readOnly: true, signal, onChunk, onDone, onError, onToolUse });
        if (run && typeof run.catch === "function") run.catch(onError);
      } catch (err) { onError(err); }
    });

    const parsed = parseToolTags(text);
    const errorCalls = parsed.errors.map((e) => ({ name: "atelier_parse_error", args: { tool: e.tool, reason: e.reason } }));
    return { text: parsed.text || text, toolCalls: [...parsed.toolCalls, ...errorCalls] };
  };
}

module.exports = { buildEngineModelTurn, transcript, lastUserText };
