// @ts-check
// Carga do projeto e tabela de mapeamento.
import { esc, clean, openDlg, section } from "../shared/dom.js";
import {
  state,
  restoreActiveChatState,
  hydrateChatState,
  logChatAction,
  CHAT_ACTIONS,
} from "../shared/state.js";
import { renderServicesSection } from "./services.js";
import { renderSkillsSection } from "./skills.js";
import { renderProjectChats } from "./projects-chat-render.js";
import { showIns, showMem, openFile } from "./projects-sync.js";

export async function load(slug) {
  const previousSlug = state.P && state.P.slug;
  state.chatCurrentPage = 1;
  state.P = await (await fetch("/api/project/" + slug)).json();
  const P = state.P;
  await hydrateChatState(slug);
  restoreActiveChatState(slug);
  if (previousSlug !== slug) {
    void logChatAction(CHAT_ACTIONS.PROJECT, slug);
  }
  $("title").textContent = slug.charAt(0).toUpperCase() + slug.slice(1);
  const ext = P.extraction;
  const extMeta =
    ext && ext.total
      ? ` · <span style="color:#7de2a3">${ext.ok} em dia</span> · <span style="color:#d97757">${ext.nova + ext.alterada} pendentes</span>`
      : "";
  $("meta").innerHTML = `${P.chats.length} chats${extMeta} · ${P.context.length} arquivos`;
  $("act").textContent = state.S && state.S.active === slug ? "ativo no harness" : "inativo (edite projects/.active)";

  if (P.app && P.app.url) {
    const isRemote = location.hostname !== "localhost" && location.hostname !== "127.0.0.1";
    const currentAppUrl = isRemote ? "/preview/" : P.app.url;
    const displayUrl = isRemote ? location.origin + "/preview/" : currentAppUrl;
    const inp = /** @type {HTMLInputElement} */ ($("canvasUrlInput"));
    if (inp) inp.value = displayUrl;
    const offTarget = $("offlineTargetUrl");
    if (offTarget) offTarget.textContent = displayUrl;
    const offCmd = $("offlineCmdHelp");
    if (offCmd && P.app.command) {
      offCmd.textContent = `${P.app.command}${P.app.cwd ? " (em " + P.app.cwd + ")" : ""}`;
    }
  }

  // Renderiza as conversas com os filtros, busca, tabela e grupos
  renderProjectChats();

  const ins = clean(P.instructions);
  const mem = clean(P.memory);
  $("side").innerHTML =
    renderServicesSection() +
    section(
      "Instruções",
      "Projeto + global",
      ins ? `<div class="preview">${esc(ins)}</div>` : '<div class="empty">Adicione em instructions.md</div>',
      "showIns"
    ) +
    section(
      "Memória",
      "Apenas você",
      (mem ? `<div class="preview">${esc(mem)}</div>` : '<div class="empty">Sem memórias ainda</div>') +
        (P.review && P.review.pendentes
          ? `<div class="rv-cta" onclick="showReview()">🧠 Revisar ${P.review.pendentes} sugestões de memória →</div>`
          : ""),
      "showMem"
    ) +
    renderSkillsSection() +
    section(
      "Contexto",
      `${P.context.length} arquivos`,
      P.context.length
        ? `<div class="files">${P.context.map((f, i) => `<div class="file" data-i="${i}">${esc(f.name)}<br><i>${esc(f.name.split(".").pop().toUpperCase())}</i></div>`).join("")}</div>`
        : '<div class="empty">Coloque arquivos em context/</div>'
    ) +
    section(
      "Programado",
      "",
      P.scheduled.length
        ? P.scheduled.map((f, i) => `<div class="row" data-s="${i}">${esc(f.name)}</div>`).join("")
        : '<div class="empty">Nenhuma tarefa recorrente</div>'
    );

  document.querySelectorAll(".file").forEach((r) => {
    r.onclick = () => openFile("context", P.context[/** @type {HTMLElement} */ (r).dataset.i].name);
  });
  document.querySelectorAll("[data-s]").forEach((r) => {
    r.onclick = () => openFile("scheduled", P.scheduled[/** @type {HTMLElement} */ (r).dataset.s].name);
  });
  if (window.syncStudioControls) window.syncStudioControls();
  const designWs = $("designWorkspace");
  if (designWs && designWs.style.display !== "none" && window["loadAllProjectDesignData"]) {
    window["loadAllProjectDesignData"](slug).then(() => {
      const activeTab = document.querySelector(".design-nav-tab.active");
      // @ts-ignore
      const view = activeTab ? activeTab.dataset.view : "layers";
      if (window["setDesignView"]) window["setDesignView"](view);
    });
  }
}

export function showMappingTable() {
  const P = state.P;
  if (!P || !P.extraction) return;
  const ext = P.extraction;
  let currentFilter = "all";

  function renderTableHtml(filter = "all", search = "") {
    let rows = ext.rows || [];
    if (filter === "ok") rows = rows.filter((r) => r.status === "ok");
    else if (filter === "nova") rows = rows.filter((r) => r.status === "nova");
    else if (filter === "alterada") rows = rows.filter((r) => r.status === "alterada");
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(
        (r) =>
          (r.titulo || "").toLowerCase().includes(q) ||
          (r.name || "").toLowerCase().includes(q) ||
          (r.por || "").toLowerCase().includes(q)
      );
    }

    return `
      <div class="filter-bar">
        <button class="filter-btn ${filter === "all" ? "active" : ""}" onclick="window._changeTableFilter('all')">Todos (${ext.total})</button>
        <button class="filter-btn ${filter === "ok" ? "active" : ""}" onclick="window._changeTableFilter('ok')">✅ Em dia (${ext.ok})</button>
        <button class="filter-btn ${filter === "nova" ? "active" : ""}" onclick="window._changeTableFilter('nova')">⏳ Novas (${ext.nova})</button>
        ${ext.alterada ? `<button class="filter-btn ${filter === "alterada" ? "active" : ""}" onclick="window._changeTableFilter('alterada')">↻ Alteradas (${ext.alterada})</button>` : ""}
        <input type="text" id="tblSearch" placeholder="Buscar título ou arquivo..." value="${esc(search)}" oninput="window._changeTableFilter(null, this.value)" style="margin-left:auto;background:var(--panel2);color:var(--text);border:1px solid var(--line);border-radius:6px;padding:4px 8px;font:inherit;font-size:12px">
      </div>
      <div class="table-wrap">
        <table class="table-full">
          <thead>
            <tr>
              <th>#</th>
              <th>Título da Conversa</th>
              <th>Data</th>
              <th>Turnos</th>
              <th>Status</th>
              <th>Analisado por</th>
              <th>Data da Análise</th>
              <th>Ação</th>
            </tr>
          </thead>
          <tbody>
            ${
              rows.length
                ? rows
                    .map((r, i) => {
                      const isAlt = r.status === "alterada";
                      const stClass = r.status === "ok" ? "status-ok" : isAlt ? "status-alterada" : "status-nova";
                      const stLabel = r.status === "ok" ? "✅ Em dia" : isAlt ? "↻ Alterada" : "⏳ Pendente";
                      const turnosDisplay =
                        isAlt && r.turnosAntes
                          ? `<span style="color:#e0a040;font-weight:600">${r.turnosAntes} → ${r.turnos}</span>`
                          : r.turnos;
                      return `<tr>
                <td>${i + 1}</td>
                <td><b>${esc(r.titulo)}</b><br><code style="font-size:11px;opacity:0.7">${esc(r.name)}</code></td>
                <td>${esc(r.data || "-")}</td>
                <td style="text-align:center">${turnosDisplay}</td>
                <td><span class="status-badge ${stClass}">${stLabel}</span></td>
                <td>${esc(r.por || "-")}</td>
                <td>${esc(r.analisadoEm || "-")}</td>
                <td><button class="btn-map" onclick="openFile('chats', '${esc(r.name)}')">Abrir</button></td>
              </tr>`;
                    })
                    .join("")
                : '<tr><td colspan="8" class="empty" style="text-align:center;padding:16px">Nenhuma conversa encontrada</td></tr>'
            }
          </tbody>
        </table>
      </div>
    `;
  }

  // @ts-ignore
  window._changeTableFilter = (f, s) => {
    if (f !== null) currentFilter = f;
    const searchVal = s !== undefined ? s : $("tblSearch") ? /** @type {HTMLInputElement} */ ($("tblSearch")).value : "";
    $("dbody").innerHTML = renderTableHtml(currentFilter, searchVal);
    const inp = /** @type {HTMLInputElement} */ ($("tblSearch"));
    if (inp) {
      inp.focus();
      inp.setSelectionRange(inp.value.length, inp.value.length);
    }
  };

  openDlg("Mapeamento de Conversas e Extração — " + P.slug, "", renderTableHtml("all", ""));
}
