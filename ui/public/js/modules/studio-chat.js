// @ts-check
// Controlador de chat compartilhado, injeção contextual e integração lateral no Studio.

import { $ } from "../shared/dom.js";
import { chatPresentation } from "./chat-presentations.js";

/**
 * Obtém os elementos DOM da apresentação de chat do Studio a partir do contrato canônico.
 * @param {Document | null} [doc]
 * @returns {Record<string, HTMLElement | null>}
 */
export function getStudioChatElements(doc = typeof document !== "undefined" ? document : null) {
  const p = chatPresentation("studio");
  if (!doc) return {};
  return {
    input: /** @type {HTMLElement | null} */ (doc.getElementById(p.input)),
    history: doc.getElementById(p.history),
    scrollButton: doc.getElementById(p.scrollButton),
    attachTray: doc.getElementById(p.attachTray),
    statusText: doc.getElementById(p.statusText),
    sendButton: doc.getElementById(p.sendButton),
    cancelButton: doc.getElementById(p.cancelButton),
    sidebar: doc.getElementById(p.sidebar),
    resizer: doc.getElementById(p.resizer),
  };
}

/**
 * Formata um bloco de contexto para injeção limpa no compositor do Studio.
 * @param {"code" | "element" | "prompt"} type
 * @param {Record<string, any>} payload
 * @returns {string}
 */
export function formatContextBlock(type, payload = {}) {
  if (type === "code") {
    const { file = "arquivo", lines = "", code = "" } = payload;
    const linesAttr = lines ? ` linhas="${lines}"` : "";
    return `\n<contexto-codigo arquivo="${file}"${linesAttr}>\n${code.trim()}\n</contexto-codigo>\n`;
  }
  if (type === "element") {
    const { nodeId = "", component = "", selector = "", file = "" } = payload;
    const fileAttr = file ? ` arquivo="${file}"` : "";
    const compAttr = component ? ` componente="${component}"` : "";
    const selAttr = selector ? ` seletor="${selector}"` : "";
    return `\n<contexto-elemento node-id="${nodeId}"${fileAttr}${compAttr}${selAttr}></contexto-elemento>\n`;
  }
  if (type === "prompt") {
    return `\n${String(payload.text || "").trim()}\n`;
  }
  return "";
}

/**
 * Injeta um bloco de contexto (código, elemento da árvore ou prompt) no compositor ativo do Studio.
 * @param {"code" | "element" | "prompt"} type
 * @param {Record<string, any>} payload
 * @param {HTMLTextAreaElement | null} [targetInput]
 * @returns {boolean}
 */
export function insertStudioContext(type, payload = {}, targetInput) {
  const input = targetInput || /** @type {HTMLTextAreaElement | null} */ ($("studioChatInput"));
  if (!input) return false;

  const block = formatContextBlock(type, payload);
  if (!block) return false;

  const start = input.selectionStart || input.value.length;
  const end = input.selectionEnd || input.value.length;
  const before = input.value.substring(0, start);
  const after = input.value.substring(end);

  input.value = `${before}${block}${after}`;
  const newPos = start + block.length;
  input.selectionStart = newPos;
  input.selectionEnd = newPos;

  if (typeof input.dispatchEvent === "function") {
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }
  input.focus();
  return true;
}

/**
 * Trata eventos de teclado no compositor do Studio.
 * @param {KeyboardEvent} e
 * @param {Function} [sendFn]
 * @returns {boolean} True se o evento foi tratado e prevenido
 */
export function handleStudioChatKey(e, sendFn = sendStudioChatMessage) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendFn();
    return true;
  }
  if (e.key === "Escape") {
    if (typeof window !== "undefined" && typeof window.closeAllChatMenus === "function") {
      window.closeAllChatMenus();
      return true;
    }
  }
  return false;
}

/**
 * Despacha o envio da mensagem da apresentação do Studio usando o pipeline universal do chat.
 */
export function sendStudioChatMessage() {
  const inp = /** @type {HTMLTextAreaElement | null} */ ($("studioChatInput"));
  if (!inp) return;
  const txt = inp.value.trim();
  if (!txt) return;

  if (typeof window !== "undefined" && typeof window.sendChatMessage === "function") {
    window.sendChatMessage("studio");
  }
}

/**
 * Alterna a visibilidade da barra lateral de chat do Studio mantendo o estado de redimensionamento.
 * @param {boolean} [force]
 * @param {Object} [elements]
 * @param {HTMLElement | null} [elements.sidebar]
 * @param {HTMLElement | null} [elements.resizer]
 * @returns {boolean} Novo estado de visibilidade
 */
export function toggleStudioChatSidebar(force, elements) {
  const sidebar = elements?.sidebar || (typeof document !== "undefined" ? $("studioSidebar") : null);
  const resizer = elements?.resizer || (typeof document !== "undefined" ? $("studioSidebarResizer") : null);
  if (!sidebar) return false;

  const willShow = force != null ? force : sidebar.style.display === "none";
  sidebar.style.display = willShow ? "" : "none";
  if (resizer) resizer.style.display = willShow ? "" : "none";

  return willShow;
}

/**
 * Sincroniza o rascunho compartilhado (draft) com o compositor do Studio.
 * @param {string} [draftText]
 * @param {HTMLTextAreaElement | null} [targetInput]
 * @returns {string}
 */
export function syncStudioChatDraft(draftText, targetInput) {
  const inp = targetInput || /** @type {HTMLTextAreaElement | null} */ (typeof document !== "undefined" ? $("studioChatInput") : null);
  if (!inp) return "";
  if (draftText != null) {
    inp.value = draftText;
  }
  return inp.value;
}

