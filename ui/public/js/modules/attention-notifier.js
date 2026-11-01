// @ts-check
// Notificador de atenção da interface (EP-09.05, RF6, RF7).
// Avalia relevância para notificação: itens novos, não reconhecidos e relevantes (high ou medium).
// Módulo puro: sem DOM, determinístico.

/**
 * @typedef {Object} AttentionItem
 * @property {string} id
 * @property {string} title
 * @property {"high" | "medium" | "low"} severity
 * @property {"open" | "acknowledged" | "resolved"} state
 * @property {string} origin
 * @property {string} openedAt
 */

/**
 * Verifica se um item merece emissão de notificação ativa ao usuário.
 * Critérios:
 * 1. Deve estar aberto (`state === "open"`) e não ter sido reconhecido/resolvido.
 * 2. Relevância: severidade `high` ou `medium` (low não gera alarme sonoro/visual intrusivo).
 * 3. Não ter sido notificado anteriormente no conjunto de itens já alertados.
 *
 * @param {AttentionItem} item
 * @param {Set<string>|Array<string>} alreadyNotifiedIds
 * @returns {boolean}
 */
export function shouldNotifyItem(item, alreadyNotifiedIds = new Set()) {
  if (!item) return false;
  if (item.state !== "open") return false;
  if (item.severity !== "high" && item.severity !== "medium") return false;

  const set = alreadyNotifiedIds instanceof Set ? alreadyNotifiedIds : new Set(alreadyNotifiedIds);
  return !set.has(item.id);
}

/**
 * Retorna o ícone FontAwesome correspondente à severidade (RF7).
 * Nunca apenas cor; sempre ícone + texto.
 * @param {string} severity
 * @returns {{ icon: string, label: string, tone: string }}
 */
export function getSeverityMeta(severity) {
  const s = String(severity || "").toLowerCase();
  if (s === "high") {
    return { icon: "fa-triangle-exclamation", label: "Alta severidade", tone: "danger" };
  }
  if (s === "medium") {
    return { icon: "fa-circle-exclamation", label: "Média severidade", tone: "warning" };
  }
  return { icon: "fa-circle-info", label: "Baixa severidade", tone: "info" };
}

/**
 * Renderiza uma notificação viva com aria-live moderado (RF6).
 * @param {AttentionItem} item
 * @returns {string}
 */
export function renderNotificationToast(item) {
  if (!item) return "";
  const meta = getSeverityMeta(item.severity);
  return `
    <div class="attention-toast attention-toast--${meta.tone}" role="status" aria-live="polite" data-attention-id="${item.id}">
      <span class="attention-toast__icon"><i class="fa-solid ${meta.icon}" aria-hidden="true"></i></span>
      <div class="attention-toast__body">
        <strong class="attention-toast__title">${item.title}</strong>
        <span class="attention-toast__meta">${meta.label} · Origem: ${item.origin}</span>
      </div>
      <button type="button" class="attention-toast__ack" data-action="ack" aria-label="Reconhecer notificação">
        <i class="fa-solid fa-check" aria-hidden="true"></i>
      </button>
    </div>`;
}
