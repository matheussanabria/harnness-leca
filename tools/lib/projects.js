// Descobre a qual projeto do harness pertence uma pasta de trabalho (caminho, ou nome de pasta do Claude Code).
// Só considera projetos que já existem em projects/. Apelidos opcionais em projects/.sources.json:
//   { "saude-prontuario": ["prontuario"], "dai": ["agentes-dai"] }
// Um apelido casa quando aparece como segmento(s) inteiros do caminho (ex.: "git/prontuario").
const fs = require("fs");
const path = require("path");

const PROJECTS = path.join(require("./root").ROOT, "projects");
const SEP = "[\\\\/\\-_ ]"; // separadores equivalentes: / \ - _ espaço (o Claude Code troca / por - nos nomes de pasta)
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function existingSlugs() {
  return fs.readdirSync(PROJECTS, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== "_template" && /^[a-z0-9][a-z0-9_-]{0,59}$/.test(d.name))
    .map((d) => d.name);
}

function loadAliases() {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(PROJECTS, ".sources.json"), "utf8").replace(/^﻿/, ""));
    return raw && typeof raw === "object" ? raw : {};
  } catch { return {}; }
}

function matchers() {
  const aliases = loadAliases(), out = [];
  for (const slug of existingSlugs()) {
    const frags = [slug, ...(Array.isArray(aliases[slug]) ? aliases[slug].filter((x) => typeof x === "string") : [])];
    for (const f of frags) {
      const parts = f.toLowerCase().split(/[\\/\-_ ]+/).filter(Boolean).map(esc);
      if (parts.length) out.push({ slug, size: f.length, re: new RegExp(`(^|${SEP})${parts.join(SEP)}(?=$|${SEP})`) });
    }
  }
  return out;
}

// Retorna o slug do projeto, ou null. Em caso de várias correspondências, vence o fragmento mais longo.
function projectFromPath(p, ms = matchers()) {
  const s = String(p || "").toLowerCase();
  let best = null;
  for (const m of ms) if (m.re.test(s) && (!best || m.size > best.size)) best = m;
  return best ? best.slug : null;
}

module.exports = { existingSlugs, matchers, projectFromPath };
