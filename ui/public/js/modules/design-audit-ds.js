// @ts-check
// Painel de conformidade do Design System na aba Auditoria (EP-11.04). Função pura de renderização.

const SEVERITY_META = {
  error: { icon: "fa-circle-xmark", label: "Erro" },
  warning: { icon: "fa-triangle-exclamation", label: "Aviso" },
  info: { icon: "fa-circle-info", label: "Info" },
};

/** @param {unknown} value */
function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch] || ch));
}

/**
 * @param {{ score: number, compliant: boolean, totalIssues: number, tokensFound: boolean, issues: any[] }} report
 * @returns {string}
 */
export function renderDesignSystemAudit(report) {
  if (!report) return "";
  const status = report.compliant ? "fa-circle-check" : "fa-circle-exclamation";
  const label = report.compliant ? "Conforme" : "Não conforme";
  const rows = (report.issues || []).slice(0, 100).map((issue) => {
    const meta = SEVERITY_META[issue.severity] || SEVERITY_META.info;
    return `<li class="ds-audit__item ds-audit__item--${esc(issue.severity)}">
      <span class="ds-audit__sev"><i class="fa-solid ${meta.icon}" aria-hidden="true"></i> ${meta.label}</span>
      <code>${esc(issue.relPath)}:${esc(issue.line)}</code>
      <span>${esc(issue.message)}</span>
      ${issue.suggestion ? `<em>${esc(issue.suggestion)}</em>` : ""}
    </li>`;
  }).join("");
  return `
    <section class="ds-audit" aria-label="Conformidade do Design System">
      <h4><i class="fa-solid fa-palette" aria-hidden="true"></i> Conformidade do Design System</h4>
      <p class="ds-audit__score"><i class="fa-solid ${status}" aria-hidden="true"></i> ${label} · ${esc(report.score)}% · ${esc(report.totalIssues)} achados</p>
      ${report.tokensFound ? "" : '<p class="ds-audit__warn"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i> tokens.css ou theme.css ausente.</p>'}
      <ul class="ds-audit__list">${rows || "<li>Nenhuma inconsistência encontrada.</li>"}</ul>
    </section>`;
}

/**
 * Busca os dados de auditoria do Design System do projeto.
 * @param {string} slug
 */
export async function fetchDesignSystemAudit(slug) {
  try {
    const res = await fetch(`/api/project/${encodeURIComponent(slug)}/audit/design-system`);
    if (!res.ok) return { ok: false, error: "Falha ao carregar auditoria do Design System." };
    return { ok: true, data: await res.json() };
  } catch (err) {
    return { ok: false, error: err?.message || "Erro de rede ao carregar auditoria do Design System." };
  }
}

/**
 * Renderiza e monta a seção de conformidade do Design System no host especificado.
 * @param {HTMLElement} container
 * @param {string} slug
 */
export async function renderDesignSystemSection(container, slug) {
  const host = /** @type {HTMLElement | null} */ (container.querySelector("#auditDesignSystemBody"));
  if (!host) return;
  host.innerHTML = `<div class="audit-evidence-loading"><i class="fa-solid fa-spinner fa-spin"></i> Verificando Design System...</div>`;

  const res = await fetchDesignSystemAudit(slug);
  if (!res.ok || !res.data) {
    host.innerHTML = `<div class="audit-evidence-loading"><i class="fa-solid fa-triangle-exclamation"></i> ${esc(res.error || "Erro ao carregar dados.")}</div>`;
    return;
  }

  host.innerHTML = renderDesignSystemAudit(res.data);
}
