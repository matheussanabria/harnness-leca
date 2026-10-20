// @ts-check
// Renderização da lista de conversas (tabela, lista e estado vazio).
import { esc, fmt } from "../shared/dom.js";
import { state } from "../shared/state.js";
import { getGroupById } from "./groups.js";
import { renderPaginationHtml } from "./projects-chat-actions.js";
import { renderEngineCounts, renderGroupChips, filterAndSortChats, renderResultCount } from "./projects-chat-filters.js";

/** Estado vazio com atalho para limpar filtros. */
export function renderEmptyChats() {
  $("chats").innerHTML = `
      <div style="padding:36px 12px;text-align:center;background:var(--panel);border:1px solid var(--line);border-radius:12px;margin-top:8px">
        <div style="font-size:28px;margin-bottom:8px">🔍</div>
        <div style="font-weight:600;font-size:15px;color:var(--text);margin-bottom:4px">Nenhuma conversa encontrada</div>
        <p class="empty" style="margin:0 0 16px">Nenhum resultado corresponde aos filtros de motor, grupo ou busca aplicados.</p>
        <button type="button" class="btn-chat-action" style="padding:6px 16px" onclick="resetAllChatFilters()">↺ Limpar Filtros e Busca</button>
      </div>
  `;
}

/** Visão em tabela. */
export function renderChatsTable(pageItems, totalFiltered) {
  const sortArrow = (f) => {
    const isCurrent = state.chatSortField === f;
    const arrow = isCurrent ? (state.chatSortAsc ? "▲" : "▼") : "⇅";
    return `<span class="sort-arrow ${isCurrent ? "active" : ""}">${arrow}</span>`;
  };

  let tableHtml = `
    <div class="chats-table-wrap">
      <table class="chats-table">
        <thead>
          <tr>
            <th class="col-agent" onclick="toggleSort('agent')" title="Ordenar por motor"><span class="th-content">Motor ${sortArrow("agent")}</span></th>
            <th class="col-title" onclick="toggleSort('title')" title="Ordenar por título"><span class="th-content">Título da Conversa ${sortArrow("title")}</span></th>
            <th class="col-group" onclick="toggleSort('group')" title="Ordenar por grupo"><span class="th-content">Grupo / Subgrupo ${sortArrow("group")}</span></th>
            <th class="col-status" onclick="toggleSort('status')" title="Ordenar por status"><span class="th-content">Status ${sortArrow("status")}</span></th>
            <th class="col-turns" onclick="toggleSort('turns')" title="Ordenar por quantidade de turnos"><span class="th-content">Turnos ${sortArrow("turns")}</span></th>
            <th class="col-date" onclick="toggleSort('mtime')" title="Ordenar por data de modificação"><span class="th-content">Data / Modificação ${sortArrow("mtime")}</span></th>
            <th class="col-actions no-sort" style="text-align:right">Ações</th>
          </tr>
        </thead>
        <tbody>
  `;

  pageItems.forEach((c) => {
    const ag =
      c.agent === "gemini"
        ? '<span class="tag" style="color:#7ca5f5;border-color:#7ca5f544;font-weight:600">✦ Gemini</span>'
        : c.agent === "opencode"
        ? '<span class="tag" style="color:#7de2a3;border-color:#7de2a344;font-weight:600">◆ OpenCode</span>'
        : '<span class="tag" style="color:#d97757;border-color:#d9775744;font-weight:600">✱ Claude</span>';
    const stClass = c.status === "ok" ? "status-ok" : c.status === "alterada" ? "status-alterada" : "status-nova";
    const stLabel = c.status === "ok" ? "✓ em dia" : c.status === "alterada" ? "↻ alterada" : "⏳ pendente";
    const stBadge = `<span class="status-badge ${stClass}">${stLabel}</span>`;

    let grpBadge = "";
    if (c.group || c.groupId) {
      const gObj = getGroupById(c.groupId);
      const color = (gObj && gObj.color) || "#d97757";
      const grpName = gObj ? gObj.name : c.group;
      const subText = c.subgroup ? ` › ${esc(c.subgroup)}` : "";
      grpBadge = `
        <span class="grp-pill" style="--grp-color:${esc(color)}" onclick="event.stopPropagation(); openAssignChatGroupModal('${esc(c.name)}')" title="Clique para alterar grupo/subgrupo">
          <span class="grp-dot"></span>
          <span>${esc(grpName)}${subText}</span>
          <span style="font-size:10px;opacity:.6;margin-left:2px">✏️</span>
        </span>
      `;
    } else {
      grpBadge = `
        <button type="button" class="btn-assign-grp" onclick="event.stopPropagation(); openAssignChatGroupModal('${esc(c.name)}')" title="Atribuir esta conversa a um grupo">
          + Grupo
        </button>
      `;
    }

    const turnsText = c.turns ? `${c.turns} turno${c.turns === 1 ? "" : "s"}` : "—";
    const titleText = esc(c.title || c.name.replace(/\.md$/, ""));

    tableHtml += `
      <tr onclick="openFile('chats', '${esc(c.name)}')">
        <td class="col-agent" style="white-space:nowrap">${ag}</td>
        <td class="col-title">
          <b style="font-weight:500;color:var(--text);display:block;max-width:380px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${titleText}</b>
          <span style="font-size:11px;color:var(--mute);display:block;max-width:380px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(c.name)}</span>
          <div class="mobile-inline-meta">${stBadge}${grpBadge}</div>
        </td>
        <td class="col-group" style="white-space:nowrap">${grpBadge}</td>
        <td class="col-status" style="white-space:nowrap">${stBadge}</td>
        <td class="col-turns" style="white-space:nowrap;font-size:12px;color:var(--mute)">${turnsText}</td>
        <td class="col-date" style="white-space:nowrap;font-size:11.5px;color:var(--mute)">${fmt(c.mtime)}</td>
        <td class="col-actions" style="text-align:right;white-space:nowrap" onclick="event.stopPropagation()">
          <div style="display:inline-flex;gap:6px;align-items:center">
            <button type="button" class="btn-sync-chat" title="Continuar esta conversa" onclick="resumeExistingChat('${esc(c.name)}', isStudioMode)">💬 Continuar</button>
          </div>
        </td>
      </tr>
    `;
  });
  tableHtml += "</tbody></table></div>";
  tableHtml += renderPaginationHtml(totalFiltered, state.chatCurrentPage, state.chatPageSize);
  $("chats").innerHTML = tableHtml;
}

/** Visão em lista. */
export function renderChatsList(pageItems, totalFiltered) {
  let listHtml = pageItems
    .map((c) => {
      const ag =
        c.agent === "gemini"
          ? '<span class="tag" style="margin-right:6px;color:#7ca5f5;border-color:#7ca5f544;font-weight:600">✦ Gemini</span>'
          : c.agent === "opencode"
          ? '<span class="tag" style="margin-right:6px;color:#7de2a3;border-color:#7de2a344;font-weight:600">◆ OpenCode</span>'
          : '<span class="tag" style="margin-right:6px;color:#d97757;border-color:#d9775744;font-weight:600">✱ Claude</span>';
      const stClass = c.status === "ok" ? "status-ok" : c.status === "alterada" ? "status-alterada" : "status-nova";
      const stLabel = c.status === "ok" ? "✓ em dia" : c.status === "alterada" ? "↻ alterada" : "⏳ pendente";
      const stBadge = `<span class="status-badge ${stClass}" style="margin-left:6px">${stLabel}</span>`;

      let grpBadge = "";
      if (c.group || c.groupId) {
        const gObj = getGroupById(c.groupId);
        const color = (gObj && gObj.color) || "#d97757";
        const grpName = gObj ? gObj.name : c.group;
        const subText = c.subgroup ? ` › ${esc(c.subgroup)}` : "";
        grpBadge = `
        <span class="grp-pill" style="--grp-color:${esc(color)};margin-left:6px" onclick="event.stopPropagation(); openAssignChatGroupModal('${esc(c.name)}')" title="Clique para alterar grupo/subgrupo">
          <span class="grp-dot"></span>
          <span>${esc(grpName)}${subText}</span>
        </span>
      `;
      } else {
        grpBadge = `
        <button type="button" class="btn-assign-grp" style="margin-left:6px" onclick="event.stopPropagation(); openAssignChatGroupModal('${esc(c.name)}')" title="Atribuir a um grupo">+ Grupo</button>
      `;
      }

      return `
      <div class="row" style="display:flex;align-items:center;justify-content:space-between" onclick="openFile('chats', '${esc(c.name)}')">
        <b style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;flex:1;min-width:0">
          ${ag}<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(c.title || c.name.replace(/\.md$/, ""))}</span>${stBadge}${grpBadge}
        </b>
        <div class="row-meta-actions" style="display:flex;align-items:center;gap:8px;margin-left:12px;flex-shrink:0" onclick="event.stopPropagation()">
          <span style="font-size:11px;color:var(--mute)">${fmt(c.mtime)}</span>
          <button type="button" class="btn-sync-chat" title="Continuar esta conversa" onclick="resumeExistingChat('${esc(c.name)}', isStudioMode)">💬 Continuar</button>
        </div>
      </div>
    `;
    })
    .join("");
  listHtml += renderPaginationHtml(totalFiltered, state.chatCurrentPage, state.chatPageSize);
  $("chats").innerHTML = listHtml;
}

export function renderProjectChats() {
  const P = state.P;
  if (!P || !P.chats) return;

  const total = P.chats.length;
  renderEngineCounts(P);
  renderGroupChips(P);
  const { list, q } = filterAndSortChats(P);

  const totalFiltered = list.length;
  state.lastFilteredChatsCount = totalFiltered;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / state.chatPageSize));
  if (state.chatCurrentPage > totalPages) state.chatCurrentPage = totalPages;
  if (state.chatCurrentPage < 1) state.chatCurrentPage = 1;

  renderResultCount(totalFiltered, total, totalPages, q);

  if ($("btnViewList")) $("btnViewList").classList.toggle("active", state.chatViewMode === "list");
  if ($("btnViewTable")) $("btnViewTable").classList.toggle("active", state.chatViewMode === "table");

  if (!list.length) {
    renderEmptyChats();
    return;
  }

  const startIndex = (state.chatCurrentPage - 1) * state.chatPageSize;
  const pageItems = list.slice(startIndex, startIndex + state.chatPageSize);
  if (state.chatViewMode === "table") renderChatsTable(pageItems, totalFiltered);
  else renderChatsList(pageItems, totalFiltered);
}
