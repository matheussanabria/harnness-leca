// @ts-check
// Painel do Mapa em Camadas: monta os marcadores numerados do protótipo e escuta o clique nos pinos.

/**
 * Um marcador por campo que tem seletor. O numero e o do campo no mapa.
 * @param {any} sc tela com prototype.selectors e fields
 * @returns {{ id: string, n: number | string, selector: string }[]}
 */
export function buildMarkers(sc) {
  const selectors = sc?.prototype?.selectors || {};
  return (sc?.fields || []).filter((field) => selectors[field.id]).map((field) => ({ id: field.id, n: field.n, selector: selectors[field.id] }));
}

/** @param {{ id: string, n: number | string, selector: string }[]} markers @param {string | null | undefined} activeId */
export function markersMessage(markers, activeId) {
  return { type: "HARNESS_PROTO_MARKERS", markers, active: activeId || null };
}

/** @param {string | null | undefined} fieldId */
export function activeMarkerMessage(fieldId) {
  return { type: "HARNESS_PROTO_MARKER_ACTIVE", fieldId: fieldId || null };
}

/**
 * Trata a mensagem de clique em pino. So vale se veio de um dos quadros de protótipo do painel.
 * @param {{ data?: any, source?: any }} event
 * @param {{ contentWindow?: any }[]} frames
 * @param {(fieldId: string) => void} focus
 * @returns {boolean} true quando o campo foi focado
 */
export function handleFieldClick(event, frames, focus) {
  const data = event?.data;
  if (!data || data.type !== "HARNESS_PROTO_FIELD_CLICK" || typeof data.fieldId !== "string" || !data.fieldId) return false;
  if (!event.source || !frames.some((frame) => frame.contentWindow === event.source)) return false;
  focus(data.fieldId);
  return true;
}

let bound = false;

/** Liga uma unica vez o ouvinte de cliques em pinos; o campo vai para setFocusedField. */
export function bindFieldClicks() {
  if (bound || typeof window === "undefined") return;
  bound = true;
  window.addEventListener("message", (event) => {
    const frames = [...document.querySelectorAll(".replica-proto-frame")];
    // @ts-ignore setFocusedField e registrado pelo workspace de camadas
    handleFieldClick(event, frames, (fieldId) => window.setFocusedField?.(fieldId));
  });
}
