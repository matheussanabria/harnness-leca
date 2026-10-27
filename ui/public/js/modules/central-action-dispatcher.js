// @ts-check
// Despachante de ações de sessão da Central (EP-09.04, RF1-RF6, RF9-RF10, RF12).
// Conecta os botões da Central com o Chat Universal e com o Escritório.

import { resumeExistingChat } from "./chat-persist.js";
import { openInteractiveChat } from "./chat-stream-ui.js";
import { switchEngine } from "./chat-engines.js";
import { state } from "../shared/state.js";
import { cs } from "./chat-store.js";

/**
 * Publica um evento de auditoria no log da 09.02 se loopback disponível.
 * @param {string} slug
 * @param {string} type
 * @param {object} payload
 */
export async function emitSessionActionEvent(slug, type, payload) {
  try {
    const res = await fetch(`/api/project/${encodeURIComponent(slug)}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        source: { provider: payload?.provider || "central", kind: "orchestration" },
        trust: "harness_owned",
        projectId: slug,
        sessionId: payload?.sessionId || null,
        payload,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Executa uma ação de sessão acionada pelo usuário na interface.
 * @param {string} actionId
 * @param {object} session
 * @param {object} options
 * @param {string} options.slug
 * @param {Function} [options.reRender]
 * @returns {Promise<boolean>}
 */
export async function executeSessionAction(actionId, session, options) {
  const { slug, reRender } = options;
  if (!session) return false;

  const artifacts = Array.isArray(session.artifacts) ? session.artifacts : [];
  const primaryArtifact = artifacts[0]?.path || artifacts[0]?.relPath || session.relPath || "";
  const chatFile = primaryArtifact ? primaryArtifact.split(/[/\\]/).pop() : "";

  // RF3 & RF10: Abrir conversa
  if (actionId === "open_chat") {
    if (chatFile) {
      await resumeExistingChat(chatFile, false);
      emitSessionActionEvent(slug, "session.opened", { sessionId: session.id, chatFile, provider: session.primaryProvider });
      return true;
    }
  }

  // RF4 & RF10: Retomar sessão nativa
  if (actionId === "resume_session") {
    const provider = session.primaryProvider || "claude";
    switchEngine(provider);
    if (chatFile) {
      await resumeExistingChat(chatFile, false);
    } else {
      openInteractiveChat();
    }
    emitSessionActionEvent(slug, "session.resumed", {
      sessionId: session.id,
      nativeSessionId: session.nativeSessionId || session.sessionId,
      provider,
      mode: "native",
    });
    return true;
  }

  // RF5: Continuar com contexto (replay)
  if (actionId === "continue_context") {
    const provider = session.primaryProvider || "gemini";
    switchEngine(provider);
    if (chatFile) {
      await resumeExistingChat(chatFile, false);
    } else {
      openInteractiveChat();
    }
    emitSessionActionEvent(slug, "session.resumed", {
      sessionId: session.id,
      provider,
      mode: "context_replay",
    });
    return true;
  }

  // RF6: Nova conversa relacionada
  if (actionId === "new_chat") {
    const provider = session.primaryProvider || "claude";
    switchEngine(provider);
    state.chatTurns = [];
    cs.currentChatFile = "";
    cs.currentChatTitle = `Relacionada: ${session.title || session.id}`;
    openInteractiveChat();
    emitSessionActionEvent(slug, "session.related_created", {
      parentSessionId: session.id,
      provider,
    });
    return true;
  }

  // RF12: Cancelar execução
  if (actionId === "cancel_execution") {
    if (confirm(`Deseja cancelar a execução da sessão "${session.title || session.id}"?`)) {
      emitSessionActionEvent(slug, "execution.cancelled", {
        sessionId: session.id,
        provider: session.primaryProvider,
        reason: "Cancelado pelo usuário via Central de Sessões",
      });
      if (reRender) reRender();
      return true;
    }
  }

  return false;
}
