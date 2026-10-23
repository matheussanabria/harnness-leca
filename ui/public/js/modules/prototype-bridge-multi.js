// @ts-check
(() => {
  // Seleção múltipla e atalhos de teclado dentro do iframe do Ateliê (roda no iframe).
  // O pai decide o conjunto (HARNESS_PROTO_SET_MULTI); aqui só se desenha o contorno e se avisa a janela-mãe.
  if (typeof window === "undefined" || window === window.top) return;
  // @ts-ignore
  const bridge = window.__harnessBridge;
  if (!bridge) return;

  const typing = (e) => {
    const t = e.target, tag = t && t.tagName ? t.tagName.toLowerCase() : "";
    return tag === "input" || tag === "textarea" || tag === "select" || !!(t && t.isContentEditable);
  };

  function setMulti(pids) {
    if (!document.getElementById("harnessMultiStyle")) {
      document.head.insertAdjacentHTML("beforeend", '<style id="harnessMultiStyle">.harness-multi{outline:2px solid #818cf8!important;outline-offset:-2px;background-image:linear-gradient(rgba(129,140,248,.14),rgba(129,140,248,.14))!important}</style>');
    }
    document.querySelectorAll(".harness-multi").forEach((el) => el.classList.remove("harness-multi"));
    for (const pid of pids || []) bridge.find(pid)?.classList.add("harness-multi");
  }

  // Chamado pelo clique da ponte principal: devolve true quando tratou o clique.
  bridge.onModifiedClick = (e, target, mode) => {
    if (!(e.shiftKey || e.ctrlKey || e.metaKey) || mode === "play") return false;
    const multiEl = target.closest("[data-node-id], [data-pid]");
    if (!multiEl) return false;
    e.preventDefault();
    e.stopPropagation();
    const pid = multiEl.getAttribute("data-pid") || multiEl.getAttribute("data-node-id") || "";
    bridge.send("HARNESS_PROTO_MULTI_CLICK", { pid, ctrl: e.ctrlKey || e.metaKey, shift: e.shiftKey });
    return true;
  };

  // Esc dentro do iframe não chega à janela-mãe: repassa para o canvas sair do modo Iniciar e limpar a seleção
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    bridge.send("HARNESS_PROTO_KEY", { key: "Escape" });
    bridge.send("HARNESS_PROTO_SHORTCUT", { action: "clear" });
  });

  // Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y / Ctrl+G: histórico e grupos moram na janela-mãe
  document.addEventListener("keydown", (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey || typing(e)) return;
    const k = String(e.key || "").toLowerCase();
    const action = k === "z" ? (e.shiftKey ? "redo" : "undo") : k === "y" && !e.shiftKey ? "redo" : k === "g" ? (e.shiftKey ? "ungroup" : "group") : "";
    if (!action) return;
    e.preventDefault();
    bridge.send("HARNESS_PROTO_SHORTCUT", { action });
  });

  // Delete e Ctrl+D com vários selecionados: a janela-mãe pede confirmação e grava
  document.addEventListener("keydown", (e) => {
    if (!document.querySelector(".harness-multi") || typing(e)) return;
    const k = String(e.key || "").toLowerCase();
    const action = e.key === "Delete" ? "remove" : (k === "d" && (e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey ? "duplicate" : "");
    if (!action) return;
    e.preventDefault();
    bridge.send("HARNESS_PROTO_SHORTCUT", { action });
  });

  window.addEventListener("message", (e) => {
    const data = e.data;
    if (data && typeof data === "object" && data.type === "HARNESS_PROTO_SET_MULTI") setMulti(data.pids);
  });
})();
