// @ts-check
import { $, esc, showToast } from "../shared/dom.js";
import { renderDiffHtml, showUndoBanner } from "./inspector-diff.js";
import { loadDsClasses, filterDsClasses } from "./inspector-ds-classes.js";
import { sendInspectorContextToChat } from "./inspector.js";

/**
 * Painel de Edição Direta de Elementos Inspecionados.
 */

let activeTab = "text"; // "text" | "class"
let currentPreviewData = null;

/**
 * Renderiza o painel de edição direta abaixo dos detalhes do componente.
 * @param {HTMLElement} container
 * @param {object} inspectedData
 */
export async function renderEditSection(container, inspectedData) {
  const files = inspectedData.files || {};
  const htmlRelPath = typeof files.html === "string" ? files.html : files.html?.path || null;

  if (!htmlRelPath) {
    // Template inline ou sem arquivo HTML
    container.innerHTML = `
      <div class="inspector-edit-section">
        <div style="font-size:12px;color:var(--mute)">
          💡 Este componente utiliza template inline (.ts) ou não possui arquivo .html externo.
          Para alterá-lo com segurança, utilize o botão <b>Inserir no Chat</b>.
        </div>
      </div>
    `;
    return;
  }

  const slug = inspectedData.projectSlug;
  loadDsClasses(slug).catch(() => {});

  const initialText = (inspectedData.outerSnippet || "")
    .replace(/<[^>]*>/g, "")
    .trim();

  container.innerHTML = `
    <div class="inspector-edit-section" id="inspectorEditBox">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:12px;font-weight:600;color:var(--text)">✏️ Edição Mecânica Direta:</span>
        <div class="inspector-edit-tabs">
          <button type="button" class="inspector-edit-tab ${activeTab === "text" ? "active" : ""}" id="tabEditText">Texto</button>
          <button type="button" class="inspector-edit-tab ${activeTab === "class" ? "active" : ""}" id="tabEditClass">Classes</button>
        </div>
      </div>

      <div id="inspectorTabContent">
        ${renderTabContent(inspectedData, initialText)}
      </div>

      <div id="inspectorDiffArea" style="display:none"></div>
    </div>
  `;

  bindTabEvents(container, inspectedData, initialText);
}

function renderTabContent(inspectedData, initialText) {
  if (activeTab === "text") {
    return `
      <div class="inspector-edit-field">
        <label>Conteúdo do texto estático:</label>
        <input type="text" id="inpEditText" class="inspector-edit-input" value="${esc(initialText)}" placeholder="Novo texto para o template..." />
      </div>
      <div style="display:flex;justify-content:flex-end;margin-top:6px">
        <button type="button" class="inspector-file-btn" id="btnPreviewEdit" style="background:var(--accent);color:#fff;border-color:var(--accent)">
          🔍 Visualizar Diff
        </button>
      </div>
    `;
  }

  const dsClasses = filterDsClasses("", 8);
  const chipsHtml = dsClasses
    .map((c) => `<button type="button" class="inspector-chip-btn ds-chip" data-cls="${esc(c)}">${esc(c)}</button>`)
    .join("");

  return `
    <div class="inspector-edit-field">
      <label>Classes CSS do elemento:</label>
      <input type="text" id="inpEditClass" class="inspector-edit-input" placeholder="Ex: ds-badge--warning, btn--primary..." />
      <div style="font-size:10px;color:var(--mute);margin-top:4px">Sugestões do Design System:</div>
      <div class="inspector-chips-box" style="max-height:80px;margin-top:2px">${chipsHtml}</div>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px">
      <div style="display:flex;gap:6px">
        <label style="font-size:11px;color:var(--mute);display:flex;align-items:center;gap:4px">
          <input type="radio" name="classAction" value="add-class" checked /> Adicionar
        </label>
        <label style="font-size:11px;color:var(--mute);display:flex;align-items:center;gap:4px">
          <input type="radio" name="classAction" value="remove-class" /> Remover
        </label>
      </div>
      <button type="button" class="inspector-file-btn" id="btnPreviewEdit" style="background:var(--accent);color:#fff;border-color:var(--accent)">
        🔍 Visualizar Diff
      </button>
    </div>
  `;
}

function bindTabEvents(container, inspectedData, initialText) {
  const btnText = $("tabEditText");
  const btnClass = $("tabEditClass");

  if (btnText) {
    btnText.onclick = () => {
      activeTab = "text";
      renderEditSection(container, inspectedData);
    };
  }
  if (btnClass) {
    btnClass.onclick = () => {
      activeTab = "class";
      renderEditSection(container, inspectedData);
    };
  }

  // Chips de classe do DS
  container.querySelectorAll(".ds-chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      const cls = btn.getAttribute("data-cls");
      const inp = /** @type {HTMLInputElement} */ ($("inpEditClass"));
      if (inp && cls) {
        inp.value = inp.value ? `${inp.value.trim()} ${cls}` : cls;
      }
    });
  });

  const btnPreview = $("btnPreviewEdit");
  if (btnPreview) {
    btnPreview.onclick = () => handlePreview(inspectedData);
  }
}

async function handlePreview(inspectedData) {
  const diffArea = $("inspectorDiffArea");
  if (!diffArea) return;

  const slug = inspectedData.projectSlug;
  const files = inspectedData.files || {};
  const htmlRelPath = typeof files.html === "string" ? files.html : files.html?.path || null;
  if (!htmlRelPath) {
    showToast("Arquivo HTML do componente não encontrado.");
    return;
  }

  let change = null;
  if (activeTab === "text") {
    const inp = /** @type {HTMLInputElement} */ ($("inpEditText"));
    if (!inp || !inp.value.trim()) {
      showToast("Digite o novo texto.");
      return;
    }
    change = { type: "text", value: inp.value.trim() };
  } else {
    const inp = /** @type {HTMLInputElement} */ ($("inpEditClass"));
    if (!inp || !inp.value.trim()) {
      showToast("Selecione ou digite a classe.");
      return;
    }
    const radio = /** @type {HTMLInputElement} */ (document.querySelector("input[name='classAction']:checked"));
    const action = radio ? radio.value : "add-class";
    change = { type: "class", action, value: inp.value.trim() };
  }

  showToast("Calculando diff...");

  const targetPayload = {
    tag: inspectedData.target?.tagName || inspectedData.elementTag || "div",
    text: inspectedData.target?.text !== undefined ? inspectedData.target.text : (inspectedData.outerSnippet || "").replace(/<[^>]*>/g, "").trim(),
    attributes: inspectedData.target?.attributes || {},
    classes: inspectedData.target?.classes || [],
    siblingIndex: inspectedData.target?.siblingIndex,
    sameTagSiblingIndex: inspectedData.target?.sameTagSiblingIndex,
    domPath: inspectedData.domPath,
  };

  try {
    const res = await fetch(`/api/project/${encodeURIComponent(slug)}/inspect/edit/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file: htmlRelPath,
        componentName: inspectedData.component,
        target: targetPayload,
        change,
      }),
    });

    const data = await res.json();

    if (!res.ok || !data.ok) {
      diffArea.style.display = "block";
      diffArea.innerHTML = `
        <div style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);padding:8px 10px;border-radius:6px;font-size:11px;color:#ef4444;margin-top:6px">
          ⚠️ <b>Edição direta não permitida neste nó:</b> ${esc(data.message || data.error)}
          ${data.candidates && data.candidates.length ? `
            <div style="margin-top:6px;font-size:10.5px">
              <b>Candidatos encontrados no template:</b>
              <ul style="margin:4px 0 0 16px;padding:0">
                ${data.candidates.map((c) => `<li>Linha ${c.line}: <code>${esc(c.snippet)}</code></li>`).join("")}
              </ul>
            </div>
          ` : ''}
          <div style="margin-top:6px">
            <button type="button" class="inspector-btn-send" id="btnDelegateToChat" style="padding:3px 10px;font-size:11px">
              💬 Inserir no Chat para o Motor Editar
            </button>
          </div>
        </div>
      `;
      const btnDelegate = $("btnDelegateToChat");
      if (btnDelegate) btnDelegate.onclick = () => sendInspectorContextToChat();
      return;
    }

    currentPreviewData = { ...data, change, file: htmlRelPath, slug, inspectedData, targetPayload };

    diffArea.style.display = "block";
    diffArea.innerHTML = `
      <div style="font-size:11px;font-weight:600;color:var(--text);margin-top:8px">Visualização do Diff (sem alteração em disco):</div>
      ${renderDiffHtml(data.diff)}
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:8px">
        <button type="button" class="btn-vp" id="btnCancelDiff" style="font-size:11px;padding:4px 10px">Cancelar</button>
        <button type="button" class="inspector-file-btn" id="btnApplyEdit" style="background:#10b981;color:#fff;border-color:#10b981;font-weight:bold;font-size:11px;padding:4px 12px">
          ✅ Confirmar e Gravar
        </button>
      </div>
    `;

    const btnCancel = $("btnCancelDiff");
    if (btnCancel) btnCancel.onclick = () => { diffArea.style.display = "none"; };

    const btnApply = $("btnApplyEdit");
    if (btnApply) btnApply.onclick = handleApply;

  } catch (err) {
    showToast("Erro de comunicação ao calcular diff.");
  }
}

async function handleApply() {
  if (!currentPreviewData) return;

  const { slug, file, change, fingerprint, inspectedData, targetPayload } = currentPreviewData;
  const btnApply = $("btnApplyEdit");
  if (btnApply) {
    btnApply.textContent = "Gravando...";
    // @ts-ignore
    btnApply.disabled = true;
  }

  try {
    const res = await fetch(`/api/project/${encodeURIComponent(slug)}/inspect/edit/apply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file,
        componentName: inspectedData.component,
        target: targetPayload || {
          tag: inspectedData.elementTag || "div",
          text: (inspectedData.outerSnippet || "").replace(/<[^>]*>/g, "").trim(),
          domPath: inspectedData.domPath,
        },
        change,
        fingerprint,
      }),
    });

    const data = await res.json();
    if (res.ok && data.ok) {
      showToast("✅ Arquivo atualizado! O Hot Reload do Angular recarregará o app.");
      const diffArea = $("inspectorDiffArea");
      if (diffArea) diffArea.style.display = "none";

      showUndoBanner(data.undoToken, slug);
    } else if (res.status === 409) {
      showToast("⚠️ Conflito 409: O arquivo foi alterado externamente. Gere novo preview.");
    } else {
      showToast(`Erro ao gravar: ${data.error}`);
    }
  } catch (err) {
    showToast("Erro ao aplicar alteração.");
  }
}
