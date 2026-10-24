// @ts-check
/**
 * Office HUD workspace menu.
 * Single responsibility: render the workspace list and call windowManager.workspaces.
 */

import { requestConfirmation } from "../shared/confirm-dialog.js";
import { guardUnsavedTransition } from "../shared/unsaved-dialog.js";
import { unsavedChanges } from "../shared/unsaved-changes.js";

export const WORKSPACE_NAME_MAX_LENGTH = 40;

/**
 * @param {ReadonlyArray<any>} workspaces
 * @returns {Array<{ id: string, name: string, icon: string, deletable: boolean }>}
 */
export function workspaceMenuItems(workspaces = []) {
  return workspaces.map((workspace) => ({
    id: String(workspace?.id || ""),
    name: String(workspace?.name || ""),
    icon: String(workspace?.icon || "fa-solid fa-shapes"),
    deletable: workspace?.isSystem !== true
  }));
}

/** @param {unknown} value */
export function normalizeWorkspaceName(value) {
  return String(value ?? "").trim().slice(0, WORKSPACE_NAME_MAX_LENGTH);
}

/**
 * @param {{
 *   container: HTMLElement,
 *   windowManager: any,
 *   getProjectSlug: () => string,
 *   onError?: (message: string) => void
 * }} options
 */
export function mountWorkspaceMenu({ container, windowManager, getProjectSlug, onError }) {
  if (!container) return { dispose() {} };

  const doc = container.ownerDocument || globalThis.document;
  const trigger = doc.createElement("button");
  trigger.type = "button";
  trigger.className = "workspace-menu-trigger";
  trigger.setAttribute("aria-haspopup", "true");
  trigger.setAttribute("aria-expanded", "false");
  trigger.innerHTML = '<i class="fa-solid fa-layer-group" aria-hidden="true"></i><span>Workspaces</span>';

  const panel = doc.createElement("div");
  panel.className = "workspace-menu-panel";
  panel.hidden = true;
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Workspaces do projeto");

  const list = doc.createElement("div");
  list.className = "workspace-menu-list";

  const saveRow = doc.createElement("div");
  saveRow.className = "workspace-menu-save";
  const input = doc.createElement("input");
  input.type = "text";
  input.maxLength = WORKSPACE_NAME_MAX_LENGTH;
  input.placeholder = "Nome do layout";
  input.setAttribute("aria-label", "Nome do novo workspace");
  const saveButton = doc.createElement("button");
  saveButton.type = "button";
  saveButton.className = "workspace-menu-save-btn";
  saveButton.innerHTML = '<i class="fa-solid fa-floppy-disk" aria-hidden="true"></i><span>Salvar</span>';
  saveRow.append(input, saveButton);

  const status = doc.createElement("p");
  status.className = "workspace-menu-status";
  status.setAttribute("role", "status");
  status.hidden = true;

  panel.append(list, saveRow, status);
  container.append(trigger, panel);

  const report = (message) => {
    status.textContent = message;
    status.hidden = false;
    onError?.(message);
  };

  const project = () => getProjectSlug() || "";

  const close = () => {
    panel.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
  };

  const open = () => {
    panel.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
    input.focus();
  };

  const saveStudio = () => (
    typeof globalThis.saveStudioSourceFile === "function"
      ? () => globalThis.saveStudioSourceFile()
      : undefined
  );

  const loadWorkspace = async (workspaceId) => {
    try {
      const loaded = await guardUnsavedTransition(async ({ force }) => (
        windowManager.workspaces.load(workspaceId, undefined, project(), { force })
      ), {
        title: "Carregar workspace",
        message: "Há alterações não salvas. Como deseja continuar?",
        save: saveStudio(),
        clear: (id) => unsavedChanges.clear(id)
      });
      if (loaded) close();
      else report("Não foi possível carregar o workspace.");
    } catch (error) {
      report(error instanceof Error ? error.message : "Falha ao carregar workspace.");
    }
  };

  const deleteWorkspace = async (workspaceId, name) => {
    const confirmed = await requestConfirmation({
      title: "Excluir workspace",
      message: `Excluir o workspace "${name}"? Esta ação não pode ser desfeita.`,
      confirmLabel: "Excluir"
    });
    if (!confirmed) return;
    const deleted = windowManager.workspaces.delete(workspaceId, project());
    if (!deleted) report("Templates do sistema não podem ser excluídos.");
  };

  const render = () => {
    list.replaceChildren();
    const items = workspaceMenuItems(windowManager.workspaces.list(project()));
    for (const item of items) {
      const row = doc.createElement("div");
      row.className = "workspace-menu-item";

      const load = doc.createElement("button");
      load.type = "button";
      load.className = "workspace-menu-load";
      const icon = doc.createElement("i");
      icon.className = item.icon;
      icon.setAttribute("aria-hidden", "true");
      const label = doc.createElement("span");
      label.textContent = item.name;
      load.append(icon, label);
      load.addEventListener("click", () => { void loadWorkspace(item.id); });
      row.appendChild(load);

      if (item.deletable) {
        const remove = doc.createElement("button");
        remove.type = "button";
        remove.className = "workspace-menu-delete";
        remove.setAttribute("aria-label", `Excluir ${item.name}`);
        remove.innerHTML = '<i class="fa-solid fa-trash-can" aria-hidden="true"></i>';
        remove.addEventListener("click", () => { void deleteWorkspace(item.id, item.name); });
        row.appendChild(remove);
      }
      list.appendChild(row);
    }
  };

  const saveWorkspace = () => {
    const name = normalizeWorkspaceName(input.value);
    if (!name) {
      report("Informe um nome para o workspace.");
      return;
    }
    const saved = windowManager.workspaces.save(name, "fa-solid fa-shapes", project());
    if (!saved) {
      report("Não foi possível salvar o workspace.");
      return;
    }
    input.value = "";
    status.hidden = true;
  };

  trigger.addEventListener("click", () => (panel.hidden ? open() : close()));
  saveButton.addEventListener("click", saveWorkspace);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") saveWorkspace();
  });
  const onDocumentClick = (event) => {
    if (!container.contains(/** @type {Node} */ (event.target))) close();
  };
  const onKeydown = (event) => {
    if (event.key === "Escape") close();
  };
  doc.addEventListener("click", onDocumentClick);
  doc.addEventListener("keydown", onKeydown);

  const unsubscribe = windowManager.workspaces.subscribe(render);
  render();

  return {
    dispose() {
      unsubscribe?.();
      doc.removeEventListener("click", onDocumentClick);
      doc.removeEventListener("keydown", onKeydown);
      trigger.remove();
      panel.remove();
    }
  };
}
