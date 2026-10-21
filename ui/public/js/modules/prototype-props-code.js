// @ts-check
import { esc, showToast } from "../shared/dom.js";
import { fetchElementTraceability } from "./prototype-element-map.js";
import { renderCodeHtml } from "./prototype-props-view.js";
import { highlight } from "./prototype-code-highlight.js";
import { CODE_TABS, activePath, componentBadge, fileEntries, langOf, pickCode, tabOfPath } from "./prototype-props-code-model.js";

let activeTab = "css";
/** @type {null | (() => void)} */
let reloadActive = null;
// Extrair ou desfazer componente muda o rastreio do elemento: recarrega as abas.
if (typeof window !== "undefined") window.addEventListener("harness:design-index-changed", () => reloadActive?.());

/**
 * Aba de código do painel: CSS, HTML, React e Angular do elemento e os arquivos do componente.
 * No painel estreito vale a versão compacta; "Expandir" abre o mesmo conteúdo num modal grande.
 * @param {{ slug: string, protoId: string, getScreen: () => string, pid: string }} ctx
 */
export function createCodeTabs(ctx) {
  /** @type {HTMLElement | null} */ let box = null;
  /** @type {HTMLElement | null} */ let modal = null;
  let local = { cls: "", rule: "" };
  let trace = null;
  let error = "";

  function emptyMessage(isFile) {
    if (error) return error;
    if (trace && !trace.sources) return "O servidor ainda está na versão antiga: reinicie-o para ler os arquivos do componente.";
    return isFile ? "Arquivo não carregado (muito grande ou ausente)." : "Carregando código do elemento...";
  }

  /** HTML do visualizador; `big` é a versão do modal (sem barra de rolagem interna apertada). */
  function viewerHtml(big) {
    const isFile = activeTab.startsWith("file:");
    const shown = activePath(activeTab, trace);
    const tabOn = isFile ? tabOfPath(shown) : activeTab;
    const tabs = CODE_TABS.map(([k, l]) => `<button type="button" class="pc-tab" role="tab" aria-selected="${k === tabOn}" data-pp-tab="${k}">${l}</button>`).join("");
    const { label, text } = pickCode(activeTab, local, trace);
    let pane;
    if (text) pane = `<pre class="pc-pre" tabindex="0"><code>${highlight(text, langOf(activeTab, trace))}</code></pre>`;
    else if (activeTab === "css" && trace) pane = renderCodeHtml(local.cls, "");
    else pane = `<div class="pc-empty">${esc(emptyMessage(isFile))}</div>`;
    const entries = fileEntries(trace);
    const badge = componentBadge(trace);
    const files = entries.length
      ? `<div class="pc-files">${entries.map((f) => `<button type="button" class="pc-file" aria-pressed="${f.path === shown}" data-pp-file="${esc(f.path)}" title="${esc(f.path)}"><span class="pc-fw">${esc(f.framework)}</span>${esc(f.name)}</button>`).join("")}</div>`
      : "";
    const foot = badge || files
      ? `<div class="pc-foot">${badge ? `<span class="pc-badge pc-badge--${badge.source}"><i class="fa-solid fa-cube"></i><code>${esc(badge.id)}</code><em>${esc(badge.label)}</em></span>` : ""}${files}</div>`
      : "";
    const expand = big ? "" : '<button type="button" class="pc-copy" data-pp-expand title="Abrir em tela grande"><i class="fa-solid fa-expand"></i><span>Expandir</span></button>';
    const copy = text ? '<button type="button" class="pc-copy" data-pp-copy title="Copiar código"><i class="fa-solid fa-copy"></i><span>Copiar</span></button>' : "";
    return `<div class="pc${big ? " pc--big" : ""}"><div class="pc-tabs" role="tablist">${tabs}<span class="pc-sp"></span>${expand}${copy}</div><div class="pc-note">${esc(label)}</div>${pane}${foot}</div>`;
  }

  function paint() {
    if (box) box.innerHTML = viewerHtml(false);
    const body = modal?.querySelector("[data-pp-modal-body]");
    if (body) body.innerHTML = viewerHtml(true);
  }

  function closeModal() {
    modal?.remove();
    modal = null;
    document.removeEventListener("keydown", onKey);
  }
  const onKey = (e) => { if (e.key === "Escape") closeModal(); };

  function openModal() {
    if (modal) return;
    modal = document.createElement("div");
    modal.className = "pc-overlay";
    modal.innerHTML = `<div class="pc-dialog" role="dialog" aria-modal="true" aria-label="Código do elemento"><div class="pc-dialog-head"><strong><i class="fa-solid fa-code"></i> Código do elemento</strong><button type="button" class="pc-copy" data-pp-close aria-label="Fechar"><i class="fa-solid fa-xmark"></i></button></div><div class="pc-dialog-body" data-pp-modal-body></div></div>`;
    modal.onclick = (e) => { if (e.target === modal) closeModal(); else onClick(e); };
    document.body.appendChild(modal);
    document.addEventListener("keydown", onKey);
    paint();
  }

  function onClick(e) {
    const el = /** @type {HTMLElement} */ (e.target);
    if (el.closest?.("[data-pp-close]")) { closeModal(); return; }
    if (el.closest?.("[data-pp-expand]")) { openModal(); return; }
    const tab = el.closest?.("[data-pp-tab]")?.getAttribute("data-pp-tab");
    if (tab) { activeTab = tab; paint(); return; }
    const file = el.closest?.("[data-pp-file]")?.getAttribute("data-pp-file");
    if (file) { activeTab = `file:${file}`; paint(); return; }
    if (el.closest?.("[data-pp-copy]")) {
      const text = pickCode(activeTab, local, trace).text;
      if (text && navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(() => showToast("Código copiado."), () => showToast("Não foi possível copiar."));
    }
  }

  const api = {
    /** Liga o controle ao bloco do painel (o painel recria o bloco a cada render). */
    attach(el) {
      box = el;
      if (box) { box.onclick = onClick; paint(); }
    },
    setRule(cls, rule) { local = { cls, rule }; paint(); },
    async reload() {
      try {
        trace = await fetchElementTraceability({ slug: ctx.slug, protoId: ctx.protoId, screenId: ctx.getScreen(), nodeId: ctx.pid });
        error = "";
      } catch (err) {
        error = err?.message || String(err);
      }
      paint();
    },
  };
  reloadActive = () => api.reload();
  return api;
}
