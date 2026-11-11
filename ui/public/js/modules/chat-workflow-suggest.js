// @ts-check
// Autocomplete for chat commands and workflow slugs; the list comes from the server catalog (no local copy).
import { esc } from "../shared/dom.js";

const INPUT_IDS = new Set(["chatInput", "studioChatInput", "miniChatInput"]);
/** @type {Promise<any>|null} */
let cache = null;

function load() {
  const empty = { commands: [], workflows: [] };
  cache ||= fetch("/api/orchestration/workflow-commands").then((r) => (r.ok ? r.json() : empty)).catch(() => empty);
  return cache;
}

/**
 * Pure: suggestions for the current input value.
 * @param {string} value @param {any} data
 */
export function buildSuggestions(value, data) {
  const v = String(value || "");
  if (!v.startsWith("/")) return [];
  const slugMatch = /^\/workflow\s+(\S*)$/i.exec(v);
  if (slugMatch) {
    const part = slugMatch[1].toLowerCase();
    return (data.workflows || [])
      .filter((w) => w.slug.startsWith(part))
      .map((w) => ({ insert: `/workflow ${w.slug} `, title: w.slug, hint: w.description, icon: "fa-diagram-project" }));
  }
  if (/\s/.test(v)) return [];
  return (data.commands || [])
    .filter((c) => c.command.startsWith(v.toLowerCase()))
    .map((c) => ({ insert: `${c.command} `, title: c.command, hint: c.description, icon: "fa-terminal" }));
}

/** @param {HTMLElement} input */
function popover(input) {
  let box = document.getElementById("wfSuggest");
  if (!box) {
    box = document.createElement("div");
    box.id = "wfSuggest";
    box.className = "wf-suggest";
  }
  // A modal <dialog> lives in the top layer: the popover must be inside it to be visible.
  const host = input.closest("dialog") || document.body;
  if (box.parentElement !== host) host.appendChild(box);
  const r = input.getBoundingClientRect();
  Object.assign(box.style, { left: `${r.left}px`, width: `${r.width}px`, bottom: `${window.innerHeight - r.top + 4}px` });
  return box;
}

function hide() {
  const box = document.getElementById("wfSuggest");
  if (box) box.hidden = true;
}

export function installWorkflowSuggest() {
  document.addEventListener("input", async (ev) => {
    const input = /** @type {HTMLTextAreaElement} */ (ev.target);
    if (!input?.id || !INPUT_IDS.has(input.id)) return;
    const items = buildSuggestions(input.value, await load());
    if (!items.length) return hide();
    const box = popover(input);
    box.hidden = false;
    box.innerHTML = items
      .map((it, i) => `<button type="button" class="wf-suggest-item" data-i="${i}"><i class="fa-solid ${it.icon}"></i> <b>${esc(it.title)}</b> <span>${esc(it.hint)}</span></button>`)
      .join("");
    box.onmousedown = (e) => {
      const b = /** @type {HTMLElement} */ (e.target).closest(".wf-suggest-item");
      if (!b) return;
      e.preventDefault();
      input.value = items[Number(/** @type {HTMLElement} */ (b).dataset.i)].insert;
      input.focus();
      hide();
    };
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") hide(); });
  document.addEventListener("focusout", () => setTimeout(hide, 150));
}
