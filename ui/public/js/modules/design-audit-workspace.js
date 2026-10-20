// @ts-check
// Workspace da auditoria e handlers globais.
import { copyToClipboard, showToast, autoGrow } from "../shared/dom.js";
import { das } from "./design-audit-store.js";
import { renderScorecards, renderRulesMatrix } from "./design-audit-matrix.js";
import { renderLegacyAudit, renderActionPlan } from "./design-audit-legacy.js";

/**
 * Renderiza o painel completo de auditoria.
 * @param {HTMLElement} container
 * @param {string} projectSlug
 * @param {any} auditData
 */
export function renderAuditWorkspace(container, projectSlug, auditData) {
  if (!auditData) {
    container.innerHTML = '<div style="padding:32px;text-align:center;color:var(--mute)">Carregando auditoria do projeto...</div>';
    return;
  }

  das.currentAuditData = auditData;

  container.innerHTML = `
    <div class="audit-workspace-layout">
      ${renderScorecards(auditData.scorecards)}
      ${renderActionPlan(auditData.actionPlan || [])}
      ${renderRulesMatrix(auditData.rulesMatrix || [])}
      ${renderLegacyAudit(auditData.legacyAudit || {})}
    </div>
  `;
}

// Binds globais
if (typeof window !== "undefined") {
  // @ts-ignore
  window.onAuditSearchInput = (val) => {
    das.auditSearchQuery = val;
    const container = $("designViewContainer");
    if (container && das.currentAuditData) {
      renderAuditWorkspace(container, "", das.currentAuditData);
    }
  };

  // @ts-ignore
  window.setAuditRulesFilter = (mode) => {
    das.auditFilterMode = mode;
    const container = $("designViewContainer");
    if (container && das.currentAuditData) {
      renderAuditWorkspace(container, "", das.currentAuditData);
    }
  };

  // @ts-ignore
  window.copyRuleTestPrompt = (ruleTitle, screenTitle) => {
    const prompt = `Por favor, atue como Engenheiro de QA e crie um cenário de teste para a regra de negócio a seguir:\n- Tela/Módulo: ${screenTitle}\n- Regra: ${ruleTitle}\nEscreva o cenário em formato BDD (Given/When/Then) e indique o teste unitário/integração correspondente.`;
    copyToClipboard(prompt, "Prompt de teste copiado!");
  };

  // @ts-ignore
  window.sendActionPlanToChat = (act) => {
    const txt = `<tarefa-auditoria>\nprioridade: ${act.priority}\ncategoria: ${act.category}\nagente: ${act.agent}\ntitulo: ${act.title}\ndescricao: ${act.description}\nacao_recomendada: ${act.action}\n</tarefa-auditoria>\n\nPor favor, execute a tarefa de auditoria descrita acima para este projeto.`;
    const inp = /** @type {HTMLTextAreaElement} */ ($("chatInput") || $("studioChatInput"));
    if (inp) {
      const existing = inp.value.trim();
      inp.value = existing ? `${txt}\n\n${existing}` : `${txt}\n\n`;
      autoGrow(inp);
      inp.focus();
      showToast(`Tarefa "${act.title}" inserida no chat!`);
    }
  };

  // @ts-ignore
  window.copyFullActionPlan = () => {
    if (!das.currentAuditData?.actionPlan) return;
    const lines = das.currentAuditData.actionPlan.map((a, i) => `${i + 1}. [${a.priority}] ${a.title} (${a.agentName}): ${a.action}`);
    const fullTxt = `## Plano de Ação - Auditoria do Projeto\n\n${lines.join("\n\n")}`;
    copyToClipboard(fullTxt, "Plano completo de auditoria copiado!");
  };
}
