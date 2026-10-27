// @ts-check
// Decisor de ações por sessão da Central (EP-09.04).
// Decide quais ações estão disponíveis para o usuário a partir das capacidades resolvidas.
// Módulo puro: sem DOM, sem rede, totalmente determinístico.

import { resolveSessionCapabilities } from "./session-capability-resolver.js";

/**
 * @typedef {Object} SessionAction
 * @property {string} id - Identificador da ação (open_chat, resume_session, continue_context, new_chat, cancel_execution)
 * @property {string} label - Rótulo em português
 * @property {string} icon - Ícone FontAwesome (fa-solid fa-*)
 * @property {string} tone - primary | secondary | danger | muted
 * @property {string} tooltip - Explicação acessível
 * @property {string} [command] - Tipo de comando associado
 */

/**
 * Determina as ações disponíveis para uma sessão.
 * @param {object} session
 * @param {object} [options]
 * @param {object} [options.capabilities] Capacidades pré-calculadas (opcional)
 * @returns {SessionAction[]}
 */
export function determineSessionActions(session, options = {}) {
  if (!session) return [];

  const cap = options.capabilities || resolveSessionCapabilities(session, options);
  /** @type {SessionAction[]} */
  const actions = [];

  // RF3: "Abrir conversa" só aparece quando existe artefato legível (Markdown) vinculado
  if (cap.hasArtifact) {
    actions.push({
      id: "open_chat",
      label: "Abrir conversa",
      icon: "fa-book-open",
      tone: "primary",
      tooltip: "Visualizar histórico Markdown da conversa",
      command: "open_chat",
    });
  }

  // RF4: "Retomar sessão" só aparece com resumeMode = native e identificador válido
  if (cap.resumeMode === "native" && cap.canResume) {
    actions.push({
      id: "resume_session",
      label: "Retomar sessão",
      icon: "fa-play",
      tone: "secondary",
      tooltip: `Retomar sessão ativa no motor ${cap.provider} (${session.nativeSessionId || session.sessionId})`,
      command: "resume_session",
    });
  }

  // RF5: "Continuar com contexto" usa resumeMode = context_replay
  if (cap.resumeMode === "context_replay" && cap.canReplay) {
    actions.push({
      id: "continue_context",
      label: "Continuar com contexto",
      icon: "fa-arrow-rotate-right",
      tone: "secondary",
      tooltip: "Iniciar nova conversa carregando histórico como contexto",
      command: "continue_context",
    });
  }

  // RF6: "Nova conversa relacionada" se não for possível retomar ou como alternativa
  actions.push({
    id: "new_chat",
    label: "Nova conversa relacionada",
    icon: "fa-plus",
    tone: "muted",
    tooltip: `Criar nova conversa vinculada a esta sessão (${session.id})`,
    command: "new_chat",
  });

  // RF12: "Cancelar execução" só é oferecido quando a execução pertence ao Harness e a capacidade atual permite
  if (cap.canCancel) {
    actions.push({
      id: "cancel_execution",
      label: "Cancelar execução",
      icon: "fa-stop",
      tone: "danger",
      tooltip: "Interromper execução ativa gerenciada pelo Harness",
      command: "cancel_execution",
    });
  }

  return actions;
}

/**
 * Renderiza os botões de ação em HTML para uso no painel de detalhes ou card.
 * @param {SessionAction[]} actions
 * @param {string} sessionId
 * @returns {string}
 */
export function renderActionButtons(actions, sessionId) {
  if (!actions || !actions.length) return "";
  return `
    <div class="central-actions" role="toolbar" aria-label="Ações da sessão">
      ${actions
        .map(
          (act) => `
        <button type="button" class="central-action-btn central-action-btn--${act.tone}"
          data-session-action="${act.id}"
          data-session-id="${sessionId}"
          title="${act.tooltip}">
          <i class="fa-solid ${act.icon}" aria-hidden="true"></i> ${act.label}
        </button>`
        )
        .join("")}
    </div>`;
}
