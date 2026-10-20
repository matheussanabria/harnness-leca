// @ts-check
import { esc } from "../../shared/dom.js";
import { renderCodeBlockHtml, bindCodeBlock } from "./canvas-code-block.js";

const SIZES = [[1280, "fa-desktop"], [768, "fa-tablet-screen-button"], [390, "fa-mobile-screen-button"]];

export function applyGeometry(el, item) {
  el.style.left = `${item.x}px`;
  el.style.top = `${item.y}px`;
  el.style.width = `${item.w}px`;
  el.style.height = `${item.h}px`;
  el.style.zIndex = String(item.z);
}

/**
 * Cria o elemento DOM de um item. `ctx.renderUrl(screen)` devolve a URL do iframe
 * e `ctx.commit(item)` avisa que o item mudou (persistência).
 */
export function buildItemEl(item, ctx) {
  const el = document.createElement("div");
  el.className = `cv-item cv-${item.kind}`;
  el.dataset.id = item.id;
  el.dataset.kind = item.kind;
  applyGeometry(el, item);
  const builders = { frame: fillFrame, text: fillText, sticky: fillSticky, rect: fillRect, code: fillCode };
  (builders[item.kind] || fillRect)(el, item, ctx);
  return el;
}

function fillFrame(el, item, ctx) {
  const sizes = SIZES.map(([w, icon]) => `<button type="button" class="cv-mini" data-nodrag data-size="${w}" title="${w}px"><i class="fa-solid ${icon}"></i></button>`).join("");
  el.innerHTML = `
    <div class="cv-label" data-drag>
      <span class="cv-frame-title" data-title>${esc(item.title || item.screen)}</span>
      <span class="cv-frame-sizes">${sizes}
        <button type="button" class="cv-mini" data-nodrag data-act="interact" title="Interagir com a tela"><i class="fa-solid fa-hand-pointer"></i></button>
        <button type="button" class="cv-mini" data-nodrag data-act="reload" title="Recarregar"><i class="fa-solid fa-rotate"></i></button>
      </span>
    </div>
    <div class="cv-frame-body"><iframe sandbox="allow-scripts" title="${esc(item.title || item.screen)}"></iframe><div class="cv-shield"></div></div>`;
  const iframe = /** @type {HTMLIFrameElement} */ (el.querySelector("iframe"));
  iframe.src = ctx.renderUrl(item.screen);
  el.querySelector('[data-act="interact"]')?.addEventListener("click", () => ctx.interact(item));
  el.querySelector('[data-act="reload"]')?.addEventListener("click", () => { iframe.src = ctx.renderUrl(item.screen); });
  el.querySelectorAll("[data-size]").forEach((button) => button.addEventListener("click", () => {
    item.w = Number(/** @type {HTMLElement} */ (button).dataset.size);
    applyGeometry(el, item);
    ctx.commit(item);
  }));
}

function fillText(el, item, ctx) {
  el.textContent = item.text;
  el.style.fontSize = `${item.size}px`;
  makeEditable(el, item, ctx);
}

function fillSticky(el, item, ctx) {
  el.style.background = item.color;
  el.textContent = item.text;
  makeEditable(el, item, ctx);
}

function fillRect(el, item) {
  el.style.background = item.fill;
}

function fillCode(el, item, ctx) {
  el.innerHTML = renderCodeBlockHtml(item);
  bindCodeBlock(el, item, () => ctx.commit(item));
}

/** Edição de texto inline: duplo clique entra, perder o foco confirma. */
function makeEditable(el, item, ctx) {
  el.addEventListener("dblclick", () => {
    el.contentEditable = "plaintext-only";
    el.classList.add("is-editing");
    el.focus();
  });
  el.addEventListener("blur", () => {
    el.contentEditable = "false";
    el.classList.remove("is-editing");
    item.text = el.innerText;
    ctx.commit(item);
  });
}

export function itemIframe(el) {
  return /** @type {HTMLIFrameElement|null} */ (el?.querySelector(".cv-frame-body iframe") || null);
}

export function reloadFrame(el, item, ctx) {
  const iframe = itemIframe(el);
  if (iframe) iframe.src = ctx.renderUrl(item.screen);
}
