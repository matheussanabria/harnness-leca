// @ts-check
import { numOf, toCss } from "./prototype-props-model.js";

/** Regras puras da seção Tipografia: converte o que o usuário digita em declarações CSS. */

export const WEIGHTS = [["100", "Thin"], ["200", "Extra Light"], ["300", "Light"], ["400", "Regular"], ["500", "Medium"], ["600", "Semi Bold"], ["700", "Bold"], ["800", "Extra Bold"], ["900", "Black"]];

/** Opção do select que mantém a fonte atual (não grava nada). */
export const KEEP_FONT = "__current";

const GENERIC_FONTS = [["system-ui, sans-serif", "Sistema (sans)"], ["Georgia, serif", "Serifada"], ["ui-monospace, monospace", "Monoespaçada"]];

/** Primeira família da lista, sem aspas. */
export function firstFamily(css) {
  return String(css ?? "").split(",")[0].replace(/["']/g, "").trim();
}

/** Peso calculado (400, "bold"...) para o múltiplo de 100 mais próximo. */
export function weightValue(css) {
  const named = { normal: "400", bold: "700" }[String(css ?? "").trim()];
  if (named) return named;
  const n = Number(css);
  return Number.isFinite(n) && n > 0 ? String(Math.min(900, Math.max(100, Math.round(n / 100) * 100))) : "400";
}

/** Opções do seletor de fonte: atual, tokens do DS e famílias genéricas. */
export function fontOptions(computed, tokens = []) {
  const current = firstFamily(computed);
  return [[KEEP_FONT, current || "Atual"], ...tokens.map((t) => [`var(${t.name})`, `${t.name.replace(/^--/, "")} (${firstFamily(t.value)})`]), ...GENERIC_FONTS];
}

export function fontFamilyPatch(value) {
  return value === KEEP_FONT ? null : { "font-family": value };
}

/** Altura de linha mostrada como razão (1.5) quando o navegador devolve pixels. */
export function lineHeightOf(computed, fontSize) {
  const px = Number(numOf(computed));
  const size = Number(numOf(fontSize));
  if (!px || !size) return "";
  return String(Math.round((px / size) * 100) / 100);
}

/** Número até 5 vira razão sem unidade; acima disso, pixels; vazio remove. */
export function lineHeightPatch(value) {
  const v = String(value ?? "").trim();
  if (v === "") return { "line-height": "" };
  if (/^\d+(\.\d+)?$/.test(v)) return { "line-height": Number(v) <= 5 ? v : `${v}px` };
  return { "line-height": v };
}

export function letterSpacingPatch(value) {
  const v = String(value ?? "").trim();
  if (v === "" || Number(v) === 0) return { "letter-spacing": "" };
  return { "letter-spacing": toCss(v) };
}

/** `start`/`end` calculados viram esquerda/direita para marcar o botão ativo. */
export function alignOf(css) {
  const v = String(css ?? "").trim();
  return v === "start" || v === "" ? "left" : v === "end" ? "right" : v;
}
