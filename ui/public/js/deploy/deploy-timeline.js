// @ts-check
// Secao "Historico e Logs" da tela /deploy (EP-10.03).
import { esc } from "../../shared/dom.js";

const KIND_META = {
  webhook: { label: "Webhook", icon: "fa-plug" },
  pipeline: { label: "Pipeline", icon: "fa-diagram-project" },
  saude: { label: "Saude", icon: "fa-heart-pulse" },
};

const STATUS_META = {
  sucesso: { label: "Sucesso", icon: "fa-circle-check", className: "is-ok" },
  falha: { label: "Falha", icon: "fa-circle-xmark", className: "is-fail" },
};

function kindBadge(kind) {
  const meta = KIND_META[kind] || KIND_META.webhook;
  return `<span class="timeline-kind"><i class="fa-solid ${meta.icon}"></i> ${meta.label}</span>`;
}

function statusBadge(status) {
  const meta = STATUS_META[status] || STATUS_META.sucesso;
  return `<span class="timeline-status ${meta.className}"><i class="fa-solid ${meta.icon}"></i> ${meta.label}</span>`;
}

function timelineRow(entry) {
  const when = entry.at ? entry.at.slice(0, 19).replace("T", " ") : "sem instante";
  return `<tr class="timeline-row" data-timeline-kind="${esc(entry.kind)}">
    <td>${esc(when)}</td>
    <td>${kindBadge(entry.kind)}</td>
    <td>${esc(entry.projectId || "—")}/${esc(entry.envId || "—")}</td>
    <td>${statusBadge(entry.status)}</td>
    <td>${esc(String(entry.durationMs || 0))} ms</td>
    <td>${esc(entry.summary || "")}</td>
    <td style="text-align:right">
      ${entry.kind === "pipeline" ? `<button type="button" class="timeline-logs-button" data-timeline-logs="${esc(entry.reference)}" title="Ver logs da execucao"><i class="fa-solid fa-file-lines"></i> Logs</button>` : ""}
    </td>
  </tr>`;
}

function logBlock(execution) {
  const lines = (execution.lines || []).map((line) => `<div class="deploy-log-line ${line.status === "failed" ? "is-failed" : ""}">
    <span class="deploy-log-head">[${line.order + 1}] ${esc(line.name)} · ${esc(line.status)}${line.exitCode !== undefined ? ` · saida ${esc(String(line.exitCode))}` : ""}${line.httpStatus ? ` · http ${esc(String(line.httpStatus))}` : ""}</span>
    <pre class="deploy-log-output">${esc(line.output || "(sem saida)")}</pre>
  </div>`).join("");
  return `<div class="deploy-logs" data-logs-execution="${esc(execution.executionId)}">
    <header class="deploy-logs-head">
      <h4><i class="fa-solid fa-file-lines"></i> ${esc(execution.pipelineId || "execucao")} · ${esc(execution.pipelineName || "")}</h4>
      <span>${esc(execution.status || "")} · ${esc(execution.startedAt ? execution.startedAt.slice(0, 19).replace("T", " ") : "")}</span>
    </header>
    ${lines || "<p class=\"health-empty\">Sem estagios registrados.</p>"}
  </div>`;
}

async function loadTimeline(filters = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, String(value));
  }
  const suffix = params.toString() ? `?${params.toString()}` : "";
  const res = await fetch(`/api/deploy/timeline${suffix}`);
  if (!res.ok) return { ok: false, error: "Falha ao carregar o historico." };
  return await res.json();
}

async function loadLogs(executionId) {
  const res = await fetch(`/api/deploy/logs?executionId=${encodeURIComponent(executionId)}&limit=5`);
  if (!res.ok) return { ok: false, error: "Falha ao carregar os logs." };
  return await res.json();
}

/**
 * Renderiza a secao de historico e logs na tela de deploy.
 */
export async function renderTimelinePanel() {
  const host = document.getElementById("timelinePanel");
  if (!host) return;
  host.innerHTML = `<div class="health-loading"><i class="fa-solid fa-spinner fa-spin"></i> Carregando historico...</div>`;

  const data = await loadTimeline({ limit: 40 });
  if (!data.ok) {
    host.innerHTML = `<div class="health-loading"><i class="fa-solid fa-triangle-exclamation"></i> ${esc(data.error || "Falha ao carregar o historico.")}</div>`;
    return;
  }
  const entries = data.entries || [];
  host.innerHTML = `
    <div class="health-summary">
      <span><i class="fa-solid fa-plug"></i> ${data.totals?.webhook || 0} webhook(s)</span>
      <span><i class="fa-solid fa-diagram-project"></i> ${data.totals?.pipeline || 0} pipeline(s)</span>
      <span><i class="fa-solid fa-heart-pulse"></i> ${data.totals?.saude || 0} medicao(oes)</span>
    </div>
    ${data.warnings?.length ? `<p class="pipeline-warnings">${data.warnings.map(esc).join(" ")}</p>` : ""}
    <div class="health-table-wrap">
      <table class="health-table">
        <thead><tr><th>Instante</th><th>Tipo</th><th>Projeto/Ambiente</th><th>Estado</th><th>Duracao</th><th>Resumo</th><th></th></tr></thead>
        <tbody>${entries.map(timelineRow).join("")}</tbody>
      </table>
    </div>
    <div id="deployLogs" class="deploy-logs-host"></div>`;

  host.querySelectorAll("[data-timeline-logs]").forEach((button) => {
    button.addEventListener("click", async () => {
      const element = /** @type {HTMLElement} */ (button);
      const executionId = element.dataset.timelineLogs || "";
      const target = document.getElementById("deployLogs");
      if (!target) return;
      target.innerHTML = `<div class="health-loading"><i class="fa-solid fa-spinner fa-spin"></i> Carregando logs...</div>`;
      const logs = await loadLogs(executionId);
      target.innerHTML = logs.ok
        ? (logs.executions || []).map(logBlock).join("") || `<p class="health-empty">Sem logs para esta execucao.</p>`
        : `<div class="health-loading"><i class="fa-solid fa-triangle-exclamation"></i> ${esc(logs.error || "Falha ao carregar os logs.")}</div>`;
    });
  });
}

if (typeof window !== "undefined") {
  // @ts-ignore
  window.reloadTimeline = () => renderTimelinePanel();
  document.addEventListener("DOMContentLoaded", () => {
    renderTimelinePanel();
  });
}
