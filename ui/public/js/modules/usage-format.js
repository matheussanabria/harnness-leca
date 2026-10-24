// @ts-check
// Aba Consumo: formatadores puros. Regra central (ADR-TEL-006): null/ausente nunca vira 0, vira "n/d".

export const NA = "n/d";

/** @param {unknown} v @returns {v is number} */
export function isNum(v) {
  return typeof v === "number" && Number.isFinite(v);
}

/** @param {unknown} value @returns {string} */
export function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** @param {number} n @param {number} digits */
function dec(n, digits) {
  return n.toFixed(digits).replace(".", ",");
}

/**
 * Formato compacto (K/M/B). Abaixo de mil mostra o inteiro.
 * @param {unknown} value
 * @returns {string}
 */
export function formatCompact(value) {
  if (!isNum(value)) return NA;
  const abs = Math.abs(value);
  if (abs < 1000) return String(Math.round(value));
  const units = [["B", 1e9], ["M", 1e6], ["K", 1e3]];
  for (const [suffix, size] of /** @type {[string, number][]} */ (units)) {
    if (abs >= size) {
      const scaled = value / size;
      return `${dec(scaled, Math.abs(scaled) >= 100 ? 0 : 1)} ${suffix}`;
    }
  }
  return String(value);
}

/**
 * Valor exato para o atributo title.
 * @param {unknown} value
 * @returns {string}
 */
export function formatExact(value) {
  if (!isNum(value)) return NA;
  return Number.isInteger(value) ? value.toLocaleString("pt-BR") : dec(value, 6).replace(/0+$/, "").replace(/,$/, "");
}

/**
 * Custo estimado em dólar. null (ou amount null) vira "n/d".
 * @param {{ amount?: unknown } | null | undefined} cost
 * @returns {string}
 */
export function formatCost(cost) {
  const amount = cost ? cost.amount : null;
  if (!isNum(amount)) return NA;
  return `US$ ${dec(amount, Math.abs(amount) < 1 ? 4 : 2)}`;
}

/** @param {{ amount?: unknown } | null | undefined} cost */
export function costTitle(cost) {
  const amount = cost ? cost.amount : null;
  return isNum(amount) ? `US$ ${formatExact(amount)} (estimado, equivalente em API)` : "Custo indisponível";
}

/**
 * Parcela percentual de `part` sobre `total`; null quando indeterminável.
 * @param {unknown} part
 * @param {unknown} total
 * @returns {number | null}
 */
export function sharePercent(part, total) {
  if (!isNum(part) || !isNum(total) || total <= 0) return null;
  return Math.round((part / total) * 1000) / 10;
}

/** @param {number | null} pct */
export function formatPercent(pct) {
  return isNum(pct) ? `${dec(pct, 1)}%` : NA;
}

/**
 * Soma apenas os valores conhecidos; null quando nenhum é conhecido.
 * @param {unknown[]} values
 * @returns {number | null}
 */
export function sumKnown(values) {
  let total = null;
  for (const v of values) if (isNum(v)) total = (total ?? 0) + v;
  return total;
}

/** @param {unknown} iso */
export function formatDateTime(iso) {
  const d = new Date(String(iso || ""));
  if (!iso || Number.isNaN(d.getTime())) return NA;
  const p = (/** @type {number} */ n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
