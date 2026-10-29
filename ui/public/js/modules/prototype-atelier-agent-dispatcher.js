// @ts-check
// Despachante do Atelier Agent Run via SSE (EP-15).
// Conecta o chat do Ateliê ao loop de ferramentas atômicas.
import {
  renderAtelierPlanCard,
  renderAtelierQuestionCard,
  renderAtelierToolCallBadge,
  bindQuestionCardActions,
} from "./prototype-atelier-agent-ui.js";

/**
 * Executa o loop do agente do Ateliê via SSE.
 * @param {object} options
 * @param {string} options.slug
 * @param {string} options.protoId
 * @param {string} options.prompt
 * @param {string} [options.engine]
 * @param {string} [options.model]
 * @param {string} [options.effort]
 * @param {string} [options.sessionId] sessão do motor da conversa anterior (mantém o histórico)
 * @param {(sessionId: string) => void} [options.onSession]
 * @param {AbortSignal} [options.signal]
 * @param {object} options.assistantTurn
 * @param {() => void} options.onRender
 * @param {() => void} options.onReloadProto
 * @param {(answer: string) => void} options.onSendAnswer
 * @param {(status: string) => void} options.setStatus
 */
export async function runAtelierAgentStream({
  slug,
  protoId,
  prompt,
  engine = "gemini",
  model,
  effort = "medium",
  sessionId,
  onSession,
  signal,
  assistantTurn,
  onRender,
  onReloadProto,
  onSendAnswer,
  setStatus,
}) {
  const url = `/api/project/${encodeURIComponent(slug)}/design/prototypes/${encodeURIComponent(protoId)}/agent-run`;

  assistantTurn.atelierPlan = null;
  assistantTurn.atelierTools = [];
  assistantTurn.atelierQuestion = null;

  setStatus(`Iniciando Agent Loop (${engine})...`);

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, engine, model, effort, sessionId }),
    signal,
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `HTTP ${res.status}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("Fluxo SSE não suportado pelo navegador.");

  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const jsonStr = line.slice(6).trim();
      if (!jsonStr) continue;

      let evt;
      try {
        evt = JSON.parse(jsonStr);
      } catch (err) {
        console.warn("[atelier-agent-dispatcher] Erro ao processar chunk SSE:", err);
        continue;
      }

      {
        if (evt.type === "session" && evt.sessionId) {
          onSession?.(evt.sessionId);
        } else if (evt.type === "waiting") {
          const min = Math.floor(evt.seconds / 60);
          setStatus(`Modelo gerando há ${min ? `${min} min ` : ""}${evt.seconds % 60}s sem emitir texto (a sessão está ativa no OpenCode)...`);
        } else if (evt.type === "turn_start") {
          setStatus(`Turno ${evt.turn}: Modelo raciocinando...`);
        } else if (evt.type === "thinking" && evt.text) {
          assistantTurn.phase = "thinking";
          assistantTurn.thinking = (assistantTurn.thinking || "") + evt.text;
          onRender();
        } else if (evt.type === "text" && evt.text) {
          assistantTurn.phase = "answering";
          assistantTurn.text = (assistantTurn.text || "") + evt.text;
          onRender();
        } else if (evt.type === "tool_exec_start") {
          setStatus(`Executando ferramenta ${evt.name}...`);
          assistantTurn.atelierTools.push({ name: evt.name, status: "executing" });
          onRender();
        } else if (evt.type === "tool_exec_end") {
          const t = assistantTurn.atelierTools.find((x) => x.name === evt.name && x.status === "executing");
          if (t) t.status = evt.ok ? "done" : "error";

          if (evt.name === "atelier_plan" && evt.ok && evt.result?.plan) {
            assistantTurn.atelierPlan = evt.result.plan;
          } else if (evt.name === "atelier_write_screen" || evt.name === "atelier_patch_styles") {
            if (evt.ok) onReloadProto();
          }
          onRender();
        } else if (evt.type === "yield" && evt.payload) {
          assistantTurn.atelierQuestion = evt.payload;
          setStatus("Aguardando resposta do usuário...");
          onRender();
        } else if (evt.type === "complete") {
          setStatus("Protótipo finalizado com sucesso!");
          onReloadProto();
        } else if (evt.type === "error") {
          throw Object.assign(new Error(evt.error || "Erro no Agent Loop"), {
            // Mesmo formato do cartão de erro do chat (título, dica e detalhe já traduzidos pelo servidor).
            info: { code: evt.code || "unknown", title: evt.title || "Erro", message: evt.error, hint: evt.hint, detail: evt.detail, retryable: !!evt.retryable },
          });
        }
      }
    }
  }

  onReloadProto();
}

/**
 * Renderiza os blocos visuais do Agent Loop dentro do cartão do assistente.
 * @param {object} assistantTurn
 * @returns {string}
 */
export function renderAtelierTurnDecorations(assistantTurn) {
  let html = "";

  if (Array.isArray(assistantTurn.atelierTools) && assistantTurn.atelierTools.length) {
    const badges = assistantTurn.atelierTools
      .map((t) => renderAtelierToolCallBadge(t.name, t.status))
      .join(" ");
    html += `<div class="atelier-tools-stream my-1">${badges}</div>`;
  }

  if (assistantTurn.atelierPlan) {
    html += renderAtelierPlanCard(assistantTurn.atelierPlan);
  }

  if (assistantTurn.atelierQuestion) {
    html += renderAtelierQuestionCard(assistantTurn.atelierQuestion);
  }

  return html;
}

/**
 * Vincula ações do cartão de pergunta no DOM.
 * @param {HTMLElement} container
 * @param {(ans: string) => void} onAnswer
 */
export function bindAtelierAgentDom(container, onAnswer) {
  bindQuestionCardActions(container, onAnswer);
}
