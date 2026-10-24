// @ts-check
/**
 * Generic confirmation dialog.
 * Single responsibility: ask a yes/no question without window.confirm.
 */

export const CONFIRM_DIALOG_CLASS = "confirm-dialog";

let presenter = null;

/** @param {((payload: { title?: string, message?: string, confirmLabel?: string, cancelLabel?: string }) => Promise<boolean>) | null} next */
export function setConfirmDialogPresenter(next) {
  presenter = typeof next === "function" ? next : null;
}

/**
 * @param {{
 *   title?: string,
 *   message?: string,
 *   confirmLabel?: string,
 *   cancelLabel?: string,
 *   doc?: Document
 * }} [options]
 * @returns {Promise<boolean>}
 */
export async function requestConfirmation(options = {}) {
  const { title, message, confirmLabel = "Confirmar", cancelLabel = "Cancelar" } = options;
  const doc = options.doc || globalThis.document;

  if (presenter) return presenter({ title, message, confirmLabel, cancelLabel });
  if (!doc || typeof doc.createElement !== "function") return false;

  return new Promise((resolve) => {
    let settled = false;
    const dialog = doc.createElement("dialog");
    dialog.className = CONFIRM_DIALOG_CLASS;
    dialog.setAttribute("aria-labelledby", `${CONFIRM_DIALOG_CLASS}-title`);

    const heading = doc.createElement("h2");
    heading.id = `${CONFIRM_DIALOG_CLASS}-title`;
    heading.textContent = title || "Confirmar ação";

    const text = doc.createElement("p");
    text.textContent = message || "Deseja continuar?";

    const actions = doc.createElement("div");
    actions.className = "unsaved-dialog-actions";

    const finish = (value) => {
      if (settled) return;
      settled = true;
      try { dialog.close?.(); } catch (_) {}
      dialog.remove?.();
      resolve(value);
    };

    const addButton = (value, label, icon, className = "") => {
      const button = doc.createElement("button");
      button.type = "button";
      button.className = `unsaved-dialog-btn ${className}`.trim();
      button.innerHTML = `<i class="${icon}" aria-hidden="true"></i> ${label}`;
      button.addEventListener("click", () => finish(value));
      actions.appendChild(button);
    };

    addButton(true, confirmLabel, "fa-solid fa-check", "is-primary");
    addButton(false, cancelLabel, "fa-solid fa-xmark");

    dialog.appendChild(heading);
    dialog.appendChild(text);
    dialog.appendChild(actions);
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault?.();
      finish(false);
    });

    (doc.body || doc.documentElement)?.appendChild(dialog);
    try {
      dialog.showModal?.();
    } catch (_) {
      dialog.setAttribute("open", "");
    }
  });
}
