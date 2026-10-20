// @ts-check
"use strict";

/**
 * Protótipo "site do Design System": recria a navegação do dis-design-system.html (topo, menu lateral e uma página
 * por item, com abas de código) a partir da captura feita por `capture-site.js`. Cada página é uma tela editável.
 */

const T = require("./screen-transform");
const { kebab, isScreenModel } = require("./extract");
const { liveHead, markDemo } = require("./docs-live");

const DOCS_HEAD = `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans:ital,wght@0,400;0,600;0,700;0,800;1,400&family=Noto+Sans+Display:wght@600;700;800&family=Noto+Sans+Mono:wght@400;600&display=swap">
<script>
/* Sandbox sem same-origin: sessionStorage em memória e navegação pela janela-mãe. */
(function () {
  try { void window.sessionStorage; } catch (error) {
    var mem = {};
    try { Object.defineProperty(window, "sessionStorage", { value: { getItem: function (k) { return k in mem ? mem[k] : null; }, setItem: function (k, v) { mem[k] = String(v); }, removeItem: function (k) { delete mem[k]; }, clear: function () { mem = {}; } }, configurable: true }); } catch (e) {}
  }
  window.harnessGoto = function (screen) {
    try { window.parent.postMessage({ type: "HARNESS_PROTO_GOTO", screen: screen }, "*"); } catch (e) {}
  };
  document.addEventListener("click", function (event) {
    var el = event.target;
    var tab = el.closest && el.closest(".dx-tab");
    if (tab) {
      var block = tab.closest(".dx-code");
      block.querySelectorAll(".dx-tab").forEach(function (t) { t.setAttribute("aria-selected", String(t === tab)); });
      block.querySelectorAll(".dx-panel").forEach(function (p) { p.hidden = p.getAttribute("data-panel") !== tab.getAttribute("data-tab"); });
      return;
    }
    var copy = el.closest && el.closest(".dx-copy");
    if (copy) {
      var visible = copy.closest(".dx-code").querySelector(".dx-panel:not([hidden]) .dx-pre");
      var text = visible ? visible.textContent : "";
      try { navigator.clipboard.writeText(text).then(function () { copy.textContent = "Copiado"; setTimeout(function () { copy.textContent = "Copiar"; }, 1200); }); } catch (e) {}
      return;
    }
    if (el.closest && el.closest("#theme")) {
      var root = document.documentElement;
      var dark = root.getAttribute("data-theme") ? root.getAttribute("data-theme") === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
      root.setAttribute("data-theme", dark ? "light" : "dark");
      return;
    }
    if (el.closest && el.closest("#menu")) { var side = document.getElementById("side"); if (side) side.classList.toggle("is-open"); }
  });
  document.addEventListener("input", function (event) {
    if (!event.target || event.target.id !== "q") return;
    var term = event.target.value.trim().toLowerCase();
    document.querySelectorAll("#nav li").forEach(function (li) { li.hidden = !!term && li.textContent.toLowerCase().indexOf(term) < 0; });
  });
})();
</script>
`;

const EXTRA_CSS = `
.dx-panel[hidden] { display: none; }
.dx-nav li[hidden] { display: none; }
`;

/** CSS só do site (variáveis --dx-* e regras .dx-*): tokens e componentes já vêm de design/ds. */
function siteCss(styles) {
  const css = styles.join("\n");
  const at = css.indexOf("--dx-bg");
  const start = at < 0 ? 0 : css.lastIndexOf(":root", at);
  return `/* Site do DIS Design System (capturado de dis-design-system.html). */\n${css.slice(start).trim()}\n${EXTRA_CSS}`;
}

/** id da tela do protótipo para cada item do menu (mantém os ids da vitrine anterior). */
function screenMap(docs) {
  const map = new Map();
  for (const group of docs.nav) {
    for (const item of group.items) {
      const component = docs.components[item.title];
      map.set(item.id, component && !isScreenModel(item.title) ? kebab(item.title) : item.id);
    }
  }
  return map;
}

function protectPre(html) {
  const saved = [];
  const text = html.replace(/<pre\b[\s\S]*?<\/pre>/g, (all) => { saved.push(all); return `<!--PRE_${saved.length - 1}-->`; });
  return { text, restore: (out) => out.replace(/<!--PRE_(\d+)-->/g, (_, i) => saved[Number(i)].replace(/^<pre\b/, `<pre data-pid="p-pre-${i}"`)) };
}

function linkify(html, map) {
  return html.replace(/<a\b([^>]*?)\shref="#([\w-]*)"([^>]*)>/g, (all, before, id, after) => {
    const target = map.get(id);
    return target ? `<a${before} href="#"${after} data-action="goto:${target}">` : all;
  });
}

function buildPage(id, site, map, docs, assets) {
  const side = site.side.replace(/\saria-current="page"/g, "").replace(new RegExp(`(<a\\b[^>]*href="#${id}")`), '$1 aria-current="page"');
  let html = `${site.top}\n<div class="dx-shell">\n${side}\n<main class="dx-main" id="main">${markDemo(site.pages[id], id, docs.demos)}</main>\n</div>`;
  html = linkify(html, map);
  const guarded = protectPre(html);
  let out = T.injectPids(guarded.text).html;
  out = guarded.restore(out);
  return `${out}\n`.replace(/src="([^"]+)"/g, (all, src) => (assets[src] ? `src="${assets[src]}"` : all));
}

function docsMapa(protoId) {
  return [
    `# MAPA: ${protoId}`, "",
    "## 1. UI / UX",
    "- Site navegável do DIS Design System: topo, menu lateral (`data-action=\"goto:<tela>\"`) e uma tela por item (fundamentos, componentes e modelos de tela), com exemplo, propriedades e abas de código.",
    "- Gerado por `tools/import-ds-docs.js --site` a partir da captura de `tools/ds-docs/capture-site.js`.", "",
    "## Componentes Candidatos",
    "- Os componentes estão em `design/ds/components/`.", "",
  ].join("\n");
}

function buildDocsSitePrototype(docs, site, ctx, snippetsFor) {
  const dir = `design/prototypes/${ctx.protoId}`;
  const now = new Date().toISOString();
  const map = screenMap(docs);
  const titles = new Map(docs.nav.flatMap((g) => g.items.map((i) => [i.id, i.title])));
  const files = [];
  const screens = [];
  for (const id of site.ids) {
    const sid = map.get(id) || id;
    files.push({ rel: `${dir}/screens/${sid}.html`, content: buildPage(id, site, map, docs, ctx.assets || {}) });
    const name = Object.keys(docs.components).find((n) => kebab(n) === sid && !isScreenModel(n));
    const snippets = name ? snippetsFor(docs.components[name]) : [];
    screens.push({ id: sid, title: titles.get(id) || sid, file: `screens/${sid}.html`, ...(snippets.length ? { snippets } : {}) });
  }
  const proto = {
    schema: 1, id: ctx.protoId, title: "DIS Design System (editável)", version: 1, activeScreen: screens[0].id, screens, components: [],
    metadata: { engine: "ds-docs-import", dsComponents: true, sourceArtifact: "dis-design-system", sourceFile: "design/dis-design-system.html", createdAt: now, updatedAt: now },
  };
  files.push({ rel: `${dir}/proto.json`, content: `${JSON.stringify(proto, null, 2)}\n` });
  files.push({ rel: `${dir}/head.html`, content: DOCS_HEAD + liveHead(docs) });
  files.push({ rel: `${dir}/styles/proto.css`, content: siteCss(site.styles) });
  files.push({ rel: `${dir}/MAPA.md`, content: docsMapa(ctx.protoId) });
  return files;
}

module.exports = { buildDocsSitePrototype, siteCss, screenMap, DOCS_HEAD };
