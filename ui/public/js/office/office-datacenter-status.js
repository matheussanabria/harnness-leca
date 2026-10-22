// @ts-check
// Estado real do Datacenter na estacao do Escritorio (EP-10.05).
// Consome o mesmo contrato do painel: GET /api/deploy/status.

const STATE_META = {
  saudavel: { label: "Saudavel", icon: "fa-circle-check", className: "is-ok" },
  degradado: { label: "Degradado", icon: "fa-circle-exclamation", className: "is-warn" },
  instavel: { label: "Instavel", icon: "fa-circle-xmark", className: "is-fail" },
  desconhecido: { label: "Sem dados", icon: "fa-circle-question", className: "is-unknown" },
};

/**
 * @param {string} value
 * @returns {string}
 */
function esc(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));
}

/**
 * Carrega e renderiza o resumo operacional no cartao do Datacenter.
 * @param {HTMLElement | null} host
 */
export async function renderOfficeDatacenterStatus(host) {
  if (!host) return;
  try {
    const res = await fetch("/api/deploy/status");
    if (!res.ok) throw new Error("Falha ao carregar o resumo operacional.");
    const data = await res.json();
    const environments = data.environments || [];
    if (!environments.length) {
      host.innerHTML = `<div class="office-datacenter-line"><i class="fa-solid fa-circle-question"></i> Sem dados operacionais: nenhuma medicao de saude registrada.</div>`;
      return;
    }
    const rows = environments.map((env) => {
      const meta = STATE_META[env.state] || STATE_META.desconhecido;
      const check = env.lastCheckAt ? env.lastCheckAt.slice(0, 16).replace("T", " ") : "sem medicao";
      return `<div class="office-datacenter-line">
        <i class="fa-solid ${meta.icon} ${meta.className}"></i>
        <span class="office-datacenter-target">${esc(env.projectId)}/${esc(env.envId)}</span>
        <span class="office-datacenter-meta">${esc(meta.label)} · ${esc(check)}${env.latencyMs ? ` · ${esc(String(env.latencyMs))} ms` : ""}</span>
      </div>`;
    }).join("");
    const totals = data.totals || {};
    host.innerHTML = `${rows}
      <div class="office-datacenter-line office-datacenter-totals">
        <i class="fa-solid fa-server"></i>
        <span class="office-datacenter-meta">${esc(String(totals.environments || 0))} ambiente(s) · ${esc(String(totals.healthy || 0))} saudavel(is) · ${esc(String(totals.pendingActions || 0))} acao(oes) pendente(s)</span>
      </div>`;
  } catch (err) {
    host.innerHTML = `<div class="office-datacenter-line"><i class="fa-solid fa-triangle-exclamation"></i> Resumo operacional indisponivel.</div>`;
  }
}
