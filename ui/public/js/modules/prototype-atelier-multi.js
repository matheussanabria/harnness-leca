// @ts-check
// Seleção múltipla, grupos, exclusão/duplicação em lote e atalhos de teclado do Ateliê (EP-12.x).
// O estado vive em `ctx` (prototype-atelier-ctx.js); o que depende do iframe e da tela passa por `host`.
import { $, showToast } from "../shared/dom.js";
import { applyStructural } from "./prototype-edit-api.js";
import { applyClick, canGroup, groupShortcut, isGroupNode, selectionLabel } from "./prototype-multiselect-model.js";
import { setLayerMulti } from "./prototype-layer-tree.js";
import { runHistory } from "./prototype-history-panel.js";
import { historyShortcut, isEditableTarget } from "./prototype-history-model.js";
import { ctx, host } from "./prototype-atelier-ctx.js";

let keysInstalled = false;

/** Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y no Ateliê (fora de campos de texto); o iframe repassa as teclas dele. */
export function installHistoryKeys() {
  if (keysInstalled) return;
  keysInstalled = true;
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
    if (event.key === "Escape" && ctx.multi.pids.length) { setMulti([], ctx.multi.anchor); return; }
    if (ctx.multi.pids.length >= 2 && event.key === "Delete") { event.preventDefault(); void runBatch("remove"); return; }
    if (ctx.multi.pids.length >= 2 && (event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === "d") { event.preventDefault(); void runBatch("duplicate"); return; }
    const action = historyShortcut(event);
    if (!action) return;
    event.preventDefault();
    void runHistory(action);
  });
}

/** Clique simples numa camada: seleção única (limpa a múltipla). */
export function selectSingle(pid) {
  if (ctx.multi.pids.length) setMulti([], pid);
  host.post({ type: "HARNESS_PROTO_SELECT_BY_PID", pid });
}

/** Ctrl alterna, Shift pega o intervalo (preview e camadas). */
export function onMultiClick(pid, mods) {
  const base = { pids: ctx.multi.pids, anchor: ctx.multi.anchor || ctx.node?.pid || "" };
  const next = applyClick(base, { pid, ...mods }, ctx.tree);
  setMulti(next.pids, next.anchor);
}

export function setMulti(pids, anchor) {
  ctx.multi = { pids, anchor };
  host.post({ type: "HARNESS_PROTO_SET_MULTI", pids });
  setLayerMulti(pids, $("atelierLayerTreeContainer"));
  paintSelectionBar();
}

export function paintSelectionBar() {
  const bar = $("atelierSelectionBar");
  if (!bar) return;
  const count = ctx.multi.pids.length;
  const group = isGroupNode(ctx.node) && !count;
  bar.hidden = !(count >= 2 || group);
  const verdict = canGroup(ctx.tree, ctx.multi.pids);
  const label = $("atelierSelectionLabel");
  if (label) label.textContent = group ? "Grupo selecionado" : selectionLabel(count, verdict);
  const groupButton = /** @type {HTMLButtonElement | null} */ ($("btnAtelierGroup"));
  const ungroupButton = /** @type {HTMLButtonElement | null} */ ($("btnAtelierUngroup"));
  if (groupButton) { groupButton.hidden = group; groupButton.disabled = !verdict.ok; groupButton.title = verdict.ok ? "Agrupar (Ctrl+G)" : verdict.reason || ""; }
  if (ungroupButton) ungroupButton.hidden = !group;
  for (const id of ["btnAtelierDuplicateSel", "btnAtelierDeleteSel"]) { const b = $(id); if (b) b.hidden = group; }
}

export function bindSelectionBar() {
  const groupButton = $("btnAtelierGroup");
  const ungroupButton = $("btnAtelierUngroup");
  const clearButton = $("btnAtelierClearSel");
  if (groupButton) groupButton.onclick = () => void runGroupAction("group");
  if (ungroupButton) ungroupButton.onclick = () => void runGroupAction("ungroup");
  if (clearButton) clearButton.onclick = () => setMulti([], ctx.multi.anchor);
  const duplicateButton = $("btnAtelierDuplicateSel");
  const deleteButton = $("btnAtelierDeleteSel");
  if (duplicateButton) duplicateButton.onclick = () => void runBatch("duplicate");
  if (deleteButton) deleteButton.onclick = () => void runBatch("remove");
}

/** Excluir ou duplicar todos os selecionados de uma vez (uma entrada no histórico). */
export async function runBatch(type) {
  const pids = ctx.multi.pids;
  if (pids.length < 2) return;
  if (type === "remove" && !confirm(`Excluir ${pids.length} elementos selecionados? Dá para desfazer com Ctrl+Z.`)) return;
  const res = await applyStructural({ slug: ctx.slug, protoId: ctx.protoId, screenId: ctx.screen, pid: pids[0], op: { type, pids } });
  if (!res.ok) { showToast(`Não foi possível ${type === "remove" ? "excluir" : "duplicar"}: ${res.error}`); return; }
  showToast(`${type === "remove" ? "Excluídos" : "Duplicados"} ${pids.length} elementos (Ctrl+Z desfaz).`);
  ctx.multi = { pids: [], anchor: "" };
  ctx.node = null;
  ctx.pendingPid = "";
  setLayerMulti([], $("atelierLayerTreeContainer"));
  paintSelectionBar();
  host.reload();
}

/** Ctrl+G / Ctrl+Shift+G: grava um `<div data-group>` de verdade no HTML (ou o desfaz) e recarrega mantendo a seleção. */
export async function runGroupAction(action) {
  if (action === "group") {
    const verdict = canGroup(ctx.tree, ctx.multi.pids);
    if (!verdict.ok) { showToast(verdict.reason || "Não dá para agrupar."); return; }
    const pids = ctx.multi.pids;
    const res = await applyStructural({ slug: ctx.slug, protoId: ctx.protoId, screenId: ctx.screen, pid: pids[0], op: { type: "group", pids } });
    if (!res.ok) { showToast(`Não foi possível agrupar: ${res.error}`); return; }
    showToast("Agrupado. O grupo é um <div> novo: confira o layout (Ctrl+Z desfaz).");
    ctx.pendingPid = res.groupPid || "";
  } else {
    if (!isGroupNode(ctx.node) || !ctx.node.pid) { showToast("Selecione um grupo para desagrupar."); return; }
    const res = await applyStructural({ slug: ctx.slug, protoId: ctx.protoId, screenId: ctx.screen, pid: ctx.node.pid, op: { type: "ungroup" } });
    if (!res.ok) { showToast(`Não foi possível desagrupar: ${res.error}`); return; }
    showToast("Desagrupado (Ctrl+Z desfaz).");
    ctx.pendingPid = "";
  }
  ctx.multi = { pids: [], anchor: "" };
  ctx.node = null;
  setLayerMulti([], $("atelierLayerTreeContainer"));
  paintSelectionBar();
  host.reload();
}
