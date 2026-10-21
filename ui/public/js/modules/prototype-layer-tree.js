// @ts-check
import { esc } from "../shared/dom.js";
import { bindLayerDrag } from "./prototype-layer-drag.js";

/**
 * Gerenciador da Árvore de Camadas (Layers Tree) do Inspetor de Protótipos.
 * Suporta identificadores canônicos nodeId (v2) e pid (v1).
 */

let currentTree = [];
let selectedNodeId = "";
let expandedNodes = new Set();
let searchQuery = "";
let callbacks = { onSelect: null, onVisibility: null, onLock: null, onMove: null };

const CATEGORY_ICONS = {
  nav: "fa-solid fa-compass",
  text: "fa-solid fa-font",
  action: "fa-solid fa-hand-pointer",
  form: "fa-solid fa-keyboard",
  media: "fa-solid fa-image",
  table: "fa-solid fa-table",
  list: "fa-solid fa-list-ul",
  section: "fa-solid fa-folder",
  component: "fa-solid fa-cube",
  box: "fa-solid fa-box",
};

function getNodeId(node) {
  return node ? (node.nodeId || node.pid || "") : "";
}

export function initLayerTree(tree, container, onSelect, onVisibility, onLock, onMove = null) {
  currentTree = tree || [];
  callbacks = { onSelect, onVisibility, onLock, onMove };

  if (expandedNodes.size === 0) {
    expandTopLevels(currentTree, 0, 2);
  }
  renderTree(container);
}

function expandTopLevels(nodes, currentDepth, maxDepth) {
  if (currentDepth >= maxDepth) return;
  for (const node of nodes) {
    const id = getNodeId(node);
    if (node.children && node.children.length > 0) {
      if (id) expandedNodes.add(id);
      expandTopLevels(node.children, currentDepth + 1, maxDepth);
    }
  }
}

export function selectLayerNode(targetId, container) {
  selectedNodeId = targetId;
  expandAncestors(currentTree, targetId);
  if (container) renderTree(container);
  scrollToSelected(container);
}

function expandAncestors(nodes, targetId, parents = []) {
  for (const node of nodes) {
    const id = getNodeId(node);
    if (id === targetId) {
      parents.forEach((p) => expandedNodes.add(p));
      return true;
    }
    if (node.children && node.children.length > 0) {
      if (expandAncestors(node.children, targetId, [...parents, id])) {
        if (id) expandedNodes.add(id);
        return true;
      }
    }
  }
  return false;
}

export function renderTree(container) {
  if (!container) return;
  const totalCount = countNodes(currentTree);
  const q = searchQuery.toLowerCase().trim();

  container.innerHTML = `
    <div class="layers-tree-container">
      <div class="layers-toolbar">
        <div class="layers-search-box">
          <i class="fa-solid fa-magnifying-glass layers-search-icon"></i>
          <input type="text" id="layerSearchInput" class="layers-search-input" placeholder="Buscar camadas..." value="${esc(searchQuery)}" />
          ${searchQuery ? '<button type="button" id="btnClearLayerSearch" class="btn-clear-layer-search"><i class="fa-solid fa-xmark"></i></button>' : ''}
        </div>
        <span class="layers-count-badge">${totalCount} nós</span>
      </div>
      <div class="layers-list-scroll" id="layersListScroll">
        ${renderNodesList(currentTree, 0, q)}
      </div>
    </div>
  `;
  bindTreeEvents(container);
}

function countNodes(nodes) {
  let count = 0;
  for (const n of nodes) {
    count += 1;
    if (n.children) count += countNodes(n.children);
  }
  return count;
}

function nodeMatchesSearch(node, q) {
  if (!q) return true;
  if ((node.displayName || "").toLowerCase().includes(q)) return true;
  if ((node.tag || "").toLowerCase().includes(q)) return true;
  if ((node.text || "").toLowerCase().includes(q)) return true;
  if ((node.classes || []).some((c) => c.toLowerCase().includes(q))) return true;
  if (node.children && node.children.some((child) => nodeMatchesSearch(child, q))) return true;
  return false;
}

function renderNodesList(nodes, depth, q) {
  if (!nodes || nodes.length === 0) return "";
  let html = "";

  for (const node of nodes) {
    if (q && !nodeMatchesSearch(node, q)) continue;

    const id = getNodeId(node);
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = q ? true : expandedNodes.has(id);
    const isSelected = id === selectedNodeId;
    const iconClass = CATEGORY_ICONS[node.category] || "fa-solid fa-box";
    const indentPx = depth * 14;

    html += `
      <div class="layer-item-row ${isSelected ? 'selected' : ''} ${node.isHidden ? 'is-hidden' : ''} ${node.isLocked ? 'is-locked' : ''}" data-node-id="${esc(id)}" data-pid="${esc(id)}" draggable="${node.isLocked ? "false" : "true"}" style="padding-left:${indentPx + 6}px">
        <span class="layer-chevron-slot">
          ${hasChildren ? `
            <button type="button" class="btn-toggle-expand" data-node-id="${esc(id)}" title="${isExpanded ? 'Recolher' : 'Expandir'}">
              <i class="fa-solid ${isExpanded ? 'fa-chevron-down' : 'fa-chevron-right'}"></i>
            </button>
          ` : '<span class="layer-chevron-spacer"></span>'}
        </span>
        <span class="layer-node-icon ${node.category}"><i class="${iconClass}"></i></span>
        <span class="layer-node-name" title="${esc(node.displayName)} (${node.tag})">${esc(node.displayName)}</span>
        <span class="layer-tag-badge">${esc(node.tag)}</span>
        <div class="layer-item-actions">
          <button type="button" class="btn-layer-action btn-toggle-vis" data-node-id="${esc(id)}" title="${node.isHidden ? 'Exibir elemento' : 'Ocultar elemento'}">
            <i class="fa-solid ${node.isHidden ? 'fa-eye-slash' : 'fa-eye'}"></i>
          </button>
          <button type="button" class="btn-layer-action btn-toggle-lock" data-node-id="${esc(id)}" title="${node.isLocked ? 'Desbloquear' : 'Bloquear'}">
            <i class="fa-solid ${node.isLocked ? 'fa-lock' : 'fa-lock-open'}"></i>
          </button>
        </div>
      </div>
    `;

    if (hasChildren && isExpanded) {
      html += renderNodesList(node.children, depth + 1, q);
    }
  }

  return html;
}

function bindTreeEvents(container) {
  const searchInput = /** @type {HTMLInputElement} */ (container.querySelector("#layerSearchInput"));
  if (searchInput) {
    searchInput.oninput = () => {
      searchQuery = searchInput.value;
      renderTree(container);
    };
  }

  const btnClear = container.querySelector("#btnClearLayerSearch");
  if (btnClear) {
    // @ts-ignore
    btnClear.onclick = () => {
      searchQuery = "";
      renderTree(container);
    };
  }

  container.querySelectorAll(".btn-toggle-expand").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = /** @type {HTMLElement} */ (btn).dataset.nodeId;
      if (!id) return;
      if (expandedNodes.has(id)) expandedNodes.delete(id);
      else expandedNodes.add(id);
      renderTree(container);
    });
  });

  container.querySelectorAll(".layer-item-row").forEach((row) => {
    row.addEventListener("click", (e) => {
      const id = /** @type {HTMLElement} */ (row).dataset.nodeId;
      if (!id) return;
      selectedNodeId = id;
      renderTree(container);
      if (callbacks.onSelect) callbacks.onSelect(id);
    });
  });

  bindLayerDrag(container, (source, target, position) => callbacks.onMove?.(source, target, position));

  container.querySelectorAll(".btn-toggle-vis").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = /** @type {HTMLElement} */ (btn).dataset.nodeId;
      if (id && callbacks.onVisibility) callbacks.onVisibility(id);
    });
  });

  container.querySelectorAll(".btn-toggle-lock").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = /** @type {HTMLElement} */ (btn).dataset.nodeId;
      if (id && callbacks.onLock) callbacks.onLock(id);
    });
  });
}

function scrollToSelected(container) {
  if (!container) return;
  setTimeout(() => {
    const selectedEl = container.querySelector(".layer-item-row.selected");
    if (selectedEl) {
      selectedEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, 50);
}
