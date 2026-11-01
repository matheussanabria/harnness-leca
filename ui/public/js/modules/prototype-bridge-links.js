// @ts-check
(() => {
  // Links de navegação dentro do iframe do Ateliê (EP-16.02). Roda no iframe, como os outros scripts da ponte.
  // Um <a href> que aponta para outra tela (screens/x.html, x.html, x) não pode seguir o href: a rota do preview só
  // serve IDs de tela. Aqui o clique vira HARNESS_PROTO_GOTO com o destino cru; quem resolve é o pai (prototype-nav-resolve.js).
  if (typeof window === "undefined" || window === window.top) return;
  // @ts-ignore
  const bridge = window.__harnessBridge;
  if (!bridge) return;

  const NOT_A_SCREEN = /^(?:#|\?|javascript:|https?:\/\/|mailto:|tel:)/i;

  // Chamado pelo clique da ponte principal: devolve true quando tratou o clique.
  bridge.onLinkClick = (e, target, mode) => {
    if (mode === "inspect" || e.defaultPrevented) return false;
    if (target.closest("[data-action]")) return false; // data-action tem prioridade e já é tratado pela ponte principal
    const link = target.closest("a[href]");
    const href = link ? (link.getAttribute("href") || "").trim() : "";
    if (!href || NOT_A_SCREEN.test(href)) return false;
    e.preventDefault();
    bridge.send("HARNESS_PROTO_GOTO", { target: href });
    return true;
  };
})();
