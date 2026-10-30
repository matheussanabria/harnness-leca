// @ts-check
// Orquestrador do Atelier Agent Loop & Tool Dispatcher (EP-15.03).
// Coordena os turnos entre o modelo de IA e as ferramentas do Ateliê.
const { executeAtelierTool } = require("./atelier-tools.service");

const DEFAULT_MAX_TURNS = 10;

/**
 * @typedef {object} AgentLoopMessage
 * @property {"user" | "model" | "tool"} role
 * @property {string} [text]
 * @property {Array<{ name: string, args: object, id?: string }>} [toolCalls]
 * @property {Array<{ name: string, result: object, id?: string }>} [toolResults]
 */

/**
 * Cria uma instância do loop de agente para prototipação incremental.
 * @param {object} options
 * @param {string} options.projectDir
 * @param {string} options.protoId
 * @param {string} [options.author]
 * @param {number} [options.maxTurns]
 * @param {() => string} [options.getContext] estado atual do protótipo, lido a cada execução
 * @param {(messages: AgentLoopMessage[], signal: AbortSignal) => Promise<{ text?: string, toolCalls?: Array<{ name: string, args: object, id?: string }> }>} options.modelTurn
 */
function createAtelierAgentLoop({
  projectDir,
  protoId,
  author = "agent",
  maxTurns = DEFAULT_MAX_TURNS,
  modelTurn,
  getContext,
}) {
  if (!projectDir || !protoId) throw new Error("projectDir e protoId são obrigatórios.");
  if (typeof modelTurn !== "function") throw new Error("modelTurn deve ser uma função assíncrona.");

  /** @type {AgentLoopMessage[]} */
  const history = [];
  let isRunning = false;

  /**
   * Executa a instrução do usuário em múltiplos turnos até a conclusão ou suspensão.
   * @param {string} userPrompt
   * @param {object} [callbacks]
   * @param {(event: { type: string, [key: string]: any }) => void} [callbacks.onEvent]
   * @param {AbortSignal} [callbacks.signal]
   */
  async function run(userPrompt, { onEvent = () => {}, signal } = {}) {
    if (isRunning) throw new Error("O loop do agente já está em execução para este protótipo.");
    isRunning = true;

    if (userPrompt) {
      // O modelo recebe o estado atual do protótipo antes do pedido; o evento mostra só o que o usuário escreveu.
      let context = "";
      try {
        context = getContext ? getContext() : "";
      } catch {
        /* sem contexto, o pedido segue */
      }
      history.push({ role: "user", text: context ? `${context}\n\n## Pedido do usuário\n${userPrompt}` : userPrompt });
      onEvent({ type: "user_prompt", text: userPrompt });
    }

    let turnCount = 0;
    try {
      while (turnCount < maxTurns) {
        if (signal?.aborted) {
          onEvent({ type: "aborted", reason: "Cancelado pelo usuário." });
          return { status: "aborted", turnCount, history };
        }

        turnCount++;
        onEvent({ type: "turn_start", turn: turnCount });

        // Invoca o modelo com o histórico acumulado
        const response = await modelTurn(history, signal, onEvent);
        const { text = "", toolCalls = [] } = response || {};

        if (text) {
          onEvent({ type: "text", text });
        }

        // Se o modelo não chamou ferramentas e só respondeu texto, encerra o turno
        if (!toolCalls.length) {
          history.push({ role: "model", text });
          onEvent({ type: "turn_end", turn: turnCount, hasToolCalls: false });
          return { status: "completed", turnCount, history, reply: text };
        }

        // Registra a resposta do modelo com chamadas de ferramenta
        history.push({ role: "model", text, toolCalls });
        onEvent({ type: "tool_calls", turn: turnCount, toolCalls });

        /** @type {Array<{ name: string, result: object, id?: string }>} */
        const toolResults = [];
        let yieldsControl = false;
        let controlPayload = null;

        for (const tc of toolCalls) {
          if (signal?.aborted) break;

          onEvent({ type: "tool_exec_start", name: tc.name, args: tc.args });
          const execRes = await executeAtelierTool(tc.name, tc.args, { projectDir, protoId, author });
          onEvent({ type: "tool_exec_end", name: tc.name, ok: execRes.ok, result: execRes.result, error: execRes.error });

          toolResults.push({ name: tc.name, result: execRes.ok ? execRes.result : { error: execRes.error }, id: tc.id });

          if (execRes.yieldsControl) {
            yieldsControl = true;
            controlPayload = execRes.result;
          }

          if (tc.name === "atelier_complete" && execRes.ok) {
            history.push({ role: "tool", toolResults });
            onEvent({ type: "complete", result: execRes.result });
            return { status: "completed", turnCount, history, result: execRes.result };
          }
        }

        history.push({ role: "tool", toolResults });

        // Suspende o loop se uma ferramenta solicitou controle do usuário (ex: atelier_ask_user)
        if (yieldsControl) {
          onEvent({ type: "yield", payload: controlPayload });
          return { status: "yielded", turnCount, history, controlPayload };
        }
      }

      onEvent({ type: "max_turns_reached", maxTurns });
      return { status: "max_turns_exceeded", turnCount, history };
    } finally {
      isRunning = false;
    }
  }

  return {
    run,
    getHistory: () => [...history],
    isRunning: () => isRunning,
  };
}

module.exports = {
  createAtelierAgentLoop,
  DEFAULT_MAX_TURNS,
};
