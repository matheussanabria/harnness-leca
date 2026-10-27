// @ts-check
// Despachante do Atelier Agent Run via SSE (EP-15).
// Conecta o chat do Ateliê ao loop de ferramentas atômicas.
import {
  renderAtelierPlanCard,
  renderAtelierQuestionCard,
  renderAtelierToolCallBadge,
  bindQuestionCardActions,
} from "./prototype-atelier-agent-ui.js";

/** Remove blocos estruturados (<tool>, <ferramenta>, <arquivo>) do texto exibido no chat. */
export function stripToolTags(text) {
  return String(text || "")
    .replace(/<\s*(?:tool|ferramenta)\s+(?:name|nome)\s*=[\s\S]*?<\/\s*(?:tool|ferramenta)\s*>/gi, "")
    .replace(/<\s*(?:tool|ferramenta)\s+(?:name|nome)\s*=[\s\S]*$/i, "")
    .replace(/<\s*arquivo\s+caminho\s*=[\s\S]*?<\/\s*arquivo\s*>/gi, "")
    .replace(/<\s*arquivo\s+caminho\s*=[\s\S]*$/i, "")
    .trim();
}

/**
 * Executa o loop do agente do Ateliê via SSE.
 * @param {object} options
 * @param {string} options.slug
 * @param {string} options.protoId
 * @param {string} options.prompt
 * @param {string} [options.engine]
 * @param {string} [options.model]
 * @param {string} [options.effort]
 * @param {AbortSignal} [options.signal]
 * @param {object} options.assistantTurn
 * @param {() => void} options.onRender
 * @param {() => void} options.onReloadProto
 * @param {(screenId: string) => void} [options.onFocusScreen]
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
  signal,
  assistantTurn,
  onRender,
  onReloadProto,
  onFocusScreen,
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
    body: JSON.stringify({ prompt, engine, model, effort }),
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

      try {
        const evt = JSON.parse(jsonStr);

        if (evt.type === "turn_start") {
          setStatus(`Turno ${evt.turn}: Modelo raciocinando...`);
        } else if (evt.type === "text" && evt.text) {
          assistantTurn.text = stripToolTags((assistantTurn.text || "") + evt.text);
          onRender();
        } else if (evt.type === "tool_exec_start") {
          setStatus(`Executando ferramenta ${evt.name}...`);
          if (evt.name === "atelier_write_screen" && evt.args?.screenId) onFocusScreen?.(evt.args.screenId);
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
          throw new Error(evt.error || "Erro no Agent Loop");
        }
      } catch (err) {
        console.warn("[atelier-agent-dispatcher] Erro ao processar chunk SSE:", err);
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
