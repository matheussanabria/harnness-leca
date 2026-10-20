// @ts-check
// Acesso ao iframe do Studio e extração de dados do elemento clicado.
import { $ } from "../shared/dom.js";

/**
 * Retorna o documento do iframe do Studio caso seja da mesma origem.
 * @returns {Document | null}
 */
export function getIframeDoc() {
  const frame = /** @type {HTMLIFrameElement} */ ($("studioIframe"));
  if (!frame) return null;
  try {
    const doc = frame.contentDocument || frame.contentWindow?.document || null;
    if (doc && doc.body) return doc;
    return null;
  } catch {
    return null;
  }
}

/**
 * Retorna a janela (window) do iframe caso acessível.
 * @returns {Window | null}
 */
export function getIframeWin() {
  const frame = /** @type {HTMLIFrameElement} */ ($("studioIframe"));
  if (!frame) return null;
  try {
    return frame.contentWindow || null;
  } catch {
    return null;
  }
}

/**
 * Normaliza o nome do componente Angular removendo prefixos de compilação do esbuild/Angular (_ e ɵ).
 * @param {string} name
 * @returns {string}
 */
export function normalizeComponentName(name) {
  if (!name || typeof name !== "string") return "";
  return name.replace(/^[_ɵ]+/, "").trim();
}

/**
 * Extrai o objeto target estruturado do elemento clicado filtrando runtime do Angular.
 * @param {HTMLElement} el
 */
export function extractTargetInfo(el) {
  if (!el || !el.tagName) return null;
  const tagName = el.tagName.toLowerCase();

  // Texto próprio direto apenas dos nós de texto diretos
  let directText = "";
  if (el.childNodes) {
    for (let i = 0; i < el.childNodes.length; i++) {
      const node = el.childNodes[i];
      if (node.nodeType === 3 /* TEXT_NODE */) {
        directText += node.nodeValue || "";
      }
    }
  }
  directText = directText.replace(/\s+/g, " ").trim().slice(0, 200);

  // Atributos estáticos e classes filtrando runtime Angular
  const attributes = {};
  const classes = [];
  if (el.attributes) {
    for (let i = 0; i < el.attributes.length; i++) {
      const attr = el.attributes[i];
      const name = attr.name.toLowerCase();
      if (
        name.startsWith("_ngcontent") ||
        name.startsWith("_nghost") ||
        name.startsWith("ng-reflect") ||
        name === "ng-version"
      ) {
        continue;
      }
      if (name === "class") {
        const parts = attr.value.trim().split(/\s+/).filter(Boolean);
        for (const cls of parts) {
          if (!cls.startsWith("ng-")) {
            classes.push(cls);
          }
        }
        if (classes.length > 0) {
          attributes["class"] = classes.join(" ");
        }
      } else {
        attributes[name] = attr.value;
      }
    }
  }

  // Índices de irmãos
  let siblingIndex = 0;
  let sameTagSiblingIndex = 0;
  let prev = el.previousElementSibling;
  while (prev) {
    siblingIndex++;
    if (prev.tagName.toLowerCase() === tagName) {
      sameTagSiblingIndex++;
    }
    prev = prev.previousElementSibling;
  }

  return {
    tagName,
    text: directText,
    attributes,
    classes,
    siblingIndex,
    sameTagSiblingIndex,
  };
}
