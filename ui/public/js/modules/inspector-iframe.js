// @ts-check
// Escuta de eventos dentro do iframe e tratamento do elemento selecionado.
import { showToast } from "../shared/dom.js";
import { state } from "../shared/state.js";
import { ist } from "./inspector-store.js";
import { getIframeDoc, getIframeWin, normalizeComponentName, extractTargetInfo } from "./inspector-dom.js";
import { toggleInspectorMode } from "./inspector-mode.js";
import { inspectComponentByName } from "./inspector-bridge.js";
import { renderInspectorCard } from "./inspector-card.js";

/**
 * Anexa os ouvintes de eventos e o elemento overlay ao DOM do iframe (quando mesma origem).
 * @param {Document} doc
 */
export function attachIframeListeners(doc) {
  const win = getIframeWin();
  if (!doc || !win) return;

  let overlay = doc.getElementById("__harness_inspector_overlay__");
  if (!overlay) {
    overlay = doc.createElement("div");
    overlay.id = "__harness_inspector_overlay__";
    overlay.style.cssText = "display:none;position:absolute;pointer-events:none;z-index:2147483647;border:2px solid #3b82f6;background:rgba(59,130,246,0.15);box-sizing:border-box;border-radius:3px;transition:top 0.04s ease, left 0.04s ease, width 0.04s ease, height 0.04s ease;";
    
    const tooltip = doc.createElement("div");
    tooltip.id = "__harness_inspector_tooltip__";
    tooltip.style.cssText = "position:absolute;top:-24px;left:0;background:#0f172a;color:#f8fafc;font-family:monospace;font-size:11px;padding:2px 6px;border-radius:3px;white-space:nowrap;pointer-events:none;box-shadow:0 2px 4px rgba(0,0,0,0.3);";
    overlay.appendChild(tooltip);

    doc.body.appendChild(overlay);
  }

  ist.boundMouseMove = (e) => {
    if (!ist.isInspectorActive) return;
    const target = /** @type {HTMLElement} */ (e.target);
    if (!target || target === doc.body || target === doc.documentElement || target.id === "__harness_inspector_overlay__") {
      return;
    }

    const rect = target.getBoundingClientRect();
    const scrollX = win.scrollX || win.pageXOffset || 0;
    const scrollY = win.scrollY || win.pageYOffset || 0;

    overlay.style.top = rect.top + scrollY + "px";
    overlay.style.left = rect.left + scrollX + "px";
    overlay.style.width = rect.width + "px";
    overlay.style.height = rect.height + "px";
    overlay.style.display = "block";

    let compName = "";
    // @ts-ignore
    const ng = win.ng;
    if (ng) {
      try {
        const comp = (typeof ng.getComponent === "function" && ng.getComponent(target)) ||
                     (typeof ng.getOwningComponent === "function" && ng.getOwningComponent(target));
        if (comp && comp.constructor && comp.constructor.name) {
          compName = comp.constructor.name;
        }
      } catch {}
    }

    if (!compName) {
      let cur = target;
      while (cur && cur !== doc.documentElement) {
        const t = cur.tagName.toLowerCase();
        if (t.includes("-")) {
          compName = t;
          break;
        }
        cur = cur.parentElement;
      }
    }

    const tag = target.tagName.toLowerCase();
    const tooltip = doc.getElementById("__harness_inspector_tooltip__");
    if (tooltip) {
      tooltip.textContent = compName ? `${compName} (<${tag}>)` : `<${tag}>`;
      tooltip.style.top = rect.top < 30 ? "4px" : "-24px";
    }
  };

  ist.boundClick = (e) => {
    if (!ist.isInspectorActive) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    const target = /** @type {HTMLElement} */ (e.target);
    if (!target) return;

    handleElementSelected(target, doc, win);
  };

  ist.boundKeyDown = (e) => {
    if (e.key === "Escape") {
      toggleInspectorMode(false);
    }
  };

  doc.addEventListener("mousemove", ist.boundMouseMove, { capture: true, passive: true });
  doc.addEventListener("click", ist.boundClick, { capture: true });
  doc.addEventListener("keydown", ist.boundKeyDown, { capture: true });
  window.addEventListener("keydown", ist.boundKeyDown, { capture: true });
}

/**
 * Remove os ouvintes e oculta o overlay do iframe.
 */
export function detachIframeListeners() {
  const doc = getIframeDoc();
  if (doc) {
    if (ist.boundMouseMove) doc.removeEventListener("mousemove", ist.boundMouseMove, { capture: true });
    if (ist.boundClick) doc.removeEventListener("click", ist.boundClick, { capture: true });
    if (ist.boundKeyDown) doc.removeEventListener("keydown", ist.boundKeyDown, { capture: true });
    const overlay = doc.getElementById("__harness_inspector_overlay__");
    if (overlay) overlay.style.display = "none";
  }
  if (ist.boundKeyDown) {
    window.removeEventListener("keydown", ist.boundKeyDown, { capture: true });
  }
  ist.boundMouseMove = null;
  ist.boundClick = null;
  ist.boundKeyDown = null;
}

/**
 * Processa o elemento clicado pelo usuário e consulta o backend.
 * @param {HTMLElement} target
 * @param {Document} doc
 * @param {Window} win
 */
export async function handleElementSelected(target, doc, win) {
  toggleInspectorMode(false);

  // @ts-ignore
  const ng = win.ng;
  let owningComp = null;
  let childComp = null;

  if (ng) {
    try {
      if (typeof ng.getOwningComponent === "function") owningComp = ng.getOwningComponent(target);
      if (typeof ng.getComponent === "function") childComp = ng.getComponent(target);
    } catch (err) {
      console.warn("[inspector] Erro ao invocar window.ng:", err);
    }
  }

  let current = target.parentElement;
  while (current && !owningComp) {
    if (ng) {
      try {
        if (typeof ng.getOwningComponent === "function") owningComp = ng.getOwningComponent(current);
      } catch {}
    }
    current = current.parentElement;
  }

  const compObj = owningComp || childComp;
  const rawCompName = compObj?.constructor?.name || "";
  let identifier = rawCompName ? normalizeComponentName(rawCompName) : null;
  const childCompName = (childComp && childComp !== owningComp && childComp.constructor?.name)
    ? normalizeComponentName(childComp.constructor.name)
    : null;

  if (!identifier) {
    let cur = target;
    while (cur && cur !== doc.documentElement) {
      const t = cur.tagName.toLowerCase();
      if (t.includes("-")) {
        identifier = t;
        break;
      }
      cur = cur.parentElement;
    }
  }

  const pathParts = [];
  let p = target;
  while (p && p.tagName && p !== doc.documentElement) {
    let seg = p.tagName.toLowerCase();
    if (p.id) {
      seg += `#${p.id}`;
    } else if (p.className && typeof p.className === "string") {
      const cls = p.className.trim().split(/\s+/).slice(0, 2).join(".");
      if (cls) seg += `.${cls}`;
    }
    pathParts.unshift(seg);
    p = p.parentElement;
  }
  const domPath = pathParts.slice(-5).join(" > ");

  const outerSnippet = target.outerHTML
    ? target.outerHTML.replace(/\s+/g, " ").slice(0, 220) + (target.outerHTML.length > 220 ? "..." : "")
    : `<${target.tagName.toLowerCase()}>`;

  const targetInfo = extractTargetInfo(target);

  if (!identifier) {
    showToast("⚠️ Componente Angular não detectado diretamente neste elemento.");
    renderInspectorCard({
      component: target.tagName.toLowerCase(),
      selector: target.tagName.toLowerCase(),
      standalone: false,
      files: {},
      templateType: "unknown",
      domPath,
      outerSnippet,
      elementTag: target.tagName.toLowerCase(),
      target: { ...targetInfo, domPath },
      projectSlug: state.P?.name || state.S?.active,
      notFound: true,
      notFoundReason: "Nenhum componente Angular registrado como dono deste elemento.",
    });
    return;
  }

  await inspectComponentByName(identifier, {
    domPath,
    outerSnippet,
    elementTag: target.tagName.toLowerCase(),
    target: { ...targetInfo, domPath },
    childComponent: childCompName,
  });
}
