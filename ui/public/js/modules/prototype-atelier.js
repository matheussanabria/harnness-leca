// @ts-check
import { $, showToast } from "../shared/dom.js";
import { renderNodeEditForm } from "./prototype-edit-panel.js";
import { applyEdit } from "./prototype-edit-api.js";
import { setAtelierChatContext } from "./prototype-chat-bridge.js";
import { initWorkspaceLayout } from "./prototype-workspace-layout.js";
import { initLayerTree } from "./prototype-layer-tree.js";
import { bindPrototypeCatalog, buildPrototypeCatalog } from "./prototype-catalog.js";
import { bindComponentCatalog, renderComponentSection } from "./prototype-component-catalog.js";
import { openComponentModal } from "./prototype-component-modal.js";
import { renderAtelierHtml, renderScreenOptions, renderVersions } from "./prototype-atelier-view.js";
import { attachStudioSidebarToAtelier, detachStudioSidebarFromAtelier } from "./prototype-atelier-sidebar.js";
import { bindCanvasMode, canvasPost, canvasReload, canvasSetInspector } from "./prototype-atelier-canvas.js";
import { mountHistory, refreshHistorySoon } from "./prototype-history-panel.js";
import { bindInspectorToggle, singleScreenMode } from "./prototype-inspector-toggle.js";
import { bindInspectorTabs } from "./prototype-atelier-inspector-tabs.js";
import { applyAtelierLayout, beginAtelierAdoption, bindAtelierLayout, persistAtelierActive, persistAtelierInspector, persistAtelierScreen, persistAtelierViewport, restoredAtelierNode, restoredAtelierScreen, restoredAtelierViewport } from "./prototype-atelier-adoption.js";
import { selectSingle, onMultiClick, bindSelectionBar, installHistoryKeys } from "./prototype-atelier-multi.js";
import { setupBridgeListener } from "./prototype-atelier-messages.js";
import { ctx, host } from "./prototype-atelier-ctx.js";
import { setChatArtifact } from "./chat-scope.js";

Object.assign(host, { post: postToPrototype, reload: reloadIframe, details: renderSelectedNodeDetails, move: moveElement, tree: renderLayerTree });

export async function renderPrototypeAtelier(container, slug, protoId, options = {}) {
  ctx.slug = slug;
  ctx.protoId = protoId;
  const legacyList = Array.isArray(options) ? options : [];
  ctx.list = Array.isArray(options.catalog) ? options.catalog : legacyList;
  ctx.options = {
    components: options.components || [],
    mcpServer: options.mcpServer || "",
    onSelect: typeof options.onSelect === "function" ? options.onSelect : null,
    onDelete: typeof options.onDelete === "function" ? options.onDelete : null,
  };
  // Primeira montagem da página reabre o protótipo salvo, quando ele ainda existe.
  const adoption = await beginAtelierAdoption({ protoId, catalog: ctx.list, onSelect: ctx.options.onSelect });
  if (adoption.redirect) return;

  // Devolve o chat ao Studio antes de o innerHTML apagar o #atelierChatHost (senão o chat some).
  detachStudioSidebarFromAtelier();
  container.innerHTML = '<div class="proto-loading"><i class="fa-solid fa-spinner fa-spin"></i> Carregando Ateliê...</div>';

  try {
    const [prototypeResponse, versionsResponse, listResponse] = await Promise.all([
      fetch(`/api/project/${encodeURIComponent(slug)}/design/prototypes/${encodeURIComponent(protoId)}`),
      fetch(`/api/project/${encodeURIComponent(slug)}/design/prototypes/${encodeURIComponent(protoId)}/versions`),
      ctx.list.length ? Promise.resolve(null) : fetch(`/api/project/${encodeURIComponent(slug)}/design/prototypes`),
    ]);
    if (!prototypeResponse.ok) {
      container.innerHTML = '<div class="proto-error"><i class="fa-solid fa-triangle-exclamation"></i> Protótipo não encontrado.</div>';
      return;
    }
    ctx.data = (await prototypeResponse.json()).prototype || {};
    ctx.screen = restoredAtelierScreen(
      ctx.data.screens || [],
      ctx.data.activeScreen || "home",
    );
    ctx.viewportWidth = restoredAtelierViewport();
    if (versionsResponse.ok) ctx.versions = (await versionsResponse.json()).versions || [];
    if (listResponse?.ok) ctx.list = buildPrototypeCatalog([], (await listResponse.json()).prototypes || []);
    ctx.components = await fetchPrototypeComponents();
    renderAtelierLayout(container);
    setupBridgeListener();
  } catch {
    container.innerHTML = '<div class="proto-error"><i class="fa-solid fa-triangle-exclamation"></i> Erro ao carregar protótipo.</div>';
  }
}

function renderAtelierLayout(container) {
  detachStudioSidebarFromAtelier();
  container.innerHTML = renderAtelierHtml({
    slug: ctx.slug,
    prototypeId: ctx.protoId,
    prototype: ctx.data,
    activeScreen: ctx.screen,
    viewportWidth: ctx.viewportWidth,
    versions: ctx.versions,
    catalog: ctx.list,
    protoComponents: ctx.components,
    mcpServer: ctx.options.mcpServer,
  });
  const root = $("protoWorkspaceRoot");
  if (root) {
    initWorkspaceLayout(root);
    applyAtelierLayout(root);
    bindAtelierLayout();
  }
  ctx.pendingPid = restoredAtelierNode();
  const catalog = document.querySelector(".proto-col-catalog");
  if (catalog) bindPrototypeCatalog(catalog, navigateCatalog, ctx.options.onDelete);
  if (catalog) bindComponentCatalog(catalog, {
    onLocate: locateComponent,
    onPreview: (componentId) => openComponentModal(ctx.slug, componentId),
  });
  attachStudioSidebarToAtelier();
  setChatArtifact("prototypes", ctx.protoId);
  setAtelierChatContext({
    slug: ctx.slug,
    protoId: ctx.protoId,
    getScreen: () => ctx.screen,
    // Atualiza a tela sem reescrever o layout: o chat e o inspetor permanecem no lugar.
    reload: () => void refreshAtelierPreview(),
    focusScreen: (id) => { ctx.screen = id; persistAtelierScreen(id); },
    mcpServer: ctx.options.mcpServer,
  });
  bindAtelierEvents(container);
  mountHistory({ slug: ctx.slug, protoId: ctx.protoId, onMoved: refreshAtelierPreview });
  bindSelectionBar();
  installHistoryKeys();
  persistAtelierActive(ctx.protoId, ctx.screen);
}

/** Recarrega dados e preview do protótipo mantendo o DOM do Ateliê (e o chat) intacto. */
async function refreshAtelierPreview() {
  try {
    const base = `/api/project/${encodeURIComponent(ctx.slug)}/design/prototypes/${encodeURIComponent(ctx.protoId)}`;
    const [prototypeResponse, versionsResponse] = await Promise.all([fetch(base), fetch(`${base}/versions`)]);
    if (prototypeResponse.ok) ctx.data = (await prototypeResponse.json()).prototype || ctx.data;
    if (versionsResponse.ok) ctx.versions = (await versionsResponse.json()).versions || [];
    const screens = ctx.data?.screens || [{ id: "home", title: "Início" }];
    if (!screens.some((screen) => screen.id === ctx.screen)) {
      if (!screens.some((s) => s.id === ctx.screen) && ctx.screen && ctx.screen !== "home") {
        screens.push({ id: ctx.screen, title: ctx.screen, file: `screens/${ctx.screen}.html` });
      } else
      ctx.screen = ctx.data?.activeScreen || screens[0]?.id || "home";
    }
    const select = /** @type {HTMLSelectElement} */ ($("atelierScreenSelect"));
    if (select) select.innerHTML = renderScreenOptions(screens, ctx.screen);
    const versionBadge = $("atelierProtoVersionBadge");
    if (versionBadge) versionBadge.textContent = `v${ctx.data?.version || 1}`;
    const versionsList = $("atelierVersionsList");
    if (versionsList) {
      versionsList.innerHTML = renderVersions(ctx.versions, ctx.data?.version);
      bindVersionRestore();
    }
    ctx.components = await fetchPrototypeComponents();
    const section = document.getElementById("protoComponentsSection");
    if (section) section.outerHTML = renderComponentSection(ctx.components, ctx.options.mcpServer);
    ctx.pendingPid = "";
    ctx.multi = { pids: [], anchor: "" };
    reloadIframe();
    refreshHistorySoon();
  } catch {
    reloadIframe();
  }
}

function navigateCatalog(id, kind) {
  if (ctx.options.onSelect) ctx.options.onSelect(id, kind);
}

/** Componentes do DS usados pelo protótipo; sem a rota ou sem rede, a seção fica vazia. */
async function fetchPrototypeComponents() {
  try {
    const res = await fetch(`/api/project/${encodeURIComponent(ctx.slug)}/design/prototypes/${encodeURIComponent(ctx.protoId)}/components`);
    if (!res.ok) return { components: [] };
    return await res.json();
  } catch {
    return { components: [] };
  }
}

/** Leva ao componente: destaca a instância na tela atual ou navega até a primeira tela que a usa. */
function locateComponent(componentId) {
  const comp = (ctx.components.components || []).find((c) => c.id === componentId);
  const target = comp?.screens.find((s) => s.screenId === ctx.screen && s.pids.length)
    || comp?.screens.find((s) => s.pids.length)
    || comp?.screens[0];
  if (!target) { showToast("This component has no linked documentation screen."); return; }
  const pid = target.pids[0] || "";
  if (target.screenId === ctx.screen) {
    if (pid) postToPrototype({ type: "HARNESS_PROTO_SELECT_BY_PID", pid });
    else reloadIframe();
    return;
  }
  ctx.screen = target.screenId;
  const select = /** @type {HTMLSelectElement} */ ($("atelierScreenSelect"));
  if (select) select.value = target.screenId;
  ctx.pendingPid = pid || null;
  reloadIframe();
}

function bindAtelierEvents(container) {
  const screenSelect = /** @type {HTMLSelectElement} */ ($("atelierScreenSelect"));
  if (screenSelect) screenSelect.onchange = () => {
    ctx.screen = screenSelect.value;
    persistAtelierScreen(ctx.screen);
    reloadIframe();
  };
  document.querySelectorAll(".btn-viewport").forEach((button) => {
    button.addEventListener("click", () => selectViewport(/** @type {HTMLElement} */ (button)));
  });
  const reloadButton = $("btnReloadProtoFrame");
  if (reloadButton) reloadButton.onclick = reloadIframe;
  const createButton = $("btnAtelierCreateProto");
  if (createButton) createButton.onclick = () => window.promptCreateNewPrototype?.(container, ctx.slug);
  bindInspectorTabs();
  bindVersionRestore();
  bindInspectorToggle((on) => {
    persistAtelierInspector(on);
    applyInspector(on);
  });
  bindCanvasMode({
    slug: ctx.slug,
    protoId: ctx.protoId,
    screens: () => ctx.data.screens || [{ id: "home", title: "Início" }],
    viewportWidth: () => ctx.viewportWidth,
    getScreen: () => ctx.screen,
    onScreen: selectCanvasScreen,
  });
}

function applyInspector(on) {
  if (canvasSetInspector(on)) return;
  const iframe = /** @type {HTMLIFrameElement} */ ($("atelierIframe"));
  iframe?.contentWindow?.postMessage({ type: "HARNESS_PROTO_MODE", mode: singleScreenMode() }, "*");
}

function selectCanvasScreen(screen) {
  if (screen !== ctx.screen) {
    ctx.screen = screen;
    const select = /** @type {HTMLSelectElement} */ ($("atelierScreenSelect"));
    if (select) select.value = screen;
    persistAtelierScreen(ctx.screen);
  }
  setTimeout(() => postToPrototype({ type: "HARNESS_PROTO_REQUEST_TREE" }), 0);
}

function selectViewport(button) {
  document.querySelectorAll(".btn-viewport").forEach((item) => item.classList.remove("active"));
  button.classList.add("active");
  ctx.viewportWidth = Number.parseInt(button.dataset.w || "1280", 10);
  const frame = $("atelierFrameContainer");
  if (frame) frame.style.width = `${ctx.viewportWidth}px`;
  persistAtelierViewport(ctx.viewportWidth);
}

function bindVersionRestore() {
  document.querySelectorAll(".btn-restore-version").forEach((button) => {
    button.addEventListener("click", async () => {
      const version = /** @type {HTMLElement} */ (button).dataset.ver;
      if (!confirm(`Deseja restaurar a versão v${version}?`)) return;
      try {
        const response = await fetch(`/api/project/${encodeURIComponent(ctx.slug)}/design/prototypes/${encodeURIComponent(ctx.protoId)}/versions/${version}/restore`, { method: "POST", headers: { "Content-Type": "application/json" } });
        showToast(response.ok ? `Versão v${version} restaurada.` : "Erro ao restaurar versão.");
        if (response.ok) await refreshAtelierPreview();
      } catch {
        showToast("Falha na requisição de restauração.");
      }
    });
  });
}

function renderLayerTree(treeData) {
  const container = $("atelierLayerTreeContainer");
  if (!container || !treeData) return;
  initLayerTree(
    treeData,
    container,
    (pid, mods) => (mods && (mods.ctrl || mods.shift) ? onMultiClick(pid, mods) : selectSingle(pid)),
    (pid) => postToPrototype({ type: "HARNESS_PROTO_TOGGLE_VISIBILITY", pid }),
    (pid) => postToPrototype({ type: "HARNESS_PROTO_TOGGLE_LOCK", pid }),
    (pid, targetPid, position) => void moveElement(pid, targetPid, position),
  );
}

/** Reordena um elemento (arrastar no canvas ou na árvore): grava no HTML e recarrega mantendo a seleção. */
async function moveElement(pid, targetPid, position) {
  const res = await applyEdit({ slug: ctx.slug, protoId: ctx.protoId, screenId: ctx.screen, pid, op: { type: "moveTo", targetPid, position } });
  if (!res.ok) { showToast(`Não foi possível mover: ${res.error}`); return; }
  ctx.pendingPid = pid;
  reloadIframe();
  refreshHistorySoon();
}

function postToPrototype(message) {
  if (canvasPost(message)) return;
  const iframe = /** @type {HTMLIFrameElement} */ ($("atelierIframe"));
  iframe?.contentWindow?.postMessage(message, "*");
}

function reloadIframe() {
  if (canvasReload()) return;
  const iframe = /** @type {HTMLIFrameElement} */ ($("atelierIframe"));
  if (iframe) iframe.src = `/api/project/${encodeURIComponent(ctx.slug)}/design/prototypes/${encodeURIComponent(ctx.protoId)}/render/${encodeURIComponent(ctx.screen)}`;
}

function renderSelectedNodeDetails() {
  const panel = $("atelierNodeDetails");
  if (panel && ctx.node) renderNodeEditForm(panel, ctx.slug, ctx.protoId, ctx.screen, ctx.node, reloadIframe, { post: postToPrototype, getScreen: () => ctx.screen, reselect: (pid) => { ctx.pendingPid = pid; reloadIframe(); } });
}
