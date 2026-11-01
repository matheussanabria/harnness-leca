// @ts-check
// DAI HQ — Módulo de Renderização do Drawer Lateral de Detalhes
import { getOrchestrationDrawerData, setupOrchestrationPanelListeners } from "../office-orchestration-panel.js";
import { renderAgentInteractiveDesk } from "./office-desk-chat.js";
import { renderOfficeChatWindow } from "./office-chat-window.js";
import { renderOfficeDatacenterStatus } from "./office-datacenter-status.js";
import { renderCabinetJournalItems, mountCabinetList } from "./office-cabinet-journal.js";

/**
 * Renderiza o conteúdo do drawer com base no objeto selecionado
 * @param {string} objKey
 * @param {any} state
 */
export function renderDrawerContent(objKey, state) {
  const iconEl = document.getElementById("drawerIcon");
  const titleEl = document.getElementById("drawerTitle");
  const subtitleEl = document.getElementById("drawerSubtitle");
  const bodyEl = document.getElementById("drawerBody");

  if (!iconEl || !titleEl || !subtitleEl || !bodyEl) return;

  bodyEl.classList.remove("drawer-body-chat");

  const proj = state.projectData || {};
  const chats = proj.chats || [];

  switch (objKey) {
    case "office_chat":
      renderOfficeChatWindow(state, { iconEl, titleEl, subtitleEl, bodyEl });
      break;

    case "file_cabinet": {
      iconEl.innerHTML = '<i class="fa-solid fa-box-archive" aria-hidden="true"></i>';
      titleEl.textContent = "Arquivo de Conversas & Diário de Bordo";
      const days = state.journal?.days || (Array.isArray(state.journal) ? state.journal : []);
      let totalSess = 0;
      for (const d of days) totalSess += (d.sessions || []).length;
      const countLabel = totalSess > 0 ? `${totalSess} sessões do diário` : `${chats.length} conversas preservadas`;
      subtitleEl.textContent = `${countLabel} no projeto "${state.activeProject}"`;

      bodyEl.innerHTML = `
        <div class="drawer-card">
          <div class="drawer-card-title">Armário de Aço — Histórico Completo</div>
          <div style="margin-bottom:12px;font-size:12.5px;color:var(--office-mute)">
            Aqui ficam armazenadas com segurança todas as sessões de chat, pedidos dos usuários e arquivos alterados pelos motores.
          </div>
          <div style="display:flex;gap:8px;margin-bottom:12px">
            <input type="text" id="cabinetSearch" placeholder="Filtrar por pedido, título ou arquivo..." style="width:100%;padding:8px 12px;border-radius:8px;border:1px solid var(--office-border);background:var(--office-panel-solid);color:var(--office-text);font-size:12.5px">
          </div>
          <div id="cabinetList" style="display:flex;flex-direction:column;gap:8px;max-height:480px;overflow-y:auto;padding-right:4px">
          </div>
          <div style="margin-top:14px;text-align:center">
            <a href="/diario" style="color:#38bdf8;text-decoration:none;font-weight:700;font-size:12px">
              <i class="fa-solid fa-book" aria-hidden="true"></i> Abrir Diário de Bordo Completo com Calendário <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i>
            </a>
          </div>
        </div>
      `;

      const cabinetEl = document.getElementById("cabinetList");
      if (cabinetEl) mountCabinetList(cabinetEl, days, chats, "", 1);

      const searchInput = document.getElementById("cabinetSearch");
      searchInput?.addEventListener("input", (e) => {
        const q = /** @type {HTMLInputElement} */ (e.target).value;
        const listEl = document.getElementById("cabinetList");
        if (listEl) mountCabinetList(listEl, days, chats, q, 1);
      });
      break;
    }

    case "whiteboard": {
      iconEl.innerHTML = '<i class="fa-solid fa-clipboard-list" aria-hidden="true"></i>';
      titleEl.textContent = "Quadro de Memória & Diretrizes";
      subtitleEl.textContent = `Regras duráveis do projeto "${state.activeProject}"`;

      const memoryText = proj.memory || "Nenhuma memória registrada em memory.md ainda.";
      bodyEl.innerHTML = `
        <div class="drawer-card">
          <div class="drawer-card-title">Memórias Duráveis (memory.md)</div>
          <pre style="background:rgba(0,0,0,0.2);padding:12px;border-radius:8px;font-size:12px;white-space:pre-wrap;color:var(--office-text);max-height:220px;overflow-y:auto;border:1px solid var(--office-border)">${memoryText}</pre>
        </div>
        <div class="drawer-card">
          <div class="drawer-card-title">Instruções do Projeto (instructions.md)</div>
          <div style="font-size:12.5px;color:var(--office-mute);margin-bottom:8px">
            Regras de arquitetura, preferências e diretrizes de desenvolvimento passadas aos agentes.
          </div>
          <a href="/diario" style="color:var(--office-accent);text-decoration:none;font-weight:600;font-size:12.5px">Ver Diário de Bordo Completo <i class="fa-solid fa-book" aria-hidden="true"></i></a>
        </div>
      `;
      break;
    }

    case "claude_desk":
    case "war_room_claude_station":
    case "agent_claude":
      renderAgentInteractiveDesk("claude", state, { iconEl, titleEl, subtitleEl, bodyEl });
      break;

    case "gemini_desk":
    case "war_room_gemini_station":
    case "agent_gemini":
      renderAgentInteractiveDesk("gemini", state, { iconEl, titleEl, subtitleEl, bodyEl });
      break;

    case "opencode_desk":
    case "war_room_opencode_station":
    case "agent_opencode":
      renderAgentInteractiveDesk("opencode", state, { iconEl, titleEl, subtitleEl, bodyEl });
      break;

    case "codex_desk":
    case "war_room_codex_station":
    case "agent_codex":
      renderAgentInteractiveDesk("codex", state, { iconEl, titleEl, subtitleEl, bodyEl });
      break;

    case "coffee_bar": {
      iconEl.innerHTML = '<i class="fa-solid fa-mug-hot" aria-hidden="true"></i>';
      titleEl.textContent = "Cantinho do Café & Métricas";
      subtitleEl.textContent = "Combustível para mentes de silício";
      bodyEl.innerHTML = `
        <div class="drawer-card">
          <div class="drawer-card-title">Nível de Cafeína da Equipe</div>
          <div class="coffee-stat-grid" style="margin-bottom:14px">
            <div class="coffee-stat-box"><div class="coffee-stat-number">100%</div><div class="coffee-stat-label">Cafeína no Tanque <i class="fa-solid fa-mug-hot" aria-hidden="true"></i></div></div>
            <div class="coffee-stat-box"><div class="coffee-stat-number">${chats.length}</div><div class="coffee-stat-label">Conversas no Projeto</div></div>
          </div>
          <p style="font-size:12.5px;color:var(--office-mute);margin:0;text-align:center;font-style:italic">
            "Todo agente eficiente precisa de uma boa pausa para o café entre um commit e outro!"
          </p>
        </div>
      `;
      break;
    }

    case "server_rack": {
      iconEl.innerHTML = '<i class="fa-solid fa-server" aria-hidden="true"></i>';
      titleEl.textContent = "Datacenter & Deploys";
      subtitleEl.textContent = "Estado real dos ambientes de deploy";
      bodyEl.innerHTML = `
        <div class="drawer-card">
          <div class="drawer-card-title">Infraestrutura em Nuvem</div>
          <div id="officeDatacenterStatus" class="office-datacenter-status">
            <div class="office-datacenter-line"><i class="fa-solid fa-spinner fa-spin"></i> Carregando estado real dos ambientes...</div>
          </div>
          <p style="font-size:12.5px;color:var(--office-mute);margin:14px 0">
            O estado vem das mesmas medicoes do painel de deploys: nada e considerado conectado sem medicao registrada.
          </p>
          <a href="/deploy" class="header-nav-btn" style="display:flex;justify-content:center;text-decoration:none">
            <i class="fa-solid fa-rocket" aria-hidden="true"></i> Abrir Painel de Deploys
          </a>
        </div>
      `;
      renderOfficeDatacenterStatus(document.getElementById("officeDatacenterStatus"));
      break;
    }

    case "war_room_main_panel":
    case "war_room_table_console":
    case "orch_core": {
      const data = getOrchestrationDrawerData(state, objKey);
      iconEl.innerHTML = data.icon;
      titleEl.textContent = data.title;
      subtitleEl.textContent = data.subtitle;
      bodyEl.innerHTML = data.html;
      setupOrchestrationPanelListeners(state, () => renderDrawerContent(objKey, state));
      break;
    }

    case "sofa":
      iconEl.innerHTML = '<i class="fa-solid fa-couch" aria-hidden="true"></i>';
      titleEl.textContent = "Lounge de Descompressão";
      subtitleEl.textContent = "Pausa para pensar fora da caixa";
      bodyEl.innerHTML = `<div class="drawer-card"><p style="font-size:13px;color:var(--office-text);margin:0">Onde os agentes descansam suas threads e o desenvolvedor respira enquanto o build passa com sucesso. <i class="fa-solid fa-leaf" aria-hidden="true"></i></p></div>`;
      break;

    default:
      if (objKey.startsWith("agent_") || objKey.startsWith("exec_")) {
        const data = getOrchestrationDrawerData(state, objKey);
        iconEl.innerHTML = data.icon;
        titleEl.textContent = data.title;
        subtitleEl.textContent = data.subtitle;
        bodyEl.innerHTML = data.html;
        setupOrchestrationPanelListeners(state, () => renderDrawerContent(objKey, state));
      } else {
        iconEl.innerHTML = '<i class="fa-solid fa-thumbtack" aria-hidden="true"></i>';
        titleEl.textContent = "Objeto do Escritório";
        subtitleEl.textContent = "";
        bodyEl.innerHTML = `<div style="color:var(--office-mute)">Selecione um item no escritório para ver detalhes.</div>`;
      }
  }
}

export { renderCabinetJournalItems };
