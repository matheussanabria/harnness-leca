// @ts-check
import { $, showToast } from "../shared/dom.js";
import { renderNodeEditForm } from "./prototype-edit-panel.js";
import { updatePropsMetrics } from "./prototype-props-panel.js";
import { applyEdit, applyStructural } from "./prototype-edit-api.js";
import { applyClick, canGroup, groupShortcut, isGroupNode, selectionLabel } from "./prototype-multiselect-model.js";
import { setAtelierChatContext } from "./prototype-chat-bridge.js";
import { initWorkspaceLayout } from "./prototype-workspace-layout.js";
import { initLayerTree, selectLayerNode, setLayerMulti } from "./prototype-layer-tree.js";
import { bindPrototypeCatalog, buildPrototypeCatalog } from "./prototype-catalog.js";
import { bindComponentCatalog, renderComponentSection } from "./prototype-component-catalog.js";
import { openComponentModal } from "./prototype-component-modal.js";
import { renderAtelierHtml, renderScreenOptions, renderVersions } from "./prototype-atelier-view.js";
import { attachStudioSidebarToAtelier, detachStudioSidebarFromAtelier } from "./prototype-atelier-sidebar.js";
import { renderElementMapping } from "./prototype-element-map.js";
import { bindCanvasMode, canvasHandleMessage, canvasPost, canvasReload, canvasSetInspector } from "./prototype-atelier-canvas.js";
import { mountHistory, refreshHistorySoon, runHistory } from "./prototype-history-panel.js";
import { historyShortcut, isEditableTarget } from "./prototype-history-model.js";
import { bindInspectorToggle, isInspectorOn, singleScreenMode } from "./prototype-inspector-toggle.js";

let currentSlug = "";
let currentProtoId = "";
let currentActiveScreen = "home";
let currentProtoData = null;
let currentVersions = [];
/** Componentes do DS usados pelas telas deste protótipo (GET .../prototypes/:id/components). */
let protoComponents = { components: [] };
let selectedNode = null;
let activeViewportWidth = 1280;
let allPrototypesList = [];
let atelierOptions = { components: [], mcpServer: "", onSelect: null, onDelete: null };
let bridgeListenerInstalled = false;
let pendingSelectPid = "";
let historyKeysInstalled = false;
let currentTree = [];
/** Seleção múltipla: `pids` (vazio = seleção simples) e `anchor` (início do intervalo do Shift). */
let multi = { pids: [], anchor: "" };

export async function renderPrototypeAtelier(container, slug, protoId, options = {}) {
  currentSlug = slug;
  currentProtoId = protoId;
  const legacyList = Array.isArray(options) ? options : [];
  allPrototypesList = Array.isArray(options.catalog) ? options.catalog : legacyList;
  atelierOptions = {
    components: options.components || [],
    mcpServer: options.mcpServer || "",
    onSelect: typeof options.onSelect === "function" ? options.onSelect : null,
    onDelete: typeof options.onDelete === "function" ? options.onDelete : null,
  };
  // Devolve o chat ao Studio antes de o innerHTML apagar o #atelierChatHost (senão o chat some).
  detachStudioSidebarFromAtelier();
  container.innerHTML = '<div class="proto-loading"><i class="fa-solid fa-spinner fa-spin"></i> Carregando Ateliê...</div>';

  try {
    const [prototypeResponse, versionsResponse, listResponse] = await Promise.all([
      fetch(`/api/project/${encodeURIComponent(slug)}/design/prototypes/${encodeURIComponent(protoId)}`),
      fetch(`/api/project/${encodeURIComponent(slug)}/design/prototypes/${encodeURIComponent(protoId)}/versions`),
      allPrototypesList.length ? Promise.resolve(null) : fetch(`/api/project/${encodeURIComponent(slug)}/design/prototypes`),
    ]);
    if (!prototypeResponse.ok) {
      container.innerHTML = '<div class="proto-error"><i class="fa-solid fa-triangle-exclamation"></i> Protótipo não encontrado.</div>';
      return;
    }
    currentProtoData = (await prototypeResponse.json()).prototype || {};
    currentActiveScreen = currentProtoData.activeScreen || "home";
    if (versionsResponse.ok) currentVersions = (await versionsResponse.json()).versions || [];
    if (listResponse?.ok) allPrototypesList = buildPrototypeCatalog([], (await listResponse.json()).prototypes || []);
    protoComponents = await fetchPrototypeComponents();
    renderAtelierLayout(container);
    setupBridgeListener();
  } catch {
    container.innerHTML = '<div class="proto-error"><i class="fa-solid fa-triangle-exclamation"></i> Erro ao carregar protótipo.</div>';
  }
}

function renderAtelierLayout(container) {
  detachStudioSidebarFromAtelier();
  container.innerHTML = renderAtelierHtml({
    slug: currentSlug,
    prototypeId: currentProtoId,
    prototype: currentProtoData,
    activeScreen: currentActiveScreen,
    viewportWidth: activeViewportWidth,
    versions: currentVersions,
    catalog: allPrototypesList,
    protoComponents,
    mcpServer: atelierOptions.mcpServer,
  });
  const root = $("protoWorkspaceRoot");
  if (root) initWorkspaceLayout(root);
  const catalog = document.querySelector(".proto-col-catalog");
  if (catalog) bindPrototypeCatalog(catalog, navigateCatalog, atelierOptions.onDelete);
  if (catalog) bindComponentCatalog(catalog, {
    onLocate: locateComponent,
    onPreview: (componentId) => openComponentModal(currentSlug, componentId),
  });
  attachStudioSidebarToAtelier();
  setAtelierChatContext({
    slug: currentSlug,
    protoId: currentProtoId,
    getScreen: () => currentActiveScreen,
    // Atualiza a tela sem reescrever o layout: o chat e o inspetor permanecem no lugar.
    reload: () => void refreshAtelierPreview(),
    mcpServer: atelierOptions.mcpServer,
  });
  bindAtelierEvents(container);
  mountHistory({ slug: currentSlug, protoId: currentProtoId, onMoved: refreshAtelierPreview });
  bindSelectionBar();
  installHistoryKeys();
}

/** Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y no Ateliê (fora de campos de texto); o iframe repassa as teclas dele. */
function installHistoryKeys() {
  if (historyKeysInstalled) return;
  historyKeysInstalled = true;
  document.addEventListener("keydown", (event) => {
    if (!$("atelierHistoryPanel")) return;
    // Ctrl+G também vale com o foco na busca da árvore de camadas (não é uma ação de texto).
    const grouping = groupShortcut(event);
    if (grouping && (!isEditableTarget(event.target) || event.target?.id === "layerSearchInput")) {
      event.preventDefault();
      void runGroupAction(grouping);
      return;
    }
    if (isEditableTarget(event.target)) return;
    if (event.key === "Escape" && multi.pids.length) { setMulti([], multi.anchor); return; }
    if (multi.pids.length >= 2 && event.key === "Delete") { event.preventDefault(); void runBatch("remove"); return; }
    if (multi.pids.length >= 2 && (event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === "d") { event.preventDefault(); void runBatch("duplicate"); return; }
    const action = historyShortcut(event);
    if (!action) return;
    event.preventDefault();
    void runHistory(action);
  });
}

/** Recarrega dados e preview do protótipo mantendo o DOM do Ateliê (e o chat) intacto. */
async function refreshAtelierPreview() {
  try {
    const base = `/api/project/${encodeURIComponent(currentSlug)}/design/prototypes/${encodeURIComponent(currentProtoId)}`;
    const [prototypeResponse, versionsResponse] = await Promise.all([fetch(base), fetch(`${base}/versions`)]);
    if (prototypeResponse.ok) currentProtoData = (await prototypeResponse.json()).prototype || currentProtoData;
    if (versionsResponse.ok) currentVersions = (await versionsResponse.json()).versions || [];
    const screens = currentProtoData?.screens || [{ id: "home", title: "Início" }];
    if (!screens.some((screen) => screen.id === currentActiveScreen)) {
      currentActiveScreen = currentProtoData?.activeScreen || screens[0]?.id || "home";
    }
    const select = /** @type {HTMLSelectElement} */ ($("atelierScreenSelect"));
    if (select) select.innerHTML = renderScreenOptions(screens, currentActiveScreen);
    const versionBadge = $("atelierProtoVersionBadge");
    if (versionBadge) versionBadge.textContent = `v${currentProtoData?.version || 1}`;
    const versionsList = $("atelierVersionsList");
    if (versionsList) {
      versionsList.innerHTML = renderVersions(currentVersions, currentProtoData?.version);
      bindVersionRestore();
    }
    protoComponents = await fetchPrototypeComponents();
    const section = document.getElementById("protoComponentsSection");
    if (section) section.outerHTML = renderComponentSection(protoComponents, atelierOptions.mcpServer);
    pendingSelectPid = "";
    multi = { pids: [], anchor: "" };
    reloadIframe();
    refreshHistorySoon();
  } catch {
    reloadIframe();
  }
}

function navigateCatalog(id, kind) {
  if (atelierOptions.onSelect) atelierOptions.onSelect(id, kind);
}

/** Componentes do DS usados pelo protótipo; sem a rota ou sem rede, a seção fica vazia. */
async function fetchPrototypeComponents() {
  try {
    const res = await fetch(`/api/project/${encodeURIComponent(currentSlug)}/design/prototypes/${encodeURIComponent(currentProtoId)}/components`);
    if (!res.ok) return { components: [] };
    return await res.json();
  } catch {
    return { components: [] };
  }
}

/** Leva ao componente: destaca a instância na tela atual ou navega até a primeira tela que a usa. */
function locateComponent(componentId) {
  const comp = (protoComponents.components || []).find((c) => c.id === componentId);
  const target = comp?.screens.find((s) => s.screenId === currentActiveScreen && s.pids.length)
    || comp?.screens.find((s) => s.pids.length);
  if (!target) { showToast("Esta instância não tem identificador (data-pid) no HTML da tela."); return; }
  const pid = target.pids[0];
  if (target.screenId === currentActiveScreen) {
    postToPrototype({ type: "HARNESS_PROTO_SELECT_BY_PID", pid });
    return;
  }
  currentActiveScreen = target.screenId;
  const select = /** @type {HTMLSelectElement} */ ($("atelierScreenSelect"));
  if (select) select.value = target.screenId;
  pendingSelectPid = pid;
  reloadIframe();
}

function bindAtelierEvents(container) {
  const screenSelect = /** @type {HTMLSelectElement} */ ($("atelierScreenSelect"));
  if (screenSelect) screenSelect.onchange = () => {
    currentActiveScreen = screenSelect.value;
    reloadIframe();
  };
  document.querySelectorAll(".btn-viewport").forEach((button) => {
    button.addEventListener("click", () => selectViewport(/** @type {HTMLElement} */ (button)));
  });
  const reloadButton = $("btnReloadProtoFrame");
  if (reloadButton) reloadButton.onclick = reloadIframe;
  const createButton = $("btnAtelierCreateProto");
  if (createButton) createButton.onclick = () => window.promptCreateNewPrototype?.(container, currentSlug);
  bindInspectorTabs();
  bindVersionRestore();
  bindInspectorToggle(applyInspector);
  bindCanvasMode({
    slug: currentSlug,
    protoId: currentProtoId,
    screens: () => currentProtoData.screens || [{ id: "home", title: "Início" }],
    viewportWidth: () => activeViewportWidth,
    getScreen: () => currentActiveScreen,
    onScreen: selectCanvasScreen,
  });
}

function applyInspector(on) {
  if (canvasSetInspector(on)) return;
  const iframe = /** @type {HTMLIFrameElement} */ ($("atelierIframe"));
  iframe?.contentWindow?.postMessage({ type: "HARNESS_PROTO_MODE", mode: singleScreenMode() }, "*");
}

function selectCanvasScreen(screen) {
  if (screen !== currentActiveScreen) {
    currentActiveScreen = screen;
    const select = /** @type {HTMLSelectElement} */ ($("atelierScreenSelect"));
    if (select) select.value = screen;
  }
  setTimeout(() => postToPrototype({ type: "HARNESS_PROTO_REQUEST_TREE" }), 0);
}

function selectViewport(button) {
  document.querySelectorAll(".btn-viewport").forEach((item) => item.classList.remove("active"));
  button.classList.add("active");
  activeViewportWidth = Number.parseInt(button.dataset.w || "1280", 10);
  const frame = $("atelierFrameContainer");
  if (frame) frame.style.width = `${activeViewportWidth}px`;
}

function bindInspectorTabs() {
  document.querySelectorAll(".inspector-tab-btn").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".inspector-tab-btn").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      const tab = /** @type {HTMLElement} */ (button).dataset.tab;
      const layers = $("inspectorLayersSection");
      const properties = $("inspectorPropsSection");
      if (!layers || !properties) return;
      layers.style.display = tab === "props" ? "none" : "flex";
      properties.style.display = tab === "layers" ? "none" : "block";
      layers.style.flex = "1";
      properties.style.flex = "1";
    });
  });
}

function bindVersionRestore() {
  document.querySelectorAll(".btn-restore-version").forEach((button) => {
    button.addEventListener("click", async () => {
      const version = /** @type {HTMLElement} */ (button).dataset.ver;
      if (!confirm(`Deseja restaurar a versão v${version}?`)) return;
      try {
        const response = await fetch(`/api/project/${encodeURIComponent(currentSlug)}/design/prototypes/${encodeURIComponent(currentProtoId)}/versions/${version}/restore`, { method: "POST", headers: { "Content-Type": "application/json" } });
        showToast(response.ok ? `Versão v${version} restaurada.` : "Erro ao restaurar versão.");
        if (response.ok) await refreshAtelierPreview();
      } catch {
        showToast("Falha na requisição de restauração.");
      }
    });
  });
}

function setupBridgeListener() {
  if (bridgeListenerInstalled) return;
  bridgeListenerInstalled = true;
  window.addEventListener("message", handleBridgeMessage);
}

function handleBridgeMessage(event) {
  const data = event.data;
  if (!data || typeof data !== "object") return;
  if (canvasHandleMessage(event)) return;
  if (data.type === "HARNESS_PROTO_SELECT") {
    selectedNode = data;
    if (multi.pids.length && !multi.pids.includes(data.pid)) setMulti([], data.pid);
    else if (!multi.pids.length) { multi.anchor = data.pid; paintSelectionBar(); }
    renderSelectedNodeDetails();
    void renderElementMapping({ slug: currentSlug, protoId: currentProtoId, screenId: currentActiveScreen, node: data });
    const tree = $("atelierLayerTreeContainer");
    if (tree && data.pid) selectLayerNode(data.pid, tree);
  } else if (data.type === "HARNESS_PROTO_METRICS") {
    updatePropsMetrics(data);
  } else if (data.type === "HARNESS_PROTO_SHORTCUT") {
    if (data.action === "undo" || data.action === "redo") void runHistory(data.action);
    else if (data.action === "group" || data.action === "ungroup") void runGroupAction(data.action);
    else if (data.action === "clear" && multi.pids.length) setMulti([], multi.anchor);
    else if ((data.action === "remove" || data.action === "duplicate") && multi.pids.length >= 2) void runBatch(data.action);
  } else if (data.type === "HARNESS_PROTO_MULTI_CLICK") {
    onMultiClick(data.pid, { ctrl: Boolean(data.ctrl), shift: Boolean(data.shift) });
  } else if (data.type === "HARNESS_PROTO_REORDER") {
    void moveElement(data.pid, data.targetPid, data.position);
  } else if (data.type === "HARNESS_PROTO_TREE") {
    currentTree = data.tree || [];
    renderLayerTree(currentTree);
    paintSelectionBar();
  } else if (data.type === "HARNESS_PROTO_READY") {
    if (!isInspectorOn()) postToPrototype({ type: "HARNESS_PROTO_MODE", mode: singleScreenMode() });
    postToPrototype({ type: "HARNESS_PROTO_REQUEST_TREE" });
    if (pendingSelectPid) {
      const pid = pendingSelectPid;
      pendingSelectPid = "";
      setTimeout(() => postToPrototype({ type: "HARNESS_PROTO_SELECT_BY_PID", pid }), 120);
    }
  } else if (data.type === "HARNESS_PROTO_GOTO" && data.screen) {
    currentActiveScreen = data.screen;
    const select = /** @type {HTMLSelectElement} */ ($("atelierScreenSelect"));
    if (select) select.value = data.screen;
    reloadIframe();
  }
}

/** Clique simples numa camada: seleção única (limpa a múltipla). */
function selectSingle(pid) {
  if (multi.pids.length) setMulti([], pid);
  postToPrototype({ type: "HARNESS_PROTO_SELECT_BY_PID", pid });
}

/** Ctrl alterna, Shift pega o intervalo (preview e camadas). */
function onMultiClick(pid, mods) {
  const base = { pids: multi.pids, anchor: multi.anchor || selectedNode?.pid || "" };
  const next = applyClick(base, { pid, ...mods }, currentTree);
  setMulti(next.pids, next.anchor);
}

function setMulti(pids, anchor) {
  multi = { pids, anchor };
  postToPrototype({ type: "HARNESS_PROTO_SET_MULTI", pids });
  setLayerMulti(pids, $("atelierLayerTreeContainer"));
  paintSelectionBar();
}

function paintSelectionBar() {
  const bar = $("atelierSelectionBar");
  if (!bar) return;
  const count = multi.pids.length;
  const group = isGroupNode(selectedNode) && !count;
  bar.hidden = !(count >= 2 || group);
  const verdict = canGroup(currentTree, multi.pids);
  const label = $("atelierSelectionLabel");
  if (label) label.textContent = group ? "Grupo selecionado" : selectionLabel(count, verdict);
  const groupButton = /** @type {HTMLButtonElement | null} */ ($("btnAtelierGroup"));
  const ungroupButton = /** @type {HTMLButtonElement | null} */ ($("btnAtelierUngroup"));
  if (groupButton) { groupButton.hidden = group; groupButton.disabled = !verdict.ok; groupButton.title = verdict.ok ? "Agrupar (Ctrl+G)" : verdict.reason || ""; }
  if (ungroupButton) ungroupButton.hidden = !group;
  for (const id of ["btnAtelierDuplicateSel", "btnAtelierDeleteSel"]) { const b = $(id); if (b) b.hidden = group; }
}

function bindSelectionBar() {
  const groupButton = $("btnAtelierGroup");
  const ungroupButton = $("btnAtelierUngroup");
  const clearButton = $("btnAtelierClearSel");
  if (groupButton) groupButton.onclick = () => void runGroupAction("group");
  if (ungroupButton) ungroupButton.onclick = () => void runGroupAction("ungroup");
  if (clearButton) clearButton.onclick = () => setMulti([], multi.anchor);
  const duplicateButton = $("btnAtelierDuplicateSel");
  const deleteButton = $("btnAtelierDeleteSel");
  if (duplicateButton) duplicateButton.onclick = () => void runBatch("duplicate");
  if (deleteButton) deleteButton.onclick = () => void runBatch("remove");
}

/** Excluir ou duplicar todos os selecionados de uma vez (uma entrada no histórico). */
async function runBatch(type) {
  const pids = multi.pids;
  if (pids.length < 2) return;
  if (type === "remove" && !confirm(`Excluir ${pids.length} elementos selecionados? Dá para desfazer com Ctrl+Z.`)) return;
  const res = await applyStructural({ slug: currentSlug, protoId: currentProtoId, screenId: currentActiveScreen, pid: pids[0], op: { type, pids } });
  if (!res.ok) { showToast(`Não foi possível ${type === "remove" ? "excluir" : "duplicar"}: ${res.error}`); return; }
  showToast(`${type === "remove" ? "Excluídos" : "Duplicados"} ${pids.length} elementos (Ctrl+Z desfaz).`);
  multi = { pids: [], anchor: "" };
  selectedNode = null;
  pendingSelectPid = "";
  setLayerMulti([], $("atelierLayerTreeContainer"));
  paintSelectionBar();
  reloadIframe();
}

/** Ctrl+G / Ctrl+Shift+G: grava um `<div data-group>` de verdade no HTML (ou o desfaz) e recarrega mantendo a seleção. */
async function runGroupAction(action) {
  if (action === "group") {
    const verdict = canGroup(currentTree, multi.pids);
    if (!verdict.ok) { showToast(verdict.reason || "Não dá para agrupar."); return; }
    const pids = multi.pids;
    const res = await applyStructural({ slug: currentSlug, protoId: currentProtoId, screenId: currentActiveScreen, pid: pids[0], op: { type: "group", pids } });
    if (!res.ok) { showToast(`Não foi possível agrupar: ${res.error}`); return; }
    showToast("Agrupado. O grupo é um <div> novo: confira o layout (Ctrl+Z desfaz).");
    pendingSelectPid = res.groupPid || "";
  } else {
    if (!isGroupNode(selectedNode) || !selectedNode.pid) { showToast("Selecione um grupo para desagrupar."); return; }
    const res = await applyStructural({ slug: currentSlug, protoId: currentProtoId, screenId: currentActiveScreen, pid: selectedNode.pid, op: { type: "ungroup" } });
    if (!res.ok) { showToast(`Não foi possível desagrupar: ${res.error}`); return; }
    showToast("Desagrupado (Ctrl+Z desfaz).");
    pendingSelectPid = "";
  }
  multi = { pids: [], anchor: "" };
  selectedNode = null;
  setLayerMulti([], $("atelierLayerTreeContainer"));
  paintSelectionBar();
  reloadIframe();
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
  const res = await applyEdit({ slug: currentSlug, protoId: currentProtoId, screenId: currentActiveScreen, pid, op: { type: "moveTo", targetPid, position } });
  if (!res.ok) { showToast(`Não foi possível mover: ${res.error}`); return; }
  pendingSelectPid = pid;
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
  if (iframe) iframe.src = `/api/project/${encodeURIComponent(currentSlug)}/design/prototypes/${encodeURIComponent(currentProtoId)}/render/${encodeURIComponent(currentActiveScreen)}`;
}

function renderSelectedNodeDetails() {
  const panel = $("atelierNodeDetails");
  if (panel && selectedNode) renderNodeEditForm(panel, currentSlug, currentProtoId, currentActiveScreen, selectedNode, reloadIframe, { post: postToPrototype, getScreen: () => currentActiveScreen, reselect: (pid) => { pendingSelectPid = pid; reloadIframe(); } });
}
