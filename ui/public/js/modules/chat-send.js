// @ts-check
// Envio de mensagens e consumo do streaming com cancelamento e sessão canônica.
import { $, showToast } from "../shared/dom.js";
import { state, saveActiveChatState, clearChatDraft } from "../shared/state.js";
import { attachmentsBusy, hasAttachments, attachmentLabel, attachmentPrompt, clearChatAttachments } from "./chat-attachments.js";
import { wrapAtelierPrompt, applyAtelierReply } from "./prototype-chat-bridge.js";
import { cs } from "./chat-store.js";
import { setChatStatus, setStreamingUI } from "./chat-stream-ui.js";
import { errorInfoFrom, clientErrorInfo, applyPermissionEvent } from "./chat-errors-permissions.js";
import { renderChatHistory } from "./chat-render.js";
import { saveCurrentChat } from "./chat-persist.js";
import { chatPresentation } from "./chat-presentations.js";
import { isChatStreamingFor, setChatStreaming, setChatAbortController } from "./chat-execution-store.js";
import { getEngineSession, setEngineSession } from "./chat-session-store.js";
import { hiaStatusFromThinking, applyHiaDone, applyHiaFeedback } from "./chat-hia-feedback.js";

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
  if (cs.currentEngine === "compare") {
    const activeEngines = [...cs.compareSelectedEngines];
    if (!activeEngines.length) {
      alert("Selecione pelo menos um motor para comparar.");
      return;
    }

    const compTurn = {
      role: "comparison",
      engines: activeEngines,
      responses: {},
    };

    for (const eng of activeEngines) {
      compTurn.responses[eng] = {
        text: "",
        thinking: "",
        model: cs.engineSettings[eng]?.model,
        effort: cs.engineSettings[eng]?.effort,
        streaming: true,
        phase: "connecting",
        error: null,
        startTime: Date.now(),
        elapsedMs: null,
      };
    }

    state.chatTurns.push(compTurn);
    setChatStreaming(P.slug, chatId, true, "compare");
    setStreamingUI(true);
    setChatStatus(`Comparando ${activeEngines.length} motores em paralelo...`);
    renderChatHistory();

    const streamPromises = activeEngines.map(async (eng) => {
      const ac = new AbortController();
      setChatAbortController(P.slug, chatId, eng, ac);
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: ac.signal,
          body: JSON.stringify({
            engine: eng,
            prompt: promptText,
            slug: P.slug,
            sessionId: getEngineSession(P.slug, chatId, eng),
            history: state.chatTurns
              .filter((t) => t.role === "user" || (t.role === "assistant" && t.engine === eng))
              .slice(0, -1)
              .map((t) => ({ role: t.role, text: t.text })),
            model: cs.engineSettings[eng]?.model,
            effort: cs.engineSettings[eng]?.effort,
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
                setEngineSession(P.slug, chatId, eng, data.sessionId);
              }

              if (data.type === "text" && data.text) {
                compTurn.responses[eng].phase = "answering";
                compTurn.responses[eng].text += data.text;
                renderChatHistory();
              } else if (data.type === "thinking" && data.text) {
                compTurn.responses[eng].phase = "thinking";
                compTurn.responses[eng].thinking = (compTurn.responses[eng].thinking || "") + data.text;
                renderChatHistory();
              } else if (data.type === "permission" || data.type === "permission_resolved") {
                applyPermissionEvent(compTurn.responses[eng], data);
                renderChatHistory(true);
              } else if (data.type === "error") {
                compTurn.responses[eng].phase = "error";
                compTurn.responses[eng].error = data.error;
                compTurn.responses[eng].errorInfo = errorInfoFrom(data);
                renderChatHistory();
              } else if (data.type === "done") {
                if (data.sessionId && !data.hiaRoute) {
                  setEngineSession(P.slug, chatId, eng, data.sessionId);
                }
                applyHiaDone(compTurn.responses[eng], data);
                if (data.fullText && !compTurn.responses[eng].text) {
                  compTurn.responses[eng].text = data.fullText;
                }
                if (state.isStudioMode && window.reloadStudioIframe) setTimeout(window.reloadStudioIframe, 350);
              }
            } catch {}
          }
        }
      } catch (err) {
        if (err.name === "AbortError") {
          compTurn.responses[eng].error = "Interrompido pelo usuário.";
        } else {
          compTurn.responses[eng].error = err.message || String(err);
          compTurn.responses[eng].errorInfo = clientErrorInfo(err);
        }
      } finally {
        setChatAbortController(P.slug, chatId, eng, null);
        compTurn.responses[eng].streaming = false;
        compTurn.responses[eng].elapsedMs = Date.now() - compTurn.responses[eng].startTime;
        renderChatHistory();
      }
    });

    await Promise.allSettled(streamPromises);
    setChatStreaming(P.slug, chatId, false);
    setStreamingUI(false);
    setChatStatus("Comparação concluída!");
    renderChatHistory();
    if (input) input.focus();
    await saveCurrentChat(true);
    return;
  }

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
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: ac.signal,
      body: JSON.stringify({
        engine: cs.currentEngine,
        prompt: await wrapAtelierPrompt(promptText),
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
            if (data.fullText && !assistantTurn.text) {
              assistantTurn.text = data.fullText;
            }
            if (state.isStudioMode && window.reloadStudioIframe) setTimeout(window.reloadStudioIframe, 350);
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
