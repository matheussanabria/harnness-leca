// @ts-check
// Shared HTML helpers of the Central de Sessões views (pure, no DOM).

/** Labels that represent absence of signal; rendered muted to avoid clutter. */
export const NEUTRAL_LABELS = new Set([
  "Sem workflow",
  "Desconhecido",
  "Sem estado",
  "Sem atenção",
  "Desconhecida",
  "Atividade desconhecida",
  "Sem sinal recente",
  "Presença desconhecida",
  "sem telemetria",
  "sem projeto",
  "desconhecido",
  "sem data",
]);

/**
 * @param {string} value
 * @returns {boolean}
 */
export function isNeutral(value) {
  return NEUTRAL_LABELS.has(String(value ?? ""));
}

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
  const neutral = isNeutral(item.label) ? " is-neutral" : "";
  return `<span class="central-badge central-badge--${esc(item.pattern || "outline")} ${esc(extra)}${neutral}"><i class="fa-solid ${esc(item.icon)}" aria-hidden="true"></i> ${esc(item.label)}</span>`;
}

/**
 * Human-readable engine name.
 * @param {string} provider
 * @returns {string}
 */
export function engineLabel(provider) {
  const key = String(provider || "").toLowerCase();
  if (key === "claude") return "Claude";
  if (key === "gemini") return "Gemini";
  if (key === "opencode") return "opencode";
  if (key === "codex") return "Codex";
  return provider ? String(provider) : "desconhecido";
}

/**
 * Stable key used for the engine pill color.
 * @param {string} provider
 * @returns {string}
 */
export function engineKey(provider) {
  return String(provider || "unknown").toLowerCase().replace(/[^a-z0-9_-]/g, "-");
}

/**
 * Short id shown under the session title (the native id when present).
 * @param {string} id
 * @returns {string}
 */
export function shortSessionId(id) {
  const text = String(id || "");
  const tail = text.includes(":") ? text.split(":").pop() : text;
  return (tail || text).slice(0, 12) || "sem id";
}

/**
 * Compact relative time in Portuguese; full date stays in the tooltip.
 * @param {string} value
 * @param {number} [now]
 * @returns {string}
 */
export function relativeTime(value, now = Date.now()) {
  const text = String(value || "");
  if (!text) return "sem data";
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text;
  const minutes = Math.floor((now - date.getTime()) / 60000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `${minutes} min atrás`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h atrás`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} d atrás`;
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}
