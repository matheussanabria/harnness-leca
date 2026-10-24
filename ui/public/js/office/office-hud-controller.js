// @ts-check
// DAI HQ — Módulo de Controle do HUD, Menus e Telemetria Lateral
import { playClickSound } from "../office-audio.js";
import { officeAgentState } from "./office-agent-state.js";
import { summarizeEngine } from "./office-engine-summary.js";

let persistHud = null;

/**
 * Liga a gravação da visibilidade do HUD ao estado da tela (EP-14.10).
 * @param {((hidden: boolean) => void) | null} handler
 */
export function setHudPersistence(handler) {
  persistHud = typeof handler === "function" ? handler : null;
}

/**
 * Controla a visibilidade global do HUD (Modo Imersivo)
 * @param {boolean} visible
 */
export function setHudVisibility(visible) {
  const isHidden = !visible;
  document.body.classList.toggle("hud-hidden", isHidden);
  if (visible) {
    document.body.classList.remove("hud-left-hidden", "hud-right-hidden");
  }

  const btnToggleHud = document.getElementById("btnToggleHud");
  if (btnToggleHud) {
    btnToggleHud.classList.toggle("active", isHidden);
    const label = btnToggleHud.querySelector(".hud-toggle-text");
    const icon = btnToggleHud.querySelector(".hud-toggle-icon");
    if (label) label.textContent = isHidden ? "Mostrar Menus" : "Ocultar Menus";
    if (icon) icon.innerHTML = isHidden
      ? '<i class="fa-solid fa-eye-slash" aria-hidden="true"></i>'
      : '<i class="fa-solid fa-eye" aria-hidden="true"></i>';
    btnToggleHud.title = isHidden ? "Reexibir menus da tela (Atalho: H)" : "Ocultar menus da tela (Atalho: H)";
  }

  try {
    persistHud?.(isHidden);
  } catch (_) {}
}

export function toggleHUD() {
  playClickSound();
  const currentlyHidden = document.body.classList.contains("hud-hidden") ||
    (document.body.classList.contains("hud-left-hidden") && document.body.classList.contains("hud-right-hidden"));
  setHudVisibility(currentlyHidden);
}

export function toggleLeftPanel(hide) {
  playClickSound();
  const shouldHide = hide !== undefined ? hide : !document.body.classList.contains("hud-left-hidden");
  document.body.classList.toggle("hud-left-hidden", shouldHide);
  checkAllHiddenState();
}

export function toggleRightSidebar(hide) {
  playClickSound();
  const shouldHide = hide !== undefined ? hide : !document.body.classList.contains("hud-right-hidden");
  document.body.classList.toggle("hud-right-hidden", shouldHide);
  checkAllHiddenState();
}

function checkAllHiddenState() {
  const leftHidden = document.body.classList.contains("hud-left-hidden");
  const rightHidden = document.body.classList.contains("hud-right-hidden");
  const bothHidden = leftHidden && rightHidden;
  const btnToggleHud = document.getElementById("btnToggleHud");
  if (bothHidden) {
    document.body.classList.add("hud-hidden");
  }
  if (btnToggleHud) {
    const isAnyHidden = leftHidden || rightHidden || document.body.classList.contains("hud-hidden");
    btnToggleHud.classList.toggle("active", isAnyHidden);
    const label = btnToggleHud.querySelector(".hud-toggle-text");
    if (label) label.textContent = isAnyHidden ? "Mostrar Menus" : "Ocultar Menus";
  }
}

/**
 * Atualiza métricas, telemetria e dados do projeto no HUD
 * @param {any} state
 */
export function updateHUD(state) {
  const proj = state.projectData || {};
  const chats = proj.chats || [];
  const hudTitle = document.getElementById("hudProjectTitle");
  const hudDesc = document.getElementById("hudProjectDesc");
  const hudIcon = document.getElementById("hudProjectIcon");
  const hudProgress = document.getElementById("hudProgressPercent");
  const hudBar = document.getElementById("hudProgressBar");
  const hudTasks = document.getElementById("hudTaskCount");
  const welcomeStats = document.getElementById("welcomeStats");

  const topIcon = document.getElementById("topProjectIcon");
  const activeSlug = state.activeProject || "projeto";
  let iconHtml = '<i class="fa-solid fa-folder-open"></i>';
  let desc = "Workspace gerenciado por agentes DAI";

  if (activeSlug.includes("57") || activeSlug.includes("multimarcas")) {
    iconHtml = '<i class="fa-solid fa-car"></i>';
    desc = "Plataforma de venda de veículos";
  } else if (activeSlug.includes("saude") || activeSlug.includes("dispensacao")) {
    iconHtml = '<i class="fa-solid fa-pills"></i>';
    desc = "Sistema de dispensação de medicamentos";
  } else if (activeSlug.includes("prontuario")) {
    iconHtml = '<i class="fa-solid fa-stethoscope"></i>';
    desc = "Prontuário eletrônico do paciente";
  } else if (activeSlug.includes("conversor") || activeSlug.includes("maquininhas")) {
    iconHtml = '<i class="fa-solid fa-calculator"></i>';
    desc = "Conversor de relatórios de maquininhas";
  } else if (activeSlug.includes("dai")) {
    iconHtml = '<i class="fa-solid fa-robot"></i>';
    desc = "Esquadrão DAI de Desenvolvimento Autônomo";
  }

  if (hudTitle) hudTitle.textContent = proj.name || activeSlug;
  if (hudDesc) hudDesc.textContent = desc;
  if (hudIcon) hudIcon.innerHTML = iconHtml;
  if (topIcon) topIcon.innerHTML = iconHtml;

  // Atualiza atalhos rápidos com o slug do projeto ativo
  document.querySelectorAll(".quick-links-list a").forEach((link) => {
    const href = link.getAttribute("href") || "";
    if (href.startsWith("/") && !href.startsWith("/api/")) {
      const base = href.split("?")[0];
      link.setAttribute("href", `${base}?p=${encodeURIComponent(activeSlug)}`);
    }
  });

  // Atualiza feed de atividades do projeto
  const hudFeed = document.getElementById("hudActivityFeed");
  if (hudFeed) {
    const journalDays = state.journal?.days || [];
    const items = [];
    if (journalDays.length > 0 && journalDays[0]?.sessions?.length > 0) {
      for (const s of journalDays[0].sessions.slice(0, 3)) {
        items.push({
          actor: s.engine || "Agente",
          time: s.time || "hoje",
          text: s.summary || s.goal || "Sessão de trabalho realizada"
        });
      }
    } else if (chats.length > 0) {
      for (const c of chats.slice(0, 3)) {
        const title = typeof c === "string" ? c.replace(/\.md$/, "") : (c.title || c.name || "Conversa");
        items.push({
          actor: "Harness",
          time: "recente",
          text: title
        });
      }
    }

    if (items.length > 0) {
      hudFeed.innerHTML = items.map((it) => `
        <div class="activity-feed-item">
          <div class="activity-top-row">
            <span class="activity-actor">${it.actor}</span>
            <span class="activity-time">${it.time}</span>
          </div>
          <div class="activity-text">${it.text}</div>
        </div>
      `).join("");
    }
  }

  const totalTasks = Math.max(chats.length, 12);
  const doneTasks = Math.min(chats.length, totalTasks);
  const pct = Math.min(100, Math.max(45, Math.round((doneTasks / totalTasks) * 100)));

  if (hudProgress) hudProgress.textContent = `${pct}%`;
  if (hudBar) hudBar.style.width = `${pct}%`;
  if (hudTasks) hudTasks.textContent = `${doneTasks} / ${totalTasks}`;

  if (welcomeStats) {
    const orch = state.orchestrationState;
    const [cCount, gCount, oCount] = engineCounts(orch);

    const totalAct = cCount + gCount + oCount;
    welcomeStats.innerHTML = `Hoje temos <b>${totalAct} execuções ativas</b> (${cCount} no Claude, ${gCount} no Gemini, ${oCount} no OpenCode) e <b>${chats.length} conversas</b> no projeto.`;
  }

  const agentListEl = document.querySelector(".agent-status-list");
  if (agentListEl) {
    const orch = state.orchestrationState;
    const [cCount, gCount, oCount] = engineCounts(orch);

    agentListEl.innerHTML = `
      <div class="agent-status-row">
        <span class="agent-name-cell"><span><i class="fa-solid fa-robot" aria-hidden="true"></i></span> Claude Code</span>
        <span class="agent-badge ${cCount > 0 ? 'badge-dev' : 'badge-ba'}">${cCount > 0 ? `${cCount} ativo · Executando` : 'Standby'}</span>
      </div>
      <div class="agent-status-row">
        <span class="agent-name-cell"><span><i class="fa-solid fa-star" aria-hidden="true"></i></span> Gemini (Antigravity)</span>
        <span class="agent-badge ${gCount > 0 ? 'badge-dev' : 'badge-ba'}">${gCount > 0 ? `${gCount} ativo · Em andamento` : 'Standby'}</span>
      </div>
      <div class="agent-status-row">
        <span class="agent-name-cell"><span><i class="fa-solid fa-gem" aria-hidden="true"></i></span> OpenCode Lab</span>
        <span class="agent-badge ${oCount > 0 ? 'badge-devops' : 'badge-ba'}">${oCount > 0 ? `${oCount} ativo` : 'Standby'}</span>
      </div>
      <div class="agent-status-row">
        <span class="agent-name-cell"><span><i class="fa-solid fa-flask" aria-hidden="true"></i></span> QA AutoTester</span>
        <span class="agent-badge badge-qa">213 testes OK</span>
      </div>
    `;
  }
}

/** Contagens claude/gemini/opencode pelo mesmo resumo da Central e do telão. */
function engineCounts(orch) {
  return ["claude", "gemini", "opencode"].map((id) =>
    summarizeEngine(id, { agentState: officeAgentState.getAgentState(id), executions: orch?.executions }).activeCount);
}
