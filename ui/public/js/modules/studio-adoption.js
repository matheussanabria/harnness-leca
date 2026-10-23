// @ts-check
// Liga o estado persistido da tela Studio aos controles reais (EP-14.08).
import { $ } from "../shared/dom.js";
import { state } from "../shared/state.js";
import { applySidebarWidth } from "./studio-layout.js";
import { setStudioViewport } from "./studio-companion.js";
import { setStudioSourceColumn, setStudioSourceColumnWidth } from "./studio-source-column.js";
import { switchStudioView } from "./studio-views.js";
import { restoreStudioState } from "./studio-state.js";

let initializedProject = "";
let running = null;

function currentProject() {
  return state.P?.slug || "";
}

function applySidebarWidthInDom(width) {
  const sidebar = /** @type {HTMLElement | null} */ ($("studioSidebar"));
  const resizer = /** @type {HTMLElement | null} */ ($("studioSidebarResizer"));
  if (!sidebar || !resizer) return;
  applySidebarWidth(sidebar, resizer, width, false);
}

/**
 * Restaura largura da sidebar, coluna de código, view e viewport do Studio.
 * Idempotente por projeto: chamar de novo com o mesmo projeto não repete o GET.
 * @param {{ project?: string, client?: any }} [options]
 * @returns {Promise<Record<string, unknown>>}
 */
export function initStudioAdoption(options = {}) {
  const project = options.project ?? currentProject();
  if (initializedProject === project && !options.client) return Promise.resolve({});
  if (running) return running;
  initializedProject = project;
  running = restoreStudioState({
    client: options.client,
    apply: {
      activeView: (value) => switchStudioView(String(value), { force: true }),
      sidebarWidth: (value) => applySidebarWidthInDom(Number(value)),
      sourceOpen: (value) => setStudioSourceColumn(Boolean(value)),
      sourceWidth: (value) => setStudioSourceColumnWidth(Number(value)),
      viewport: (value) => setStudioViewport(String(value)),
    },
  }).finally(() => {
    running = null;
  });
  return running;
}

/** Reseta a hidratação (troca de projeto ou testes). */
export function resetStudioAdoption() {
  initializedProject = "";
  running = null;
}
