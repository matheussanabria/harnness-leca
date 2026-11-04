// @ts-check
// Connects the Studio chat to the canvas islands (EP-19.07 and 19.08), like prototype-chat-bridge does for the Atelier.
// The island publishes its state with `harness:canvas-state`; this bridge adds it to the prompt and hands the
// <mindmap> blocks of the answer back to the island with `harness:canvas-apply` (legacy and islands never share modules).
import { showToast } from "../shared/dom.js";

export const CANVAS_STATE_EVENT = "harness:canvas-state";
export const CANVAS_APPLY_EVENT = "harness:canvas-apply";
const MAX_BLOCKS = 3;
const MAX_BLOCK_CHARS = 20000;

/** @typedef {{ boardId: string, title: string, selectedId: string, selectedText: string, outline: string }} CanvasState */

/** @type {{ kind: string, slug: string } | null} */
let context = null;
/** @type {CanvasState | null} */
let latest = null;
/** @type {{ boardId: string, hash: string } | null} */
let sent = null;
let listening = false;

const RULES = `Você está no canvas de Mapas Mentais do harness. Para criar ou expandir o mapa, responda com um bloco neste formato exato:
<mindmap parent="selected">
- Tópico
  - Subtópico
</mindmap>
Use lista com "-" e 2 espaços por nível, no máximo 4 níveis e 40 tópicos por bloco, com textos curtos.
parent="selected" adiciona sob o nó selecionado; parent="root" adiciona sob a raiz; mode="new" substitui o mapa inteiro (o primeiro tópico vira a raiz).
Fora do bloco, explique em 1-2 frases o que foi feito. Para apenas conversar, responda sem o bloco.`;

/** @param {Event} event */
function onState(event) {
  const detail = /** @type {CustomEvent} */ (event).detail;
  latest = detail && typeof detail.boardId === "string" ? /** @type {CanvasState} */ (detail) : null;
}

/** Activates (or, with null, deactivates) the canvas mode of the chat. @param {{ kind: string, slug: string } | null} next */
export function setCanvasChatContext(next) {
  context = next;
  sent = null;
  if (!next) latest = null;
  if (next && !listening && typeof window !== "undefined") {
    window.addEventListener(CANVAS_STATE_EVENT, onState);
    listening = true;
  }
}

export function isCanvasChatActive() {
  return context !== null;
}

/** Forgets what was already sent: the next message carries the rules and the map again. */
export function resetCanvasPromptState() {
  sent = null;
}

/** Short djb2 hash to know whether the map changed since the last message. @param {string} text */
function hashText(text) {
  let h = 5381;
  for (let i = 0; i < text.length; i += 1) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return String(h);
}

/**
 * Builds the prompt for the canvas chat. New session: rules + current map. Resumed session: only the request, plus the
 * map when it changed since the last message. Without an open board the text goes through untouched.
 * @param {string} text @param {{ resumed?: boolean }} [opts]
 */
export function wrapCanvasPrompt(text, opts = {}) {
  if (!context || !latest) return text;
  const hash = hashText(`${latest.title}\u0000${latest.selectedId}\u0000${latest.outline}`);
  const fresh = !opts.resumed || !sent || sent.boardId !== latest.boardId;
  const changed = fresh || !sent || sent.hash !== hash;
  sent = { boardId: latest.boardId, hash };
  if (!changed) return text;
  const selected = latest.selectedText ? ` (nó selecionado: "${latest.selectedText}")` : "";
  const map = `Mapa atual "${latest.title}"${selected}:\n${latest.outline}`;
  if (fresh) return `${RULES}\n\n${map}\n\nPedido do usuário:\n${text}`;
  return `O mapa mudou desde a última mensagem.\n${map}\n\nPedido do usuário:\n${text}`;
}

/** @param {string} raw */
function readAttributes(raw) {
  const attr = (/** @type {string} */ name) => new RegExp(`${name}\\s*=\\s*"([^"]*)"`, "i").exec(raw)?.[1]?.trim().toLowerCase() || "";
  const mode = attr("mode") === "new" ? "new" : "append";
  const parent = attr("parent") === "root" ? "root" : "selected";
  return { mode, parent };
}

/**
 * Extracts the <mindmap> blocks of an answer (at most 3, each capped), leaving the outline parsing to the island.
 * @param {string} fullText
 * @returns {Array<{ mode: "append" | "new", parent: "selected" | "root", body: string }>}
 */
export function extractMindmapBlocks(fullText) {
  const blocks = [];
  const pattern = /<\s*mindmap([^>]*)>([\s\S]*?)<\s*\/\s*mindmap\s*>/gi;
  for (const match of String(fullText || "").matchAll(pattern)) {
    if (blocks.length >= MAX_BLOCKS) break;
    const body = match[2].replace(/^\s*\n/, "").trimEnd().slice(0, MAX_BLOCK_CHARS);
    if (body.trim()) blocks.push({ ...readAttributes(match[1]), body });
  }
  return blocks;
}

/** Hands the blocks of an answer to the open map. @param {string} fullText */
export function applyCanvasReply(fullText) {
  if (!context || !latest || !/<\s*mindmap/i.test(fullText || "")) return;
  const blocks = extractMindmapBlocks(fullText);
  if (!blocks.length) return;
  window.dispatchEvent(new CustomEvent(CANVAS_APPLY_EVENT, { detail: { boardId: latest.boardId, blocks } }));
  showToast(blocks.length === 1 ? "Mapa mental atualizado pelo chat" : `Mapa mental atualizado pelo chat (${blocks.length} blocos)`);
}
