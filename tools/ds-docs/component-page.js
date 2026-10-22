// @ts-check
"use strict";
/**
 * Páginas de componente da vitrine do DS (protótipo `dis-ds-vitrine`), geradas a partir do manifest.json e dos
 * arquivos da pasta `design/ds/components/<slug>/`. É o jeito padrão de documentar um componente novo:
 * `tools/add-ds-component.js` usa este módulo.
 *
 * Estrutura canônica da página: Exemplo, Código (HTML, CSS, JavaScript, Angular, React), Quando e como usar,
 * API e navegação anterior/próximo. Todo elemento recebe `data-pid` sequencial (`p-1`, `p-2`...); os blocos de
 * código usam `p-pre-N`.
 */

const esc = (text) => String(text == null ? "" : text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
/** Texto com `código` entre crases vira <code>. */
const inline = (text) => esc(text).replace(/`([^`]+)`/g, "<code>$1</code>");

const VOID = new Set(["img", "input", "br", "hr", "meta", "link", "area", "base", "col", "embed", "source", "track", "wbr"]);

/** Abas do bloco de código, na ordem canônica. `key` aponta para o arquivo do componente. */
const CODE_TABS = [
  { label: "HTML", lang: "html", note: "Marcação final. Precisa de tokens.css e bundle.css." },
  { label: "CSS", lang: "css", note: "Regras do bundle.css usadas por este componente. Dependem das variáveis do tokens.css." },
  { label: "JavaScript", lang: "js", note: "" },
  { label: "Angular", lang: "js", note: "Angular 18, componente standalone." },
  { label: "React", lang: "js", note: "React 18 + TypeScript." },
];

/**
 * Numera todo elemento com `data-pid="p-N"` em ordem de documento. Mantém `p-pre-N` dos blocos de código e não
 * entra em <pre>, <script> e <style>. Remove pids antigos antes (renumeração completa).
 * @param {string} html
 */
function numberPids(html) {
  let n = 0;
  const parts = html.split(/(<pre\b[\s\S]*?<\/pre>|<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>)/gi);
  return parts.map((part, i) => {
    if (i % 2 === 1) return part; // pre/script/style intactos (pre mantém o p-pre-N que já tem)
    return part
      .replace(/\sdata-pid="p-\d+"/g, "")
      .replace(/<([a-zA-Z][\w-]*)((?:\s+[^\s=>/]+(?:=(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>/g, (_, tag, attrs, slash) => {
        n += 1;
        return `<${tag}${attrs} data-pid="p-${n}"${slash}>`;
      });
  }).join("");
}

/** Dá `data-pid` aos elementos que ainda não têm (continua depois do maior pid da página; não mexe nos demais). */
function fillMissingPids(html) {
  let n = maxPid(html);
  const parts = html.split(/(<pre\b[\s\S]*?<\/pre>|<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>)/gi);
  return parts.map((part, i) => (i % 2 === 1 ? part : part.replace(/<([a-zA-Z][\w-]*)((?:\s+[^\s=>/]+(?:=(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>/g, (all, tag, attrs, slash) => {
    if (/\sdata-pid=/.test(attrs)) return all;
    n += 1;
    return `<${tag}${attrs} data-pid="p-${n}"${slash}>`;
  }))).join("");
}

/** Maior número de pid `p-N` no HTML (ignora p-pre-N e demais pids não numéricos). */
function maxPid(html) {
  let max = 0;
  for (const m of html.matchAll(/data-pid="p-(\d+)"/g)) max = Math.max(max, Number(m[1]));
  return max;
}

const navItem = (slug, name, a, b, current) => `<li data-pid="p-${a}"><a href="#"${current ? ' aria-current="page"' : ""} data-action="goto:${slug}" data-pid="p-${b}">${esc(name)}</a></li>`;

/**
 * Garante o item do componente no menu lateral de uma página (idempotente): remove o que existir e insere
 * depois do item `afterSlug`. Os pids novos continuam a numeração da página (não mexe nos demais).
 * @param {string} html
 * @param {{ slug: string, name: string, afterSlug: string }} item
 */
function ensureNavItem(html, item) {
  const li = (slug) => new RegExp(`<li data-pid="p-[^"]+"><a href="#"(?: aria-current="page")? data-action="goto:${slug}" data-pid="p-[^"]+">[^<]*</a></li>`);
  const without = html.replace(li(item.slug), "");
  const anchor = li(item.afterSlug).exec(without);
  if (!anchor) throw new Error(`Item '${item.afterSlug}' não encontrado no menu da vitrine.`);
  const next = maxPid(without) + 1;
  const insert = navItem(item.slug, item.name, next, next + 1, false);
  return without.slice(0, anchor.index + anchor[0].length) + insert + without.slice(anchor.index + anchor[0].length);
}

/**
 * Marca como página atual o item `slug` do menu (e desmarca os outros).
 * @param {string} html
 * @param {string} slug
 */
function markCurrent(html, slug) {
  return html
    .replace(/ aria-current="page"/g, "")
    .replace(new RegExp(`(<a href="#")( data-action="goto:${slug}")`), '$1 aria-current="page"$2');
}

/** Valor "Padrão" da tabela de API: vazio vira "-", resto vira <code> sem as crases do manifest. */
function defaultCell(value) {
  if (value === undefined || value === null || value === "" || (Array.isArray(value) && !value.length)) return "-";
  const text = typeof value === "string" ? value.replace(/^`|`$/g, "") : JSON.stringify(value);
  return `<code>${esc(text)}</code>`;
}

function apiTable(manifest) {
  const props = Object.values(manifest.props || {});
  const events = Object.values(manifest.events || {});
  const rows = props.map((p) => `<tr><td><code>${esc(p.name)}</code></td><td class="t-type"><code>${esc(p.type)}</code></td><td>${defaultCell(p.default)}</td><td>${inline(p.description || "")}</td></tr>`).join("");
  const evRows = events.map((e) => `<tr><td><code>${esc(e.name)}</code></td><td class="t-type"><code>${esc(e.payload || "evento")}</code></td><td>-</td><td>${inline(e.description || "")}</td></tr>`).join("");
  return `<section class="dx-sec"><h2>API</h2><div class="dx-tablewrap"><table class="dx-table"><thead><tr><th>Prop</th><th>Tipo</th><th>Padrão</th><th>Descrição</th></tr></thead><tbody>${rows}${evRows}</tbody></table></div></section>`;
}

/**
 * Bloco "Código" com as cinco abas. `sources` = { html, css, js, angular, react } (texto dos arquivos).
 * @param {Record<string, string>} sources
 * @param {(code: string, lang: string) => string} highlight
 */
function codeBlock(sources, highlight) {
  const keys = ["html", "css", "js", "angular", "react"];
  const present = CODE_TABS.map((tab, i) => ({ ...tab, key: keys[i], i })).filter((t) => (sources[t.key] || "").trim());
  const buttons = present.map((t, n) => `<button type="button" role="tab" class="dx-tab" aria-selected="${n === 0}" tabindex="${n === 0 ? 0 : -1}" data-tab="${t.i}">${t.label}</button>`).join("");
  const panels = present.map((t, n) => {
    const code = highlight(sources[t.key].replace(/\s+$/, ""), t.lang);
    const note = t.note ? `<div class="dx-note">${esc(t.note)}</div>` : "";
    return `<div class="dx-panel" data-panel="${t.i}"${n === 0 ? "" : " hidden"}>${note}<pre data-pid="p-pre-${t.i}" class="dx-pre" tabindex="0"><code>${code}</code></pre></div>`;
  }).join("");
  return `<section class="dx-sec"><h2>Código</h2><div class="dx-code"><div class="dx-tabs" role="tablist">${buttons}<span class="dx-tabs__sp"></span><button type="button" class="dx-copy">Copiar</button></div>${panels}</div></section>`;
}

/** Demo estático do palco: o HTML do componente sem comentários nem linhas em branco duplicadas. */
function demoHtml(html) {
  return html.replace(/<!--[\s\S]*?-->\s*/g, "").trim();
}

/**
 * Conteúdo de <main> da página do componente (sem pids; numberPids é aplicado depois na página inteira).
 * @param {any} manifest
 * @param {Record<string, string>} sources
 * @param {{ group: string, demoName: string, highlight: (code: string, lang: string) => string, prev?: { slug: string, title: string }, next?: { slug: string, title: string } }} ctx
 */
function buildMain(manifest, sources, ctx) {
  const usage = (manifest.usage || []).map((u) => `<li>${inline(u)}</li>`).join("");
  const pn = (dir, target) => (target ? `<span><a href="#" data-action="goto:${target.slug}">${dir === "prev" ? "← " : ""}${esc(target.title)}${dir === "next" ? " →" : ""}</a></span>` : "<span></span>");
  return `<main class="dx-main" id="main"><div class="dx-page"><header><div class="dx-eyebrow">${esc(ctx.group)}</div><h1>${esc(manifest.name)}</h1><p class="dx-lead">${inline(manifest.description)}</p></header>`
    + `<section class="dx-sec"><h2>Exemplo</h2><div class="dx-stage"><div class="dx-stage__inner ds" data-demo="${esc(ctx.demoName)}" style="width: auto; transform: none;">${demoHtml(sources.html || "")}</div></div></section>`
    + codeBlock(sources, ctx.highlight)
    + `<section class="dx-sec"><h2>Quando e como usar</h2><ul class="dx-list">${usage}</ul></section>`
    + apiTable(manifest)
    + `<div class="dx-pn">${pn("prev", ctx.prev)}${pn("next", ctx.next)}</div></div></main>`;
}

/**
 * Reescreve os links de anterior/próximo de uma página.
 * @param {string} html
 * @param {{ prev?: { slug: string, title: string } | null, next?: { slug: string, title: string } | null }} links  `undefined` mantém, `null` esvazia
 */
function setPn(html, links) {
  return html.replace(/<div class="dx-pn"([^>]*)>([\s\S]*?)<\/div>(?=<\/div><\/main>)/, (all, attrs, inner) => {
    const spans = inner.match(/<span[^>]*>[\s\S]*?<\/span>/g) || [];
    const read = (span) => {
      const m = span && /<a [^>]*data-action="goto:([^"]+)"[^>]*>([^<]*)<\/a>/.exec(span);
      return m ? { slug: m[1], title: m[2].replace(/^← /, "").replace(/ →$/, "") } : null;
    };
    const cur = { prev: read(spans[0]), next: read(spans[1]) };
    const prev = links.prev === undefined ? cur.prev : links.prev;
    const next = links.next === undefined ? cur.next : links.next;
    const make = (dir, t) => {
      if (!t) return "<span></span>";
      const label = `${dir === "prev" ? "← " : ""}${esc(t.title)}${dir === "next" ? " →" : ""}`;
      return `<span><a href="#" data-action="goto:${t.slug}">${label}</a></span>`;
    };
    return `<div class="dx-pn"${attrs}>${make("prev", prev)}${make("next", next)}</div>`;
  });
}

module.exports = { esc, inline, numberPids, fillMissingPids, maxPid, ensureNavItem, markCurrent, buildMain, setPn, apiTable, codeBlock, demoHtml, CODE_TABS, VOID };
