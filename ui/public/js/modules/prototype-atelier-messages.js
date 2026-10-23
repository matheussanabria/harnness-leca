// @ts-check
// Mensagens que o iframe do protótipo manda ao Ateliê (seleção, árvore, atalhos, navegação entre telas).
import { $ } from "../shared/dom.js";
import { updatePropsMetrics } from "./prototype-props-panel.js";
import { selectLayerNode } from "./prototype-layer-tree.js";
import { renderElementMapping } from "./prototype-element-map.js";
import { canvasHandleMessage } from "./prototype-atelier-canvas.js";
import { runHistory } from "./prototype-history-panel.js";
import { isInspectorOn, singleScreenMode } from "./prototype-inspector-toggle.js";
import { persistAtelierNode, persistAtelierScreen } from "./prototype-atelier-adoption.js";
import { ctx, host } from "./prototype-atelier-ctx.js";
import { onMultiClick, setMulti, paintSelectionBar, runBatch, runGroupAction } from "./prototype-atelier-multi.js";

let listenerInstalled = false;

export function setupBridgeListener() {
  if (listenerInstalled) return;
  listenerInstalled = true;
  window.addEventListener("message", handleBridgeMessage);
}

function handleBridgeMessage(event) {
  const data = event.data;
  if (!data || typeof data !== "object") return;
  if (canvasHandleMessage(event)) return;
  if (data.type === "HARNESS_PROTO_SELECT") {
    ctx.node = data;
    if (ctx.multi.pids.length && !ctx.multi.pids.includes(data.pid)) setMulti([], data.pid);
    else if (!ctx.multi.pids.length) { ctx.multi.anchor = data.pid; paintSelectionBar(); }
    persistAtelierNode(data.pid || "");
    host.details();
    void renderElementMapping({ slug: ctx.slug, protoId: ctx.protoId, screenId: ctx.screen, node: data });
    const tree = $("atelierLayerTreeContainer");
    if (tree && data.pid) selectLayerNode(data.pid, tree);
  } else if (data.type === "HARNESS_PROTO_METRICS") {
    updatePropsMetrics(data);
  } else if (data.type === "HARNESS_PROTO_SHORTCUT") {
    if (data.action === "undo" || data.action === "redo") void runHistory(data.action);
    else if (data.action === "group" || data.action === "ungroup") void runGroupAction(data.action);
    else if (data.action === "clear" && ctx.multi.pids.length) setMulti([], ctx.multi.anchor);
    else if ((data.action === "remove" || data.action === "duplicate") && ctx.multi.pids.length >= 2) void runBatch(data.action);
  } else if (data.type === "HARNESS_PROTO_MULTI_CLICK") {
    onMultiClick(data.pid, { ctrl: Boolean(data.ctrl), shift: Boolean(data.shift) });
  } else if (data.type === "HARNESS_PROTO_REORDER") {
    void host.move(data.pid, data.targetPid, data.position);
  } else if (data.type === "HARNESS_PROTO_TREE") {
    ctx.tree = data.tree || [];
    host.tree(ctx.tree);
    paintSelectionBar();
  } else if (data.type === "HARNESS_PROTO_READY") {
    if (!isInspectorOn()) host.post({ type: "HARNESS_PROTO_MODE", mode: singleScreenMode() });
    host.post({ type: "HARNESS_PROTO_REQUEST_TREE" });
    if (ctx.pendingPid) {
      const pid = ctx.pendingPid;
      ctx.pendingPid = "";
      setTimeout(() => host.post({ type: "HARNESS_PROTO_SELECT_BY_PID", pid }), 120);
    }
  } else if (data.type === "HARNESS_PROTO_GOTO" && data.screen) {
    ctx.screen = data.screen;
    const select = /** @type {HTMLSelectElement} */ ($("atelierScreenSelect"));
    if (select) select.value = data.screen;
    persistAtelierScreen(ctx.screen);
    host.reload();
  }
}
