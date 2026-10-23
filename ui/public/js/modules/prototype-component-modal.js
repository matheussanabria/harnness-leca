// @ts-check
import { esc } from "../shared/dom.js";

/**
 * Janela com o preview e o código-fonte de um componente do DS.
 * Preview: a página renderizada pelo registry. Código: os arquivos do componente, por framework.
 */

const base = (slug) => `/api/project/${encodeURIComponent(slug)}/design/registry`;

/** @param {string} slug @param {string} componentId */
export function openComponentModal(slug, componentId) {
  closeComponentModal();
  const overlay = document.createElement("div");
  overlay.id = "compModalOverlay";
  overlay.className = "comp-modal-overlay";
  overlay.innerHTML = `
    <div class="comp-modal" role="dialog" aria-modal="true" aria-labelledby="compModalTitle">
      <header class="comp-modal__head">
        <h3 id="compModalTitle"><i class="fa-solid fa-cube"></i> <span>${esc(componentId)}</span></h3>
        <button type="button" class="proto-panel-action-btn" data-comp-close title="Fechar" aria-label="Fechar"><i class="fa-solid fa-xmark"></i></button>
      </header>
      <nav class="comp-modal__tabs" role="tablist">
        <button type="button" class="btn-proto-vp active" data-comp-tab="preview" role="tab"><i class="fa-solid fa-eye"></i> Preview</button>
        <button type="button" class="btn-proto-vp" data-comp-tab="code" role="tab"><i class="fa-solid fa-code"></i> Código-fonte</button>
      </nav>
      <div class="comp-modal__body" id="compModalBody">
        <iframe class="comp-modal__frame" sandbox="allow-scripts" src="${base(slug)}/${encodeURIComponent(componentId)}/preview" title="Preview de ${esc(componentId)}"></iframe>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  overlay.addEventListener("click", (event) => {
    const target = /** @type {HTMLElement} */ (event.target);
    if (target === overlay || target.closest("[data-comp-close]")) return closeComponentModal();
    const tab = target.closest("[data-comp-tab]");
    if (tab) showTab(slug, componentId, /** @type {HTMLElement} */ (tab).dataset.compTab || "preview");
    const file = target.closest("[data-comp-file]");
    if (file) showFile(/** @type {HTMLElement} */ (file).dataset.compFile || "");
  });
  document.addEventListener("keydown", onKey);
}

export function closeComponentModal() {
  document.getElementById("compModalOverlay")?.remove();
  document.removeEventListener("keydown", onKey);
}

function onKey(event) {
  if (event.key === "Escape") closeComponentModal();
}

/** @param {string} slug @param {string} componentId @param {string} tab */
async function showTab(slug, componentId, tab) {
  document.querySelectorAll("[data-comp-tab]").forEach((b) => b.classList.toggle("active", b.getAttribute("data-comp-tab") === tab));
  const body = document.getElementById("compModalBody");
  if (!body) return;
  if (tab === "preview") {
    body.innerHTML = `<iframe class="comp-modal__frame" sandbox="allow-scripts" src="${base(slug)}/${encodeURIComponent(componentId)}/preview" title="Preview de ${esc(componentId)}"></iframe>`;
    return;
  }
  body.innerHTML = '<div class="proto-loading"><i class="fa-solid fa-spinner fa-spin"></i> Carregando código...</div>';
  try {
    const res = await fetch(`${base(slug)}/${encodeURIComponent(componentId)}/source`);
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || "Falha ao ler o código.");
    const files = data.source.files || [];
    if (!files.length) { body.innerHTML = '<div class="proto-error">Nenhum arquivo-fonte registrado para este componente.</div>'; return; }
    const entry = files.find((f) => f.entry) || files[0];
    body.innerHTML = `
      <div class="comp-modal__files">${files.map((f, i) => `<button type="button" class="btn-proto-vp ${f === entry ? "active" : ""}" data-comp-file="${i}"><i class="fa-regular fa-file-code"></i> ${esc(f.framework)} · ${esc(f.path)}</button>`).join("")}</div>
      <pre class="comp-modal__code" id="compModalCode"></pre>`;
    body.dataset.files = JSON.stringify(files.map((f) => ({ path: f.path, content: f.content, bytes: f.bytes })));
    showFile(String(files.indexOf(entry)));
  } catch (err) {
    body.innerHTML = `<div class="proto-error"><i class="fa-solid fa-triangle-exclamation"></i> ${esc(err instanceof Error ? err.message : String(err))}</div>`;
  }
}

/** @param {string} index */
function showFile(index) {
  const body = document.getElementById("compModalBody");
  const code = document.getElementById("compModalCode");
  if (!body || !code) return;
  const files = JSON.parse(body.dataset.files || "[]");
  const file = files[Number(index)];
  if (!file) return;
  document.querySelectorAll("[data-comp-file]").forEach((b) => b.classList.toggle("active", b.getAttribute("data-comp-file") === String(index)));
  code.textContent = file.content === null
    ? `Arquivo grande demais para exibir (${Math.round(file.bytes / 1024)} KB).`
    : file.content;
}
