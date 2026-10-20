// @ts-check
import { esc, copyToClipboard, showToast, autoGrow, $ } from "../shared/dom.js";
import { state } from "../shared/state.js";

const STAGE_COLUMNS = [
  { id: "prototype", title: "Protótipo" },
  { id: "extracted", title: "Extraído" },
  { id: "design_system", title: "No design system" },
  { id: "boilerplate", title: "Boilerplate" },
  { id: "implemented", title: "Implementado" },
  { id: "documented", title: "Documentado" },
];

/**
 * Formata o bloco de contexto para envio ao chat de acordo com a metodologia de design.
 * @param {any} comp
 */
export function formatDesignContext(comp) {
  const files = comp.files || {};
  const fileLines = [];
  if (files.ds) fileLines.push(`- ds: ${files.ds}`);
  if (files.target) fileLines.push(`- target: ${files.target}`);
  if (comp.dsFolder) fileLines.push(`- pasta_ds: ${comp.dsFolder}`);

  return `<contexto-design>
componente: ${comp.name || "Componente"} (${comp.selector || "sem-seletor"})
funcionalidade: ${comp.feature || "design-system"}
etapa_atual: ${comp.stageLabel || comp.stage}
proxima_etapa: ${comp.dai?.nextStageLabel || "Concluído"}
agente_sugerido: ${comp.dai?.agentId || "frontend-engineer"}
acao_sugerida: ${comp.dai?.nextAction || "Implementar componente conforme metodologia"}
arquivos:
${fileLines.join("\n") || "- (nenhum arquivo específico vinculado)"}
</contexto-design>`;
}

/**
 * Copia o bloco delimitado <contexto-design> para o clipboard.
 * @param {any} comp
 */
export function copyDesignContext(comp) {
  const txt = formatDesignContext(comp);
  copyToClipboard(txt, `Contexto de ${comp.name} copiado!`);
}

/**
 * Insere o bloco <contexto-design> no chat ativo e alterna para ele.
 * @param {any} comp
 */
export function sendDesignContextToChat(comp) {
  const txt = formatDesignContext(comp);
  const inp = /** @type {HTMLTextAreaElement} */ ($("chatInput") || $("studioChatInput"));
  if (inp) {
    const existing = inp.value.trim();
    inp.value = existing ? `${txt}\n\n${existing}` : `${txt}\n\n`;
    autoGrow(inp);
    inp.focus();
    inp.selectionStart = inp.selectionEnd = inp.value.length;
    showToast(`Contexto de ${comp.name} enviado ao chat!`);
  }
}

/**
 * Renderiza um item individual do checklist, destacando marcas inferidas.
 * @param {string} label
 * @param {any} meta
 */
function renderCheckItem(label, meta = {}) {
  const isChecked = Boolean(meta.checked);
  const isInferred = Boolean(meta.inferred);
  const title = isInferred && meta.inferredFrom
    ? `Inferido de: ${meta.inferredFrom}`
    : (isChecked ? "Verificado" : "Pendente");
  const cls = `chk-item ${isChecked ? 'checked' : ''} ${isInferred ? 'inferred' : ''}`;
  const icon = isChecked ? (isInferred ? '✓*' : '✓') : '○';

  return `<span class="${cls}" title="${esc(title)}">${icon} ${esc(label)}</span>`;
}

/**
 * Renderiza um cartão individual de componente no Kanban.
 * @param {any} comp
 * @param {boolean} [isDraft]
 */
function renderDesignCard(comp, isDraft = false) {
  const chk = comp.checklist || {};
  const dai = comp.dai || {};

  return `
    <div class="design-card ${isDraft ? 'draft' : ''}" id="card_${esc(comp.id)}">
      <div class="design-card-head">
        <div>
          <div class="design-card-title">${esc(comp.name)} ${isDraft ? '<span style="font-size:10px;background:#eab308;color:#000;padding:1px 5px;border-radius:3px;font-weight:bold">RASCUNHO</span>' : ''}</div>
          <div class="design-card-selector">&lt;${esc(comp.selector || comp.id)}&gt;</div>
        </div>
        ${comp.isOverridden ? '<span title="Etapa definida manualmente" style="font-size:10px;color:var(--mute)">✏️ manual</span>' : ''}
      </div>

      <div class="design-card-dai" title="Próximo passo: ${esc(dai.nextAction || '')}">
        <span>${esc(dai.icon || '🤖')}</span>
        <span><b>${esc(dai.agentId || 'agente')}:</b> ${esc(dai.nextAction || '').slice(0, 52)}...</span>
      </div>

      ${comp.alreadyExists ? `
        <div style="font-size:10.5px;color:#38bdf8;background:rgba(56,189,248,0.1);border:1px solid rgba(56,189,248,0.25);border-radius:4px;padding:3px 6px;margin-bottom:4px" title="${esc(comp.existingPath || '')}">
          ⚡ Já existe no app: <code style="font-size:10px">${esc(comp.existingPath ? comp.existingPath.split('/').pop() : '')}</code>
        </div>
      ` : ''}

      <!-- Checklist das 6 marcas com suporte a inferencias -->
      <div class="design-checklist" title="Progresso da metodologia">
        ${renderCheckItem("Protótipo", chk.meta?.inPrototype || { checked: chk.inPrototype })}
        ${renderCheckItem("Extraído", chk.meta?.isExtracted || { checked: chk.isExtracted })}
        ${renderCheckItem("No DS", chk.meta?.inDesignSystem || { checked: chk.inDesignSystem })}
        ${renderCheckItem("Boilerplate", chk.meta?.hasBoilerplate || { checked: chk.hasBoilerplate })}
        ${renderCheckItem("No App", chk.meta?.isImplemented || { checked: chk.isImplemented })}
        ${renderCheckItem("Documentado", chk.meta?.isDocumented || { checked: chk.isDocumented })}
      </div>
      ${chk.hasBoilerplate && !chk.isImplemented ? '<div style="font-size:10.5px;color:var(--mute);margin-top:-2px">ℹ️ Ainda não aplicado ao app</div>' : ''}

      <div class="design-card-actions">
        <button type="button" class="btn-card-action" onclick='copyDesignCardContext(${JSON.stringify(comp)})' title="Copiar bloco <contexto-design>">📋 Copiar</button>
        <button type="button" class="btn-card-action" onclick='sendDesignCardContext(${JSON.stringify(comp)})' title="Inserir no chat ativo">💬 No Chat</button>
      </div>
    </div>
  `;
}

/**
 * Renderiza o quadro Kanban completo.
 * @param {HTMLElement} container
 * @param {any[]} components
 * @param {any} [draftComponent]
 */
export function renderKanbanBoard(container, components = [], draftComponent = null) {
  const cardsByCol = {};
  for (const col of STAGE_COLUMNS) {
    cardsByCol[col.id] = [];
  }

  // Se houver rascunho em memória, insere na etapa deduzida ou em 'extracted'
  if (draftComponent) {
    const draftStage = draftComponent.stage || "extracted";
    if (cardsByCol[draftStage]) {
      cardsByCol[draftStage].push(renderDesignCard(draftComponent, true));
    }
  }

  for (const comp of components) {
    const stage = comp.stage || "prototype";
    if (cardsByCol[stage]) {
      cardsByCol[stage].push(renderDesignCard(comp, false));
    } else {
      cardsByCol.prototype.push(renderDesignCard(comp, false));
    }
  }

  const columnsHtml = STAGE_COLUMNS.map((col) => {
    const cards = cardsByCol[col.id] || [];
    return `
      <div class="kanban-col" data-col="${esc(col.id)}">
        <div class="kanban-col-header">
          <span>${esc(col.title)}</span>
          <span class="kanban-col-count">${cards.length}</span>
        </div>
        <div class="kanban-cards-list">
          ${cards.length > 0 ? cards.join("") : '<div style="font-size:11px;color:var(--mute);text-align:center;padding:16px 0">Nenhum componente nesta etapa</div>'}
        </div>
      </div>
    `;
  }).join("");

  container.innerHTML = `<div class="design-kanban-board">${columnsHtml}</div>`;
}

// Binds globais para eventos de clique inline dos botões dos cartões
if (typeof window !== "undefined") {
  // @ts-ignore
  window.copyDesignCardContext = copyDesignContext;
  // @ts-ignore
  window.sendDesignCardContext = sendDesignContextToChat;
}
