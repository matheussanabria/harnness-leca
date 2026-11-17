// @ts-check
// Studio column for Scrum stories (chat | preview | stories): opens the same interactive board used in the office,
// so stories can be moved, detailed and blocked without leaving the Studio.
import { $ } from "../shared/dom.js";
import { state } from "../shared/state.js";
import { mountScrumBoard } from "../office/scrum-board/scrum-board.js";
import { ds } from "./design-scrum-store.js";
import { ensureStoriesResizer } from "./studio-stories-resizer.js";

const COLUMN_ID = "studioStoriesWorkspace";
const BODY_CLASS = "studio-stories-open";

/** @returns {string} */
function activeSlug() {
  return state.P?.slug || state.activeProject || "";
}

/** Slug whose board is currently mounted; a project switch remounts it on the next render. */
let mountedSlug = "";

export function isStudioStoriesColumnOpen() {
  return document.body.classList.contains(BODY_CLASS);
}

function ensureColumn() {
  const host = $("studioWorkspace");
  if (!host) return null;
  let pane = $(COLUMN_ID);
  if (pane) return pane;
  pane = document.createElement("section");
  pane.id = COLUMN_ID;
  pane.className = "studio-stories-col";
  pane.setAttribute("aria-label", "Histórias do Scrum");
  pane.innerHTML = `
    <header class="studio-stories-head">
      <strong><i class="fa-solid fa-list-check" aria-hidden="true"></i> Histórias</strong>
      <span id="studioStoriesSubtitle" class="studio-stories-subtitle"></span>
      <button type="button" class="btn-vp btn-vp-icon" id="btnStudioStoriesClose" title="Fechar histórias" aria-label="Fechar histórias"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
    </header>
    <div id="studioStoriesBody" class="studio-stories-body"></div>`;
  host.appendChild(pane);
  const close = pane.querySelector("#btnStudioStoriesClose");
  if (close instanceof HTMLElement) close.onclick = () => setStudioStoriesColumn(false);
  return pane;
}

/** Mounts (or remounts) the board for the active project inside the column body. */
export async function renderStudioStories() {
  const body = $("studioStoriesBody");
  const slug = activeSlug();
  if (!body) return;
  if (!slug) {
    body.innerHTML = '<p class="sb-empty">Selecione um projeto para ver as histórias.</p>';
    mountedSlug = "";
    return;
  }
  mountedSlug = slug;
  await mountScrumBoard(body, slug, {
    publish: (scrum) => {
      state.scrumData = scrum;
      window.dispatchEvent(new CustomEvent("dai:scrumChanged", { detail: { slug, scrum } }));
    },
    onSendToChat: (story) => /** @type {any} */ (window).sendStoryToChat?.(story),
    onEdit: (story) => {
      ds.currentScrumData = state.scrumData || ds.currentScrumData;
      /** @type {any} */ (window).openEditStoryModal?.(story);
    },
    onSubtitle: (text) => {
      const subtitle = $("studioStoriesSubtitle");
      if (subtitle) subtitle.textContent = text;
    },
  });
}

/** @param {boolean} open */
export function setStudioStoriesColumn(open) {
  document.body.classList.toggle(BODY_CLASS, open);
  $("btnViewStories")?.classList.toggle("active", open);
  $("btnViewStories")?.setAttribute("aria-pressed", String(open));
  if (!open) return;
  if (!ensureColumn()) return;
  ensureStoriesResizer();
  void renderStudioStories();
}

/** Called when the active project changes: keeps an open column in sync with the new project. */
export function syncStudioStoriesProject() {
  if (isStudioStoriesColumnOpen() && mountedSlug !== activeSlug()) void renderStudioStories();
}
