// @ts-check
// Revisão das sugestões de memória (EP-13.06):
// Lê projects/<slug>/context/extraido-memorias.md, mostra o que ainda não foi revisado nem está na memória,
// e aplica as decisões:
//   - Projeto migrado (possui memory/): promover grava item atômico com store.saveItem e atualiza índice.
//   - Projeto legado (sem memory/): acrescenta "- [AAAA-MM-DD] ..." em memory.md.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const state = require("./state");
const { ROOT } = require("./root");
const { redact } = require("./redact");
const { resolveMemoryDir, listItems, saveItem } = require("./memory/store");
const { hashOf, slugify } = require("./memory/item");
const { isSimilar } = require("./memory/dedupe");
const { inferType } = require("./memory/migrate");
const { render: renderIndex } = require("./memory/index");

const CONSOLIDATION_ACTIONS = new Set(["consolidada", "fora-da-consolidacao"]);
const MAX_TEXT = 600;
const MAX_ACTIONS = 200;

class ReviewError extends Error {}

/** @typedef {"memoria" | "regra" | "decisao" | "termo"} Categoria */
/** @typedef {{ id: string, categoria: Categoria, texto: string, conversas: { titulo: string, data: string, sessao: string }[] }} Suggestion */

const CATEGORY_HEADINGS = /** @type {[RegExp, Categoria][]} */ ([
  [/^mem[óo]rias$/i, "memoria"],
  [/^regras(?: e prefer[êe]ncias)?$/i, "regra"],
  [/^decis[õo]es$/i, "decisao"],
  [/^termos(?: do dom[íi]nio)?$/i, "termo"],
]);

const PREFIX = /** @type {Record<Categoria, string>} */ ({ memoria: "", regra: "Regra: ", decisao: "Decisão: ", termo: "Termo: " });

const normalize = (s) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[`*_"'“”]/g, "").replace(/\s+/g, " ").replace(/[.;:,\s]+$/, "").trim();

const idOf = (categoria, texto) => crypto.createHash("sha1").update(`${categoria}|${normalize(texto)}`).digest("hex").slice(0, 12);

function cleanText(texto) {
  const one = String(texto ?? "")
    .replace(/\s+/g, " ")
    .replace(/^[-*]\s+/, "")
    .replace(/^<!--\s*harvest:[^>]+-->\s*/, "")
    .replace(/^\[\d{4}-\d{2}-\d{2}\]\s*/, "")
    .trim();
  return redact(one).slice(0, MAX_TEXT).trim();
}

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
    const heading = line.match(/^#{2,3} (.+?)\s*$/);
    if (heading) {
      flush();
      const cat = CATEGORY_HEADINGS.find(([re]) => re.test(heading[1]));
      if (cat) { categoria = cat[1]; continue; }
      const t = heading[1].match(/^(.*?)\s*\((\d{4}-\d{2}-\d{2}|s\/d)\)$/);
      titulo = t ? t[1] : heading[1];
      if (t && t[2] !== "s/d") data = t[2];
      categoria = null;
      continue;
    }
    if (!categoria) continue;
    const bullet = line.match(/^- (.*)$/);
    if (bullet) { flush(); last = { categoria, texto: bullet[1] }; }
    else if (last && line.trim()) last.texto += " " + line.trim();
    else if (!line.trim()) flush();
  }
  flush();
  return [...found.values()];
}

function files(slug) {
  const p = state.paths(slug);
  return {
    suggestions: path.join(p.proj, "context", "extraido-memorias.md"),
    consolidated: path.join(p.proj, "context", "memorias-consolidadas.md"),
    harvested: path.join(p.proj, "context", "colhido-nativo.md"),
    memory: path.join(p.proj, "memory.md"),
    review: path.join(p.proj, "memory-review.json"),
    memoryDir: path.join(p.proj, "memory"),
  };
}

const read = (file) => { try { return fs.readFileSync(file, "utf8").replace(/^﻿/, ""); } catch { return ""; } };

function isProjectMigrated(slug) {
  const memDir = resolveMemoryDir(ROOT, slug);
  return fs.existsSync(memDir) && fs.statSync(memDir).isDirectory();
}

function loadReview(slug) {
  try {
    const j = JSON.parse(read(files(slug).review));
    if (j && typeof j === "object" && j.itens && typeof j.itens === "object" && !Array.isArray(j.itens)) return { version: 1, itens: j.itens };
  } catch { /* sem revisão */ }
  return { version: 1, itens: {} };
}

function saveReview(slug, review) {
  fs.writeFileSync(files(slug).review, JSON.stringify(review, null, 2) + "\n");
}

const memoryLines = (memory) => memory.split(/\r?\n/).filter((l) => /^- /.test(l)).map((l) => normalize(l.replace(/^- (\[\d{4}-\d{2}-\d{2}\]\s*)?/, "")));

function alreadyInMemoryLegacy(lines, texto, categoria) {
  const candidates = [normalize(texto), normalize(PREFIX[categoria] + texto)];
  return lines.some((l) => candidates.some((c) => c && (l === c || (c.length >= 25 && l.includes(c)))));
}

function alreadyInMemoryCurated(validItems, texto) {
  const norm = normalize(texto);
  const targetHash = hashOf(norm, "");
  return validItems.some((v) => {
    if (v.item.meta.hash === targetHash) return true;
    if (isSimilar(v.item.meta.description, texto, 0.8)) return true;
    return false;
  });
}

function pending(slug, { somenteOriginais = false } = {}) {
  const f = files(slug);
  const reviewed = loadReview(slug).itens;
  const migrated = isProjectMigrated(slug);
  const byUser = (/** @type {string} */ id) => reviewed[id] && !CONSOLIDATION_ACTIONS.has(reviewed[id].acao);
  /** @type {Map<string, Suggestion>} */
  const all = new Map(parseSuggestions(read(f.suggestions)).filter((s) => !reviewed[s.id]).map((s) => [s.id, s]));
  if (!somenteOriginais) {
    for (const s of parseSuggestions(read(f.consolidated)).filter((x) => !byUser(x.id))) {
      const seen = all.get(s.id);
      if (seen) seen.conversas.push(...s.conversas); else all.set(s.id, s);
    }
    // Inclui candidatos colhidos nativamente dos motores locais (EP-13.08)
    for (const s of parseSuggestions(read(f.harvested)).filter((x) => !byUser(x.id))) {
      const seen = all.get(s.id);
      if (seen) seen.conversas.push(...s.conversas); else all.set(s.id, s);
    }
  }

  if (migrated) {
    const memDir = resolveMemoryDir(ROOT, slug);
    const { valid } = listItems(memDir);
    return [...all.values()].filter((s) => !alreadyInMemoryCurated(valid, s.texto));
  }

  const lines = memoryLines(read(f.memory));
  return [...all.values()].filter((s) => !alreadyInMemoryLegacy(lines, s.texto, s.categoria));
}

function apply(slug, acoes, now = new Date()) {
  if (!Array.isArray(acoes) || acoes.length > MAX_ACTIONS) throw new ReviewError(`informe uma lista com até ${MAX_ACTIONS} ações`);
  const f = files(slug);
  const byId = new Map(pending(slug).map((s) => [s.id, s]));
  const review = loadReview(slug);
  const today = now.toISOString().slice(0, 10);
  const result = { promovidas: 0, descartadas: 0, ignoradas: /** @type {string[]} */ ([]) };
  const migrated = isProjectMigrated(slug);
  /** @type {string[]} */
  const toAppendLegacy = [];
  const memDir = resolveMemoryDir(ROOT, slug);

  for (const a of acoes) {
    const s = a && typeof a.id === "string" ? byId.get(a.id) : undefined;
    if (!s || (a.acao !== "promover" && a.acao !== "descartar")) { result.ignoradas.push(String(a && a.id)); continue; }
    byId.delete(s.id);
    if (a.acao === "promover") {
      const rawText = typeof a.texto === "string" && a.texto.trim() ? a.texto : s.texto;
      const texto = cleanText(rawText);
      if (!texto) { result.ignoradas.push(s.id); continue; }

      if (migrated) {
        const itemType = a.type || inferType(texto);
        const itemName = a.name || slugify(texto.slice(0, 50)) || "memoria-fato";
        const itemDesc = (a.description || texto).slice(0, 140);
        let itemBody = typeof a.body === "string" ? a.body : "";
        if (!itemBody && (itemType === "feedback" || itemType === "project")) {
          const why = a.why ? a.why.trim() : "Extraído e promovido da revisão de conversas.";
          const how = a.how ? a.how.trim() : "Aplicar conforme contexto do projeto.";
          itemBody = `**Why:**\n${why}\n\n**How to apply:**\n${how}\n`;
        }
        const saveRes = saveItem(memDir, {
          name: itemName,
          description: itemDesc,
          type: itemType,
          body: itemBody,
          source: `review:${s.id}`,
        }, { today, update: a.update, forceNew: Boolean(a.forceNew) });

        if (saveRes.status === "recusado") {
          result.ignoradas.push(s.id);
          continue;
        }
      } else {
        toAppendLegacy.push(`- [${today}] ${PREFIX[s.categoria]}${texto}`);
      }

      review.itens[s.id] = { acao: "promovida", em: now.toISOString(), categoria: s.categoria, texto };
      result.promovidas++;
    } else {
      review.itens[s.id] = { acao: "descartada", em: now.toISOString(), categoria: s.categoria, texto: s.texto };
      result.descartadas++;
    }
  }

  if (migrated && result.promovidas > 0) {
    const { valid } = listItems(memDir);
    const scopeTitle = slug === "global" ? "Memória global" : `Memória do projeto ${slug}`;
    const rendered = renderIndex(valid, { scopeTitle, today });
    fs.writeFileSync(f.memory, rendered.content, "utf8");
  } else if (!migrated && toAppendLegacy.length) {
    const memory = read(f.memory);
    const base = memory.trim() ? memory.replace(/\s*$/, "\n") : "# Memória do projeto\n<!-- Equivale ao campo \"Memória\". Atualizada pelo Claude durante as conversas. Formato: - [AAAA-MM-DD] fato -->\n\n";
    fs.writeFileSync(f.memory, base + toAppendLegacy.join("\n") + "\n");
  }

  if (result.promovidas || result.descartadas) saveReview(slug, review);
  return result;
}

module.exports = {
  parseSuggestions,
  pending,
  apply,
  cleanText,
  idOf,
  files,
  loadReview,
  saveReview,
  isProjectMigrated,
  ReviewError,
  CONSOLIDATION_ACTIONS,
  MAX_ACTIONS,
};
