// @ts-check
// Painel de detalhe da Central de Sessões (EP-09.03). Função pura de renderização.

import { describeSession, formatTimestamp } from "./central-sessions-model.js";
import { esc, statusBadge } from "./central-sessions-format.js";
import { presenceBadges, originBadge, lastActivityText } from "./central-sessions-presence.js";
import { determineSessionActions, renderActionButtons } from "./central-session-actions.js";

/**
 * Painel de detalhe da sessão.
 * @param {{ session: object, detail: object | null }} params
 * @returns {string}
 */
export function renderCentralDetail(params) {
  const { session, detail } = params;
  if (!session) {
    return `<aside class="central-detail central-detail--empty"><i class="fa-solid fa-hand-pointer"></i> Selecione uma sessão para ver o detalhe.</aside>`;
  }
  const status = describeSession(session);
  const artifacts = detail?.session?.artifacts || detail?.artifacts || session?.artifacts || [];
  const executions = detail?.session?.executions || detail?.executions || [];
  const events = detail?.session?.events || detail?.events || [];
  const actions = determineSessionActions({ ...session, artifacts });

  return `
    <aside class="central-detail" aria-label="Detalhe da sessão">
      <h4 class="central-detail__title">${esc(session.title)}</h4>
      ${renderActionButtons(actions, session.id)}
      <dl class="central-detail__grid">
        <dt>Motor</dt><dd>${esc(session.primaryProvider || "desconhecido")}</dd>
        <dt>Projeto</dt><dd>${esc(session.projectId || "sem projeto")} (${esc(status.confidence.label)})</dd>
        <dt>Workflow</dt><dd>${statusBadge(status.workflow)}</dd>
        <dt>Execução</dt><dd>${statusBadge(status.execution)}</dd>
        <dt>Atenção</dt><dd>${statusBadge(status.attention)}</dd>
        <dt>Atividade</dt><dd>${presenceBadges(session) || "sem sinal"}</dd>
        <dt>Origem</dt><dd>${originBadge(session) || "registro Markdown"}</dd>
        <dt>Última atividade</dt><dd>${esc(lastActivityText(session))}</dd>
      </dl>
      <h5 class="central-detail__subtitle"><i class="fa-solid fa-file-lines"></i> Artefatos (${artifacts.length})</h5>
      <ul class="central-detail__list">
        ${artifacts.length ? artifacts.map((item) => `<li>${esc(item.path || item.relPath || "artefato")}</li>`).join("") : "<li>Nenhum artefato vinculado.</li>"}
      </ul>
      <h5 class="central-detail__subtitle"><i class="fa-solid fa-play"></i> Execuções (${executions.length})</h5>
      <ul class="central-detail__list">
        ${executions.length ? executions.map((item) => `<li>${esc(item.id || "execução")} — ${esc(item.status || "unknown")}</li>`).join("") : "<li>Nenhuma execução registrada.</li>"}
      </ul>
      <h5 class="central-detail__subtitle"><i class="fa-solid fa-timeline"></i> Timeline (${events.length})</h5>
      <ul class="central-detail__list">
        ${events.length ? events.map((item) => `<li>${esc(item.type || "evento")} — ${esc(formatTimestamp(item.at))}</li>`).join("") : "<li>Sem eventos publicados.</li>"}
      </ul>
    </aside>`;
}
