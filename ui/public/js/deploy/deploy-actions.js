// @ts-check
// Secao "Acoes Autorizadas" da tela /deploy (EP-10.04).
import { esc, showToast } from "../../shared/dom.js";

const RISK_META = {
  baixo: { label: "Baixo", icon: "fa-shield-halved", className: "is-low" },
  medio: { label: "Medio", icon: "fa-shield-halved", className: "is-medium" },
  critico: { label: "Critico", icon: "fa-triangle-exclamation", className: "is-critical" },
};

function riskBadge(risk) {
  const meta = RISK_META[risk] || RISK_META.baixo;
  return `<span class="action-risk ${meta.className}"><i class="fa-solid ${meta.icon}"></i> ${meta.label}</span>`;
}

function actionCard(action) {
  const confirm = action.requiresConfirmation ? " · exige confirmacao" : "";
  return `<article class="action-card" data-action-id="${esc(action.id)}">
    <header class="action-card-head">
      <h4><i class="fa-solid fa-bolt"></i> ${esc(action.label)}</h4>
      ${riskBadge(action.risk)}
    </header>
    <p class="action-desc">${esc(action.description || "")}</p>
    <div class="action-meta">
      <span><i class="fa-solid fa-server"></i> ${esc(action.projectId)}/${esc(action.envId)}</span>
      <span><i class="fa-solid fa-list-check"></i> ${esc(action.type)}</span>
      <span class="action-confirm">${esc(confirm.replace(" · ", ""))}</span>
    </div>
    <div class="action-buttons">
      <button type="button" class="action-authorize-button" data-action-authorize="${esc(action.id)}" title="Emitir autorizacao para a acao">
        <i class="fa-solid fa-user-check"></i> Autorizar
      </button>
      <button type="button" class="action-execute-button" data-action-execute="${esc(action.id)}" title="Executar a acao autorizada">
        <i class="fa-solid fa-play"></i> Executar
      </button>
    </div>
    <p class="action-status" data-action-status="${esc(action.id)}"></p>
  </article>`;
}

async function loadActions() {
  const res = await fetch("/api/deploy/actions");
  if (!res.ok) return { ok: false, error: "Falha ao carregar as acoes." };
  return await res.json();
}

async function authorize(actionId, actor) {
  const res = await fetch(`/api/deploy/actions/${encodeURIComponent(actionId)}/authorize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ actor }),
  });
  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }
  return { ok: res.ok, data };
}

async function execute(actionId, authorizationId, confirm) {
  const res = await fetch(`/api/deploy/actions/${encodeURIComponent(actionId)}/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ authorizationId, confirm, actor: "interface" }),
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
 * Renderiza a secao de acoes autorizadas na tela de deploy.
 */
export async function renderActionsPanel() {
  const host = document.getElementById("actionsPanel");
  if (!host) return;
  host.innerHTML = `<div class="health-loading"><i class="fa-solid fa-spinner fa-spin"></i> Carregando acoes...</div>`;

  const data = await loadActions();
  if (!data.ok) {
    host.innerHTML = `<div class="health-loading"><i class="fa-solid fa-triangle-exclamation"></i> ${esc(data.error || "Falha ao carregar as acoes.")}</div>`;
    return;
  }
  const actions = data.actions || [];
  host.innerHTML = `<div class="actions-grid">${actions.map(actionCard).join("")}</div>`;

  host.querySelectorAll("[data-action-authorize]").forEach((button) => {
    button.addEventListener("click", async () => {
      const element = /** @type {HTMLElement} */ (button);
      const actionId = element.dataset.actionAuthorize || "";
      const actor = window.prompt("Responsavel pela autorizacao:", "operador");
      if (!actor) return;
      const result = await authorize(actionId, actor);
      const status = host.querySelector(`[data-action-status="${actionId}"]`);
      if (!result.ok) {
        if (status) status.textContent = result.data?.error || "Falha ao autorizar.";
        return;
      }
      if (status) status.textContent = `Autorizacao ${result.data.authorization.id} emitida (expira ${String(result.data.authorization.expiresAt).slice(11, 19)}).`;
      showToast("Autorizacao emitida.");
    });
  });

  host.querySelectorAll("[data-action-execute]").forEach((button) => {
    button.addEventListener("click", async () => {
      const element = /** @type {HTMLElement} */ (button);
      const actionId = element.dataset.actionExecute || "";
      const action = actions.find((item) => item.id === actionId);
      const authorizationId = window.prompt("Identificador da autorizacao:", "");
      if (!authorizationId) return;
      const confirmed = action?.requiresConfirmation
        ? window.confirm("Acao critica em producao. Confirmar a execucao?")
        : true;
      if (!confirmed) return;
      const result = await execute(actionId, authorizationId, confirmed);
      const status = host.querySelector(`[data-action-status="${actionId}"]`);
      if (!result.ok) {
        if (status) status.textContent = result.data?.error || "Falha ao executar.";
        return;
      }
      if (status) status.textContent = `Acao executada: ${result.data.action?.status || "registrada"}.`;
      showToast("Acao registrada no historico.");
    });
  });
}

if (typeof window !== "undefined") {
  // @ts-ignore
  window.reloadActions = () => renderActionsPanel();
  document.addEventListener("DOMContentLoaded", () => {
    renderActionsPanel();
  });
}
