// @ts-check
import { state } from "../shared/state.js";
import { cs } from "./chat-store.js";
import { setChatStatus, setStreamingUI } from "./chat-stream-ui.js";
import { errorInfoFrom, clientErrorInfo, applyPermissionEvent } from "./chat-errors-permissions.js";
import { renderChatHistory } from "./chat-render.js";
import { saveCurrentChat } from "./chat-persist.js";
import { setChatStreaming, setChatAbortController } from "./chat-execution-store.js";
import { getEngineSession, setEngineSession } from "./chat-session-store.js";
import { applyHiaDone } from "./chat-hia-feedback.js";
import { newComparisonTraceId } from "./chat-trace-id.js";

/** Comparison mode: fires every selected engine in parallel against /api/chat. */
export async function runComparison(P, chatId, promptText, input) {
  const activeEngines = [...cs.compareSelectedEngines], traceId = newComparisonTraceId(); // 1 por comparação
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
          engine: eng, traceId,
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
              if (data.fullText && (!compTurn.responses[eng].text || data.replaceText)) {
                compTurn.responses[eng].text = data.fullText;
              }
              if (document.body.classList.contains("studio-active") && window.reloadStudioIframe) setTimeout(window.reloadStudioIframe, 350);
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
}
