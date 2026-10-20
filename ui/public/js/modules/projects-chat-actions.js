// @ts-check
// Filtros, ordenação, visão e paginação da lista de conversas.
import { $ } from "../shared/dom.js";
import { state } from "../shared/state.js";
import { renderProjectChats } from "./projects-chat-render.js";

export function setChatEngineFilter(engine) {
  state.chatEngineFilter = engine;
  state.chatCurrentPage = 1;
  renderProjectChats();
}

export function setChatGroupFilter(groupId) {
  if (state.chatGroupFilter === groupId) {
    state.chatGroupFilter = "all";
    state.chatSubgroupFilter = "all";
  } else {
    state.chatGroupFilter = groupId;
    state.chatSubgroupFilter = "all";
  }
  state.chatCurrentPage = 1;
  renderProjectChats();
}

export function setChatSubgroupFilter(sub) {
  if (state.chatSubgroupFilter === sub) {
    state.chatSubgroupFilter = "all";
  } else {
    state.chatSubgroupFilter = sub;
  }
  state.chatCurrentPage = 1;
  renderProjectChats();
}

export function onChatSearchInput(query) {
  state.chatSearchQuery = query;
  state.chatCurrentPage = 1;
  renderProjectChats();
}

export function clearChatSearch() {
  state.chatSearchQuery = "";
  state.chatCurrentPage = 1;
  const inp = /** @type {HTMLInputElement} */ ($("chatSearchInput"));
  if (inp) inp.value = "";
  renderProjectChats();
}

export function onChatSortSelectChange(value) {
  const [field, dir] = value.split("_");
  state.chatSortField = field;
  state.chatSortAsc = dir === "asc";
  state.chatCurrentPage = 1;
  renderProjectChats();
}

export function toggleSort(field) {
  if (state.chatSortField === field) {
    state.chatSortAsc = !state.chatSortAsc;
  } else {
    state.chatSortField = field;
    state.chatSortAsc = field === "title" || field === "agent" || field === "group";
  }
  const selVal = `${state.chatSortField}_${state.chatSortAsc ? "asc" : "desc"}`;
  const sel = /** @type {HTMLSelectElement} */ ($("chatSortSelect"));
  if (sel) sel.value = selVal;
  state.chatCurrentPage = 1;
  renderProjectChats();
}

export function setChatViewMode(mode) {
  state.chatViewMode = mode;
  try {
    localStorage.setItem("harness_chats_view_mode", mode);
  } catch {}
  renderProjectChats();
}

export function resetAllChatFilters() {
  state.chatEngineFilter = "all";
  state.chatGroupFilter = "all";
  state.chatSubgroupFilter = "all";
  state.chatSearchQuery = "";
  state.chatCurrentPage = 1;
  const inp = /** @type {HTMLInputElement} */ ($("chatSearchInput"));
  if (inp) inp.value = "";
  renderProjectChats();
}

export function changeChatPage(page) {
  const total = state.lastFilteredChatsCount || 0;
  const maxPage = Math.max(1, Math.ceil(total / state.chatPageSize));
  if (page < 1) page = 1;
  if (page > maxPage) page = maxPage;
  state.chatCurrentPage = page;
  renderProjectChats();
  const el = $("chatsControlPanel");
  if (el) {
    const rect = el.getBoundingClientRect();
    if (rect.top < 0 || rect.top > 300) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }
}

export function changeChatPageSize(size) {
  const parsed = parseInt(size, 10);
  if (!isNaN(parsed) && parsed > 0) {
    state.chatPageSize = parsed;
    state.chatCurrentPage = 1;
    try {
      localStorage.setItem("harness_chats_page_size", String(parsed));
    } catch {}
    renderProjectChats();
  }
}

export function renderPaginationHtml(totalItems, currentPage, pageSize) {
  if (totalItems <= 0) return "";
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  const pagesToShow = [];
  const delta = 1;
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentPage - delta && i <= currentPage + delta)) {
      pagesToShow.push(i);
    } else if (pagesToShow[pagesToShow.length - 1] !== "...") {
      pagesToShow.push("...");
    }
  }

  const buttonsHtml = pagesToShow
    .map((p) => {
      if (p === "...") {
        return `<span style="padding:0 3px;color:var(--mute);font-size:12px">…</span>`;
      }
      const isActive = p === currentPage;
      return `<button type="button" class="page-btn ${isActive ? "active" : ""}" onclick="changeChatPage(${p})">${p}</button>`;
    })
    .join("");

  return `
    <div class="chats-pagination">
      <div class="pagination-info">
        Exibindo <b>${startItem}–${endItem}</b> de <b>${totalItems}</b> conversas
      </div>
      <div class="pagination-controls">
        <button type="button" class="page-btn" onclick="changeChatPage(1)" ${currentPage === 1 ? "disabled" : ""} title="Primeira página">«</button>
        <button type="button" class="page-btn" onclick="changeChatPage(${currentPage - 1})" ${currentPage === 1 ? "disabled" : ""} title="Página anterior">‹</button>
        ${buttonsHtml}
        <button type="button" class="page-btn" onclick="changeChatPage(${currentPage + 1})" ${currentPage === totalPages ? "disabled" : ""} title="Próxima página">›</button>
        <button type="button" class="page-btn" onclick="changeChatPage(${totalPages})" ${currentPage === totalPages ? "disabled" : ""} title="Última página">»</button>
      </div>
      <div class="page-size-wrap">
        <span>Por pág:</span>
        <select class="page-size-select" onchange="changeChatPageSize(this.value)">
          <option value="10" ${pageSize === 10 ? "selected" : ""}>10</option>
          <option value="15" ${pageSize === 15 ? "selected" : ""}>15</option>
          <option value="25" ${pageSize === 25 ? "selected" : ""}>25</option>
          <option value="50" ${pageSize === 50 ? "selected" : ""}>50</option>
          <option value="100" ${pageSize === 100 ? "selected" : ""}>100</option>
        </select>
      </div>
    </div>
  `;
}
