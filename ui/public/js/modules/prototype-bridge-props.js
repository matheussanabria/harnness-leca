// @ts-check
(() => {
  // Leitura de medidas do elemento e prévia ao vivo dos estilos do painel Posição, Layout, Aparência e Tipografia (roda no iframe).
  if (typeof window === "undefined" || window === window.top) return;

  const COMPUTED = [
    "display", "position", "width", "height", "min-width", "max-width", "min-height", "max-height", "overflow",
    "margin-top", "margin-right", "margin-bottom", "margin-left", "padding-top", "padding-right", "padding-bottom", "padding-left",
    "flex-direction", "flex-wrap", "justify-content", "align-items", "align-self", "gap", "flex-grow", "translate", "rotate",
    "opacity", "border-top-left-radius", "border-top-right-radius", "border-bottom-right-radius", "border-bottom-left-radius",
    "background-color", "border-top-width", "border-top-style", "border-top-color", "box-shadow", "filter",
    "font-family", "font-size", "font-weight", "font-style", "line-height", "letter-spacing", "text-align",
    "text-transform", "text-decoration-line", "color",
  ];

  const COLOR_RE = /^(#|rgb|hsl)/i;
  const MAX_TOKENS = 80;

  /** Tokens do DS (variáveis de :root em #dsTokensStyle) já resolvidos, separados em cores e sombras. */
  function readTokens() {
    const sheet = /** @type {HTMLStyleElement | null} */ (document.getElementById("dsTokensStyle"))?.sheet;
    const root = getComputedStyle(document.documentElement);
    const colors = [];
    const shadows = [];
    const fonts = [];
    const seen = new Set();
    try {
      for (const r of Array.from(sheet?.cssRules || [])) {
        const style = /** @type {CSSStyleRule} */ (r).style;
        if (!style) continue;
        for (const name of Array.from(style)) {
          if (!name.startsWith("--") || seen.has(name)) continue;
          seen.add(name);
          const value = root.getPropertyValue(name).trim();
          if (COLOR_RE.test(value) && colors.length < MAX_TOKENS) colors.push({ name, value });
          else if (/^shadow|-shadow/.test(name.slice(2)) && value) shadows.push({ name, value });
          else if (/^--(font|ff|typeface)/.test(name) && !/size|weight|line|height|spacing|style/.test(name) && value) fonts.push({ name, value });
        }
      }
    } catch {}
    return { colors, shadows, fonts };
  }
  let tokenCache = null;

  /** Regra `.px-*` do elemento dentro do proto.css já aplicado na página. */
  function findOwnRule(el) {
    const cls = Array.from(el.classList).find((c) => c.startsWith("px-"));
    if (!cls) return { cls: "", rule: "" };
    const sheet = /** @type {HTMLStyleElement | null} */ (document.getElementById("protoCustomStyle"))?.sheet;
    let rule = "";
    try {
      for (const r of Array.from(sheet?.cssRules || [])) {
        if (/** @type {CSSStyleRule} */ (r).selectorText === `.${cls}`) rule = r.cssText;
      }
    } catch {}
    return { cls, rule };
  }

  function snapshot(el) {
    const cs = getComputedStyle(el);
    const parent = el.parentElement;
    const pcs = parent ? getComputedStyle(parent) : null;
    const rect = el.getBoundingClientRect();
    const own = findOwnRule(el);
    return {
      computed: Object.fromEntries(COMPUTED.map((k) => [k, cs.getPropertyValue(k)])),
      size: { w: Math.round(rect.width * 10) / 10, h: Math.round(rect.height * 10) / 10 },
      parent: { display: pcs?.display || "", direction: pcs?.flexDirection || "" },
      cls: own.cls,
      ownRule: own.rule,
      tokens: (tokenCache = tokenCache || readTokens()),
    };
  }

  /** Aplica a prévia inline (some ao recarregar; a classe gravada passa a valer). */
  function applyLive(el, styles) {
    for (const [prop, value] of Object.entries(styles || {})) {
      if (value === "" || value == null) el.style.removeProperty(prop);
      else el.style.setProperty(prop, String(value));
    }
    el.setAttribute("data-px-live", "1");
  }

  // Prévia ao vivo pedida pelo painel: aplica os estilos e devolve as medidas novas.
  window.addEventListener("message", (e) => {
    const d = e.data;
    if (!d || d.type !== "HARNESS_PROTO_STYLE") return;
    const id = d.pid || d.nodeId;
    const el = document.querySelector(`[data-node-id="${id}"], [data-pid="${id}"]`);
    if (!el) return;
    applyLive(el, d.styles);
    try { window.parent.postMessage({ type: "HARNESS_PROTO_METRICS", pid: id, ...snapshot(el) }, "*"); } catch {}
  });

  // @ts-ignore
  window.__hpProps = { snapshot, applyLive };
})();
