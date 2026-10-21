// @ts-check
// Secao "Pipelines de Deploy" da tela /deploy (EP-10.01).
import { esc } from "../../shared/dom.js";

const STAGE_META = {
  command: { label: "Comando", icon: "fa-terminal" },
  webhook: { label: "Webhook", icon: "fa-plug" },
};

const STATUS_META = {
  completed: { label: "Concluido", icon: "fa-circle-check", className: "is-ok" },
  failed: { label: "Falhou", icon: "fa-circle-xmark", className: "is-fail" },
  running: { label: "Em execucao", icon: "fa-spinner", className: "is-running" },
};

function stageBadge(stage) {
  const meta = STAGE_META[stage.type] || STAGE_META.command;
  const status = STATUS_META[stage.status] || STATUS_META.running;
  return `<span class="pipeline-stage">
    <i class="fa-solid ${meta.icon}"></i> ${esc(stage.name || stage.id)}
    <span class="pipeline-stage-status ${status.className}"><i class="fa-solid ${status.icon}"></i> ${status.label}</span>
    ${stage.exitCode !== undefined ? `<span class="pipeline-stage-code">saida ${esc(String(stage.exitCode))}</span>` : ""}
    ${stage.httpStatus ? `<span class="pipeline-stage-code">http ${esc(String(stage.httpStatus))}</span>` : ""}
  </span>`;
}

function pipelineCard(pipeline) {
  const last = pipeline.lastRun;
  const status = last ? (STATUS_META[last.status] || STATUS_META.running) : null;
  const warnings = (pipeline.warnings || []).map((warning) => `<li>${esc(warning)}</li>`).join("");
  const stages = (pipeline.stages || []).map((stage) => `<li>${esc(stage.name || stage.id)} <span class="pipeline-stage-type">${esc(stage.type)}</span></li>`).join("");
  return `<article class="pipeline-card" data-pipeline-id="${esc(pipeline.id)}">
    <header class="pipeline-card-head">
      <h4><i class="fa-solid fa-diagram-project"></i> ${esc(pipeline.name || pipeline.id)}</h4>
      ${status ? `<span class="pipeline-status ${status.className}"><i class="fa-solid ${status.icon}"></i> ${status.label}</span>` : `<span class="pipeline-status is-idle"><i class="fa-solid fa-circle-minus"></i> Sem execucao</span>`}
    </header>
    <div class="pipeline-meta">
      <span><i class="fa-solid fa-code-branch"></i> ${esc(pipeline.branch || "main")}</span>
      <span><i class="fa-solid fa-server"></i> ${esc(pipeline.projectId || "sem projeto")}/${esc(pipeline.envId || "sem ambiente")}</span>
      ${pipeline.requireConfirm ? `<span class="pipeline-confirm"><i class="fa-solid fa-lock"></i> exige confirmacao</span>` : ""}
    </div>
    <ul class="pipeline-stages">${stages}</ul>
    ${last ? `<div class="pipeline-last">${(last.stages || []).map(stageBadge).join(" ")}</div>` : ""}
    ${warnings ? `<ul class="pipeline-warnings">${warnings}</ul>` : ""}
    <button type="button" class="pipeline-run-button" data-pipeline-run="${esc(pipeline.id)}" title="Executar o pipeline">
      <i class="fa-solid fa-play"></i> Executar
    </button>
  </article>`;
}

async function loadPipelines() {
  const res = await fetch("/api/deploy/pipelines");
  if (!res.ok) return { ok: false, error: "Falha ao carregar os pipelines." };
  return await res.json();
}

async function runPipeline(pipelineId, confirm) {
  const res = await fetch(`/api/deploy/pipelines/${encodeURIComponent(pipelineId)}/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ confirm, actor: "interface" }),
  });
  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }
  return { ok: res.ok, data };
}

/**
 * Renderiza a secao de pipelines na tela de deploy.
 */
export async function renderPipelinesPanel() {
  const host = document.getElementById("pipelinesPanel");
  if (!host) return;
  host.innerHTML = `<div class="pipeline-loading"><i class="fa-solid fa-spinner fa-spin"></i> Carregando pipelines...</div>`;

  const data = await loadPipelines();
  if (!data.ok) {
    host.innerHTML = `<div class="pipeline-loading"><i class="fa-solid fa-triangle-exclamation"></i> ${esc(data.error || "Falha ao carregar os pipelines.")}</div>`;
    return;
  }
  const pipelines = data.pipelines || [];
  if (!pipelines.length) {
    host.innerHTML = `<p class="pipeline-empty">Nenhum pipeline definido. Crie a definicao em <code>global/deploy-pipelines.json</code> ou pela API.</p>`;
    return;
  }
  host.innerHTML = `<div class="pipelines-grid">${pipelines.map(pipelineCard).join("")}</div>`;

  host.querySelectorAll("[data-pipeline-run]").forEach((button) => {
    button.addEventListener("click", async () => {
      const element = /** @type {HTMLElement} */ (button);
      const pipelineId = element.dataset.pipelineRun || "";
      const pipeline = pipelines.find((item) => item.id === pipelineId);
      const confirmed = !pipeline?.requireConfirm || window.confirm("Executar o pipeline em ambiente protegido?");
      if (!confirmed) return;
      element.setAttribute("disabled", "disabled");
      const result = await runPipeline(pipelineId, confirmed);
      if (!result.ok) {
        window.alert(result.data?.error || "Falha ao executar o pipeline.");
      }
      await renderPipelinesPanel();
    });
  });
}

if (typeof window !== "undefined") {
  // @ts-ignore
  window.reloadPipelines = () => renderPipelinesPanel();
  document.addEventListener("DOMContentLoaded", () => {
    renderPipelinesPanel();
  });
}
