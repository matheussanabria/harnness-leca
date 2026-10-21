// @ts-check
// Secao "Saude dos Ambientes" da tela /deploy (EP-10.02).
import { esc } from "../../shared/dom.js";

const STATE_META = {
  saudavel: { label: "Saudavel", icon: "fa-circle-check", className: "is-ok" },
  degradado: { label: "Degradado", icon: "fa-circle-exclamation", className: "is-warn" },
  instavel: { label: "Instavel", icon: "fa-circle-xmark", className: "is-fail" },
  desconhecido: { label: "Desconhecido", icon: "fa-circle-question", className: "is-unknown" },
};

function stateBadge(state) {
  const meta = STATE_META[state] || STATE_META.desconhecido;
  return `<span class="health-state ${meta.className}"><i class="fa-solid ${meta.icon}"></i> ${meta.label}</span>`;
}

function environmentCard(env) {
  return `<article class="health-card" data-health-env="${esc(`${env.projectId}/${env.envId}`)}">
    <header class="health-card-head">
      <h4><i class="fa-solid fa-server"></i> ${esc(env.projectId)} / ${esc(env.envId)}</h4>
      ${stateBadge(env.state)}
    </header>
    <div class="health-meta">
      <span><i class="fa-solid fa-gauge-high"></i> ${env.lastLatencyMs} ms</span>
      <span><i class="fa-solid fa-magnifying-glass-chart"></i> ${env.measured}/${env.checks} medicao(oes)</span>
      <span><i class="fa-solid fa-clock"></i> ${env.lastCheckedAt ? esc(env.lastCheckedAt.slice(0, 19).replace("T", " ")) : "sem medicao"}</span>
    </div>
  </article>`;
}

function checkRow(check) {
  const last = check.lastMeasurement;
  const state = last?.state || "desconhecido";
  return `<tr class="health-check-row" data-health-check="${esc(check.id)}">
    <td>${esc(check.id)}</td>
    <td>${esc(check.type)}</td>
    <td><code>${esc(check.target)}</code></td>
    <td>${stateBadge(state)}</td>
    <td>${last ? `${esc(String(last.latencyMs))} ms` : "—"}</td>
    <td>${last ? esc(String(last.detail || "").slice(0, 80)) : "sem medicao"}</td>
    <td style="text-align:right">
      <button type="button" class="health-run-button" data-health-run="${esc(check.id)}" title="Executar a verificacao agora">
        <i class="fa-solid fa-play"></i> Verificar
      </button>
    </td>
  </tr>`;
}

async function loadHealth() {
  const res = await fetch("/api/deploy/health");
  if (!res.ok) return { ok: false, error: "Falha ao carregar a saude dos ambientes." };
  return await res.json();
}

async function runCheck(checkId) {
  const res = await fetch(`/api/deploy/health/checks/${encodeURIComponent(checkId)}/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
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
 * Renderiza a secao de saude dos ambientes na tela de deploy.
 */
export async function renderHealthPanel() {
  const host = document.getElementById("healthPanel");
  if (!host) return;
  host.innerHTML = `<div class="health-loading"><i class="fa-solid fa-spinner fa-spin"></i> Verificando ambientes...</div>`;

  const data = await loadHealth();
  if (!data.ok) {
    host.innerHTML = `<div class="health-loading"><i class="fa-solid fa-triangle-exclamation"></i> ${esc(data.error || "Falha ao carregar a saude.")}</div>`;
    return;
  }
  const environments = data.environments || [];
  const checks = data.checks || [];
  host.innerHTML = `
    <div class="health-summary">
      <span><i class="fa-solid fa-list-check"></i> ${data.totals?.checks || 0} verificacao(oes)</span>
      <span><i class="fa-solid fa-server"></i> ${data.totals?.environments || 0} ambiente(s)</span>
      <span><i class="fa-solid fa-heart-pulse"></i> ${data.totals?.measured || 0} medido(s)</span>
    </div>
    ${environments.length ? `<div class="health-grid">${environments.map(environmentCard).join("")}</div>`
      : `<p class="health-empty">Nenhuma verificacao configurada. Crie em <code>global/deploy-health.json</code> ou pela API.</p>`}
    ${checks.length ? `<div class="health-table-wrap">
      <table class="health-table">
        <thead><tr><th>Verificacao</th><th>Tipo</th><th>Alvo</th><th>Estado</th><th>Latencia</th><th>Detalhe</th><th></th></tr></thead>
        <tbody>${checks.map(checkRow).join("")}</tbody>
      </table>
    </div>` : ""}`;

  host.querySelectorAll("[data-health-run]").forEach((button) => {
    button.addEventListener("click", async () => {
      const element = /** @type {HTMLElement} */ (button);
      element.setAttribute("disabled", "disabled");
      const result = await runCheck(element.dataset.healthRun || "");
      if (!result.ok) window.alert(result.data?.error || "Falha ao executar a verificacao.");
      await renderHealthPanel();
    });
  });
}

if (typeof window !== "undefined") {
  // @ts-ignore
  window.reloadHealth = () => renderHealthPanel();
  document.addEventListener("DOMContentLoaded", () => {
    renderHealthPanel();
  });
}
