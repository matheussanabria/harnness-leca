// @ts-check
// Shared HTML helpers of the Central de Sessões views (pure, no DOM).

/**
 * @param {string} value
 * @returns {string}
 */
export function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * @param {object} status
 * @param {string} [extra]
 * @returns {string}
 */
export function statusBadge(status, extra = "") {
  const item = status || { label: "Desconhecido", icon: "fa-circle-question" };
  return `<span class="central-badge central-badge--${esc(item.pattern || "outline")} ${esc(extra)}"><i class="fa-solid ${esc(item.icon)}"></i> ${esc(item.label)}</span>`;
}
