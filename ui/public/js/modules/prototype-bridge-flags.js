// @ts-check
(() => {
  // Olho e cadeado da árvore de camadas, dentro do iframe: o estado vira atributo (data-hidden / data-locked) no elemento
  // e o Ateliê é avisado para gravá-lo na tela, de modo que sobreviva ao recarregar (e valha no Play e na exportação).
  if (typeof window === "undefined" || window === window.top) return;
  // @ts-ignore
  const bridge = window.__harnessBridge;
  if (!bridge) return;

  /** @param {Element} el @param {string} name @param {boolean} on */
  function setFlag(el, name, on) {
    if (on) el.setAttribute(name, "true");
    else el.removeAttribute(name);
    bridge.send("HARNESS_PROTO_FLAG", { pid: el.getAttribute("data-pid") || el.getAttribute("data-node-id") || "", name, value: on ? "true" : "" });
    bridge.sendTree();
  }

  const FLAGS = { HARNESS_PROTO_TOGGLE_VISIBILITY: "data-hidden", HARNESS_PROTO_TOGGLE_LOCK: "data-locked" };

  window.addEventListener("message", (e) => {
    const data = e.data;
    const name = data && typeof data === "object" ? FLAGS[data.type] : "";
    if (!name) return;
    const el = bridge.find(data.nodeId || data.pid);
    if (el) setFlag(el, name, el.getAttribute(name) !== "true");
  });
})();
