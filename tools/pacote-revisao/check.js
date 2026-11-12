// @ts-check
// `check`: o pacote e os ajustes manuais continuam verdadeiros? Cada achado diz o que fazer.
// Niveis: erro (pacote enganoso), aviso (provavelmente velho), info.
const path = require("path");
const { execFileSync } = require("child_process");
const { ROOT } = require("./config");
const { fingerprint, readManifest } = require("./manifest");

/** Escapa texto para dentro de uma expressao regular. */
function reEsc(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Uma alternativa de seletor (sem virgula): atributos, #id e .classe existem no HTML? Pseudo-classes sao ignoradas. */
function alternativeMatches(alt, html) {
  for (const m of alt.matchAll(/\[([\w-]+)(?:=["']?([^"'\]]*)["']?)?\]/g)) {
    const has = m[2] === undefined
      ? new RegExp(reEsc(m[1])).test(html)
      : html.includes(`${m[1]}="${m[2]}"`) || html.includes(`${m[1]}='${m[2]}'`);
    if (!has) return false;
  }
  const plain = alt.replace(/\[[^\]]*\]/g, " ").replace(/:has\(([^)]*)\)/g, " $1 ").replace(/:[\w-]+(\([^)]*\))?/g, " ");
  for (const m of plain.matchAll(/([#.])([A-Za-z_][\w-]*)/g)) {
    const re = m[1] === "#"
      ? new RegExp(`id=["']${reEsc(m[2])}["']`)
      : new RegExp(`class=["'](?:[^"']*\\s)?${reEsc(m[2])}(?:\\s[^"']*)?["']`);
    if (!re.test(html)) return false;
  }
  return true;
}

/** O seletor acha algo no HTML? Heuristica por texto (sem DOM): basta uma das alternativas separadas por virgula. */
function selectorMatches(selector, html) {
  const alts = String(selector).split(",").map((s) => s.trim()).filter(Boolean);
  return alts.length === 0 || alts.some((alt) => alternativeMatches(alt, html));
}

/**
 * @param {{ ctx: { slug: string, repo: string, projectDir: string, configFile: string, outDir: string, config: any },
 *           map: any, board: any, comDrift?: boolean }} p
 * @returns {{ level: "erro"|"aviso"|"info", code: string, message: string }[]}
 */
function runCheck({ ctx, map, board, comDrift }) {
  const { config, outDir } = ctx;
  const out = [];
  const add = (level, code, message) => out.push({ level, code, message });

  // 1. Pacote defasado em relacao as fontes.
  const mf = readManifest(outDir);
  if (!mf) {
    add("aviso", "SEM_MANIFESTO", `Sem .pacote-revisao.json em ${outDir}: o pacote nao foi gerado por esta ferramenta. Rode: node tools/pacote-revisao.js build`);
  } else {
    const now = fingerprint({ repo: ctx.repo, projectDir: ctx.projectDir, configFile: ctx.configFile, outDir, historias: config.historias });
    for (const [grupo, hash] of Object.entries(now)) {
      if (mf.fontes && mf.fontes[grupo] !== hash) add("aviso", "PACOTE_DEFASADO", `Mudou desde ${String(mf.geradoEm).slice(0, 10)}: ${grupo}. Regere o pacote.`);
    }
  }

  // 2. Status informado que o snapshot ja alcancou (ajuste velho) ou que ainda vale.
  for (const f of config.statusForcado) {
    const s = board.stories.find((x) => x.key === f.key);
    if (!s) {
      add("aviso", "STATUS_SEM_HISTORIA", `statusForcado de ${f.key}: a historia nao esta na lista do pacote.`);
    } else if (s.statusDoSnapshot === f.status) {
      add("aviso", "STATUS_ABSORVIDO", `${f.key}: o snapshot ja diz "${f.status}"; remova o statusForcado (desde ${f.desde}).`);
    } else {
      add("info", "STATUS_AJUSTADO", `${f.key}: mostrando "${f.status}" (snapshot: "${s.statusDoSnapshot || "sem"}"), ajuste de ${f.desde}.`);
    }
  }

  // 3. Correcoes do mapa que a fonte ja absorveu ou que perderam o alvo.
  for (const a of map.fixes.absorvidas) {
    add("aviso", "CORRECAO_ABSORVIDA", `Correcao de ${a.tela}${a.campo ? "/" + a.campo : ""} (${a.parte}) ja esta na fonte; remova de "correcoes" (desde ${a.desde}).`);
  }
  for (const a of map.fixes.semAlvo) {
    add("erro", "CORRECAO_SEM_ALVO", `Correcao de ${a.tela}${a.campo ? "/" + a.campo : ""} nao encontra a tela ou o campo no mapa.`);
  }

  // 4. Trechos escondidos que nao existem mais no prototipo.
  for (const h of config.esconderNoPrototipo) {
    const html = map.protos[h.tela];
    if (html === undefined) {
      add("erro", "ESCONDER_SEM_TELA", `esconderNoPrototipo: a tela "${h.tela}" nao tem prototipo ligado.`);
      continue;
    }
    const body = html.replace(/^<style>[^<]*<\/style>/, "");
    for (const sel of h.seletores) {
      if (!selectorMatches(sel, body)) add("aviso", "ESCONDER_ORFAO", `"${sel}" nao existe mais no prototipo "${h.tela}"; o ajuste esta velho (desde ${h.desde}).`);
    }
  }

  // 5. Seletores do prototipo (pinos e destaque) que nao acham o elemento: o prototipo mudou e o mapa nao.
  for (const sc of map.screensData.screens) {
    const proto = sc.prototype;
    if (!proto || !proto.selectors) continue;
    const body = (map.protos[proto.screen] || "").replace(/^<style>[^<]*<\/style>/, "");
    for (const [field, sel] of Object.entries(proto.selectors)) {
      if (!selectorMatches(String(sel), body)) add("aviso", "SELETOR_ORFAO", `${sc.id}/${field}: o seletor "${sel}" nao acha nada no prototipo "${proto.screen}".`);
    }
  }

  // 6. Opcional: deriva do mapa contra o codigo (ferramenta existente).
  if (comDrift) {
    try {
      const raw = execFileSync("node", [path.join(ROOT, "tools", "audit-layers-drift.js"), "--repo", ctx.repo, "--json"], {
        encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"],
      });
      for (const r of JSON.parse(raw)) {
        for (const d of r.drifts || []) add("aviso", "DERIVA_CODIGO", `${r.feature}: ${typeof d === "string" ? d : JSON.stringify(d).slice(0, 160)}`);
      }
    } catch {
      add("aviso", "DERIVA_INDISPONIVEL", "Nao foi possivel rodar tools/audit-layers-drift.js.");
    }
  }
  return out;
}

module.exports = { runCheck, selectorMatches };
