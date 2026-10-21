// @ts-check
import { showToast } from "../shared/dom.js";
import { applyEdit } from "./prototype-edit-api.js";
import { alignPatch, blurPatch, opacityPatch, radiusPatch, rotatePatch, ruleToLines, shadowPatch, sizePatch, STROKE_CLEAR, stepValue, strokePatch, toCss, translatePatch } from "./prototype-props-model.js";
import { fontFamilyPatch, letterSpacingPatch, lineHeightPatch } from "./prototype-props-type-model.js";
import { createCodeTabs } from "./prototype-props-code.js";
import { renderPropsHtml } from "./prototype-props-view.js";

/** Painel Posição e Layout ligado ao nó selecionado: prévia ao vivo no iframe e gravação em classe + proto.css. */

/** Valores "neutros" dos selects: viram remoção da propriedade. */
const NEUTRAL = new Set(["normal", "auto"]);
const COMMIT_DELAY = 450;
const COLOR_PROPS = new Set(["background-color", "border-color", "color"]);

/** @type {null | { host: HTMLElement, node: any, structure: string, refresh: (msg: any) => void }} */
let current = null;

const structureOf = (node) => `${/flex/.test(node.computed?.display || "")}|${/flex/.test(node.parent?.display || "")}`;

/**
 * @param {HTMLElement} host
 * @param {{ slug: string, protoId: string, getScreen: () => string, node: any, post: (message: object) => void }} ctx
 */
export function mountPropsPanel(host, ctx) {
  const { node } = ctx;
  if (!host) return;
  if (!node?.computed) {
    host.innerHTML = '<div class="pp-muted">Recarregue o protótipo para habilitar o painel Posição e Layout.</div>';
    current = null;
    return;
  }
  const pid = node.pid;
  let pending = {};
  let timer = 0;
  let ruleText = ruleToLines(node.ownRule);
  let clsName = node.cls || "";

  const code = createCodeTabs({ slug: ctx.slug, protoId: ctx.protoId, getScreen: ctx.getScreen, pid });
  const paintCode = () => code.setRule(clsName, ruleText);
  const render = () => {
    host.innerHTML = renderPropsHtml(node);
    code.attach(/** @type {HTMLElement | null} */ (host.querySelector("[data-pp-code]")));
    code.setRule(clsName, ruleText);
    if (current) current.structure = structureOf(node);
  };

  async function flush() {
    const styles = pending;
    pending = {};
    if (!Object.keys(styles).length) return;
    const res = await applyEdit({ slug: ctx.slug, protoId: ctx.protoId, screenId: ctx.getScreen(), pid, op: { type: "setStyles", styles } });
    if (!res.ok) { showToast(`Erro: ${res.error}`); return; }
    clsName = res.cls || clsName;
    ruleText = ruleToLines(res.rule || "");
    node.ownRule = res.rule || "";
    paintCode();
    code.reload();
  }

  /** Prévia imediata no iframe + gravação com atraso (ou na hora, em campos de escolha). */
  function setStyles(patch, immediate = false) {
    if (!patch) return;
    ctx.post({ type: "HARNESS_PROTO_STYLE", pid, styles: patch });
    Object.assign(pending, patch);
    clearTimeout(timer);
    timer = window.setTimeout(flush, immediate ? 0 : COMMIT_DELAY);
    if (immediate) window.setTimeout(() => ctx.post({ type: "HARNESS_PROTO_STYLE", pid, styles: {} }), COMMIT_DELAY + 150);
  }

  const val = (prop) => /** @type {HTMLInputElement | null} */ (host.querySelector(`[data-px="${prop}"]`))?.value ?? "";
  const measured = (dim) => String(dim === "width" ? node.size?.w : node.size?.h);

  /** Traduz um campo do painel em declarações CSS. */
  function patchForField(prop, value) {
    if (prop === "translate-x" || prop === "translate-y") return translatePatch(val("translate-x"), val("translate-y"));
    if (prop === "rotate") return rotatePatch(value);
    if (prop === "opacity") return opacityPatch(value);
    if (prop === "border-radius") return radiusPatch(value);
    if (prop === "blur") return blurPatch(value);
    if (prop === "font-family") return fontFamilyPatch(value);
    if (prop === "font-weight") return { "font-weight": value };
    if (prop === "line-height") return lineHeightPatch(value);
    if (prop === "letter-spacing") return letterSpacingPatch(value);
    if (prop === "box-shadow") return shadowPatch(value === "" ? "none" : value) || null;
    if (prop === "border-width" || prop === "border-style") return strokePatch(prop, value, node.computed);
    if (COLOR_PROPS.has(prop)) return !value || CSS.supports("color", value) ? { [prop]: value } : null;
    if (prop === "width-mode" || prop === "height-mode") return sizePatch(prop === "width-mode" ? "width" : "height", /** @type {any} */ (value), measured(prop === "width-mode" ? "width" : "height"));
    if (NEUTRAL.has(value)) return { [prop]: "" };
    return { [prop]: toCss(value) };
  }

  const ACTIONS = {
    "dir-row": () => ({ "flex-direction": "row" }),
    "dir-column": () => ({ "flex-direction": "column" }),
    "fill-none": () => ({ "background-color": "" }),
    "color-none": () => ({ color: "" }),
    "ta-left": () => ({ "text-align": "left" }),
    "ta-center": () => ({ "text-align": "center" }),
    "ta-right": () => ({ "text-align": "right" }),
    "ta-justify": () => ({ "text-align": "justify" }),
    "stroke-none": () => STROKE_CLEAR,
    clip: (el) => ({ overflow: el.checked ? "hidden" : "" }),
    wrap: (el) => ({ "flex-wrap": el.checked ? "wrap" : "" }),
    grow: (el) => ({ "flex-grow": el.checked ? "1" : "" }),
  };

  host.oninput = (e) => {
    const el = /** @type {HTMLInputElement} */ (e.target);
    if (el.matches?.("input.pp-input")) setStyles(patchForField(el.dataset.px || "", el.value));
    else if (el.matches?.('input[type="color"]')) {
      const prop = el.dataset.pxColor || "";
      const text = /** @type {HTMLInputElement | null} */ (host.querySelector(`input.pp-input[data-px="${prop}"]`));
      if (text) text.value = el.value;
      setStyles({ [prop]: el.value });
    }
  };
  host.onchange = (e) => {
    const el = /** @type {HTMLInputElement} */ (e.target);
    if (el.matches?.("select.pp-select")) setStyles(patchForField(el.dataset.px || "", el.value), true);
    else if (el.dataset?.pxAct && ACTIONS[el.dataset.pxAct]) setStyles(ACTIONS[el.dataset.pxAct](el), true);
  };
  host.onclick = (e) => {
    const swatch = /** @type {HTMLElement} */ (e.target).closest?.("[data-px-token]");
    if (swatch) { setStyles({ [swatch.dataset.pxProp || ""]: `var(${swatch.dataset.pxToken})` }, true); return; }
    const btn = /** @type {HTMLElement} */ (e.target).closest?.("[data-px-act]");
    const act = btn?.getAttribute("data-px-act") || "";
    if (!btn || btn.tagName !== "BUTTON") return;
    if (act === "copy-rule") { copyRule(ruleText); return; }
    if (ACTIONS[act]) { setStyles(ACTIONS[act](btn), true); return; }
    const patch = alignPatch(/** @type {any} */ (act), node.parent);
    if (patch) setStyles(patch, true);
    else showToast("O elemento pai não é flex: defina o layout do pai para alinhar na vertical.");
  };
  host.onkeydown = (e) => {
    const el = /** @type {HTMLInputElement} */ (e.target);
    if (!el.matches?.("input.pp-input") || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
    const next = stepValue(el.value, (e.key === "ArrowUp" ? 1 : -1) * (e.shiftKey ? 10 : 1));
    if (next === null) return;
    e.preventDefault();
    el.value = next;
    el.dispatchEvent(new Event("input", { bubbles: true }));
  };
  // Ao sair de um campo, pede as medidas novas ao iframe (L/A mudam com Ajustar/Preencher).
  host.onfocusout = () => window.setTimeout(() => ctx.post({ type: "HARNESS_PROTO_STYLE", pid, styles: {} }), 60);

  current = {
    host,
    node,
    structure: structureOf(node),
    refresh(msg) {
      node.computed = msg.computed || node.computed;
      node.size = msg.size || node.size;
      node.parent = msg.parent || node.parent;
      node.tokens = msg.tokens || node.tokens;
      if (document.activeElement?.matches?.("input.pp-input") && host.contains(document.activeElement)) return;
      if (Object.keys(pending).length) return;
      render();
    },
  };
  render();
  code.reload();
}

/** Medidas novas vindas do iframe (HARNESS_PROTO_METRICS): redesenha se o painel estiver livre. */
export function updatePropsMetrics(msg) {
  if (current && msg && current.node?.pid === msg.pid) current.refresh(msg);
}

function copyRule(text) {
  if (!text) return;
  const done = () => showToast("Classe copiada.");
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done, () => showToast("Não foi possível copiar."));
  else showToast("Não foi possível copiar.");
}
