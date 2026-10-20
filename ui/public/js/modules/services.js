// @ts-check
import { $, esc, section, showToast } from "../shared/dom.js";
import { state } from "../shared/state.js";

let activeLogsServiceId = null;
let activeLogsEventSource = null;

export function renderServicesSection() {
  const P = state.P;
  const services = (P && P.services) || [];
  if (!services.length) return "";

  const rows = services
    .map((s) => {
      const isRunning = s.status === "running";
      const stBadge = isRunning
        ? `<span class="status-badge status-ok" style="font-size:10px">● rodando (PID ${s.pid || ""})</span>`
        : `<span class="status-badge" style="font-size:10px;opacity:0.7">parado</span>`;
      const actionBtn = isRunning
        ? `<button type="button" class="btn-vp" onclick="stopCurrentService('${esc(s.id)}')" style="color:#ef4444;font-size:11px;padding:2px 8px">⏹ Parar</button>`
        : `<button type="button" class="btn-vp" onclick="startCurrentService('${esc(s.id)}')" style="color:#10b981;font-size:11px;padding:2px 8px">▶ Subir</button>`;

      return `
      <div style="padding:8px 0;border-bottom:1px solid var(--line);display:flex;flex-direction:column;gap:4px">
        <div style="display:flex;align-items:center;justify-content:space-between">
          <b style="font-size:12.5px">${esc(s.name)}</b>
          <div style="display:flex;align-items:center;gap:4px">
            ${stBadge}
            ${actionBtn}
            <button type="button" class="btn-vp" onclick="openServiceLogsModal('${esc(s.id)}')" title="Ver logs" style="font-size:11px;padding:2px 6px">📜</button>
          </div>
        </div>
        <div style="font-size:11px;font-family:monospace;color:var(--accent);display:flex;gap:6px;align-items:center;flex-wrap:wrap">
          <code>${esc(s.command)}</code>
          <span style="color:var(--mute)">· ${esc(s.url)}</span>
        </div>
      </div>
    `;
    })
    .join("");

  return section("Servidores Dev", `${services.length} serviço(s)`, `<div style="display:flex;flex-direction:column">${rows}</div>`);
}

export function updateServiceStatusIndicators() {
  const P = state.P;
  const services = (P && P.services) || [];
  const isRunning = services.some((s) => s.status === "running");

  const btnStart = $("btnCanvasStartSrv");
  const btnStop = $("btnCanvasStopSrv");
  const btnOfflineStart = $("btnOfflineStart");

  if (btnStart) btnStart.style.display = isRunning ? "none" : "inline-flex";
  if (btnStop) btnStop.style.display = isRunning ? "inline-flex" : "none";
  if (btnOfflineStart) {
    btnOfflineStart.innerHTML = isRunning ? "<span>🔄</span> Servidor Subindo..." : "<span>▶</span> Subir Projeto Agora";
  }

  const badgeModal = $("srvLogsStatusBadge");
  if (badgeModal) {
    badgeModal.className = "status-badge " + (isRunning ? "status-ok" : "status-nova");
    badgeModal.textContent = isRunning ? "running" : "stopped";
  }
}

export async function startCurrentService(serviceId) {
  const P = state.P;
  if (!P || !P.slug) return;
  // Sem serviceId (botões gerais "Subir"), inicia todos os serviços parados (ex.: web + api).
  const all = P.services || [];
  const ids = serviceId
    ? [serviceId]
    : all.filter((s) => s.status !== "running").map((s) => s.id);
  if (!ids.length) ids.push(all[0] ? all[0].id : "default");
  showToast(ids.length > 1 ? `🚀 Subindo ${ids.length} serviços...` : "🚀 Subindo servidor dev...");

  const btnStart = $("btnCanvasStartSrv");
  if (btnStart) {
    btnStart.textContent = "Iniciando...";
    btnStart.disabled = true;
  }

  try {
    for (const sId of ids) {
      const res = await fetch(`/api/project/${P.slug}/services/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceId: sId }),
      });
      const data = await res.json();
      const s = all.find((x) => x.id === sId) || all[0];
      const label = (s && s.name) || sId;
      if (data && data.ok) {
        showToast(`✅ ${label} iniciado (PID ${data.pid || ""})!`);
        if (s) {
          s.status = "running";
          s.pid = data.pid;
        }
      } else {
        showToast(`❌ Erro ao iniciar ${label}: ` + (data.error || "falha"));
      }
    }
    updateServiceStatusIndicators();
    setTimeout(() => window.checkAppStatus && window.checkAppStatus(false), 2000);
    setTimeout(() => window.checkAppStatus && window.checkAppStatus(false), 5000);
  } catch (err) {
    showToast("❌ Erro de rede ao iniciar serviço");
  } finally {
    if (btnStart) {
      btnStart.textContent = "▶ Subir";
      btnStart.disabled = false;
    }
  }
}

export async function stopCurrentService(serviceId) {
  const P = state.P;
  if (!P || !P.slug) return;
  const sId = serviceId || (P.services && P.services[0] ? P.services[0].id : undefined);
  showToast("⏹ Parando processo...");

  try {
    const res = await fetch(`/api/project/${P.slug}/services/stop`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ serviceId: sId }),
    });
    const data = await res.json();
    if (data && data.ok) {
      showToast("⏹ Processo finalizado com sucesso!");
      if (P.services) {
        for (const s of P.services) {
          if (!sId || s.id === sId) {
            s.status = "stopped";
            delete s.pid;
          }
        }
      }
      updateServiceStatusIndicators();
      if (window.checkAppStatus) window.checkAppStatus(false);
    }
  } catch (err) {
    showToast("❌ Erro ao parar processo");
  }
}

export function openServiceLogsModal(serviceId) {
  const P = state.P;
  if (!P || !P.slug) return;
  const sId = serviceId || (P.services && P.services[0] ? P.services[0].id : "default");
  activeLogsServiceId = sId;

  /** @type {any} */ const dlg = $("srvLogsDlg");
  if (!dlg) return;
  dlg.showModal();

  const title = $("srvLogsTitle");
  if (title) title.textContent = `Logs: ${sId} (${P.slug})`;

  const box = $("srvLogsContent");
  if (box) box.textContent = "Conectando ao stream de saída do processo...\n";

  if (activeLogsEventSource) {
    activeLogsEventSource.close();
  }

  activeLogsEventSource = new EventSource(`/api/project/${P.slug}/services/logs?serviceId=${encodeURIComponent(sId)}&stream=1`);
  activeLogsEventSource.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data);
      if (data && data.text) {
        box.textContent += data.text + "\n";
        const auto = /** @type {HTMLInputElement} */ ($("srvLogsAutoscroll"));
        if (auto && auto.checked) {
          box.scrollTop = box.scrollHeight;
        }
      }
    } catch {
      box.textContent += e.data + "\n";
    }
  };

  activeLogsEventSource.onerror = () => {
    // Stream de log ativo
  };

  dlg.onclose = () => {
    if (activeLogsEventSource) {
      activeLogsEventSource.close();
      activeLogsEventSource = null;
    }
  };
}

export function clearServiceLogsView() {
  const box = $("srvLogsContent");
  if (box) box.textContent = "";
}
