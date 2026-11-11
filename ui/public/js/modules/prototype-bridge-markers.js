// @ts-check
(() => {
  // Marcadores numerados sobre o protótipo no Mapa em Camadas: um pino amarelo por campo com seletor,
  // posicionado no canto do trecho; clicar no pino avisa o painel (HARNESS_PROTO_FIELD_CLICK).
  // Roda no iframe, como os outros scripts da ponte. Nao mexe na arvore do protótipo alem da camada dos pinos.
  if (typeof window === "undefined" || window === window.top) return;

  const LAYER_ID = "harnessMarkers";
  /** @type {{ id: string, n: number | string, selector: string }[]} */
  let markers = [];
  /** @type {string | null} */
  let active = null;
  let timer = 0;

  const style = document.createElement("style");
  style.id = "harnessMarkersStyle";
  style.textContent = `#${LAYER_ID}{position:absolute;left:0;top:0;width:0;height:0}
.harness-pin{position:absolute;z-index:2147483000;width:22px;height:22px;padding:0;border-radius:50%;border:2px solid #fff;background:#facc15;color:#1f2937;font:700 11px/18px system-ui,sans-serif;text-align:center;cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,.45)}
.harness-pin:hover{background:#fde047}
.harness-pin.is-active{background:#2563eb;color:#fff;box-shadow:0 0 0 3px rgba(37,99,235,.4)}`;
  document.head.appendChild(style);

  function layer() {
    let node = document.getElementById(LAYER_ID);
    if (!node) {
      node = document.createElement("div");
      node.id = LAYER_ID;
      document.body.appendChild(node);
    }
    return node;
  }

  function draw() {
    const root = layer();
    root.textContent = "";
    const maxLeft = Math.max(0, document.documentElement.scrollWidth - 26);
    for (const marker of markers) {
      let target = null;
      try {
        target = document.querySelector(marker.selector);
      } catch {
        // seletor invalido: sem pino
      }
      if (!target) continue;
      const rect = target.getBoundingClientRect();
      if (!rect.width && !rect.height) continue;
      const pin = document.createElement("button");
      pin.type = "button";
      pin.className = `harness-pin${marker.id === active ? " is-active" : ""}`;
      pin.textContent = String(marker.n);
      pin.setAttribute("aria-label", `Campo ${marker.n}`);
      pin.style.left = `${Math.max(0, Math.min(rect.right + window.scrollX - 12, maxLeft))}px`;
      pin.style.top = `${Math.max(0, rect.top + window.scrollY - 10)}px`;
      pin.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        window.parent.postMessage({ type: "HARNESS_PROTO_FIELD_CLICK", fieldId: marker.id }, "*");
      });
      root.appendChild(pin);
    }
  }

  function schedule() {
    clearTimeout(timer);
    timer = window.setTimeout(draw, 60);
  }

  window.addEventListener("message", (event) => {
    const data = event.data;
    if (!data || typeof data !== "object") return;
    if (data.type === "HARNESS_PROTO_MARKERS") {
      markers = Array.isArray(data.markers) ? data.markers.filter((m) => m && typeof m.selector === "string") : [];
      active = typeof data.active === "string" ? data.active : null;
      schedule();
    } else if (data.type === "HARNESS_PROTO_MARKER_ACTIVE") {
      active = typeof data.fieldId === "string" ? data.fieldId : null;
      draw();
    }
  });

  window.addEventListener("resize", schedule);
  window.addEventListener("load", schedule);
  if (typeof MutationObserver !== "undefined" && document.body) {
    new MutationObserver((records) => {
      const layerNode = document.getElementById(LAYER_ID);
      if (records.some((record) => !layerNode || !layerNode.contains(record.target))) schedule();
    }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style", "hidden", "aria-expanded"] });
  }
  if (typeof ResizeObserver !== "undefined" && document.body) new ResizeObserver(schedule).observe(document.body);
})();
