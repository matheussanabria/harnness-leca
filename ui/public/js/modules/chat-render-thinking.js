// @ts-check
// Bloco "Raciocínio interno" do chat. O histórico é redesenhado inteiro (innerHTML) a cada trecho que chega do modelo,
// o que recriava o bloco: a rolagem voltava ao topo, o aberto/fechado era recalculado e a seleção de texto sumia.
// Aqui o estado que importa (rolagem, escolha do usuário, expansão) sobrevive ao redesenho.
import { esc } from "../shared/dom.js";

/** Escolha explícita do usuário (chave -> aberto). Só muda por clique dele, nunca pelo redesenho. */
const userOpen = new Map();
/** Chaves com o bloco em altura total. */
const expanded = new Set();
/** Folga em px para considerar que o leitor está "no fim" e deve acompanhar o texto novo. */
const FOLLOW_PX = 24;

const fmt = (/** @type {number} */ n) => n.toLocaleString("pt-BR");

/**
 * @param {string} key  identifica o bloco entre redesenhos (chat + turno [+ motor])
 * @param {string} text
 * @param {{ streaming?: boolean, phase?: string, hasAnswer?: boolean }} [o]
 */
export function thinkingHtml(key, text, { streaming = false, phase = "", hasAnswer = false } = {}) {
  if (!text) return "";
  // Padrão: aberto enquanto o modelo só pensa; a escolha do usuário, se houver, manda.
  const open = userOpen.has(key) ? userOpen.get(key) : streaming && !hasAnswer;
  const live = streaming && phase === "thinking" ? '<span class="thinking-stream-badge">gerando pensamento...</span>' : "";
  const big = expanded.has(key);
  return `<details class="chat-thinking" data-think-key="${esc(key)}"${streaming ? ' data-think-live="1"' : ""}${open ? " open" : ""}>`
    + `<summary><span style="display:flex;align-items:center;gap:6px"><i class="fa-solid fa-brain"></i> Raciocínio interno ${live}</span></summary>`
    + `<div class="think-tools"><span class="think-count">${fmt(text.length)} caracteres</span>`
    + `<button type="button" class="think-btn" data-think-act="expand" title="${big ? "Recolher" : "Expandir"}"><i class="fa-solid ${big ? "fa-compress" : "fa-expand"}"></i></button>`
    + `<button type="button" class="think-btn" data-think-act="copy" title="Copiar raciocínio"><i class="fa-regular fa-copy"></i></button></div>`
    + `<div class="think-content${big ? " expanded" : ""}">${esc(text)}</div></details>`;
}

const keyOf = (/** @type {any} */ el) => el.closest?.("[data-think-key]")?.dataset?.thinkKey;

/** Fotografa a rolagem de cada bloco antes do redesenho. @param {any} box */
export function captureThinkState(box) {
  /** @type {Map<string, { top: number, follow: boolean }>} */
  const snap = new Map();
  for (const el of box.querySelectorAll?.(".think-content") || []) {
    const key = keyOf(el);
    if (key) snap.set(key, { top: el.scrollTop, follow: el.scrollHeight - el.scrollTop - el.clientHeight <= FOLLOW_PX });
  }
  return snap;
}

/**
 * Devolve a rolagem depois do redesenho: quem estava no fim continua acompanhando o texto novo; quem rolou para cima
 * fica exatamente onde estava. Bloco novo em geração começa no fim; bloco já concluído começa no topo.
 * @param {any} box
 * @param {Map<string, { top: number, follow: boolean }>} snap
 */
export function restoreThinkState(box, snap) {
  for (const el of box.querySelectorAll?.(".think-content") || []) {
    const key = keyOf(el);
    const s = key ? snap.get(key) : undefined;
    const live = el.closest?.("[data-think-live]");
    if (!s) { el.scrollTop = live ? el.scrollHeight : 0; continue; }
    el.scrollTop = s.follow ? el.scrollHeight : s.top;
  }
}

let installed = false;

/** Cliques delegados (os blocos são recriados, então nada é ligado direto neles). @param {any} [root] */
export function installThinkHandlers(root = globalThis.document) {
  if (installed || !root?.addEventListener) return;
  installed = true;
  root.addEventListener("click", (/** @type {any} */ e) => {
    const summary = e.target?.closest?.(".chat-thinking summary");
    if (summary) {
      // Em captura o <details> ainda não alternou: o estado que o usuário está pedindo é o contrário do atual.
      const d = summary.parentElement;
      if (d?.dataset?.thinkKey) userOpen.set(d.dataset.thinkKey, !d.open);
      return;
    }
    const btn = e.target?.closest?.("[data-think-act]");
    const d = btn?.closest?.(".chat-thinking");
    const key = d?.dataset?.thinkKey;
    if (!btn || !key) return;
    const content = d.querySelector(".think-content");
    if (btn.dataset.thinkAct === "expand") {
      const big = !expanded.has(key);
      if (big) expanded.add(key); else expanded.delete(key);
      content?.classList.toggle("expanded", big);
      btn.title = big ? "Recolher" : "Expandir";
      btn.querySelector("i")?.setAttribute("class", `fa-solid ${big ? "fa-compress" : "fa-expand"}`);
    } else if (btn.dataset.thinkAct === "copy") {
      globalThis.navigator?.clipboard?.writeText(content?.textContent || "").catch(() => {});
    }
  }, true);
}

/** Só para testes: zera o estado guardado. */
export function resetThinkState() {
  userOpen.clear();
  expanded.clear();
  installed = false;
}
