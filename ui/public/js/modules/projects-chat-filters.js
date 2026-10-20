// @ts-check
// Contadores, chips de grupo, filtragem e ordenação das conversas.
import { esc } from "../shared/dom.js";
import { state } from "../shared/state.js";
import { getProjectGroups } from "./groups.js";

/** Contadores por motor e destaque do filtro de motor ativo. */
export function renderEngineCounts(P) {
  const total = P.chats.length;
  const claudeCount = P.chats.filter((c) => (c.agent || "claude") === "claude").length;
  const geminiCount = P.chats.filter((c) => c.agent === "gemini").length;
  const opencodeCount = P.chats.filter((c) => c.agent === "opencode").length;
  const codexCount = P.chats.filter((c) => c.agent === "codex").length;

  if ($("countEngAll")) $("countEngAll").textContent = String(total);
  if ($("countEngClaude")) $("countEngClaude").textContent = String(claudeCount);
  if ($("countEngGemini")) $("countEngGemini").textContent = String(geminiCount);
  if ($("countEngOpencode")) $("countEngOpencode").textContent = String(opencodeCount);
  if ($("countEngCodex")) $("countEngCodex").textContent = String(codexCount);

  document.querySelectorAll("#engineFilterBar .eng-badge-filter").forEach((b) => {
    b.classList.toggle("active", /** @type {HTMLElement} */ (b).dataset.eng === state.chatEngineFilter);
  });
}

/** Chips de grupo e barra de subgrupos. */
export function renderGroupChips(P) {
  const total = P.chats.length;
  const grps = getProjectGroups();
  const groupCounts = {};
  let unassignedCount = 0;
  P.chats.forEach((c) => {
    if (c.groupId || c.group) {
      const key = c.groupId || c.group;
      groupCounts[key] = (groupCounts[key] || 0) + 1;
    } else {
      unassignedCount++;
    }
  });

  let grpChipsHtml = `
    <button type="button" class="group-chip-filter ${state.chatGroupFilter === "all" ? "active" : ""}" onclick="setChatGroupFilter('all')">
      <span>Todos</span> <span class="filter-count">${total}</span>
    </button>
    <button type="button" class="group-chip-filter ${state.chatGroupFilter === "__none__" ? "active" : ""}" onclick="setChatGroupFilter('__none__')">
      <span>Sem Grupo</span> <span class="filter-count">${unassignedCount}</span>
    </button>
  `;

  grps.forEach((g) => {
    const count = groupCounts[g.id] || groupCounts[g.name] || 0;
    const isAct = state.chatGroupFilter === g.id;
    grpChipsHtml += `
      <button type="button" class="group-chip-filter ${isAct ? "active" : ""}" onclick="setChatGroupFilter('${esc(g.id)}')">
        <span class="grp-dot" style="background:${esc(g.color || "#d97757")}"></span>
        <span>${esc(g.name)}</span>
        <span class="filter-count">${count}</span>
      </button>
    `;
  });
  if ($("groupChipsContainer")) $("groupChipsContainer").innerHTML = grpChipsHtml;

  const activeGrp = grps.find((g) => g.id === state.chatGroupFilter);
  if (activeGrp && activeGrp.subgroups && activeGrp.subgroups.length > 0) {
    $("subgroupFilterBar").style.display = "flex";
    const subCounts = {};
    let subTotal = 0;
    P.chats.forEach((c) => {
      if (c.groupId === activeGrp.id || c.group === activeGrp.name) {
        subTotal++;
        if (c.subgroup) subCounts[c.subgroup] = (subCounts[c.subgroup] || 0) + 1;
      }
    });

    let subChips = `
      <button type="button" class="subgroup-chip-filter ${state.chatSubgroupFilter === "all" ? "active" : ""}" onclick="setChatSubgroupFilter('all')">
        Todos (${subTotal})
      </button>
    `;
    activeGrp.subgroups.forEach((sub) => {
      const count = subCounts[sub] || 0;
      subChips += `
        <button type="button" class="subgroup-chip-filter ${state.chatSubgroupFilter === sub ? "active" : ""}" onclick="setChatSubgroupFilter('${esc(sub)}')">
          ${esc(sub)} (${count})
        </button>
      `;
    });
    if ($("subgroupChipsContainer")) $("subgroupChipsContainer").innerHTML = subChips;
  } else if ($("subgroupFilterBar")) {
    $("subgroupFilterBar").style.display = "none";
  }
}

/** Aplica filtros de motor, grupo, subgrupo, busca e ordenação. */
export function filterAndSortChats(P) {
  let list = P.chats.slice();
  if (state.chatEngineFilter !== "all") {
    list = list.filter((c) => (c.agent || "claude") === state.chatEngineFilter);
  }
  if (state.chatGroupFilter === "__none__") {
    list = list.filter((c) => !c.groupId && !c.group);
  } else if (state.chatGroupFilter !== "all") {
    list = list.filter((c) => c.groupId === state.chatGroupFilter || c.group === state.chatGroupFilter);
    if (state.chatSubgroupFilter !== "all") {
      list = list.filter((c) => (c.subgroup || "") === state.chatSubgroupFilter);
    }
  }

  const q = state.chatSearchQuery.trim().toLowerCase();
  if (q) {
    list = list.filter((c) => {
      const title = (c.title || c.name || "").toLowerCase();
      const fname = (c.name || "").toLowerCase();
      const agent = (c.agent || "claude").toLowerCase();
      const group = (c.group || "").toLowerCase();
      const subgroup = (c.subgroup || "").toLowerCase();
      const status = (c.status === "ok" ? "em dia ok" : c.status === "alterada" ? "alterada" : "pendente nova").toLowerCase();
      return (
        title.includes(q) ||
        fname.includes(q) ||
        agent.includes(q) ||
        group.includes(q) ||
        subgroup.includes(q) ||
        status.includes(q)
      );
    });
  }

  list.sort((a, b) => {
    let vA, vB;
    if (state.chatSortField === "mtime") {
      vA = a.mtime || 0;
      vB = b.mtime || 0;
    } else if (state.chatSortField === "title") {
      vA = (a.title || a.name || "").toLowerCase();
      vB = (b.title || b.name || "").toLowerCase();
    } else if (state.chatSortField === "agent") {
      vA = (a.agent || "claude").toLowerCase();
      vB = (b.agent || "claude").toLowerCase();
    } else if (state.chatSortField === "group") {
      vA = (a.group || "zzzz").toLowerCase();
      vB = (b.group || "zzzz").toLowerCase();
    } else if (state.chatSortField === "status") {
      vA = a.status || "";
      vB = b.status || "";
    } else if (state.chatSortField === "turns") {
      vA = a.turns || 0;
      vB = b.turns || 0;
    } else {
      vA = a.mtime || 0;
      vB = b.mtime || 0;
    }
    if (vA < vB) return state.chatSortAsc ? -1 : 1;
    if (vA > vB) return state.chatSortAsc ? 1 : -1;
    return 0;
  });
  return { list, q };
}

/** Texto do contador de resultados e botão de limpar busca. */
export function renderResultCount(totalFiltered, total, totalPages, q) {
  if ($("chatSearchClear")) $("chatSearchClear").style.display = q ? "block" : "none";
  if ($("chatsResultCount")) {
    if (totalFiltered === 0) {
      $("chatsResultCount").textContent = "0 conversas";
    } else if (totalFiltered !== total) {
      $("chatsResultCount").textContent = `Pág. ${state.chatCurrentPage}/${totalPages} (${totalFiltered} de ${total})`;
    } else {
      $("chatsResultCount").textContent =
        totalPages > 1
          ? `Pág. ${state.chatCurrentPage}/${totalPages} (${total} conversas)`
          : `${total} conversa${total === 1 ? "" : "s"}`;
    }
  }
}
