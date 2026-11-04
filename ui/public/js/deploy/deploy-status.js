// @ts-check
// Resumo operacional de deploy no painel tradicional (EP-10.05).
import { esc } from "../shared/dom.js";

const STATE_META = {
  saudavel: { label: "Saudavel", icon: "fa-circle-check", className: "is-ok" },
  degradado: { label: "Degradado", icon: "fa-circle-exclamation", className: "is-warn" },
  instavel: { label: "Instavel", icon: "fa-circle-xmark", className: "is-fail" },
  desconhecido: { label: "Sem dados", icon: "fa-circle-question", className: "is-unknown" },
};

function stateBadge(state) {
  const meta = STATE_META[state] || STATE_META.desconhecido;
  return `<span class="deploy-state ${meta.className}"><i class="fa-solid ${meta.icon}"></i> ${meta.label}</span>`;
}

function environmentRow(env) {
  const check = env.lastCheckAt ? env.lastCheckAt.slice(0, 19).replace("T", " ") : "sem medicao";
  const deploy = env.lastDeployAt ? env.lastDeployAt.slice(0, 19).replace("T", " ") : "sem deploy";
  return `<tr>
    <td>${esc(env.projectId || "—")}/${esc(env.envId || "—")}</td>
    <td>${stateBadge(env.state)}</td>
    <td>${esc(check)}</td>
    <td>${env.latencyMs} ms</td>
    <td>${esc(deploy)} · ${esc(env.lastDeployStatus || "—")}</td>
    <td>${esc(env.lastPipelineStatus || "—")}</td>
    <td>${env.pendingActions || 0}</td>
  </tr>`;
}

async function loadStatus() {
  const res = await fetch("/api/deploy/status");
  if (!res.ok) return { ok: false, error: "Falha ao carregar o resumo operacional." };
  return await res.json();
}

/**
 * Renderiza o resumo operacional no painel de deploy.
 */
export async function renderDeployStatus() {
  const host = document.getElementById("deployStatusPanel");
  if (!host) return;
  host.innerHTML = `<div class="health-loading"><i class="fa-solid fa-spinner fa-spin"></i> Carregando resumo...</div>`;

  const data = await loadStatus();
  if (!data.ok) {
    host.innerHTML = `<div class="health-loading"><i class="fa-solid fa-triangle-exclamation"></i> ${esc(data.error || "Falha ao carregar o resumo.")}</div>`;
    return;
  }
  const environments = data.environments || [];
  if (!environments.length) {
    host.innerHTML = `<p class="health-empty">Sem dados operacionais: nenhuma verificacao de saude foi executada ainda.</p>`;
    return;
  }
  host.innerHTML = `
    <div class="health-summary">
      <span><i class="fa-solid fa-server"></i> ${data.totals?.environments || 0} ambiente(s)</span>
      <span><i class="fa-solid fa-heart-pulse"></i> ${data.totals?.healthy || 0} saudavel(is)</span>
      <span><i class="fa-solid fa-triangle-exclamation"></i> ${data.totals?.degraded || 0} degradado(s)</span>
      <span><i class="fa-solid fa-circle-xmark"></i> ${data.totals?.unstable || 0} instavel(is)</span>
      <span><i class="fa-solid fa-user-check"></i> ${data.totals?.pendingActions || 0} acao(oes) pendente(s)</span>
    </div>
    <div class="health-table-wrap">
      <table class="health-table">
        <thead><tr><th>Projeto/Ambiente</th><th>Estado</th><th>Ultima verificacao</th><th>Latencia</th><th>Ultimo deploy</th><th>Ultimo pipeline</th><th>Pendentes</th></tr></thead>
        <tbody>${environments.map(environmentRow).join("")}</tbody>
      </table>
    </div>`;
}

if (typeof window !== "undefined") {
  // @ts-ignore
  window.reloadDeployStatus = () => renderDeployStatus();
  document.addEventListener("DOMContentLoaded", () => {
    renderDeployStatus();
  });
}
