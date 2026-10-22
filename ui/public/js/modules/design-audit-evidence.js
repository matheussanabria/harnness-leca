// @ts-check
// Secao "Evidencias de teste" da aba Auditoria (EP-11.01).
import { esc, showToast } from "../shared/dom.js";
import { das } from "./design-audit-store.js";
import { fetchAuditMatrix, fetchAuditPipeline, runAuditAction } from "./design-audit-evidence-api.js";

const STATE_META = {
  planned: { label: "Planejada", icon: "fa-clipboard-list", className: "is-planned" },
  generated: { label: "Gerada", icon: "fa-file-code", className: "is-generated" },
  executed: { label: "Executada", icon: "fa-play", className: "is-executed" },
  approved: { label: "Aprovada", icon: "fa-circle-check", className: "is-approved" },
};

const ACTION_META = {
  generate: { label: "Gerar", icon: "fa-wand-magic-sparkles" },
  execute: { label: "Executar", icon: "fa-play" },
  approve: { label: "Aprovar", icon: "fa-circle-check" },
};

const STATES = Object.keys(STATE_META);

function stateBadge(state) {
  const meta = STATE_META[state] || STATE_META.planned;
  return `<span class="audit-evidence-state ${meta.className}"><i class="fa-solid ${meta.icon}"></i> ${meta.label}</span>`;
}

function evidenceCell(row) {
  if (!row.evidence?.file) return `<span class="audit-evidence-missing">Sem artefato detectado</span>`;
  const parts = [`<code title="${esc(row.evidence.file)}">${esc(row.evidence.file)}</code>`];
  if (row.evidence.hash) parts.push(`<span class="audit-evidence-meta">sha ${esc(row.evidence.hash.slice(0, 8))}</span>`);
  if (row.evidence.command) parts.push(`<span class="audit-evidence-meta">cmd ${esc(row.evidence.command)}</span>`);
  if (row.evidence.actor) parts.push(`<span class="audit-evidence-meta">por ${esc(row.evidence.actor)}</span>`);
  if (row.evidence.at) parts.push(`<span class="audit-evidence-meta">${esc(row.evidence.at.slice(0, 10))}</span>`);
  return parts.join(" ");
}

function legacyCell(row) {
  const legacy = row.legacy || {};
  if (!legacy.total) return `<span class="audit-evidence-missing">Sem item de legado</span>`;
  return `<span class="audit-evidence-meta">${legacy.igual} igual · ${legacy.dif} dif · ${legacy.falta} falta${legacy.pendingDecision ? ` · ${legacy.pendingDecision} sem decisão do PM` : ""}</span>`;
}

function actionButtons(row, actions = []) {
  return Object.keys(ACTION_META).map((id) => {
    const meta = ACTION_META[id];
    const action = actions.find((item) => item.id === id);
    const enabled = Boolean(action?.enabled);
    const reason = action?.reason || "";
    const title = enabled ? `Acao ${meta.label.toLowerCase()}` : reason;
    return `<button type="button" class="audit-evidence-action ${enabled ? "is-enabled" : "is-disabled"}" data-evidence-action="${id}" data-evidence-id="${esc(row.id)}" data-screen-id="${esc(row.screenId)}" data-rule-title="${esc(row.title)}" ${enabled ? "" : "disabled"} title="${esc(title)}">
      <i class="fa-solid ${meta.icon}"></i> ${meta.label}
    </button>`;
  }).join(" ");
}

function renderRows(rows = [], actionsByRule = new Map()) {
  if (!rows.length) {
    return `<tr><td colspan="5" style="text-align:center;padding:22px;color:var(--mute)">Nenhuma regra com o filtro selecionado.</td></tr>`;
  }
  return rows.map((row) => {
    const actions = actionsByRule.get(`${row.screenId}|${row.title}`) || [];
    return `
    <tr class="audit-evidence-row" data-evidence-id="${esc(row.id)}">
      <td>
        <div style="font-size:11px;color:#a5b4fc;margin-bottom:2px">${esc(row.screenName || "")}</div>
        <div style="font-size:12.5px">${esc(row.title)}</div>
      </td>
      <td style="width:130px">${stateBadge(row.state)}</td>
      <td style="font-size:11.5px">${evidenceCell(row)}</td>
      <td style="font-size:11.5px">${legacyCell(row)}</td>
      <td style="width:230px;text-align:right">${actionButtons(row, actions)}</td>
    </tr>`;
  }).join("");
}

/**
 * Renderiza a secao de evidencias de teste.
 * @param {HTMLElement} container
 * @param {string} slug
 */
export async function renderEvidenceSection(container, slug) {
  const host = /** @type {HTMLElement | null} */ (container.querySelector("#auditEvidenceBody"));
  if (!host) return;
  host.innerHTML = `<div class="audit-evidence-loading"><i class="fa-solid fa-spinner fa-spin"></i> Carregando evidencias...</div>`;

  const data = await fetchAuditMatrix(slug, { state: das.auditEvidenceState === "all" ? "" : das.auditEvidenceState });
  if (!data.ok) {
    host.innerHTML = `<div class="audit-evidence-loading"><i class="fa-solid fa-triangle-exclamation"></i> ${esc(data.error || "Falha ao carregar as evidencias.")}</div>`;
    return;
  }
  das.auditEvidenceData = data;

  const pipeline = await fetchAuditPipeline(slug);
  const actionsByRule = new Map();
  for (const item of pipeline.items || []) {
    actionsByRule.set(`${item.screenId}|${item.ruleTitle}`, item.actions || []);
  }

  const counts = data.summary?.counts || {};
  const filters = ["all", ...STATES].map((state) => {
    const meta = state === "all" ? { label: "Todas", icon: "fa-layer-group" } : STATE_META[state];
    const count = state === "all" ? data.totals?.rules || 0 : counts[state] || 0;
    const active = das.auditEvidenceState === state;
    return `<button type="button" class="view-btn ${active ? "active" : ""}" data-evidence-filter="${state}" aria-pressed="${active}">
      <i class="fa-solid ${meta.icon}"></i> ${meta.label} <span>${count}</span>
    </button>`;
  }).join("");

  host.innerHTML = `
    <div class="audit-evidence-toolbar">
      <div class="view-mode-toggle">${filters}</div>
      <div class="audit-evidence-summary">
        <span><i class="fa-solid fa-circle-check"></i> ${data.summary?.approvedPercent || 0}% aprovadas</span>
        <span><i class="fa-solid fa-play"></i> ${data.summary?.executedPercent || 0}% executadas</span>
        <span><i class="fa-solid fa-file-code"></i> ${data.summary?.artifactPercent || 0}% com artefato</span>
      </div>
    </div>
    <div class="audit-evidence-note">
      <i class="fa-solid fa-circle-info"></i>
      Gerado nao e aprovado: so conta como cobertura comprovada a regra com arquivo, comando e responsavel registrados.
    </div>
    <div style="overflow-x:auto;max-height:420px">
      <table class="audit-table">
        <thead>
          <tr>
            <th>Regra e Tela</th>
            <th>Estado da evidencia</th>
            <th>Evidencia</th>
            <th>Legado</th>
            <th style="text-align:right">Acao</th>
          </tr>
        </thead>
        <tbody>${renderRows(data.matrix || [], actionsByRule)}</tbody>
      </table>
    </div>`;

  host.querySelectorAll("[data-evidence-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      const element = /** @type {HTMLElement} */ (button);
      das.auditEvidenceState = element.dataset.evidenceFilter || "all";
      renderEvidenceSection(container, slug);
    });
  });

  host.querySelectorAll("[data-evidence-action]").forEach((button) => {
    button.addEventListener("click", async () => {
      const element = /** @type {HTMLElement} */ (button);
      const action = element.dataset.evidenceAction || "";
      const screenId = element.dataset.screenId || "";
      const ruleTitle = element.dataset.ruleTitle || "";
      const row = (data.matrix || []).find((item) => item.screenId === screenId && item.title === ruleTitle);
      element.setAttribute("disabled", "disabled");
      const result = await runAuditAction(slug, action, {
        screenId,
        screenName: row?.screenName,
        ruleTitle,
        kind: row?.kind || "bdd",
        actor: "interface",
        note: `Acao ${action} registrada pela aba Auditoria.`,
      });
      if (!result.ok) {
        showToast(result.data?.error || "Falha ao executar a acao.");
        return;
      }
      showToast(action === "generate" ? "Teste gerado." : action === "execute" ? "Teste executado." : "Evidencia aprovada.");
      renderEvidenceSection(container, slug);
    });
  });
}
