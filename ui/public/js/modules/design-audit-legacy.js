// @ts-check
// Auditoria de legado e plano de ação.
import { esc } from "../shared/dom.js";

/**
 * Renderiza a auditoria de paridade com o legado.
 * @param {any} legacyAudit
 */
export function renderLegacyAudit(legacyAudit = {}) {
  const counts = legacyAudit.counts || {};
  const items = legacyAudit.items || [];

  if (items.length === 0) {
    return `
      <div class="audit-panel-box">
        <div style="padding:24px;text-align:center;color:var(--mute)">
          Este projeto não possui matriz formal de paridade com sistema legado em doc/legado/.
        </div>
      </div>
    `;
  }

  const badgeForParity = (par, pm) => {
    let tag = "";
    if (pm) tag += `<span class="audit-tag tag-pm">⚠️ SEM DECISÃO PM</span> `;
    switch (par) {
      case "igual":
        tag += `<span class="audit-tag tag-ok">= IGUAL AO LEGADO</span>`;
        break;
      case "dif":
        tag += `<span class="audit-tag tag-dif">≠ DIFERENTE DE PROPÓSITO</span>`;
        break;
      case "falta":
        tag += `<span class="audit-tag tag-falta">✕ FALTA NO NOVO</span>`;
        break;
      case "fora":
        tag += `<span class="audit-tag tag-fora">– FORA DE ESCOPO</span>`;
        break;
      default:
        tag += `<span class="audit-tag tag-none">${esc(par)}</span>`;
    }
    return tag;
  };

  const cardsHtml = items.map((it) => `
    <div class="audit-legacy-card ${it.pm ? 'has-pm-warning' : ''}">
      <div class="legacy-card-head">
        <div>
          <span style="font-size:11px;color:#a5b4fc">${esc(it.telaNome)}</span>
          <h4 style="margin:2px 0 0;font-size:14px;color:var(--text)">${esc(it.title)}</h4>
        </div>
        <div>${badgeForParity(it.par, it.pm)}</div>
      </div>

      <div class="legacy-comparison-grid">
        <div class="legacy-col">
          <span class="legacy-col-label">Sistema Legado:</span>
          <div class="legacy-col-text">${esc(it.legado || 'Comportamento histórico registrado.')}</div>
        </div>
        <div class="legacy-col">
          <span class="legacy-col-label">Sistema Novo:</span>
          <div class="legacy-col-text">${esc(it.novo || 'Implementação projetada para a nova arquitetura.')}</div>
        </div>
      </div>

      <div class="legacy-why">
        <b>${it.par === 'igual' ? 'Observação:' : 'Por quê / Justificativa:'}</b> ${esc(it.porque || 'Sem justificativa detalhada.')}
      </div>
      ${it.fonte ? `<div style="font-size:11px;color:var(--mute);margin-top:6px">Fonte: <code>${esc(it.fonte)}</code></div>` : ''}
    </div>
  `).join("");

  return `
    <div class="audit-panel-box">
      <div class="audit-panel-header">
        <div>
          <h3 style="margin:0;font-size:15px;color:var(--text)">Paridade com o Sistema Legado (${items.length} regras comparadas)</h3>
          <div style="font-size:11.5px;color:var(--mute);margin-top:2px">
            O que o legado fazia, o que o novo faz hoje e, quando é diferente, a justificativa e o status de homologação com o PM.
          </div>
        </div>
        <div style="display:flex;gap:6px;font-size:11.5px">
          <span class="audit-tag tag-ok">${counts.igual || 0} iguais</span>
          <span class="audit-tag tag-dif">${counts.dif || 0} diferentes</span>
          <span class="audit-tag tag-falta">${counts.falta || 0} faltam</span>
          <span class="audit-tag tag-pm">${counts.semDecisaoPm || 0} sem decisão PM</span>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px;max-height:480px;overflow-y:auto;padding-right:4px">
        ${cardsHtml}
      </div>
    </div>
  `;
}

/**
 * Renderiza o plano de ação priorizado.
 * @param {any[]} actions
 */
export function renderActionPlan(actions = []) {
  if (actions.length === 0) {
    return `
      <div class="audit-panel-box">
        <div style="padding:24px;text-align:center;color:#22c55e">
          ✨ Nenhum gap crítico identificado! Todos os itens auditados estão em conformidade.
        </div>
      </div>
    `;
  }

  const itemsHtml = actions.map((act) => `
    <div class="audit-action-item priority-${act.priority.toLowerCase()}">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px">
        <div style="display:flex;gap:10px">
          <span style="font-size:22px">${esc(act.icon || '🚀')}</span>
          <div>
            <div style="display:flex;align-items:center;gap:6px">
              <span class="priority-badge ${act.priority.toLowerCase()}">${esc(act.priority)}</span>
              <span style="font-size:11px;color:var(--mute);text-transform:uppercase">${esc(act.category)}</span>
              <span style="font-size:11px;color:#a5b4fc">· Atribuído a: <b>${esc(act.agentName || act.agent)}</b></span>
            </div>
            <h4 style="margin:4px 0 2px;font-size:14px;color:var(--text)">${esc(act.title)}</h4>
            <div style="font-size:12px;color:var(--mute)">${esc(act.description)}</div>
            <div style="font-size:11.5px;color:var(--text);margin-top:4px"><b>Ação recomendada:</b> ${esc(act.action)}</div>
          </div>
        </div>
        <button type="button" class="btn-card-action" onclick='sendActionPlanToChat(${JSON.stringify(act)})' title="Enviar esta tarefa para o Agente executar no Chat">
          💬 Executar com Agente
        </button>
      </div>
    </div>
  `).join("");

  return `
    <div class="audit-panel-box">
      <div class="audit-panel-header">
        <div>
          <h3 style="margin:0;font-size:15px;color:var(--text)">Plano de Ação e Gaps Priorizados (${actions.length} tarefas)</h3>
          <div style="font-size:11.5px;color:var(--mute);margin-top:2px">Recomendações técnicas geradas pela auditoria para resolução rápida pelos Agentes DAI.</div>
        </div>
        <button type="button" class="btn-card-action" onclick="copyFullActionPlan()" title="Copiar plano completo de auditoria para o clipboard">
          📋 Copiar Plano Completo
        </button>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${itemsHtml}
      </div>
    </div>
  `;
}
