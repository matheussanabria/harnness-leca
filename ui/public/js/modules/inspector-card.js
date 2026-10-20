// @ts-check
// Cartão do inspetor: renderização, contexto e ações (copiar, chat, arquivo).
import { esc, showToast, copyToClipboard, autoGrow, openDlg } from "../shared/dom.js";
import { state } from "../shared/state.js";
import { renderEditSection } from "./inspector-edit-panel.js";
import { ist } from "./inspector-store.js";
import { normalizeComponentName } from "./inspector-dom.js";
import { cleanupParentHighlights } from "./inspector-mode.js";
import { detachIframeListeners } from "./inspector-iframe.js";

/**
 * Extrai o caminho relativo como string de um descritor de arquivo.
 * @param {any} file
 * @returns {string | null}
 */
export function extractFilePath(file) {
  if (!file) return null;
  if (typeof file === "string") return file;
  if (typeof file === "object" && typeof file.path === "string") return file.path;
  return null;
}

/**
 * Renderiza o Card de Detalhes da Inspeção no Studio.
 * @param {any} data
 */
export function renderInspectorCard(data) {
  let panel = $("inspectorResultCard");
  if (!panel) {
    panel = document.createElement("div");
    panel.id = "inspectorResultCard";
    panel.className = "inspector-card";
    const container = $("studioViewportContainer") || $("studioFrameWrapper") || document.body;
    container.appendChild(panel);
  }

  const files = data.files || {};
  const tsPath = extractFilePath(files.ts);
  const htmlPath = extractFilePath(files.html);
  const stylesList = Array.isArray(files.styles)
    ? files.styles.map(extractFilePath).filter(Boolean)
    : (files.style ? [extractFilePath(files.style)].filter(Boolean) : []);
  const hasFiles = Boolean(tsPath || htmlPath || stylesList.length);

  panel.innerHTML = `
    <div class="inspector-card-header">
      <div class="inspector-card-title">
        <span>🔍 Componente Inspecionado</span>
        <span class="inspector-badge angular">Angular 18</span>
        ${data.standalone ? '<span class="inspector-badge standalone">Standalone</span>' : ''}
      </div>
      <div style="display:flex;gap:6px;align-items:center">
        <button type="button" class="btn-vp" onclick="openQuickInspectorPanel()" style="font-size:11px;padding:3px 10px;cursor:pointer" title="Voltar para a seleção e lista de componentes">← Voltar</button>
        <button type="button" class="btn-vp" onclick="closeInspectorPanel()" style="font-size:11px;padding:3px 10px;background:rgba(239,68,68,0.2);color:#ef4444;border-color:rgba(239,68,68,0.3);font-weight:bold;cursor:pointer" title="Desativar Inspetor">✕ Desativar (ESC)</button>
      </div>
    </div>
    <div class="inspector-card-body">
      ${data.childComponent ? `
        <div style="background:rgba(59,130,246,0.12);border:1px solid rgba(59,130,246,0.3);border-radius:4px;padding:6px 10px;font-size:11px;color:#38bdf8;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center">
          <span>ℹ️ O elemento clicado é o host do componente filho <b>&lt;${esc(data.childComponent)}&gt;</b>.</span>
          <button type="button" class="inspector-chip-btn" onclick="inspectComponentByName('${esc(data.childComponent)}')" style="margin-left:8px;font-size:10.5px">Inspecionar filho</button>
        </div>
      ` : ''}

      ${data.notFound ? `
        <div style="background:rgba(234,179,8,0.12);border:1px solid rgba(234,179,8,0.3);border-radius:4px;padding:8px 10px;font-size:12px;color:#eab308;margin-bottom:8px">
          ⚠️ <b>Arquivo deste componente não localizado:</b> ${esc(data.notFoundReason || 'Componente não encontrado no repositório.')}
        </div>
      ` : ''}

      <div class="inspector-meta-row">
        <span class="inspector-comp-name">${esc(data.component || data.elementTag)}</span>
        ${data.selector ? `<span class="inspector-badge selector">&lt;${esc(data.selector)}&gt;</span>` : ''}
      </div>

      <div class="inspector-files-list">
        ${tsPath ? `
          <div class="inspector-file-item">
            <span class="inspector-file-label ts">TS</span>
            <span class="inspector-file-path" title="${esc(tsPath)}">${esc(tsPath)}</span>
            <div class="inspector-file-actions">
              <button type="button" class="inspector-file-btn" onclick="copyToClipboard('${esc(tsPath)}', 'Caminho TS copiado!')" title="Copiar caminho">📋</button>
              <button type="button" class="inspector-file-btn" onclick="viewInspectorFile('${esc(tsPath)}', 'TypeScript')" title="Visualizar código">👁️</button>
            </div>
          </div>
        ` : ''}

        ${htmlPath ? `
          <div class="inspector-file-item">
            <span class="inspector-file-label html">HTML</span>
            <span class="inspector-file-path" title="${esc(htmlPath)}">${esc(htmlPath)}</span>
            <div class="inspector-file-actions">
              <button type="button" class="inspector-file-btn" onclick="copyToClipboard('${esc(htmlPath)}', 'Caminho HTML copiado!')" title="Copiar caminho">📋</button>
              <button type="button" class="inspector-file-btn" onclick="viewInspectorFile('${esc(htmlPath)}', 'Template HTML')" title="Visualizar código">👁️</button>
            </div>
          </div>
        ` : data.templateType === 'inline' ? `
          <div class="inspector-file-item" style="color:var(--mute);font-size:11px">
            <span class="inspector-file-label html">HTML</span>
            <span>Template inline definido no arquivo .ts</span>
          </div>
        ` : ''}

        ${stylesList.map((stPath) => `
          <div class="inspector-file-item">
            <span class="inspector-file-label style">CSS</span>
            <span class="inspector-file-path" title="${esc(stPath)}">${esc(stPath)}</span>
            <div class="inspector-file-actions">
              <button type="button" class="inspector-file-btn" onclick="copyToClipboard('${esc(stPath)}', 'Caminho Style copiado!')" title="Copiar caminho">📋</button>
              <button type="button" class="inspector-file-btn" onclick="viewInspectorFile('${esc(stPath)}', 'Estilos')" title="Visualizar código">👁️</button>
            </div>
          </div>
        `).join('')}

        ${!hasFiles && !data.notFound ? '<div style="font-size:12px;color:var(--mute)">Nenhum arquivo de código associado foi localizado no repositório.</div>' : ''}
      </div>

      <div class="inspector-elem-preview" title="Hierarquia: ${esc(data.domPath)}">
        <div style="font-size:10px;color:var(--mute);margin-bottom:3px">Elemento no DOM:</div>
        <div>${esc(data.outerSnippet)}</div>
      </div>

      <div id="inspectorEditContainer"></div>
    </div>
    <div class="inspector-card-actions">
      <button type="button" class="inspector-btn-copy" onclick="markInspectedAsComponent()" title="Marcar como componente e abrir aba Design com rascunho em memória" style="background:rgba(99,102,241,0.2);color:#a5b4fc;border-color:rgba(99,102,241,0.3);margin-right:auto">📐 Marcar como componente</button>
      <button type="button" class="inspector-btn-copy" onclick="copyInspectorContext()" title="Copiar bloco de contexto para área de transferência">📋 Copiar Contexto</button>
      <button type="button" class="inspector-btn-send" onclick="sendInspectorContextToChat()">💬 Inserir no Chat</button>
    </div>
  `;

  panel.style.display = "flex";

  const editBox = $("inspectorEditContainer");
  if (editBox) {
    renderEditSection(editBox, data);
  }
}

/**
 * Fecha o painel de resultado da inspeção e desativa o modo.
 */
export function closeInspectorPanel() {
  ist.isInspectorActive = false;
  cleanupParentHighlights();
  const btn = $("btnInspectorToggle");
  if (btn) btn.classList.remove("active");
  const banner = $("inspectorActiveBanner");
  if (banner) banner.style.display = "none";
  const panel = $("inspectorResultCard");
  if (panel) panel.style.display = "none";
  detachIframeListeners();

  try {
    const frame = /** @type {HTMLIFrameElement} */ ($("studioIframe"));
    if (frame && frame.contentWindow) {
      frame.contentWindow.postMessage({ type: "HARNESS_DEACTIVATE_INSPECTOR" }, "*");
    }
  } catch {}
}

/**
 * Formata o bloco de contexto no padrão exato solicitado para os motores LLM.
 * @param {any} data
 * @returns {string}
 */
export function formatInspectorContext(data) {
  if (!data) return "";
  const files = data.files || {};
  const tsPath = extractFilePath(files.ts);
  const htmlPath = extractFilePath(files.html);
  const stylesList = Array.isArray(files.styles)
    ? files.styles.map(extractFilePath).filter(Boolean)
    : (files.style ? [extractFilePath(files.style)].filter(Boolean) : []);

  const fileLines = [];
  if (tsPath) fileLines.push(`- ts: ${tsPath}`);
  if (htmlPath) fileLines.push(`- html: ${htmlPath}`);
  else if (data.templateType === "inline") fileLines.push(`- html: (inline no arquivo .ts)`);
  for (const st of stylesList) {
    fileLines.push(`- style: ${st}`);
  }

  return `<contexto-inspetor>
componente: ${data.component || "Desconhecido"} (${data.selector || "sem seletor"})
arquivos:
${fileLines.join("\n") || "- (nenhum arquivo localizado)"}
elemento: ${data.outerSnippet || "<elemento>"}
caminho: ${data.domPath || "DOM"}
</contexto-inspetor>`;
}

/**
 * Copia o bloco de contexto do componente para o clipboard.
 */
export function copyInspectorContext() {
  if (!ist.currentInspectedData) return;
  const ctx = formatInspectorContext(ist.currentInspectedData);
  copyToClipboard(ctx, "Contexto do componente copiado!");
}

/**
 * Injeta o bloco de contexto do componente diretamente no textarea do chat ativo.
 */
export function sendInspectorContextToChat() {
  if (!ist.currentInspectedData) return;
  const ctx = formatInspectorContext(ist.currentInspectedData);

  const inp = /** @type {HTMLTextAreaElement} */ ($("studioChatInput") || $("chatInput"));
  if (inp) {
    const existing = inp.value.trim();
    inp.value = existing ? `${ctx}\n\n${existing}` : `${ctx}\n\n`;
    autoGrow(inp);
    inp.focus();
    inp.selectionStart = inp.selectionEnd = inp.value.length;
    showToast("Contexto do componente inserido no chat!");
    closeInspectorPanel();
  }
}

/**
 * Marca o elemento inspecionado como componente e abre a aba Design com um rascunho em memória.
 */
export function markInspectedAsComponent() {
  if (!ist.currentInspectedData) return;
  const draftData = { ...currentInspectedData };
  if (draftData.component) {
    draftData.component = normalizeComponentName(draftData.component);
  }
  if (draftData.selector && ["div", "span", "p", "button", "section", "article"].includes(draftData.selector.toLowerCase())) {
    draftData.selector = null;
  }
  closeInspectorPanel();
  // @ts-ignore
  if (typeof window.openDesignWithDraft === "function") {
    // @ts-ignore
    window.openDesignWithDraft(draftData);
  }
}

/**
 * Visualiza o conteúdo de um arquivo do componente em modal dialog central.
 * @param {string} relPath
 * @param {string} label
 */
export async function viewInspectorFile(relPath, label) {
  const projectSlug = ist.currentInspectedData?.projectSlug || state.P?.name || state.S?.active;
  try {
    const res = await fetch(`/api/project/${encodeURIComponent(projectSlug)}/inspect/file?path=${encodeURIComponent(relPath)}`);
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || "Erro ao ler arquivo.");
      return;
    }

    const htmlContent = `
      <div style="margin-bottom:8px;font-family:monospace;font-size:12px;color:var(--mute)">${esc(data.path)} (${data.size} bytes)</div>
      <pre class="inspector-code-view"><code>${esc(data.content)}</code></pre>
    `;

    openDlg(`Código: ${label}`, "", htmlContent);
  } catch (err) {
    console.error("[viewInspectorFile]", err);
    showToast("Erro ao carregar conteúdo do arquivo.");
  }
}
