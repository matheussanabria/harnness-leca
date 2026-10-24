// @ts-check
/**
 * Unsaved-changes dialog and transition guard.
 * Single responsibility: turn UNSAVED_CHANGES blockers into a Save/Discard/Cancel decision.
 */

import { UNSAVED_CHANGES_ERROR } from "./unsaved-changes.js";

export const UNSAVED_DIALOG_CLASS = "unsaved-dialog";
const MAX_LABEL_LENGTH = 120;

/** @type {((payload: { blockers: ReadonlyArray<any>, title?: string, message?: string, canSave?: boolean }) => Promise<"save" | "discard" | "cancel">) | null} */
let presenter = null;

/** @param {typeof presenter} next */
export function setUnsavedDialogPresenter(next) {
  presenter = typeof next === "function" ? next : null;
}

export function resetUnsavedDialogPresenter() {
  presenter = null;
}

/** @param {unknown} value */
function normalizeLabel(value) {
  return String(value ?? "").trim().slice(0, MAX_LABEL_LENGTH);
}

/**
 * @param {{
 *   blockers?: ReadonlyArray<{ id?: string, label?: string }>,
 *   title?: string,
 *   message?: string,
 *   canSave?: boolean,
 *   doc?: Document
 * }} [options]
 * @returns {Promise<"save" | "discard" | "cancel">}
 */
export async function requestUnsavedResolution(options = {}) {
  const { blockers = [], title, message, canSave = true } = options;
  const doc = options.doc || globalThis.document;

  if (presenter) return presenter({ blockers, title, message, canSave });
  if (!doc || typeof doc.createElement !== "function") return "cancel";

  return new Promise((resolve) => {
    let settled = false;
    const dialog = doc.createElement("dialog");
    dialog.className = UNSAVED_DIALOG_CLASS;
    dialog.setAttribute("aria-labelledby", `${UNSAVED_DIALOG_CLASS}-title`);

    const heading = doc.createElement("h2");
    heading.id = `${UNSAVED_DIALOG_CLASS}-title`;
    heading.textContent = title || "Alterações não salvas";

    const text = doc.createElement("p");
    text.textContent = message || "Existem alterações não salvas que impedem a troca de contexto.";

    const list = doc.createElement("ul");
    list.className = "unsaved-dialog-blockers";
    for (const blocker of blockers) {
      const item = doc.createElement("li");
      item.textContent = normalizeLabel(blocker?.label || blocker?.id || "Alteração não salva");
      list.appendChild(item);
    }

    const actions = doc.createElement("div");
    actions.className = "unsaved-dialog-actions";

    const finish = (choice) => {
      if (settled) return;
      settled = true;
      try { dialog.close?.(); } catch (_) {}
      dialog.remove?.();
      resolve(choice);
    };

    const addButton = (choice, label, icon, className = "") => {
      const button = doc.createElement("button");
      button.type = "button";
      button.className = `unsaved-dialog-btn ${className}`.trim();
      button.innerHTML = `<i class="${icon}" aria-hidden="true"></i> ${label}`;
      button.addEventListener("click", () => finish(choice));
      actions.appendChild(button);
    };

    if (canSave) addButton("save", "Salvar", "fa-solid fa-floppy-disk", "is-primary");
    addButton("discard", "Descartar", "fa-solid fa-trash-can", "is-danger");
    addButton("cancel", "Cancelar", "fa-solid fa-xmark");

    dialog.appendChild(heading);
    dialog.appendChild(text);
    if (blockers.length) dialog.appendChild(list);
    dialog.appendChild(actions);
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault?.();
      finish("cancel");
    });

    (doc.body || doc.documentElement)?.appendChild(dialog);
    try {
      dialog.showModal?.();
    } catch (_) {
      dialog.setAttribute("open", "");
    }
  });
}

/**
 * Applies a decision before retrying a transition.
 * @param {"save" | "discard" | "cancel"} choice
 * @param {{
 *   blockers?: ReadonlyArray<{ id?: string }>,
 *   save?: () => unknown,
 *   clear?: (id: string) => void
 * }} [options]
 * @returns {Promise<boolean>} true when the transition may proceed
 */
export async function applyUnsavedChoice(choice, options = {}) {
  if (choice === "cancel") return false;
  if (choice === "save") {
    if (typeof options.save !== "function") return false;
    const result = await options.save();
    return result !== false;
  }
  if (choice === "discard") {
    for (const blocker of options.blockers || []) {
      if (blocker?.id) options.clear?.(blocker.id);
    }
    return true;
  }
  return false;
}

/**
 * Runs a transition and resolves UNSAVED_CHANGES with the shared dialog.
 * @param {(context: { force: boolean }) => Promise<any>} transition
 * @param {{
 *   save?: () => unknown,
 *   clear?: (id: string) => void,
 *   title?: string,
 *   message?: string,
 *   requestDecision?: typeof requestUnsavedResolution
 * }} [options]
 * @returns {Promise<any>} transition result, or false when cancelled
 */
export async function guardUnsavedTransition(transition, options = {}) {
  try {
    return await transition({ force: false });
  } catch (error) {
    if (!error || error.code !== UNSAVED_CHANGES_ERROR) throw error;
    const blockers = Array.isArray(error.blockers) ? error.blockers : [];
    const decide = options.requestDecision || requestUnsavedResolution;
    const choice = await decide({
      blockers,
      title: options.title,
      message: options.message,
      canSave: typeof options.save === "function"
    });
    const proceed = await applyUnsavedChoice(choice, {
      blockers,
      save: options.save,
      clear: options.clear
    });
    if (!proceed) return false;
    return await transition({ force: true });
  }
}
