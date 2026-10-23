// @ts-check
import { esc } from "../shared/dom.js";
import { deleteConfirmText, deleteUrl } from "./prototype-delete-model.js";
import { logAtelierAction } from "./prototype-atelier-state.js";

/**
 * Diálogo de confirmação próprio (o confirm() do navegador não combina com o resto da interface
 * e não explica o que acontece). Resolve true só se o usuário confirmar.
 * @param {{ id: string, title?: string, kind?: string }} item
 * @returns {Promise<boolean>}
 */
export function confirmDeletePrototype(item) {
  const text = deleteConfirmText(item);
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "pd-overlay";
    overlay.innerHTML = `
      <div class="pd-dialog" role="alertdialog" aria-modal="true" aria-labelledby="pdTitle" aria-describedby="pdBody">
        <div class="pd-icon"><i class="fa-solid fa-trash-can"></i></div>
        <h3 id="pdTitle">${esc(text.title)}</h3>
        <p id="pdBody">${esc(text.body)}</p>
        <div class="pd-actions">
          <button type="button" class="pd-btn" data-pd="cancel">Cancelar</button>
          <button type="button" class="pd-btn pd-btn--danger" data-pd="confirm">${esc(text.confirmLabel)}</button>
        </div>
      </div>`;
    const close = (answer) => {
      document.removeEventListener("keydown", onKey, true);
      overlay.remove();
      resolve(answer);
    };
    const onKey = (event) => {
      if (event.key === "Escape") { event.stopPropagation(); close(false); }
    };
    overlay.addEventListener("click", (event) => {
      const target = /** @type {HTMLElement} */ (event.target);
      if (target === overlay || target.closest('[data-pd="cancel"]')) close(false);
      else if (target.closest('[data-pd="confirm"]')) close(true);
    });
    document.addEventListener("keydown", onKey, true);
    document.body.appendChild(overlay);
    /** @type {HTMLElement | null} */ (overlay.querySelector('[data-pd="cancel"]'))?.focus();
  });
}

/**
 * Pede o OK do usuário e exclui no servidor. Devolve true se excluiu.
 * @param {string} slug
 * @param {{ id: string, title?: string, kind?: string }} item
 */
export async function deletePrototypeWithConfirm(slug, item) {
  if (!(await confirmDeletePrototype(item))) return false;
  const response = await fetch(deleteUrl(slug, item.id), { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Não foi possível excluir o protótipo.");
  void logAtelierAction("excluir protótipo", item.id);
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("harness:design-index-changed", { detail: { slug } }));
  return true;
}
