// @ts-check
// Envio de mensagens e consumo do streaming com cancelamento e sessão canônica.
import { $, showToast } from "../shared/dom.js";
import { state, saveActiveChatState, clearChatDraft } from "../shared/state.js";
import { attachmentsBusy, hasAttachments, attachmentLabel, attachmentPrompt, clearChatAttachments } from "./chat-attachments.js";
import { wrapAtelierPrompt, applyAtelierReply, getAtelierChatContext } from "./prototype-chat-bridge.js";
import { runAtelierAgentStream } from "./prototype-atelier-agent-dispatcher.js";
import { cs } from "./chat-store.js";
import { setChatStatus, setStreamingUI } from "./chat-stream-ui.js";
import { errorInfoFrom, clientErrorInfo, applyPermissionEvent } from "./chat-errors-permissions.js";
import { renderChatHistory } from "./chat-render.js";
import { saveCurrentChat } from "./chat-persist.js";
import { chatPresentation } from "./chat-presentations.js";
import { isChatStreamingFor, setChatStreaming, setChatAbortController } from "./chat-execution-store.js";
import { getEngineSession, setEngineSession } from "./chat-session-store.js";
import { hiaStatusFromThinking, applyHiaFeedback } from "./chat-hia-feedback.js";
import { runComparison } from "./chat-send-compare.js";

export async function sendChatMessage(presentation = "main") {
  const P = state.P;
  if (!P) return;
  const chatId = cs.currentChatFile;
  if (isChatStreamingFor(P.slug, chatId)) return;
  const input = /** @type {HTMLInputElement} */ ($(chatPresentation(presentation).input));
  if (attachmentsBusy()) return showToast("Aguarde o envio dos anexos terminar.");
  const typed = input?.value ? input.value.trim() : "";
  if (!typed && !hasAttachments()) return;

  const label = attachmentLabel();
  const text = [typed, label].filter(Boolean).join("\n\n");
  const promptText = (typed || "Analise os anexos.") + attachmentPrompt();
  clearChatAttachments();

  state.chatTurns.push({ role: "user", text });
  saveActiveChatState();
  clearChatDraft(P.slug);

  if (input) {
    input.value = "";
    input.style.height = "auto";
  }
  const studioInput = /** @type {HTMLInputElement} */ ($("studioChatInput"));
  if (studioInput && studioInput !== input) {
    studioInput.value = "";
    studioInput.style.height = "auto";
  }
  const miniInput = /** @type {HTMLInputElement} */ ($("miniChatInput"));
  if (miniInput && miniInput !== input) {
    miniInput.value = "";
    miniInput.style.height = "auto";
  }

  // MODO COMPARATIVO: dispara todos os motores selecionados em paralelo
  if (cs.currentEngine === "compare") return runComparison(P, chatId, promptText, input);

  // MODO INDIVIDUAL: motor único
  const assistantTurn = {
    role: "assistant",
    text: "",
    thinking: "",
    phase: "connecting",
    engine: cs.currentEngine,
    model: cs.engineSettings[cs.currentEngine]?.model,
    effort: cs.engineSettings[cs.currentEngine]?.effort,
    daiAgent: cs.activeDaiAgent || undefined,
  };
  state.chatTurns.push(assistantTurn);
  setChatStreaming(P.slug, chatId, true, cs.currentEngine);
  setStreamingUI(true);
  setChatStatus(`Conectando com ${cs.currentEngine}...`);
  renderChatHistory();

  const ac = new AbortController();
  setChatAbortController(P.slug, chatId, cs.currentEngine, ac);

  try {
    const atelierCtx = getAtelierChatContext();
    if (atelierCtx) {
      await runAtelierAgentStream({
        slug: P.slug,
        protoId: atelierCtx.protoId,
        prompt: promptText,
        engine: cs.currentEngine,
        model: cs.engineSettings[cs.currentEngine]?.model,
        effort: cs.engineSettings[cs.currentEngine]?.effort,
        sessionId: getEngineSession(P.slug, chatId, cs.currentEngine),
        onSession: (id) => setEngineSession(P.slug, chatId, cs.currentEngine, id),
        signal: ac.signal,
        assistantTurn,
        onRender: () => renderChatHistory(),
        onReloadProto: () => atelierCtx.reload?.(),
        onSendAnswer: (ans) => {
          const inp = $(chatPresentation(presentation).input) || (state.isStudioMode ? $("studioChatInput") : $("chatInput"));
          if (inp) {
            inp.value = ans;
            sendChatMessage(presentation);
          }
        },
        setStatus: (st) => setChatStatus(st),
      });
      return;
    }

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: ac.signal,
      body: JSON.stringify({
        engine: cs.currentEngine,
        prompt: await wrapAtelierPrompt(promptText, { resumed: Boolean(getEngineSession(P.slug, chatId, cs.currentEngine)) }),
        slug: P.slug,
        sessionId: getEngineSession(P.slug, chatId, cs.currentEngine),
        history: state.chatTurns.slice(0, -2).map((t) => ({ role: t.role, text: t.text })),
        model: cs.engineSettings[cs.currentEngine]?.model,
        effort: cs.engineSettings[cs.currentEngine]?.effort,
        daiAgent: cs.activeDaiAgent || undefined,
      }),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw Object.assign(new Error(errJson.error || `HTTP ${res.status}`), { http: res.status });
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const jsonStr = line.slice(6).trim();
        if (!jsonStr) continue;
        try {
          const data = JSON.parse(jsonStr);
          if (data.sessionId && !data.hiaRoute) {
            setEngineSession(P.slug, chatId, cs.currentEngine, data.sessionId);
          }

          if (data.type === "text" && data.text) {
            assistantTurn.phase = "answering";
            assistantTurn.text += data.text;
            setChatStatus("Recebendo resposta...");
            renderChatHistory();
          } else if (data.type === "thinking" && data.text) {
            assistantTurn.phase = "thinking";
            assistantTurn.thinking = (assistantTurn.thinking || "") + data.text;
            setChatStatus(hiaStatusFromThinking(data.text) || "Pensando (raciocínio interno)...");
            renderChatHistory();
          } else if (data.type === "permission" || data.type === "permission_resolved") {
            applyPermissionEvent(assistantTurn, data);
            renderChatHistory(true);
          } else if (data.type === "error") {
            assistantTurn.errorInfo = errorInfoFrom(data);
            renderChatHistory();
          } else if (data.type === "done") {
            if (data.sessionId && !data.hiaRoute) {
              setEngineSession(P.slug, chatId, cs.currentEngine, data.sessionId);
            }
            applyHiaFeedback(assistantTurn, data, setChatStatus);
            // replaceText: the quality gate retried a bad answer; the streamed text is replaced by the retry's.
            if (data.fullText && (!assistantTurn.text || data.replaceText)) {
              assistantTurn.text = data.fullText;
            }
            if (document.body.classList.contains("studio-active") && window.reloadStudioIframe) setTimeout(window.reloadStudioIframe, 350);
          }
        } catch {}
      }
    }
  } catch (err) {
    if (err.name === "AbortError") {
      assistantTurn.text += `\n\n> *Resposta interrompida pelo usuário.*`;
    } else {
      assistantTurn.errorInfo = clientErrorInfo(err);
    }
  } finally {
    setChatAbortController(P.slug, chatId, cs.currentEngine, null);
    setChatStreaming(P.slug, chatId, false);
    setStreamingUI(false);
    const currentSId = getEngineSession(P.slug, chatId, cs.currentEngine);
    setChatStatus(currentSId ? `Sessão ativa (${cs.currentEngine}): ${currentSId.slice(0, 14)}...` : "");
    renderChatHistory();
    const targetInp = $(chatPresentation(presentation).input) || (state.isStudioMode ? $("studioChatInput") : $("chatInput"));
    if (targetInp) targetInp.focus();
    await applyAtelierReply(assistantTurn.text);
    await saveCurrentChat(true);
  }
}
