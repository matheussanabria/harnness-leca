// @ts-check
// Explorador e editor manual de código-fonte do app aberto no Studio.
import { showToast } from "../shared/dom.js";
import { state } from "../shared/state.js";
import { windowManager } from "../window-manager/window-manager.js";
import { renderSourceTree } from "./studio-source-tree.js";
import { highlightSourceCode, sourceLanguage } from "./studio-source-highlight.js";

const UNSAVED_SOURCE_ID = "studio-source";

const sourceState = {
  slug: "",
  files: [],
  path: "",
  fingerprint: "",
  dirty: false,
  loading: false,
};

function mountWorkspace() {
  const wrapper = $("studioFrameWrapper");
  if (!wrapper || $("studioSourceWorkspace")) return;
  const workspace = document.createElement("section");
  workspace.id = "studioSourceWorkspace";
  workspace.className = "studio-source-workspace";
  workspace.setAttribute("aria-label", "Editor de código-fonte");
  workspace.innerHTML = `
    <aside class="source-explorer">
      <div class="source-explorer-header">
        <strong><i class="fa-solid fa-folder-tree"></i> Arquivos</strong>
        <button type="button" class="source-icon-btn" onclick="loadStudioSourceWorkspace(true)" title="Atualizar lista" aria-label="Atualizar lista"><i class="fa-solid fa-rotate"></i></button>
      </div>
      <label class="source-search">
        <i class="fa-solid fa-magnifying-glass"></i>
        <input id="studioSourceSearch" type="search" placeholder="Filtrar arquivos" oninput="filterStudioSourceFiles(this.value)" aria-label="Filtrar arquivos">
      </label>
      <div id="studioSourceFileList" class="source-file-list"></div>
    </aside>
    <div class="source-editor-pane">
      <div class="source-editor-toolbar">
        <span id="studioSourcePath" class="source-editor-path">Selecione um arquivo</span>
        <span id="studioSourceLanguage" class="source-language" hidden></span>
        <span id="studioSourceDirty" class="source-dirty" hidden>Alterado</span>
        <button type="button" class="btn-vp btn-vp-icon" onclick="reloadStudioSourceFile()" title="Descartar alterações e recarregar" aria-label="Recarregar arquivo"><i class="fa-solid fa-rotate-left"></i></button>
        <button type="button" id="btnStudioSourceSave" class="btn-source-save" onclick="saveStudioSourceFile()" disabled><i class="fa-solid fa-floppy-disk"></i> Salvar</button>
      </div>
      <div id="studioSourceEmpty" class="source-editor-empty">
        <i class="fa-solid fa-file-code"></i>
        <strong>Código-fonte da aplicação</strong>
        <span>Escolha um arquivo no explorador para editar.</span>
      </div>
      <div id="studioSourceCodeShell" class="source-code-shell" hidden>
        <pre id="studioSourceLineNumbers" class="source-line-numbers" aria-hidden="true"></pre>
        <div class="source-code-stage">
          <pre id="studioSourceHighlight" class="source-highlight" aria-hidden="true"><code></code></pre>
          <textarea id="studioSourceEditor" class="source-editor" spellcheck="false" aria-label="Conteúdo do arquivo" oninput="handleStudioSourceInput()" onscroll="syncStudioSourceEditorScroll()" onclick="syncStudioSourceEditorScroll()" onkeyup="syncStudioSourceEditorScroll()" onkeydown="handleStudioSourceEditorKey(event)"></textarea>
        </div>
      </div>
      <div class="source-editor-footer"><span id="studioSourceStatus">Pronto</span><span id="studioSourcePosition">Ctrl+S para salvar</span></div>
    </div>`;
  wrapper.appendChild(workspace);
}

async function responseJson(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Falha HTTP ${response.status}`);
  return data;
}

function setStatus(message) {
  const status = $("studioSourceStatus");
  if (status) status.textContent = message;
}

function setDirty(dirty) {
  sourceState.dirty = dirty;
  const badge = $("studioSourceDirty");
  const save = /** @type {HTMLButtonElement} */ ($("btnStudioSourceSave"));
  if (badge) badge.hidden = !dirty;
  if (save) save.disabled = !dirty || !sourceState.path;
  if (dirty) {
    windowManager.unsaved.mark(UNSAVED_SOURCE_ID, {
      label: "Código do Studio",
      projectSlug: state.P?.slug || ""
    });
  } else {
    windowManager.unsaved.clear(UNSAVED_SOURCE_ID);
  }
}

function renderFileList(filter = "") {
  const host = $("studioSourceFileList");
  if (!host) return;
  renderSourceTree({
    host,
    files: sourceState.files,
    activePath: sourceState.path,
    filter,
    onOpen: openStudioSourceFile,
  });
}

function updateSyntaxHighlight() {
  const editor = /** @type {HTMLTextAreaElement} */ ($("studioSourceEditor"));
  const code = $("studioSourceHighlight")?.querySelector("code");
  const lines = $("studioSourceLineNumbers");
  if (!editor || !code || !lines) return;
  code.innerHTML = highlightSourceCode(editor.value, sourceState.path) + (editor.value.endsWith("\n") ? " " : "");
  const count = Math.max(1, editor.value.split("\n").length);
  lines.textContent = Array.from({ length: count }, (_, index) => String(index + 1)).join("\n");
  syncStudioSourceEditorScroll();
}

export async function loadStudioSourceWorkspace(force = false) {
  mountWorkspace();
  const slug = state.P?.slug;
  if (!slug || sourceState.loading) return;
  if (!force && sourceState.slug === slug && sourceState.files.length) return;
  if (sourceState.dirty && !window.confirm("Descartar as alterações manuais ainda não salvas?")) return;
  sourceState.loading = true;
  setStatus("Carregando arquivos...");
  try {
    const data = await responseJson(await fetch(`/api/project/${encodeURIComponent(slug)}/source`));
    sourceState.slug = slug;
    sourceState.files = data.files || [];
    sourceState.path = "";
    sourceState.fingerprint = "";
    setDirty(false);
    renderFileList(/** @type {HTMLInputElement} */ ($("studioSourceSearch"))?.value || "");
    setStatus(`${sourceState.files.length} arquivos disponíveis`);
  } catch (err) {
    setStatus(err.message || String(err));
    showToast(`Não foi possível carregar o código: ${err.message || err}`);
  } finally {
    sourceState.loading = false;
  }
}

export async function openStudioSourceFile(filePath) {
  if (!filePath || (sourceState.dirty && !window.confirm("Descartar as alterações manuais ainda não salvas?"))) return;
  const editor = /** @type {HTMLTextAreaElement} */ ($("studioSourceEditor"));
  if (!editor) return;
  setStatus("Abrindo arquivo...");
  try {
    const url = `/api/project/${encodeURIComponent(sourceState.slug)}/source/file?path=${encodeURIComponent(filePath)}`;
    const data = await responseJson(await fetch(url));
    sourceState.path = data.path;
    sourceState.fingerprint = data.fingerprint;
    editor.value = data.content;
    const shell = $("studioSourceCodeShell");
    if (shell) shell.hidden = false;
    const empty = $("studioSourceEmpty");
    if (empty) empty.style.display = "none";
    const pathLabel = $("studioSourcePath");
    if (pathLabel) pathLabel.textContent = data.path;
    const language = $("studioSourceLanguage");
    if (language) {
      language.textContent = sourceLanguage(data.path);
      language.hidden = false;
    }
    updateSyntaxHighlight();
    setDirty(false);
    renderFileList(/** @type {HTMLInputElement} */ ($("studioSourceSearch"))?.value || "");
    setStatus(`${data.size} bytes`);
    editor.focus();
  } catch (err) {
    setStatus(err.message || String(err));
    showToast(`Falha ao abrir arquivo: ${err.message || err}`);
  }
}

export function filterStudioSourceFiles(value) { renderFileList(value); }
export function markStudioSourceDirty() { if (sourceState.path) setDirty(true); }
export function hasUnsavedStudioSource() { return sourceState.dirty; }

export function handleStudioSourceInput() {
  markStudioSourceDirty();
  updateSyntaxHighlight();
}

export function syncStudioSourceEditorScroll() {
  const editor = /** @type {HTMLTextAreaElement} */ ($("studioSourceEditor"));
  const highlight = $("studioSourceHighlight");
  const lines = $("studioSourceLineNumbers");
  if (!editor) return;
  if (highlight) {
    highlight.scrollTop = editor.scrollTop;
    highlight.scrollLeft = editor.scrollLeft;
  }
  if (lines) lines.scrollTop = editor.scrollTop;
  const position = $("studioSourcePosition");
  if (position) {
    const before = editor.value.slice(0, editor.selectionStart).split("\n");
    position.textContent = `Ln ${before.length}, Col ${(before.at(-1) || "").length + 1} · Ctrl+S para salvar`;
  }
}

export function reloadStudioSourceFile() {
  if (sourceState.path) openStudioSourceFile(sourceState.path);
}

export async function saveStudioSourceFile() {
  const editor = /** @type {HTMLTextAreaElement} */ ($("studioSourceEditor"));
  if (!editor || !sourceState.path || !sourceState.dirty) return;
  if (state.P?.slug !== sourceState.slug) {
    showToast("O projeto ativo mudou. Atualize a lista de arquivos antes de salvar.");
    return;
  }
  setStatus("Salvando...");
  try {
    const response = await fetch(`/api/project/${encodeURIComponent(sourceState.slug)}/source/file`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: sourceState.path, content: editor.value, fingerprint: sourceState.fingerprint }),
    });
    const data = await responseJson(response);
    sourceState.fingerprint = data.fingerprint;
    setDirty(false);
    setStatus(`Salvo agora · ${data.size} bytes`);
    showToast("Arquivo salvo. O servidor da aplicação aplicará o hot-reload.");
  } catch (err) {
    setStatus(err.message || String(err));
    showToast(`Não foi possível salvar: ${err.message || err}`);
  }
}

export function handleStudioSourceEditorKey(event) {
  const editor = /** @type {HTMLTextAreaElement} */ (event.currentTarget);
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
    event.preventDefault();
    saveStudioSourceFile();
  } else if (event.key === "Tab") {
    event.preventDefault();
    const start = editor.selectionStart;
    editor.setRangeText("  ", start, editor.selectionEnd, "end");
    handleStudioSourceInput();
  }
}
