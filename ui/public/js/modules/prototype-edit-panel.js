// @ts-check
import { $, showToast, esc } from "../shared/dom.js";

let lastFingerprint = "";

/**
 * Renderiza o painel de edição mecânica e estrutural do nó selecionado.
 * @param {HTMLElement} panel
 * @param {string} slug
 * @param {string} protoId
 * @param {string} screenId
 * @param {object} node
 * @param {() => void} onApplySuccess
 */
export function renderNodeEditForm(panel, slug, protoId, screenId, node, onApplySuccess) {
  if (!panel || !node) return;

  const classesStr = Array.isArray(node.classes) ? node.classes.join(" ") : "";
  const isVoidTag = ["img", "input", "br", "hr"].includes((node.tag || "").toLowerCase());

  panel.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:10px">
      <!-- 1. Cabeçalho do Elemento -->
      <div style="display:flex;align-items:center;justify-content:space-between;padding-bottom:8px;border-bottom:1px solid #1f2937">
        <div style="display:flex;align-items:center;gap:6px">
          <span style="font-weight:700;color:#60a5fa;font-size:13px">&lt;${esc(node.tag)}&gt;</span>
        </div>
        <span style="font-size:10px;background:#0f172a;color:#f59e0b;padding:2px 6px;border-radius:4px;border:1px solid #334155">
          PID: ${esc(node.pid)}
        </span>
      </div>

      <!-- 2. Conteúdo de Texto -->
      ${!isVoidTag ? `
        <div style="background:#131c2e;padding:8px 10px;border-radius:6px;border:1px solid #1f2937">
          <label style="display:block;font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;margin-bottom:4px">Conteúdo de Texto</label>
          <div style="display:flex;gap:4px">
            <input type="text" id="protoEditText" value="${esc(node.text || '')}" style="flex:1;background:#090d16;color:#f8fafc;border:1px solid #334155;border-radius:4px;padding:4px 6px;font-size:11px" />
            <button type="button" id="btnPreviewText" class="btn-proto-vp" title="Gerar diff deste texto"><i class="fa-solid fa-code-compare"></i> Diff</button>
          </div>
        </div>
      ` : ''}

      <!-- 3. Estilo & Classes CSS -->
      <div style="background:#131c2e;padding:8px 10px;border-radius:6px;border:1px solid #1f2937;display:flex;flex-direction:column;gap:6px">
        <label style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase">Classes & Tokens</label>
        <div style="display:flex;gap:4px">
          <input type="text" id="protoEditClasses" value="${esc(classesStr)}" placeholder="Classes utilitárias..." style="flex:1;background:#090d16;color:#f8fafc;border:1px solid #334155;border-radius:4px;padding:4px 6px;font-size:11px" />
          <button type="button" id="btnPreviewClasses" class="btn-proto-vp" title="Gerar diff de classes"><i class="fa-solid fa-code-compare"></i> Diff</button>
        </div>
        <div style="display:flex;gap:4px;margin-top:2px">
          <input type="text" id="protoEditStyleProp" placeholder="propriedade (ex: color)" style="width:45%;background:#090d16;color:#f8fafc;border:1px solid #334155;border-radius:4px;padding:4px 6px;font-size:10px" />
          <input type="text" id="protoEditStyleVal" placeholder="var(--ds-color-primary)" style="width:55%;background:#090d16;color:#f8fafc;border:1px solid #334155;border-radius:4px;padding:4px 6px;font-size:10px" />
          <button type="button" id="btnPreviewToken" class="btn-proto-vp" title="Gerar diff de token"><i class="fa-solid fa-code-compare"></i> Diff</button>
        </div>
      </div>

      <!-- 4. Operações Estruturais -->
      <div style="background:#131c2e;padding:8px 10px;border-radius:6px;border:1px solid #1f2937">
        <label style="display:block;font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;margin-bottom:6px">Estrutura & Blocos</label>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px">
          <button type="button" id="btnMoveUp" class="btn-proto-vp"><i class="fa-solid fa-arrow-up"></i> Mover Acima</button>
          <button type="button" id="btnMoveDown" class="btn-proto-vp"><i class="fa-solid fa-arrow-down"></i> Mover Abaixo</button>
          <button type="button" id="btnDuplicate" class="btn-proto-vp"><i class="fa-solid fa-copy"></i> Duplicar</button>
          <button type="button" id="btnRemove" class="btn-proto-vp" style="color:#fca5a5;border-color:#7f1d1d"><i class="fa-solid fa-trash-can"></i> Remover</button>
        </div>
        <div style="display:flex;gap:4px;margin-top:8px">
          <select id="selectDsBlock" style="flex:1;background:#090d16;color:#cbd5e1;border:1px solid #334155;font-size:10.5px;padding:4px;border-radius:4px">
            <option value="ds-card">Bloco: ds-card</option>
            <option value="ds-badge">Bloco: ds-badge</option>
            <option value="ds-btn">Bloco: ds-btn</option>
            <option value="ds-alert">Bloco: ds-alert</option>
          </select>
          <button type="button" id="btnInsertBlock" class="btn-proto-vp" style="color:#60a5fa"><i class="fa-solid fa-plus"></i> Inserir</button>
        </div>
      </div>

      <!-- 5. Extração & Exportação -->
      <div style="display:flex;flex-direction:column;gap:4px">
        <button type="button" id="btnExtractComponent" class="btn-proto-vp" style="width:100%;justify-content:center;color:#34d399;border-color:#065f46">
          <i class="fa-solid fa-cube"></i> Extrair Componente para Quadro
        </button>
        <a href="/api/project/${encodeURIComponent(slug)}/design/prototypes/${encodeURIComponent(protoId)}/export/single-html" download="${protoId}.html" class="btn-proto-vp" style="text-decoration:none;justify-content:center;color:#a5b4fc">
          <i class="fa-solid fa-download"></i> Baixar HTML Único
        </a>
      </div>

      <!-- 6. Diff Preview & Ação Primária -->
      <div id="protoDiffArea" style="display:none;background:#030712;padding:8px;border-radius:6px;border:1px solid #3b82f6;margin-top:4px">
        <div style="font-size:10px;font-weight:700;color:#60a5fa;margin-bottom:4px">Prévia de Alteração (Diff):</div>
        <pre id="protoDiffContent" style="background:#0b0f19;padding:6px;border-radius:4px;font-size:10px;max-height:110px;overflow:auto;color:#cbd5e1;margin:0"></pre>
        <div style="display:flex;gap:6px;margin-top:8px">
          <button type="button" id="btnApplyEdit" style="flex:1;padding:6px 12px;background:#2563eb;color:#fff;border:none;border-radius:4px;font-size:11px;font-weight:600;cursor:pointer">
            <i class="fa-solid fa-check"></i> Aplicar Alteração
          </button>
          <button type="button" id="btnCancelDiff" class="btn-proto-vp">Cancelar</button>
        </div>
      </div>

      <!-- 7. Desfazer Última Edição -->
      <button type="button" id="btnUndoProtoEdit" class="btn-proto-vp" style="justify-content:center;color:#fca5a5;border-color:#5c1d24;margin-top:4px">
        <i class="fa-solid fa-rotate-left"></i> Desfazer Última Edição Direta
      </button>
    </div>
  `;

  bindEditEvents(slug, protoId, screenId, node, onApplySuccess);
}

function bindEditEvents(slug, protoId, screenId, node, onApplySuccess) {
  let pendingOp = null;

  async function handlePreview(op) {
    try {
      const res = await fetch(`/api/project/${encodeURIComponent(slug)}/design/prototypes/${encodeURIComponent(protoId)}/edit/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ screen: screenId, pid: node.pid, op }),
      });
      if (!res.ok) {
        const err = await res.json();
        showToast("Erro: " + (err.error || "Operação inválida"));
        return;
      }
      const data = await res.json();
      lastFingerprint = data.fingerprint;
      pendingOp = op;
      const diffArea = $("protoDiffArea");
      const diffPre = $("protoDiffContent");
      if (diffArea && diffPre) {
        diffPre.textContent = data.diff || "(nenhuma alteração)";
        diffArea.style.display = "block";
      }
    } catch {
      showToast("Falha na visualização de diff.");
    }
  }

  async function handleStructural(op, snippetHtml = "") {
    try {
      const res = await fetch(`/api/project/${encodeURIComponent(slug)}/design/prototypes/${encodeURIComponent(protoId)}/edit/structural`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ screen: screenId, pid: node.pid, op, snippetHtml }),
      });
      if (res.ok) {
        showToast(`✔ Operação ${op.type} executada.`);
        onApplySuccess();
      } else {
        const err = await res.json();
        showToast("Erro: " + (err.error || "Falha"));
      }
    } catch {
      showToast("Falha na requisição estrutural.");
    }
  }

  const btnText = $("btnPreviewText");
  if (btnText) btnText.onclick = () => handlePreview({ type: "setText", text: $("protoEditText")?.value || "" });

  const btnClasses = $("btnPreviewClasses");
  if (btnClasses) btnClasses.onclick = () => handlePreview({ type: "setClasses", classes: $("protoEditClasses")?.value || "" });

  const btnToken = $("btnPreviewToken");
  if (btnToken) btnToken.onclick = () => {
    const prop = $("protoEditStyleProp")?.value || "";
    const val = $("protoEditStyleVal")?.value || "";
    if (prop && val) handlePreview({ type: "setToken", property: prop, value: val });
  };

  const btnMoveUp = $("btnMoveUp");
  if (btnMoveUp) btnMoveUp.onclick = () => handleStructural({ type: "move", direction: "up" });

  const btnMoveDown = $("btnMoveDown");
  if (btnMoveDown) btnMoveDown.onclick = () => handleStructural({ type: "move", direction: "down" });

  const btnDuplicate = $("btnDuplicate");
  if (btnDuplicate) btnDuplicate.onclick = () => handleStructural({ type: "duplicate" });

  const btnRemove = $("btnRemove");
  if (btnRemove) btnRemove.onclick = () => {
    if (confirm("Remover este elemento?")) handleStructural({ type: "remove" });
  };

  const btnInsertBlock = $("btnInsertBlock");
  if (btnInsertBlock) btnInsertBlock.onclick = () => {
    const block = $("selectDsBlock")?.value || "ds-card";
    const snippet = `<div class="${block}" data-pid="p-new">\n  <h3>Título do Bloco</h3>\n  <p>Conteúdo do ${block}</p>\n</div>`;
    handleStructural({ type: "insertBlock", componentId: block, position: "after" }, snippet);
  };

  const btnExtract = $("btnExtractComponent");
  if (btnExtract) btnExtract.onclick = async () => {
    const name = prompt("Nome do componente candidato:", "MeuComponente");
    if (!name) return;
    try {
      const res = await fetch(`/api/project/${encodeURIComponent(slug)}/design/prototypes/${encodeURIComponent(protoId)}/extract-component`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, screen: screenId, pid: node.pid }),
      });
      if (res.ok) {
        showToast(`✔ Componente '${name}' registrado na coluna Protótipo / Extraído!`);
      } else {
        showToast("Erro ao extrair componente.");
      }
    } catch {
      showToast("Falha na requisição de extração.");
    }
  };

  const btnCancel = $("btnCancelDiff");
  if (btnCancel) btnCancel.onclick = () => {
    const diffArea = $("protoDiffArea");
    if (diffArea) diffArea.style.display = "none";
    pendingOp = null;
  };

  const btnApply = $("btnApplyEdit");
  if (btnApply) btnApply.onclick = async () => {
    if (!pendingOp) return;
    try {
      const res = await fetch(`/api/project/${encodeURIComponent(slug)}/design/prototypes/${encodeURIComponent(protoId)}/edit/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ screen: screenId, pid: node.pid, op: pendingOp, fingerprint: lastFingerprint }),
      });
      if (res.ok) {
        showToast("✔ Alteração aplicada!");
        const diffArea = $("protoDiffArea");
        if (diffArea) diffArea.style.display = "none";
        onApplySuccess();
      } else {
        const err = await res.json();
        showToast("Erro: " + (err.error || "Conflito"));
      }
    } catch {
      showToast("Falha na aplicação.");
    }
  };

  const btnUndo = $("btnUndoProtoEdit");
  if (btnUndo) btnUndo.onclick = async () => {
    try {
      const res = await fetch(`/api/project/${encodeURIComponent(slug)}/design/prototypes/${encodeURIComponent(protoId)}/edit/undo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ screen: screenId }),
      });
      if (res.ok) {
        showToast("✔ Alteração desfeita.");
        onApplySuccess();
      } else {
        showToast("Nenhum histórico para desfazer.");
      }
    } catch {
      showToast("Falha na requisição de undo.");
    }
  };
}
