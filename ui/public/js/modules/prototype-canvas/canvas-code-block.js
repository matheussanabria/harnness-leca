// @ts-check
import { esc, copyToClipboard } from "../../shared/dom.js";
import { CODE_LANGS, buildCodePreview } from "./canvas-model.js";

const EXT = { html: "html", css: "css", js: "js", ts: "ts", json: "json", md: "md" };

/** Corpo do bloco de código (cabeçalho, editor e preview). */
export function renderCodeBlockHtml(item) {
  const langs = CODE_LANGS.map((l) => `<option value="${l}" ${l === item.lang ? "selected" : ""}>${l}</option>`).join("");
  return `
    <div class="cv-code-head" data-drag>
      <i class="fa-solid fa-code"></i>
      <input class="cv-code-name" data-nodrag value="${esc(item.name)}" spellcheck="false" title="Nome do bloco">
      <select class="cv-code-lang" data-nodrag title="Linguagem">${langs}</select>
      <button type="button" class="cv-mini ${item.tab === "code" ? "active" : ""}" data-nodrag data-act="tab-code" title="Código"><i class="fa-solid fa-pen"></i></button>
      <button type="button" class="cv-mini ${item.tab === "preview" ? "active" : ""}" data-nodrag data-act="tab-preview" title="Pré-visualizar (HTML)"><i class="fa-solid fa-eye"></i></button>
      <button type="button" class="cv-mini" data-nodrag data-act="copy" title="Copiar código"><i class="fa-regular fa-copy"></i></button>
      <button type="button" class="cv-mini" data-nodrag data-act="download" title="Baixar arquivo"><i class="fa-solid fa-download"></i></button>
    </div>
    <textarea class="cv-code-editor" data-nodrag spellcheck="false" placeholder="Cole ou escreva o código do componente...">${esc(item.code)}</textarea>
    <iframe class="cv-code-preview" sandbox="allow-scripts" title="Preview do bloco"></iframe>`;
}

export function syncCodeBlock(el, item) {
  el.classList.toggle("show-preview", item.tab === "preview");
  el.querySelector('[data-act="tab-code"]')?.classList.toggle("active", item.tab !== "preview");
  el.querySelector('[data-act="tab-preview"]')?.classList.toggle("active", item.tab === "preview");
  if (item.tab === "preview") {
    const frame = /** @type {HTMLIFrameElement|null} */ (el.querySelector(".cv-code-preview"));
    const html = buildCodePreview(item);
    if (frame) frame.srcdoc = html || '<p style="font:13px system-ui;color:#64748b;padding:12px">Sem preview: só blocos HTML são renderizados.</p>';
  }
}

/** Liga eventos do bloco; `commit(persist)` avisa o canvas que o item mudou. */
export function bindCodeBlock(el, item, commit) {
  const editor = /** @type {HTMLTextAreaElement} */ (el.querySelector(".cv-code-editor"));
  const name = /** @type {HTMLInputElement} */ (el.querySelector(".cv-code-name"));
  const lang = /** @type {HTMLSelectElement} */ (el.querySelector(".cv-code-lang"));
  editor.addEventListener("input", () => { item.code = editor.value; commit(); });
  editor.addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    e.preventDefault();
    const { selectionStart: s, selectionEnd: end } = editor;
    editor.setRangeText("  ", s, end, "end");
    item.code = editor.value;
    commit();
  });
  name.addEventListener("input", () => { item.name = name.value; commit(); });
  lang.addEventListener("change", () => { item.lang = lang.value; if (item.lang !== "html" && item.tab === "preview") item.tab = "code"; syncCodeBlock(el, item); commit(); });
  el.addEventListener("click", (e) => {
    const button = /** @type {HTMLElement|null} */ (/** @type {HTMLElement} */ (e.target).closest("[data-act]"));
    if (!button) return;
    const act = button.dataset.act;
    if (act === "tab-code") item.tab = "code";
    else if (act === "tab-preview") item.tab = "preview";
    else if (act === "copy") return copyToClipboard(item.code, "Código copiado.");
    else if (act === "download") return downloadCode(item);
    syncCodeBlock(el, item);
    commit();
  });
  syncCodeBlock(el, item);
}

export function downloadCode(item) {
  const blob = new Blob([item.code || ""], { type: "text/plain;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${(item.name || "componente").replace(/[^\w.-]+/g, "-")}.${EXT[item.lang] || "txt"}`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}
