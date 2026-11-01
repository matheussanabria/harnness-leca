// @ts-check
// DAI HQ — Armário de Conversas: lista paginada do diário de bordo.
// Só a página atual entra no DOM; o diário pode ter centenas de sessões.
import { bindPager, paginate, renderPager } from "../shared/pagination.js";

export const CABINET_PAGE_SIZE = 20;

const ENGINE_STYLES = [
  ["claude", "#d97757", "CLAUDE"],
  ["gemini", "#5c87f2", "GEMINI"],
  ["opencode", "#3cb371", "OPENCODE"],
];

/** @param {any} s @param {string} q */
function matchesSession(s, q) {
  if (!q) return true;
  const has = (/** @type {string} */ v) => String(v || "").toLowerCase().includes(q);
  return has(s.titulo) || has(s.file) || (s.prompts || []).some(has) || (s.edited || []).some(has);
}

/** @param {any} s */
function renderSessionItem(s) {
  const ag = String(s.agente || "harness").toLowerCase();
  const style = ENGINE_STYLES.find(([key]) => ag.includes(key));
  const agCol = style ? style[1] : "#94a3b8";
  const agBadge = style ? style[2] : ag.toUpperCase();
  const promptText = s.prompts && s.prompts[0] ? s.prompts[0] : "";
  return `
          <div class="chat-item-row" onclick="window.location.href='/?chat=${encodeURIComponent(s.file || "")}'" style="border-left:3px solid ${agCol}">
            <div class="chat-item-info">
              <div style="display:flex;align-items:center;gap:6px">
                <span style="font-size:9.5px;font-weight:700;padding:1px 5px;border-radius:3px;background:${agCol}22;color:${agCol};border:1px solid ${agCol}55">${agBadge}</span>
                <span class="chat-item-title">${s.titulo || s.file}</span>
              </div>
              <span class="chat-item-meta">${s.inicio || ""} · ${s.toolCount || 0} tools · ${s.prompts?.length || 0} pedidos</span>
              ${promptText ? `<span style="font-size:11px;color:#94a3b8;font-style:italic;margin-top:2px;display:block">"${promptText.slice(0, 80)}..."</span>` : ""}
            </div>
            <span style="font-size:12px;color:var(--office-accent);font-weight:700">Abrir <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i></span>
          </div>`;
}

/**
 * Lista do armário, paginada.
 * @param {any[]} days
 * @param {any[]} fallbackChats
 * @param {string} [filterText]
 * @param {number} [page]
 * @returns {string}
 */
export function renderCabinetJournalItems(days, fallbackChats, filterText = "", page = 1) {
  const q = (filterText || "").trim().toLowerCase();
  const empty = `<div style="color:var(--office-mute);padding:14px 0;font-style:italic;text-align:center">Nenhuma conversa encontrada.</div>`;

  /** @type {{ day: string, session: any }[]} */
  const flat = [];
  for (const d of days || []) {
    for (const s of (d.sessions || []).filter((/** @type {any} */ x) => matchesSession(x, q))) flat.push({ day: d.day, session: s });
  }

  if (flat.length) {
    const data = paginate(flat, page, CABINET_PAGE_SIZE);
    let html = "";
    let lastDay = "";
    for (const { day, session } of data.items) {
      if (day !== lastDay) {
        const total = flat.filter((e) => e.day === day).length;
        html += `<div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;padding:4px 0"><i class="fa-solid fa-calendar-days" aria-hidden="true"></i> ${day} (${total} sessões)</div>`;
        lastDay = day;
      }
      html += renderSessionItem(session);
    }
    return html + renderPager(data, { label: "Paginação do armário", key: "cabinet" });
  }

  const chats = (fallbackChats || []).filter((c) => !q || (c.title || c.name || c.id || "").toLowerCase().includes(q));
  if (!chats.length) return empty;
  const data = paginate(chats, page, CABINET_PAGE_SIZE);
  const rows = data.items
    .map(
      (c) => `
      <div class="chat-item-row" onclick="window.location.href='/?chat=${encodeURIComponent(c.id || c.name || "")}'">
        <div class="chat-item-info">
          <span class="chat-item-title">${c.title || c.name || c.id}</span>
          <span class="chat-item-meta">${c.date || "Sem data"} · ${c.engine || "motor"}</span>
        </div>
        <span style="font-size:12px;color:var(--office-accent)">Abrir <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i></span>
      </div>`,
    )
    .join("");
  return rows + renderPager(data, { label: "Paginação do armário", key: "cabinet" });
}

/**
 * Desenha a lista no container e liga o paginador.
 * @param {HTMLElement} listEl
 * @param {any[]} days
 * @param {any[]} chats
 * @param {string} [q]
 * @param {number} [page]
 */
export function mountCabinetList(listEl, days, chats, q = "", page = 1) {
  listEl.innerHTML = renderCabinetJournalItems(days, chats, q, page);
  bindPager(listEl, (next) => mountCabinetList(listEl, days, chats, q, next), "cabinet");
}
