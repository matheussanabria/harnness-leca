// @ts-check
// Three-column workspace of the Canvas Design views (EP-19.06): board catalog | chat dock | embedded editor.
// It reuses the Atelier layout: same classes, same ids (#protoWorkspaceRoot, #atelierChatHost) and the same helpers,
// so resizing, collapsing and the Studio chat dock behave exactly like in the prototypes view.
import { getIslandLoader } from "../shared/island-loader.js";
import { createCanvasApi } from "./design-canvas-api.js";
import { mountCanvasCatalog } from "./design-canvas-catalog.js";
import { setCanvasChatContext } from "./canvas-chat-bridge.js";
import { setChatArtifact } from "./chat-scope.js";
import { attachStudioSidebarToAtelier, parkStudioSidebar } from "./prototype-atelier-sidebar.js";
import { initWorkspaceLayout } from "./prototype-workspace-layout.js";

/** @type {Record<string, { kind: "mindmap" | "board", icon: string, rail: string, title: string }>} */
const VIEWS = {
  "canvas-mindmap": { kind: "mindmap", icon: "fa-sitemap", rail: "Mapas mentais", title: "Mapa mental" },
  "canvas-board": { kind: "board", icon: "fa-chalkboard", rail: "Quadros", title: "Quadro livre" },
};

/** Board open in each view, kept while the page lives so switching tabs returns to the same board. */
const selection = new Map();

/** @param {string} panel @param {string} icon @param {string} title @param {string} buttonIcon */
function panelRail(panel, icon, title, buttonIcon) {
  return `<div class="proto-panel-rail"><button type="button" class="proto-panel-action-btn btn-expand-panel" data-panel="${panel}" title="Expandir"><i class="fa-solid ${buttonIcon}"></i></button><span class="rail-title-vertical"><i class="fa-solid ${icon}"></i> ${title}</span></div>`;
}

/** @param {string} view */
export function canvasWorkspaceHtml(view) {
  const info = VIEWS[view];
  return `
    <div id="protoWorkspaceRoot" class="proto-workspace-root canvas-workspace">
      <div class="proto-col-catalog">
        <div class="proto-panel-normal" id="canvasCatalogHost"></div>
        ${panelRail("catalog", info.icon, info.rail, "fa-chevron-right")}
      </div>
      <div class="proto-resizer" data-target="catalog" data-dir="left"></div>
      <div class="proto-col-chat">
        <div class="proto-panel-normal">
          <div class="proto-panel-header">
            <span class="proto-panel-title"><i class="fa-solid fa-comments"></i> Chat com IA</span>
            <div class="proto-panel-actions">
              <button type="button" class="proto-panel-action-btn" onclick="minimizeCurrentChat('atelier')" title="Minimizar"><i class="fa-solid fa-window-minimize"></i></button>
              <button type="button" class="proto-panel-action-btn btn-collapse-panel" data-panel="chat" title="Recolher"><i class="fa-solid fa-chevron-left"></i></button>
            </div>
          </div>
          <div id="atelierChatHost" class="proto-chat-host"></div>
        </div>
        ${panelRail("chat", "fa-comments", "Chat IA", "fa-comments")}
      </div>
      <div class="proto-resizer" data-target="chat" data-dir="left"></div>
      <div class="proto-col-preview canvas-stage" id="canvasStage"></div>
    </div>`;
}

/**
 * Renders the workspace into the Design container and mounts the editor island for the selected board.
 * @param {HTMLElement} container @param {string} view @param {string} slug
 */
export async function renderCanvasWorkspace(container, view, slug) {
  const info = VIEWS[view];
  const loader = getIslandLoader();
  if (!info || !loader) return false;
  loader.unmount();
  parkStudioSidebar(); // replacing the markup below would delete the chat if it were still inside the old host
  container.innerHTML = canvasWorkspaceHtml(view);
  const root = /** @type {HTMLElement} */ (container.querySelector("#protoWorkspaceRoot"));
  const stage = /** @type {HTMLElement} */ (container.querySelector("#canvasStage"));
  const catalogHost = /** @type {HTMLElement} */ (container.querySelector("#canvasCatalogHost"));
  initWorkspaceLayout(root);
  attachStudioSidebarToAtelier();
  // Both canvas kinds understand chat answers: <mindmap> outlines and <board> Mermaid diagrams.
  setCanvasChatContext({ kind: info.kind, slug });

  const api = createCanvasApi(slug);
  const key = `${slug}:${view}`;
  /** @param {string | null} id */
  const open = (id) => {
    selection.set(key, id || "");
    setChatArtifact(view, id);
    void loader.mount(view, { slug, params: id ? [id] : [] }, stage);
  };
  const catalog = mountCanvasCatalog(catalogHost, {
    slug, kind: info.kind, api,
    getSelectedId: () => selection.get(key) || "",
    onSelect: (id) => { open(id); catalog.refresh(); },
    onChange: () => {},
  });
  let current = selection.get(key) || "";
  if (!current) {
    try { current = (await api.list(info.kind))[0]?.id || ""; } catch { current = ""; }
  }
  open(current || null);
  catalog.refresh();
  return true;
}
