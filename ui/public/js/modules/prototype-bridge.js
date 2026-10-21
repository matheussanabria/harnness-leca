// @ts-check
(() => {
  // Ponte leve do Harness Leca para o iframe do protótipo
  if (typeof window === "undefined" || window === window.top) return;

  function sendToParent(type, payload = {}) {
    try {
      window.parent.postMessage({ type, ...payload }, "*");
    } catch {}
  }

  function getCategoryForTag(tag, classes = []) {
    const t = tag.toLowerCase();
    if (["header", "nav", "footer"].includes(t)) return "nav";
    if (["h1", "h2", "h3", "h4", "h5", "h6", "p", "span", "b", "strong", "i", "em", "label"].includes(t)) return "text";
    if (["button", "a"].includes(t)) return "action";
    if (["input", "select", "textarea", "form"].includes(t)) return "form";
    if (["img", "svg", "canvas", "figure"].includes(t)) return "media";
    if (["table", "thead", "tbody", "tr", "th", "td"].includes(t)) return "table";
    if (["ul", "ol", "li"].includes(t)) return "list";
    if (["section", "article", "aside", "main"].includes(t)) return "section";
    const cl = classes.join(" ").toLowerCase();
    if (cl.includes("card") || cl.includes("badge") || cl.includes("alert")) return "component";
    return "box";
  }

  function computeDisplayName(el, tag, classes) {
    if (el.hasAttribute("data-component")) return el.getAttribute("data-component") || tag;
    if (el.id) return `#${el.id}`;
    const directText = Array.from(el.childNodes)
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent?.trim() || "")
      .join(" ")
      .trim();

    if (["button", "a"].includes(tag) && directText) {
      return `${tag}: ${directText.slice(0, 18)}`;
    }
    if (["h1", "h2", "h3", "h4", "h5", "h6", "p", "span", "label"].includes(tag) && directText) {
      return directText.length > 22 ? `"${directText.slice(0, 20)}..."` : `"${directText}"`;
    }
    const c = classes.find((cls) => !cls.startsWith("harness-") && !cls.startsWith("p-") && cls.length > 2);
    return c ? `${tag}.${c}` : `<${tag}>`;
  }

  let dynamicCounter = 0;
  function extractNode(el) {
    if (!el || el.nodeType !== 1) return null;
    const tag = el.tagName.toLowerCase();
    if (["script", "style", "noscript"].includes(tag)) return null;

    let nodeId = el.getAttribute("data-node-id") || el.getAttribute("data-pid") || "";
    if (!nodeId) {
      nodeId = el.id ? el.id : `el-${tag}-${++dynamicCounter}`;
      el.setAttribute("data-node-id", nodeId);
    }
    const pid = el.getAttribute("data-pid") || nodeId;
    const classes = Array.from(el.classList).filter((c) => c !== "harness-highlight");
    const isHidden = el.style.display === "none" || el.classList.contains("is-hidden");
    const isLocked = el.getAttribute("data-locked") === "true";
    const category = el.hasAttribute("data-component") ? "component" : getCategoryForTag(tag, classes);
    const displayName = computeDisplayName(el, tag, classes);
    const directText = (el.textContent || "").trim().slice(0, 40);

    const children = [];
    for (const child of Array.from(el.children)) {
      const childNode = extractNode(child);
      if (childNode) children.push(childNode);
    }

    return {
      nodeId,
      pid,
      tag,
      id: el.id || "",
      classes,
      category,
      displayName,
      text: directText,
      isHidden,
      isLocked,
      children,
    };
  }

  function sendFullTree() {
    const rootEl = document.body;
    if (!rootEl) return;
    const tree = [];
    for (const child of Array.from(rootEl.children)) {
      const node = extractNode(child);
      if (node) tree.push(node);
    }
    sendToParent("HARNESS_PROTO_TREE", {
      proto: document.body.getAttribute("data-proto") || "",
      screen: document.body.getAttribute("data-screen") || "",
      version: document.body.getAttribute("data-version") || "1.0.0",
      tree,
    });
  }

  // HTML do elemento sem o realce da própria ponte (usado pelo canvas para criar blocos de código)
  function cleanHtml(el) {
    const clone = el.cloneNode(true);
    clone.classList.remove("harness-highlight");
    clone.querySelectorAll(".harness-highlight").forEach((n) => n.classList.remove("harness-highlight"));
    return (clone.outerHTML || "").slice(0, 20000);
  }

  function selectElement(targetEl) {
    if (!targetEl) return;
    document.querySelectorAll(".harness-highlight").forEach((el) => el.classList.remove("harness-highlight"));
    targetEl.classList.add("harness-highlight");

    const nodeId = targetEl.getAttribute("data-node-id") || targetEl.getAttribute("data-pid") || "";
    const pid = targetEl.getAttribute("data-pid") || nodeId;
    const tag = targetEl.tagName.toLowerCase();
    const classes = Array.from(targetEl.classList).filter((c) => c !== "harness-highlight");
    const text = (targetEl.textContent || "").trim();
    const rect = targetEl.getBoundingClientRect();

    const attrs = {};
    for (const attr of Array.from(targetEl.attributes)) {
      if (!["class", "data-pid", "data-node-id"].includes(attr.name)) {
        attrs[attr.name] = attr.value;
      }
    }

    sendToParent("HARNESS_PROTO_SELECT", {
      nodeId,
      pid,
      tag,
      classes,
      text,
      attrs,
      html: cleanHtml(targetEl),
      rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
      ...(window.__hpProps ? window.__hpProps.snapshot(targetEl) : {}), // painel Posição e Layout
    });
  }

  function findElementById(id) {
    if (!id) return null;
    return document.querySelector(`[data-node-id="${id}"], [data-pid="${id}"]`);
  }

  // Modos: "legacy" (padrão: goto navega, o resto seleciona), "inspect" (só seleciona) e "play" (executa a tela de verdade)
  let mode = "legacy";
  function setMode(next) {
    mode = next === "play" || next === "inspect" ? next : "legacy";
    document.getElementById("harnessPlayStyle")?.remove();
    if (mode !== "play") return;
    document.querySelectorAll(".harness-highlight").forEach((el) => el.classList.remove("harness-highlight"));
    document.head.insertAdjacentHTML("beforeend", '<style id="harnessPlayStyle">[data-pid]:hover,[data-node-id]:hover{outline:none!important;cursor:auto!important}</style>');
  }

  // 1. Interação por clique no preview
  document.addEventListener("click", (e) => {
    // @ts-ignore
    const target = e.target;
    if (!target) return;
    const actionEl = target.closest("[data-action]");
    if (actionEl && mode !== "inspect") {
      const action = actionEl.getAttribute("data-action") || "";
      if (action.startsWith("goto:")) {
        e.preventDefault();
        sendToParent("HARNESS_PROTO_GOTO", { screen: action.replace(/^goto:/, "").trim() });
        return;
      }
      if (action.startsWith("toggle:")) {
        e.preventDefault();
        const sel = action.replace(/^toggle:/, "").trim();
        const el = document.querySelector(sel);
        if (el) el.classList.toggle("is-open");
        return;
      }
    }

    const nodeEl = mode === "play" ? null : target.closest("[data-node-id], [data-pid]");
    if (!nodeEl) return;
    e.preventDefault();
    e.stopPropagation();
    selectElement(nodeEl);
  }, true);

  // Esc dentro do iframe não chega à janela-mãe; repassa para o canvas sair do modo Iniciar
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") sendToParent("HARNESS_PROTO_KEY", { key: "Escape" }); });

  // 2. Escuta ordens da janela-mãe
  window.addEventListener("message", (e) => {
    const data = e.data;
    if (!data || typeof data !== "object") return;

    const targetId = data.nodeId || data.pid;
    if (data.type === "HARNESS_PROTO_MODE") {
      setMode(data.mode);
    } else if (["HARNESS_PROTO_SELECT_BY_ID", "HARNESS_PROTO_SELECT_BY_PID", "HARNESS_PROTO_HIGHLIGHT"].includes(data.type)) {
      const el = findElementById(targetId);
      if (el) {
        selectElement(el);
        el.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    } else if (data.type === "HARNESS_PROTO_TOGGLE_VISIBILITY") {
      const el = findElementById(targetId);
      if (el) {
        // @ts-ignore
        el.style.display = el.style.display === "none" ? "" : "none";
        sendFullTree();
      }
    } else if (data.type === "HARNESS_PROTO_TOGGLE_LOCK") {
      const el = findElementById(targetId);
      if (el) {
        const isLocked = el.getAttribute("data-locked") === "true";
        el.setAttribute("data-locked", isLocked ? "false" : "true");
        sendFullTree();
      }
    } else if (data.type === "HARNESS_PROTO_REQUEST_TREE") {
      sendFullTree();
    } else if (data.type === "HARNESS_PROTO_CLEAR_HIGHLIGHT") {
      document.querySelectorAll(".harness-highlight").forEach((el) => el.classList.remove("harness-highlight"));
    }
  });

  let treeDebounce = null;
  function scheduleSendTree() {
    clearTimeout(treeDebounce);
    treeDebounce = setTimeout(sendFullTree, 80);
  }

  // Interface para scripts irmãos (arrastar para reordenar)
  window.__harnessBridge = { send: sendToParent, mode: () => mode, select: selectElement };

  // Notifica que a ponte está ativa e envia a árvore de elementos
  sendToParent("HARNESS_PROTO_READY", {
    proto: document.body?.getAttribute("data-proto") || "",
    screen: document.body?.getAttribute("data-screen") || "",
    version: document.body?.getAttribute("data-version") || "1.0.0",
  });
  sendFullTree();

  // Observa montagem assíncrona de frameworks (DataChef, React, Angular)
  if (typeof MutationObserver !== "undefined" && document.body) {
    const observer = new MutationObserver(() => scheduleSendTree());
    observer.observe(document.body, { childList: true, subtree: true });
  }
  window.addEventListener("load", scheduleSendTree);
  setTimeout(scheduleSendTree, 350);
  setTimeout(scheduleSendTree, 900);
})();
