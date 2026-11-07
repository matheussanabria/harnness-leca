// @ts-check
// Salvar e retomar conversas.
import { $ } from "../shared/dom.js";
import { parseChat, parseFrontmatter } from "../shared/markdown.js";
import { state, saveActiveChatState } from "../shared/state.js";
import { cs } from "./chat-store.js";
import { switchEngine } from "./chat-engines.js";
import { openInteractiveChat, setChatStatus, setStreamingUI } from "./chat-stream-ui.js";
import { warnIfLocalInferenceUnsafe } from "./chat-hia-panel.js";
import { renderChatHistory } from "./chat-render.js";
import { getEngineSession, setEngineSession, activateEngineSessions, moveEngineSessions } from "./chat-session-store.js";
import { isAtelierChatActive } from "./prototype-chat-bridge.js";
import { isCanvasChatActive } from "./canvas-chat-bridge.js";

// Motores que podem assinar um turno e assinar o cabeçalho da conversa.
const ASSISTANT_ENGINES = new Set(["claude", "opencode", "gemini", "codex", "ollama"]);

export async function saveCurrentChat(auto = false) {
  auto = auto === true; // o onclick dos botões chama sem argumento; nunca confundir com um evento
  const P = state.P;
  if (!P || state.chatTurns.length < 2) return;
  const sessionEngine = cs.currentEngine === "compare" ? cs.compareSelectedEngines[0] || "claude" : cs.currentEngine;
  if (auto && !getEngineSession(P.slug, cs.currentChatFile, sessionEngine)) return;
  if (!auto) setChatStatus("Salvando conversa no projeto...");
  const b1 = /** @type {HTMLButtonElement} */ ($("btnSaveChat"));
  if (b1 && !auto) b1.disabled = true;
  const b2 = /** @type {HTMLButtonElement} */ ($("btnSaveStudioChat"));
  if (b2 && !auto) b2.disabled = true;

  try {
    const firstUserMsg = state.chatTurns.find((t) => t.role === "user");
    const title =
      cs.currentChatTitle ||
      (firstUserMsg
        ? firstUserMsg.text.slice(0, 50).replace(/[\r\n]+/g, " ")
        : cs.currentEngine === "compare"
        ? "Comparativo Multi-Motor"
        : "Chat com " + cs.currentEngine);

    const flatTurns = [];
    for (const t of state.chatTurns) {
      if (t.role === "user") {
        flatTurns.push({ role: "user", text: t.text });
      } else if (t.role === "comparison") {
        for (const eng of t.engines) {
          const resp = t.responses[eng];
          if (resp && (resp.text || resp.thinking)) {
            flatTurns.push({
              role: "assistant",
              engine: eng,
              model: resp.model,
              effort: resp.effort,
              text: resp.text,
              thinking: resp.thinking,
              hiaRoute: resp.hiaRoute,
              hiaTool: resp.hiaTool,
              tokensSaved: resp.tokensSaved,
            });
          }
        }
      } else {
        flatTurns.push(t.errorInfo ? { ...t, text: `${t.text || ""}\n\n> **Erro:** ${t.errorInfo.title} — ${t.errorInfo.message}` } : t);
      }
    }

    const saveEngine = cs.currentEngine === "compare" ? cs.compareSelectedEngines[0] || "claude" : cs.currentEngine;

    const res = await fetch("/api/chat/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug: P.slug,
        engine: saveEngine,
        title,
        turns: flatTurns,
        sessionId: getEngineSession(P.slug, cs.currentChatFile, saveEngine),
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Falha ao salvar");

    if (data.fileName && cs.currentChatFile !== data.fileName) {
      moveEngineSessions(P.slug, cs.currentChatFile, data.fileName);
      cs.currentChatFile = data.fileName;
      state.currentChatFile = data.fileName;
      saveActiveChatState();
    }

    setChatStatus(auto ? `Salvo automaticamente em chats/${data.fileName}` : `Salvo com sucesso em chats/${data.fileName}!`);
    // Dentro do Ateliê, recarregar o projeto inteiro reescreveria o chat; a tela já foi atualizada localmente.
    if (!isAtelierChatActive() && !isCanvasChatActive() && window.load) await window.load(P.slug);
  } catch (err) {
    setChatStatus(`Erro ao salvar${auto ? " automaticamente" : ""}: ${err.message}`);
    if (auto) return;
    const b1 = /** @type {HTMLButtonElement} */ ($("btnSaveChat"));
    if (b1) b1.disabled = false;
    const b2 = /** @type {HTMLButtonElement} */ ($("btnSaveStudioChat"));
    if (b2) b2.disabled = false;
  }
}

export async function resumeExistingChat(chatName, preferStudio = false, { silent = false } = {}) {
  const P = state.P;
  if (!P) return;
  // silent: restore the turns in the background (no alerts, no dialog, no focus); nothing is shown on failure.
  const fail = (message) => (silent ? undefined : alert(message));
  try {
    const res = await fetch("/api/file?path=" + encodeURIComponent(`${P.slug}/chats/${chatName}`));
    const data = await res.json();
    const rawContent = data.content || "";
    if (!rawContent) {
      fail("Não foi possível carregar o conteúdo da conversa.");
      return;
    }

    const meta = parseFrontmatter(rawContent);
    const text = rawContent.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "");
    const parsedItems = parseChat(text);

    const turns = [];
    for (let i = 0; i < parsedItems.length; i++) {
      const it = parsedItems[i];
      if (it.who === "user") {
        turns.push({ role: "user", text: it.text });
      } else if (ASSISTANT_ENGINES.has(it.who)) {
        let thinking = "";
        if (i > 0 && parsedItems[i - 1].who === "internal") {
          const thinkTool = parsedItems[i - 1].tools.find((t) => t.thinking);
          if (thinkTool) thinking = thinkTool.input;
        }
        /** @type {any} */
        const turn = { role: "assistant", engine: it.who, text: it.text, thinking, phase: "done" };
        const next = parsedItems[i + 1];
        const hia = next && next.who === "internal" ? next.tools.find((tool) => /^hia-/.test(tool.name)) : null;
        if (hia) {
          turn.hiaRoute = hia.name.replace(/^hia-/, "");
          turn.hiaTool = hia.hint;
          turn.tokensSaved = Number(hia.result) || 0;
        }
        turns.push(turn);
      }
    }

    if (!turns.length) {
      fail("A conversa selecionada não possui mensagens para retomar.");
      return;
    }

    try {
      /** @type {any} */ ($("dlg")).close();
    } catch {}
    try {
      /** @type {any} */ ($("continueChatDlg")).close();
    } catch {}

    state.chatTurns = turns;
    cs.currentChatFile = chatName;
    state.currentChatFile = chatName;
    cs.currentChatTitle = meta.titulo || meta.title || chatName.replace(/\.md$/, "");
    activateEngineSessions(P.slug, chatName);

    const targetEngine = ASSISTANT_ENGINES.has(meta.agente) ? meta.agente : "claude";

    switchEngine(targetEngine);
    if (targetEngine === "ollama") warnIfLocalInferenceUnsafe();

    if (meta.sessao) {
      setEngineSession(P.slug, chatName, targetEngine, meta.sessao);
    }

    renderChatHistory();
    setStreamingUI(false);
    saveActiveChatState();
    if (silent) return;

    const sessaoAviso = meta.sessao ? ` · Sessão: ${meta.sessao.slice(0, 14)}...` : "";
    setChatStatus(`Conversa carregada: "${cs.currentChatTitle}" (${turns.length} turnos)${sessaoAviso}`);

    if (preferStudio || state.isStudioMode) {
      if (!state.isStudioMode && window.toggleStudioMode) window.toggleStudioMode(true);
      setTimeout(() => {
        const inp = $("studioChatInput");
        if (inp) inp.focus();
        const hist = $("studioChatHistory");
        if (hist) hist.scrollTop = hist.scrollHeight;
      }, 100);
    } else {
      openInteractiveChat();
      setTimeout(() => {
        const inp = $("chatInput");
        if (inp) inp.focus();
        const hist = $("chatHistory");
        if (hist) hist.scrollTop = hist.scrollHeight;
      }, 100);
    }
  } catch (err) {
    fail("Erro ao retomar conversa: " + (err.message || String(err)));
  }
}
