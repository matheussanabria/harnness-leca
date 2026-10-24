// @ts-check
// Interação do chat da estação e lista de sessões.
import { playClickSound } from "../office-audio.js";

export function setupDeskChatInteraction(agentKey, state, meta) {
  const inputEl = /** @type {HTMLTextAreaElement} */ (document.getElementById("deskChatInput"));
  const sendBtn = /** @type {HTMLButtonElement} */ (document.getElementById("deskChatSendBtn"));
  const historyEl = document.getElementById("deskChatHistory");
  const statusEl = document.getElementById("deskChatStatus");
  const btn3D = document.getElementById("btnLoadIn3DMonitor");

  btn3D?.addEventListener("click", () => {
    // @ts-ignore
    if (window.engine3D?.browserScreen) {
      // @ts-ignore
      window.engine3D.browserScreen.navigateTo(`/?engine=${agentKey}&new=1`);
      // @ts-ignore
      window.engine3D.sitAtWorkstation();
      playClickSound();
    }
  });

  const sendMessage = async () => {
    const text = inputEl ? inputEl.value.trim() : "";
    if (!text || !historyEl || !sendBtn) return;

    const userMsg = document.createElement("div");
    userMsg.style.cssText = "align-self:flex-end;background:#1e3a8a;color:#eff6ff;padding:8px 12px;border-radius:8px;max-width:85%;line-height:1.4";
    userMsg.textContent = text;
    historyEl.appendChild(userMsg);

    inputEl.value = "";
    sendBtn.disabled = true;
    sendBtn.innerHTML = '<i class="fa-solid fa-hourglass-half fa-spin" aria-hidden="true"></i>...';

    const assistantMsg = document.createElement("div");
    assistantMsg.style.cssText = `align-self:flex-start;background:rgba(30,41,59,0.9);border:1px solid ${meta.color}55;color:#f1f5f9;padding:8px 12px;border-radius:8px;max-width:92%;line-height:1.4`;
    assistantMsg.innerHTML = `<span>${meta.icon} ${meta.name} gerando resposta...</span>`;
    historyEl.appendChild(assistantMsg);
    historyEl.scrollTop = historyEl.scrollHeight;

    if (statusEl) {
      statusEl.style.display = "block";
      statusEl.textContent = "Conectando ao motor /api/chat...";
      statusEl.style.color = "#94a3b8";
    }

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          engine: agentKey,
          prompt: text,
          slug: state.activeProject
        })
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP ${res.status}`);
      }

      let fullText = "";
      let hasError = false;
      let errorObj = null;

      if (res.body && res.body.getReader) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        assistantMsg.innerHTML = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.type === "error") {
                  hasError = true;
                  errorObj = data;
                } else if (data.token) {
                  fullText += data.token;
                } else if (data.text) {
                  fullText += data.text;
                } else if (data.chunk) {
                  fullText += data.chunk;
                }
              } catch (_) {
                fullText += line.slice(6);
              }
            } else if (line.trim() && !line.startsWith("event:")) {
              fullText += line + "\n";
            }
          }

          if (hasError && errorObj) {
            assistantMsg.innerHTML = `
              <div style="background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.4);border-radius:6px;padding:8px 10px;color:#fca5a5;font-size:11.5px">
                <div style="font-weight:700;margin-bottom:4px"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i> ${errorObj.title || "Erro na Execução"}</div>
                <div>${errorObj.error || errorObj.message || "Falha reportada pelo motor."}</div>
                ${errorObj.hint ? `<div style="margin-top:6px;color:#cbd5e1;font-size:11px"><i class="fa-solid fa-lightbulb" aria-hidden="true"></i> ${errorObj.hint}</div>` : ""}
              </div>
            `;
          } else {
            assistantMsg.textContent = fullText;
          }
          historyEl.scrollTop = historyEl.scrollHeight;
        }
      } else {
        const json = await res.json();
        fullText = json.response || json.text || JSON.stringify(json);
        assistantMsg.textContent = fullText;
      }

      if (statusEl) {
        if (hasError) {
          statusEl.innerHTML = '<i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i> Motor reportou uma limitação na execução.';
          statusEl.style.color = "#fca5a5";
        } else {
          statusEl.innerHTML = '<i class="fa-solid fa-circle-check" aria-hidden="true"></i> Resposta concluída com sucesso!';
          statusEl.style.color = "#22c55e";
        }
      }
      playClickSound();
    } catch (err) {
      assistantMsg.innerHTML = `<span style="color:#ef4444"><i class="fa-solid fa-circle-xmark" aria-hidden="true"></i> Falha ao conversar com o agente: ${err.message}. Você pode tentar abrir o chat completo na Central.</span>`;
      if (statusEl) {
        statusEl.textContent = "Erro na requisição. Verifique a chave ou serviço do motor.";
        statusEl.style.color = "#ef4444";
      }
    } finally {
      sendBtn.disabled = false;
      sendBtn.innerHTML = 'Enviar <i class="fa-solid fa-bolt" aria-hidden="true"></i>';
    }
  };

  sendBtn?.addEventListener("click", sendMessage);
  inputEl?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
}

export function renderAgentSessionList(sessions, fallbackChats, accentColor, projectSlug) {
  const continueAction = (chatFile) => `window.openOfficeChatConversation(${JSON.stringify(chatFile)})`;
  if (sessions && sessions.length > 0) {
    return sessions.slice(0, 6).map(s => {
      const promptText = (s.prompts && s.prompts[0]) ? s.prompts[0] : "";
      return `
        <div class="chat-item-row" onclick='${continueAction(s.file || "")}' style="border-left:3px solid ${accentColor}">
          <div class="chat-item-info">
            <span class="chat-item-title">${s.titulo || s.file}</span>
            <span class="chat-item-meta">${s.day || ''} · ${s.toolCount || 0} tools · ${s.prompts?.length || 0} pedidos</span>
            ${promptText ? `<span style="font-size:11px;color:#94a3b8;font-style:italic;margin-top:2px;display:block">"${promptText.slice(0, 75)}..."</span>` : ''}
          </div>
          <span style="font-size:11.5px;color:#38bdf8;font-weight:700">Continuar <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i></span>
        </div>
      `;
    }).join("");
  }

  if (fallbackChats && fallbackChats.length > 0) {
    return fallbackChats.slice(0, 6).map(c => `
      <div class="chat-item-row" onclick='${continueAction(c.name || c.id || "")}'>
        <div class="chat-item-info">
          <span class="chat-item-title">${c.title || c.name || c.id}</span>
          <span class="chat-item-meta">${c.date || "Sem data"} · ${c.engine || "motor"}</span>
        </div>
        <span style="font-size:11.5px;color:#38bdf8;font-weight:700">Continuar <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i></span>
      </div>
    `).join("");
  }

  return `<div style="color:var(--office-mute);font-size:12px;padding:8px 0;font-style:italic">Nenhuma conversa anterior registrada com este motor. Inicie um chat acima!</div>`;
}
