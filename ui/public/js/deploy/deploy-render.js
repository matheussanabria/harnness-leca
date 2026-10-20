// @ts-check
// Renderização das estatísticas, dos cartões de projeto e do histórico.
import { dp } from "./deploy-store.js";
import { maskUrl, formatTimeAgo, escapeHtml, escapeAttr } from "./deploy-utils.js";

// Resolução resiliente dos elementos do DOM
function getGridEl() {
  return typeof document !== "undefined" ? document.getElementById("projectsGrid") : null;
}
function getHistoryTbodyEl() {
  return typeof document !== "undefined" ? document.getElementById("historyTbody") : null;
}
function getStatEl(id) {
  return typeof document !== "undefined" ? document.getElementById(id) : null;
}
function createEl(tagName, doc = typeof document !== "undefined" ? document : null) {
  if (doc && typeof doc.createElement === "function") {
    return doc.createElement(tagName);
  }
  return {
    tagName,
    className: "",
    innerHTML: "",
    children: [],
    appendChild(child) {
      this.children.push(child);
    },
  };
}

export function renderAll() {
  renderStats();
  renderGrid();
  renderHistory();
}

export function renderStats() {
  const statProjectsCount = getStatEl("statProjectsCount");
  const statEnvsCount = getStatEl("statEnvsCount");
  const statWebhooksReady = getStatEl("statWebhooksReady");
  const statLastDeploy = getStatEl("statLastDeploy");

  const projects = dp.deployConfig.projects || [];
  let totalEnvs = 0;
  let configuredWebhooks = 0;

  projects.forEach((p) => {
    (p.environments || []).forEach((e) => {
      totalEnvs++;
      if (e.webhookUrl && e.webhookUrl.trim()) configuredWebhooks++;
    });
  });

  if (statProjectsCount) statProjectsCount.textContent = String(projects.length);
  if (statEnvsCount) statEnvsCount.textContent = String(totalEnvs);
  if (statWebhooksReady) {
    statWebhooksReady.innerHTML = `${configuredWebhooks} <span style="font-size:14px;color:var(--mute)">/ ${totalEnvs}</span>`;
  }

  if (statLastDeploy) {
    if (dp.deployHistory.length > 0) {
      const last = dp.deployHistory[0];
      const timeAgo = formatTimeAgo(new Date(last.timestamp));
      const color = last.ok ? "var(--success)" : "var(--danger)";
      statLastDeploy.innerHTML = `<span style="color:${color}"><i class="fa-solid fa-circle" style="font-size:9px;vertical-align:middle"></i> ${escapeHtml(last.status || 'ERR')}</span> <span style="font-size:13px;color:var(--mute)">(${escapeHtml(timeAgo)})</span>`;
    } else {
      statLastDeploy.innerHTML = `<span style="font-size:14px;color:var(--mute)">Nenhum ainda</span>`;
    }
  }
}

export function renderGrid(targetGrid = getGridEl()) {
  if (!targetGrid) return;
  targetGrid.innerHTML = "";

  const projects = dp.deployConfig.projects || [];
  if (projects.length === 0) {
    targetGrid.innerHTML = `
      <div style="grid-column: 1/-1; padding: 48px 20px; text-align: center; background: var(--panel); border: 1px dashed var(--line); border-radius: 16px;">
        <div style="font-size: 32px; margin-bottom: 12px; color: var(--accent);"><i class="fa-solid fa-rocket"></i></div>
        <h3 style="margin: 0 0 6px;">Nenhum projeto de deploy cadastrado</h3>
        <p style="color: var(--mute); font-size: 13.5px; margin: 0 0 16px;">Adicione seus projetos hospedados no Easypanel (Hostinger VPS) com seus respectivos webhooks.</p>
        <button class="btn-primary" onclick="window.openNewProjectModal()"><i class="fa-solid fa-plus"></i> Cadastrar Primeiro Projeto</button>
      </div>
    `;
    return;
  }

  projects.forEach((proj) => {
    const card = createEl("div");
    card.className = "project-card";

    const envs = proj.environments || [];
    let envsHtml = "";

    envs.forEach((env) => {
      const isStaging = env.type === "staging" || (env.id && env.id.toLowerCase().includes("stag"));
      const isProd = env.type === "production" || (env.id && env.id.toLowerCase().includes("prod"));
      const badgeClass = isStaging ? "env-staging" : isProd ? "env-prod" : "env-custom";
      const deployBtnClass = isProd ? "btn-deploy-prod" : "btn-deploy-staging";

      const hasUrl = Boolean(env.webhookUrl && env.webhookUrl.trim());
      const maskedUrl = hasUrl ? maskUrl(env.webhookUrl) : "Nenhum webhook configurado";

      // Verifica último status desse ambiente no histórico
      const lastHistory = dp.deployHistory.find((h) => h.projectId === proj.id && h.envId === env.id);
      let statusDotClass = "dot-idle";
      let statusText = "Pronto";
      if (lastHistory) {
        statusDotClass = lastHistory.ok ? "dot-success" : "dot-error";
        statusText = `${lastHistory.status} (${formatTimeAgo(new Date(lastHistory.timestamp))})`;
      }

      const envIcon = isProd ? '<i class="fa-solid fa-shield-halved"></i>' : isStaging ? '<i class="fa-solid fa-flask"></i>' : '<i class="fa-solid fa-gear"></i>';

      envsHtml += `
        <div class="env-row" data-project-id="${escapeHtml(proj.id)}" data-env-id="${escapeHtml(env.id)}">
          <div class="env-row-header">
            <span class="env-badge ${badgeClass}">
              ${envIcon} ${escapeHtml(env.name || env.id)}
            </span>
            <div class="env-status-indicator">
              <span class="indicator-dot ${statusDotClass}" id="dot-${escapeHtml(proj.id)}-${escapeHtml(env.id)}"></span>
              <span id="statustext-${escapeHtml(proj.id)}-${escapeHtml(env.id)}">${escapeHtml(statusText)}</span>
            </div>
          </div>

          <div class="env-url-preview" title="${hasUrl ? escapeHtml(env.webhookUrl) : 'Clique em Configurar para inserir a URL do Easypanel'}">
            <span class="${hasUrl ? '' : 'env-url-empty'}">${escapeHtml(maskedUrl)}</span>
            ${hasUrl ? `<button class="btn-icon" title="Copiar URL Completa" onclick="window.copyToClipboard('${escapeAttr(env.webhookUrl)}')"><i class="fa-solid fa-copy"></i></button>` : ''}
          </div>

          <div class="env-actions">
            <button 
              class="btn-deploy ${deployBtnClass}" 
              id="btn-deploy-${escapeHtml(proj.id)}-${escapeHtml(env.id)}"
              onclick="window.triggerDeploy('${escapeAttr(proj.id)}', '${escapeAttr(env.id)}')"
              ${hasUrl ? '' : 'disabled title="Configure o Webhook antes de disparar"'}
            >
              <span><i class="fa-solid fa-rocket"></i></span> Deploy ${escapeHtml(env.name || env.id)}
            </button>
            <button class="btn-row-action" title="Editar Webhook e Configurações" onclick="window.openEditEnvModal('${escapeAttr(proj.id)}', '${escapeAttr(env.id)}')">
              <i class="fa-solid fa-gear"></i> Configurar
            </button>
            ${hasUrl ? `
              <button class="btn-row-action" title="Copiar comando cURL para terminal" onclick="window.copyCurl('${escapeAttr(env.webhookUrl)}', '${escapeAttr(env.method || 'POST')}')">
                <i class="fa-solid fa-terminal"></i> cURL
              </button>
            ` : ''}
          </div>
        </div>
      `;
    });

    card.innerHTML = `
      <div class="project-card-header">
        <div class="project-title-area">
          <h3><span><i class="fa-solid fa-box-archive"></i></span> ${escapeHtml(proj.name || proj.id)}</h3>
          <p class="desc">${escapeHtml(proj.description || `ID: ${proj.id}`)}</p>
        </div>
        <div class="project-header-actions">
          <button class="btn-icon" title="Editar Informações do Projeto" onclick="window.openEditProjectModal('${escapeAttr(proj.id)}')"><i class="fa-solid fa-pen-to-square"></i></button>
          <button class="btn-icon" title="Excluir Projeto" onclick="window.deleteProject('${escapeAttr(proj.id)}')"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
      <div class="environments-list">
        ${envsHtml}
      </div>
    `;

    targetGrid.appendChild(card);
  });
}

export function renderHistory(targetTbody = getHistoryTbodyEl()) {
  if (!targetTbody) return;
  targetTbody.innerHTML = "";

  if (dp.deployHistory.length === 0) {
    targetTbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 28px; color: var(--mute); font-style: italic;">
          Nenhum histórico de deploy registrado nesta sessão.
        </td>
      </tr>
    `;
    return;
  }

  dp.deployHistory.forEach((item) => {
    const tr = createEl("tr");
    const d = new Date(item.timestamp);
    const timeStr = d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR");
    const isOk = item.ok;
    const statusClass = isOk ? "status-chip-ok" : "status-chip-err";
    const snippet = item.snippet ? (item.snippet.length > 80 ? item.snippet.slice(0, 80) + "…" : item.snippet) : "-";
    const statusIcon = isOk ? '<i class="fa-solid fa-check"></i>' : '<i class="fa-solid fa-xmark"></i>';

    tr.innerHTML = `
      <td style="font-family: var(--font-mono); font-size: 12px; color: var(--mute);">${escapeHtml(timeStr)}</td>
      <td><b>${escapeHtml(item.projectName || item.projectId || '-')}</b></td>
      <td><span class="badge">${escapeHtml(item.envName || item.envId || '-')}</span></td>
      <td>
        <span class="status-chip ${statusClass}">
          ${statusIcon} ${escapeHtml(String(item.status || 'ERR'))} ${escapeHtml(item.statusText || '')}
        </span>
      </td>
      <td style="font-family: var(--font-mono); font-size: 12px;">${item.durationMs ? item.durationMs + 'ms' : '-'}</td>
      <td class="snippet-cell" title="${escapeHtml(item.snippet || '')}">${escapeHtml(snippet)}</td>
    `;
    targetTbody.appendChild(tr);
  });
}
