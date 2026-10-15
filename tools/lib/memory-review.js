// @ts-check
// Revisão das sugestões de memória: lê projects/<slug>/context/extraido-memorias.md (gerado pela extração), mostra só o
// que ainda não foi revisado nem está na memory.md, e aplica as decisões do usuário:
//   promover (opcionalmente com o texto editado) -> acrescenta "- [AAAA-MM-DD] ..." em projects/<slug>/memory.md
//   descartar                                     -> só registra, para a sugestão não voltar quando a conversa for reanalisada
// O estado da revisão fica em projects/<slug>/memory-review.json. Nada é promovido sem uma ação explícita.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const state = require("./state");
const { redact } = require("./redact");

// Registros que a consolidação grava em memory-review.json (as decisões do usuário são "promovida" e "descartada").
const CONSOLIDATION_ACTIONS = new Set(["consolidada", "fora-da-consolidacao"]);
const MAX_TEXT = 600;
const MAX_ACTIONS = 200;

// Erro de entrada inválida: a mensagem é nossa e pode ir ao navegador. Qualquer outro erro (disco, etc.) não.
class ReviewError extends Error {}

/** @typedef {"memoria" | "regra" | "decisao" | "termo"} Categoria */
/** @typedef {{ id: string, categoria: Categoria, texto: string, conversas: { titulo: string, data: string, sessao: string }[] }} Suggestion */

const CATEGORY_HEADINGS = /** @type {[RegExp, Categoria][]} */ ([
  [/^mem[óo]rias$/i, "memoria"],
  [/^regras(?: e prefer[êe]ncias)?$/i, "regra"],
  [/^decis[õo]es$/i, "decisao"],
  [/^termos(?: do dom[íi]nio)?$/i, "termo"],
]);

// Como cada categoria aparece na memory.md (a memória "pura" não leva prefixo).
const PREFIX = /** @type {Record<Categoria, string>} */ ({ memoria: "", regra: "Regra: ", decisao: "Decisão: ", termo: "Termo: " });

/** @param {string} s */
const normalize = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[`*_"'“”]/g, "").replace(/\s+/g, " ").replace(/[.;:,\s]+$/, "").trim();

/** @param {Categoria} categoria @param {string} texto */
const idOf = (categoria, texto) => crypto.createHash("sha1").update(`${categoria}|${normalize(texto)}`).digest("hex").slice(0, 12);

// Texto de uma sugestão como vai para a memória: uma linha, sem marcadores, sem segredos nem dados pessoais.
/** @param {string} texto */
function cleanText(texto) {
  const one = String(texto ?? "").replace(/\s+/g, " ").replace(/^[-*]\s+/, "").replace(/^\[\d{4}-\d{2}-\d{2}\]\s*/, "").trim();
  return redact(one).slice(0, MAX_TEXT).trim();
}

/**
 * Sugestões do extraido-memorias.md, sem repetição (a mesma sugestão em várias conversas aparece uma vez, com todas as origens).
 * @param {string} md
 * @returns {Suggestion[]}
 */
function parseSuggestions(md) {
  /** @type {Map<string, Suggestion>} */
  const found = new Map();
  let sessao = "", titulo = "", data = "", categoria = /** @type {Categoria | null} */ (null);
  /** @type {{ categoria: Categoria, texto: string } | null} */
  let last = null;

  const flush = () => {
    if (!last) return;
    const texto = cleanText(last.texto);
    last = null;
    if (!texto) return;
    const id = idOf(/** @type {Categoria} */ (categoria), texto);
    const origem = { titulo, data, sessao };
    const existing = found.get(id);
    if (existing) { if (!existing.conversas.some((c) => c.sessao === sessao && c.titulo === titulo)) existing.conversas.push(origem); }
    else found.set(id, { id, categoria: /** @type {Categoria} */ (categoria), texto, conversas: [origem] });
  };

  for (const line of String(md).split(/\r?\n/)) {
    const marker = line.match(/^<!-- sessao: (\S+)(?: \| (\S+))? -->/);
    if (marker) { flush(); sessao = marker[1]; data = marker[2] || ""; categoria = null; continue; }
    const heading = line.match(/^## (.+?)\s*$/);
    if (heading) {
      flush();
      const cat = CATEGORY_HEADINGS.find(([re]) => re.test(heading[1]));
      if (cat) { categoria = cat[1]; continue; }
      const t = heading[1].match(/^(.*?)\s*\((\d{4}-\d{2}-\d{2}|s\/d)\)$/); // "## Título (data)": nova conversa
      titulo = t ? t[1] : heading[1];
      if (t && t[2] !== "s/d") data = t[2];
      categoria = null;
      continue;
    }
    if (!categoria) continue;
    const bullet = line.match(/^- (.*)$/);
    if (bullet) { flush(); last = { categoria, texto: bullet[1] }; }
    else if (last && line.trim()) last.texto += " " + line.trim(); // continuação da linha anterior
    else if (!line.trim()) flush();
  }
  flush();
  return [...found.values()];
}

// ---------- estado da revisão e memory.md ----------

/** @param {string} slug */
function files(slug) {
  const p = state.paths(slug);
  return {
    suggestions: path.join(p.proj, "context", "extraido-memorias.md"),
    consolidated: path.join(p.proj, "context", "memorias-consolidadas.md"), // gerado por tools/lib/consolidate.js
    memory: path.join(p.proj, "memory.md"),
    review: path.join(p.proj, "memory-review.json"),
  };
}

/** @param {string} file */
const read = (file) => { try { return fs.readFileSync(file, "utf8").replace(/^﻿/, ""); } catch { return ""; } };

/** @param {string} slug @returns {{ version: number, itens: Record<string, { acao: string, em: string, categoria: string, texto: string }> }} */
function loadReview(slug) {
  try {
    const j = JSON.parse(read(files(slug).review));
    if (j && typeof j === "object" && j.itens && typeof j.itens === "object" && !Array.isArray(j.itens)) return { version: 1, itens: j.itens };
  } catch { /* sem revisão ainda */ }
  return { version: 1, itens: {} };
}

// Linhas da memory.md sem o marcador "- [data] " e normalizadas, para saber se uma sugestão já está lá.
/** @param {string} memory */
const memoryLines = (memory) => memory.split(/\r?\n/).filter((l) => /^- /.test(l)).map((l) => normalize(l.replace(/^- (\[\d{4}-\d{2}-\d{2}\]\s*)?/, "")));

/** @param {string[]} lines @param {string} texto @param {Categoria} categoria */
function alreadyInMemory(lines, texto, categoria) {
  const candidates = [normalize(texto), normalize(PREFIX[categoria] + texto)];
  return lines.some((l) => candidates.some((c) => c && (l === c || (c.length >= 25 && l.includes(c)))));
}

/** @param {string} slug @param {ReturnType<typeof loadReview>} review */
function saveReview(slug, review) {
  fs.writeFileSync(files(slug).review, JSON.stringify(review, null, 2) + "\n");
}

/**
 * O que ainda precisa de revisão: sugestões que não foram promovidas, descartadas nem consolidadas e que não estão na
 * memory.md. Inclui as consolidadas (memorias-consolidadas.md), a menos que `somenteOriginais`.
 * @param {string} slug
 * @param {{ somenteOriginais?: boolean }} [opts]
 * @returns {Suggestion[]}
 */
function pending(slug, { somenteOriginais = false } = {}) {
  const f = files(slug);
  const reviewed = loadReview(slug).itens;
  const lines = memoryLines(read(f.memory));
  // Qualquer registro esconde a sugestão ORIGINAL (inclusive "consolidada": ela já está representada na consolidada).
  // Já a sugestão CONSOLIDADA só é escondida por uma decisão do usuário (promovida ou descartada), nunca pelo registro de
  // consolidação: uma consolidada com o mesmo texto de um original tem o mesmo id e precisa continuar visível.
  const byUser = (/** @type {string} */ id) => reviewed[id] && !CONSOLIDATION_ACTIONS.has(reviewed[id].acao);
  /** @type {Map<string, Suggestion>} */
  const all = new Map(parseSuggestions(read(f.suggestions)).filter((s) => !reviewed[s.id]).map((s) => [s.id, s]));
  if (!somenteOriginais) {
    for (const s of parseSuggestions(read(f.consolidated)).filter((x) => !byUser(x.id))) {
      const seen = all.get(s.id);
      if (seen) seen.conversas.push(...s.conversas); else all.set(s.id, s);
    }
  }
  return [...all.values()].filter((s) => !alreadyInMemory(lines, s.texto, s.categoria));
}

/**
 * Aplica as decisões. Só ids que estão pendentes agora valem (nada de gravar texto arbitrário por aqui).
 * @param {string} slug
 * @param {{ id: string, acao: "promover" | "descartar", texto?: string }[]} acoes
 * @param {Date} [now]
 */
function apply(slug, acoes, now = new Date()) {
  if (!Array.isArray(acoes) || acoes.length > MAX_ACTIONS) throw new ReviewError(`informe uma lista com até ${MAX_ACTIONS} ações`);
  const f = files(slug);
  const byId = new Map(pending(slug).map((s) => [s.id, s]));
  const review = loadReview(slug);
  const today = now.toISOString().slice(0, 10);
  const result = { promovidas: 0, descartadas: 0, ignoradas: /** @type {string[]} */ ([]) };
  /** @type {string[]} */
  const toAppend = [];

  for (const a of acoes) {
    const s = a && typeof a.id === "string" ? byId.get(a.id) : undefined;
    if (!s || (a.acao !== "promover" && a.acao !== "descartar")) { result.ignoradas.push(String(a && a.id)); continue; }
    byId.delete(s.id); // a mesma sugestão não vale duas vezes na mesma chamada
    if (a.acao === "promover") {
      const texto = cleanText(typeof a.texto === "string" && a.texto.trim() ? a.texto : s.texto);
      if (!texto) { result.ignoradas.push(s.id); continue; }
      toAppend.push(`- [${today}] ${PREFIX[s.categoria]}${texto}`);
      review.itens[s.id] = { acao: "promovida", em: now.toISOString(), categoria: s.categoria, texto };
      result.promovidas++;
    } else {
      review.itens[s.id] = { acao: "descartada", em: now.toISOString(), categoria: s.categoria, texto: s.texto };
      result.descartadas++;
    }
  }

  if (toAppend.length) {
    const memory = read(f.memory);
    const base = memory.trim() ? memory.replace(/\s*$/, "\n") : "# Memória do projeto\n<!-- Equivale ao campo \"Memória\". Atualizada pelo Claude durante as conversas. Formato: - [AAAA-MM-DD] fato -->\n\n";
    fs.writeFileSync(f.memory, base + toAppend.join("\n") + "\n");
  }
  if (result.promovidas || result.descartadas) saveReview(slug, review);
  return result;
}

module.exports = { parseSuggestions, pending, apply, cleanText, idOf, files, loadReview, saveReview, ReviewError, CONSOLIDATION_ACTIONS, MAX_ACTIONS };
