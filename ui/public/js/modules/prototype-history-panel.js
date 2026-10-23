// @ts-check
import { $, esc, showToast } from "../shared/dom.js";
import { historyRows, moveToast } from "./prototype-history-model.js";

/**
 * Histórico do Ateliê: botões Desfazer/Refazer, lista de tudo o que aconteceu no protótipo e salto para qualquer ponto.
 * O estado vive no servidor (`.history/` do protótipo), então sobrevive a recarregar a página e a reiniciar o servidor.
 */

/** @type {{ cursor: number, canUndo: boolean, canRedo: boolean, entries: any[] } | null} */
let data = null;
let ctx = null;
let timer = 0;
let open = false;

const base = () => `/api/project/${encodeURIComponent(ctx.slug)}/design/prototypes/${encodeURIComponent(ctx.protoId)}/history`;

/**
 * @param {{ slug: string, protoId: string, onMoved: () => Promise<void> | void }} context
 */
export function mountHistory(context) {
  ctx = context;
  data = null;
  open = false;
  const undo = $("btnAtelierUndo");
  const redo = $("btnAtelierRedo");
  if (undo) undo.onclick = () => void runHistory("undo");
  if (redo) redo.onclick = () => void runHistory("redo");
  const toggle = $("btnAtelierHistory");
  if (toggle) toggle.onclick = () => setOpen(!open);
  const panel = $("atelierHistoryPanel");
  if (panel) {
    panel.onclick = (event) => {
      const target = /** @type {HTMLElement} */ (event.target);
      if (target.closest("[data-history-close]")) { setOpen(false); return; }
      const pin = /** @type {HTMLElement | null} */ (target.closest("[data-history-pin]"));
      if (pin) { void togglePin(Number(pin.dataset.historyPin), pin.dataset.pinned === "1"); return; }
      if (target.closest("[data-history-mark]")) { void togglePin(data ? data.cursor : -1, false); return; }
      const row = /** @type {HTMLElement | null} */ (target.closest("[data-history-index]"));
      if (row && !row.classList.contains("current")) void runHistory("goto", Number(row.dataset.historyIndex));
    };
  }
  void refreshHistory();
}

/** Atualiza botões e lista (agrupa chamadas seguidas). */
export function refreshHistorySoon() {
  if (!ctx) return;
  clearTimeout(timer);
  timer = window.setTimeout(() => void refreshHistory(), 200);
}

export async function refreshHistory() {
  if (!ctx) return;
  try {
    const res = await fetch(base());
    if (!res.ok) return;
    data = await res.json();
    paint();
  } catch {}
}

function setOpen(next) {
  open = next;
  const panel = $("atelierHistoryPanel");
  if (panel) panel.hidden = !open;
  $("btnAtelierHistory")?.classList.toggle("active", open);
  $("btnAtelierHistory")?.setAttribute("aria-expanded", String(open));
  if (open) void refreshHistory();
}

/** Marca o ponto (pede um nome) ou tira a marca. */
async function togglePin(index, pinned) {
  if (!ctx || index < 0) return;
  let name = "";
  if (!pinned) {
    const entry = data && data.entries ? data.entries[index] : null;
    name = (window.prompt("Nome do ponto (ex.: antes de mexer na Nova prescrição):", entry && entry.label !== "Estado inicial" ? entry.label : "") || "").trim();
    if (!name) return;
  }
  try {
    const res = await fetch(`${base()}/checkpoint`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, index }) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) { showToast(body.error || "Não foi possível marcar o ponto."); return; }
    data = body;
    showToast(pinned ? "Ponto desmarcado." : `Ponto marcado: ${name}`);
    paint();
  } catch {
    showToast("Falha de rede ao marcar o ponto.");
  }
}

/** Desfaz, refaz ou volta para uma entrada. Devolve true se mexeu no protótipo. */
export async function runHistory(action, index) {
  if (!ctx) return false;
  if (data && action === "undo" && !data.canUndo) { showToast("Nada para desfazer."); return false; }
  if (data && action === "redo" && !data.canRedo) { showToast("Nada para refazer."); return false; }
  const before = data && data.entries ? data.entries[data.cursor] : null;
  try {
    const res = await fetch(`${base()}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(action === "goto" ? { index } : {}),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) { showToast(body.error || "Não foi possível mudar o histórico."); return false; }
    data = body;
    const label = action === "undo" ? (before && before.label) || "alteração" : body.entry ? body.entry.label : "";
    showToast(moveToast(action, label));
    paint();
    await ctx.onMoved();
    return true;
  } catch {
    showToast("Falha de rede ao usar o histórico.");
    return false;
  }
}

function paint() {
  if (!data) return;
  const undo = /** @type {HTMLButtonElement | null} */ ($("btnAtelierUndo"));
  const redo = /** @type {HTMLButtonElement | null} */ ($("btnAtelierRedo"));
  if (undo) undo.disabled = !data.canUndo;
  if (redo) redo.disabled = !data.canRedo;
  const count = $("atelierHistoryCount");
  if (count) count.textContent = String(Math.max(0, data.entries.length - 1));
  const list = $("atelierHistoryList");
  if (!list || !open) return;
  const rows = historyRows(data);
  list.innerHTML = rows.map((r) => `
    <li class="history-row${r.current ? " current" : ""}${r.future ? " future" : ""}" data-history-index="${r.index}" tabindex="0" role="button" title="${esc(r.detail || r.label)}">
      <i class="fa-solid ${r.icon}" aria-hidden="true"></i>
      <span class="history-main"><b>${esc(r.checkpoint || r.label)}</b>${r.checkpoint ? `<small>${esc(r.label)}</small>` : r.files ? `<small>${esc(r.files)}</small>` : ""}</span>
      <span class="history-when">${r.current ? "agora no protótipo" : esc(r.when)}</span>
      <button type="button" class="history-pin${r.checkpoint ? " on" : ""}" data-history-pin="${r.index}" data-pinned="${r.checkpoint ? 1 : 0}" title="${r.checkpoint ? "Desmarcar ponto" : "Marcar como ponto nomeado"}" aria-label="Ponto nomeado"><i class="fa-${r.checkpoint ? "solid" : "regular"} fa-star"></i></button>
    </li>`).join("") || '<li class="history-empty">Nenhuma alteração ainda.</li>';
}
