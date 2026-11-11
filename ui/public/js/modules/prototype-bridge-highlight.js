// @ts-check
(() => {
  // Destaque por seletor CSS dentro do iframe: o Mapa em Camadas pede o destaque do trecho ligado ao campo escolhido.
  // Roda no iframe, como os outros scripts da ponte. Nao seleciona nem mexe na arvore de elementos.
  if (typeof window === "undefined" || window === window.top) return;

  const clear = () => document.querySelectorAll(".harness-highlight").forEach((el) => el.classList.remove("harness-highlight"));

  window.addEventListener("message", (event) => {
    const data = event.data;
    if (!data || typeof data !== "object" || data.type !== "HARNESS_PROTO_HIGHLIGHT_SELECTOR") return;
    clear();
    let first = null;
    try {
      document.querySelectorAll(String(data.selector || "")).forEach((el) => {
        el.classList.add("harness-highlight");
        first = first || el;
      });
    } catch {
      // seletor invalido: fica sem destaque
    }
    if (first) first.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });
})();
