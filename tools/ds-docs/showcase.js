// @ts-check
"use strict";
const { kebab, isScreenModel } = require("./extract");
const T = require("./screen-transform");
const { PATIENT_HEAD } = require("./patient-flow");

const esc = (text) => String(text == null ? "" : text).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
/** Texto com `código` entre crases vira <code>. */
const inline = (text) => esc(text).replace(/`([^`]+)`/g, "<code>$1</code>");

const SHOWCASE_CSS = `/* Vitrine do DIS Design System. O estilo dos componentes vem de design/ds/components.css. */
body { margin: 0; background: var(--neutral-background); color: var(--neutral-body); font-family: var(--font-sans); }
.dsdoc { max-width: 1120px; margin: 0 auto; padding: 32px 32px 56px; }
.dsdoc__group { font-size: 12px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--neutral-dark); }
.dsdoc__title { margin: 4px 0 8px; font: 800 32px/1.15 var(--font-display); color: var(--primary-headings); }
.dsdoc__summary { margin: 0 0 24px; max-width: 70ch; font-size: 16px; line-height: 1.5; color: var(--neutral-dark); }
.dsdoc__section { margin-top: 28px; }
.dsdoc__h2 { margin: 0 0 12px; font: 600 20px/1.15 var(--font-display); color: var(--primary-headings); }
.dsdoc__demo { padding: 24px; background: var(--white); border: 1px solid var(--neutral-light); overflow-x: auto; }
.dsdoc__demo--flush { padding: 0; }
.dsdoc__table { width: 100%; border-collapse: collapse; background: var(--white); font-size: 14px; }
.dsdoc__table th, .dsdoc__table td { padding: 8px 12px; border: 1px solid var(--neutral-light); text-align: left; vertical-align: top; }
.dsdoc__table th { background: var(--primary-background); color: var(--primary-headings); font-weight: 700; }
.dsdoc__table code, .dsdoc__list code { padding: 1px 5px; background: var(--neutral-background); font: 13px var(--font-mono); }
.dsdoc__list { margin: 0; padding-left: 20px; display: grid; gap: 6px; line-height: 1.5; }
.dsdoc__files { margin-top: 28px; padding-top: 12px; border-top: 1px solid var(--neutral-light); font-size: 13px; color: var(--neutral-dark); }
.dsdoc__swatches { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
.dsdoc__swatch { display: grid; grid-template-columns: 48px 1fr; gap: 12px; padding: 8px; background: var(--white); border: 1px solid var(--neutral-light); font-size: 12px; }
.dsdoc__chip { width: 48px; height: 48px; border: 1px solid rgba(0, 0, 0, 0.12); }
.dsdoc__ramp { display: flex; flex-wrap: wrap; gap: 0; margin-bottom: 12px; }
.dsdoc__step { width: 64px; padding: 24px 6px 6px; font-size: 11px; }
.dsdoc__type { padding: 12px 0; border-bottom: 1px solid var(--neutral-light); }
.dsdoc__type small { display: block; margin-top: 4px; color: var(--neutral-dark); font: 12px var(--font-sans); }
.dsdoc__bars { display: grid; gap: 8px; }
.dsdoc__bar { display: grid; grid-template-columns: 200px 1fr; align-items: center; gap: 12px; font-size: 13px; }
.dsdoc__bar span { height: 16px; background: var(--primary-interactive-area); }
.dsdoc__icons { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 8px; }
.dsdoc__icon { display: grid; justify-items: center; gap: 8px; padding: 16px 8px; background: var(--white); border: 1px solid var(--neutral-light); font-size: 12px; }
.dsdoc__icon svg { width: 24px; height: 24px; fill: var(--neutral-body); }
`;

function propsTable(rows) {
  if (!rows || !rows.length) return "";
  const body = rows.map(([name, type, def, desc]) => `<tr><td><code>${esc(name)}</code></td><td><code>${esc(type)}</code></td><td>${def === "-" ? "" : `<code>${esc(def)}</code>`}</td><td>${inline(desc)}</td></tr>`).join("");
  return `<section class="dsdoc__section"><h2 class="dsdoc__h2">Propriedades</h2><table class="dsdoc__table"><thead><tr><th>Nome</th><th>Tipo</th><th>Padrão</th><th>Descrição</th></tr></thead><tbody>${body}</tbody></table></section>`;
}

function usageList(items) {
  if (!items || !items.length) return "";
  return `<section class="dsdoc__section"><h2 class="dsdoc__h2">Quando usar</h2><ul class="dsdoc__list">${items.map((i) => `<li>${inline(i)}</li>`).join("")}</ul></section>`;
}

function componentPage(name, doc, ctx) {
  const slug = kebab(name);
  const wide = (ctx.wide || {})[name] ? " dsdoc__demo--flush" : "";
  const demo = T.dropBlockedImages(T.inlineAssets(doc.html, ctx.assets));
  const script = doc.js && doc.js.trim() ? `\n${T.wrapScript(doc.js)}` : "";
  const html = `<article class="dsdoc">
  <header class="dsdoc__head">
    <span class="dsdoc__group">${esc(doc.group)}</span>
    <h1 class="dsdoc__title">${esc(doc.title)}</h1>
    <p class="dsdoc__summary">${inline(doc.summary)}</p>
  </header>
  <section class="dsdoc__section">
    <h2 class="dsdoc__h2">Exemplo</h2>
    <div class="dsdoc__demo${wide} ds">
${demo}
    </div>
  </section>
  ${propsTable(doc.props)}
  ${usageList(doc.usage)}
  <footer class="dsdoc__files">Arquivos do componente: <code>design/ds/components/${slug}/</code> (HTML, CSS, JS, React, Angular e manifest.json). Registro: <code>dis.${slug}</code>.</footer>
</article>${script}
`;
  return T.injectPids(T.markComponents(html, ctx.demoRootMap || new Map())).html;
}

function colorsPage(docs) {
  const groups = Object.entries(docs.colors.semantic).map(([group, list]) => `<section class="dsdoc__section"><h2 class="dsdoc__h2">${esc(group)}</h2><div class="dsdoc__swatches">${list.map((c) => `<div class="dsdoc__swatch"><div class="dsdoc__chip" style="background:${esc(c.hex)}"></div><div><strong>--${esc(c.name)}</strong><br>${esc(c.hex)} · ${esc(c.ref)}<br>${esc(c.usage)}</div></div>`).join("")}</div></section>`).join("");
  const ramps = Object.entries(docs.colors.ramps).map(([name, steps]) => `<div class="dsdoc__ramp">${steps.map((s) => `<div class="dsdoc__step" style="background:${esc(s.hex)};color:${s.dark ? "#fff" : "#091e42"}">${esc(name)}-${s.step}<br>${esc(s.hex)}</div>`).join("")}</div>`).join("");
  return page("Fundamentos", "Cores", "Cores semânticas do DIS (tokens de tema) e rampas primitivas.", `${groups}<section class="dsdoc__section"><h2 class="dsdoc__h2">Rampas primitivas</h2>${ramps}</section>`);
}

function typographyPage(docs) {
  const groups = docs.type.groups.map((g) => `<section class="dsdoc__section"><h2 class="dsdoc__h2">${esc(g.name)}</h2>${g.styles.map((s) => `<div class="dsdoc__type"><div style="font-family:var(--font-${esc(s.family)});font-size:${esc(s.fontSize)};line-height:${esc(s.lineHeight)};font-weight:${esc(s.fontWeight)};${s.letterSpacing ? `letter-spacing:${esc(s.letterSpacing)};` : ""}">${esc(s.sample)}</div><small>${esc(s.name)} · ${esc(s.fontSize)} / ${esc(s.lineHeight)} · peso ${esc(s.fontWeight)}. ${esc(s.usage)}</small></div>`).join("")}</section>`).join("");
  return page("Fundamentos", "Tipografia", "Famílias Noto Sans, Noto Sans Display e Noto Sans Mono em três densidades.", groups);
}

function spacingPage(docs) {
  const s = docs.spacing;
  const bars = s.spacing.map((i) => `<div class="dsdoc__bar"><strong>--${esc(i.name)} · ${esc(i.value)}</strong><span style="width:${esc(i.value)}"></span></div>`).join("");
  const table = (title, list) => `<section class="dsdoc__section"><h2 class="dsdoc__h2">${title}</h2><table class="dsdoc__table"><thead><tr><th>Token</th><th>Valor</th><th>Uso</th></tr></thead><tbody>${list.map((i) => `<tr><td><code>--${esc(i.name)}</code></td><td><code>${esc(i.value)}</code></td><td>${esc(i.usage)}</td></tr>`).join("")}</tbody></table></section>`;
  return page("Fundamentos", "Espaçamento e grid", "Escala de espaçamento, raios, sombras, breakpoints e contêineres.",
    `<section class="dsdoc__section"><h2 class="dsdoc__h2">Escala de espaçamento</h2><div class="dsdoc__bars">${bars}</div></section>${table("Raios", s.radius)}${table("Sombras", s.shadow)}${table("Breakpoints", s.breakpoint)}${table("Contêineres", s.container)}`);
}

function iconsPage(docs) {
  const icons = docs.iconList.map((i) => `<div class="dsdoc__icon"><svg viewBox="0 0 ${i.w} ${i.h}" aria-hidden="true"><path d="${esc(i.d)}"></path></svg><span>${esc(i.name)}</span></div>`).join("");
  return page("Fundamentos", "Ícones", "Ícones Font Awesome usados pelos componentes.", `<section class="dsdoc__section"><div class="dsdoc__icons">${icons}</div></section>`);
}

function page(group, title, summary, body) {
  const html = `<article class="dsdoc"><header class="dsdoc__head"><span class="dsdoc__group">${esc(group)}</span><h1 class="dsdoc__title">${esc(title)}</h1><p class="dsdoc__summary">${esc(summary)}</p></header>${body}</article>\n`;
  return T.injectPids(html).html;
}

/** Boilerplates de um componente, um por tecnologia (viram blocos de código no canvas). */
function snippetsFor(doc) {
  const title = doc.title || "Componente";
  const defs = [["HTML", "html", doc.html], ["CSS", "css", doc.css], ["JS", "js", doc.js], ["React (JSX)", "js", doc.react], ["Angular (TS)", "ts", doc.angular]];
  return defs.filter(([, , code]) => code && String(code).trim()).map(([label, lang, code]) => ({ name: `${title} · ${label}`, lang, code: String(code).trim() }));
}

/** Telas da vitrine, na ordem do menu do DS (fundamentos, depois cada grupo de componentes). */
function showcaseScreens(docs, ctx) {
  const fundamentals = [
    { id: "cores", title: "Cores", html: colorsPage(docs) },
    { id: "tipografia", title: "Tipografia", html: typographyPage(docs) },
    { id: "espacamento", title: "Espaçamento e grid", html: spacingPage(docs) },
    { id: "icones", title: "Ícones", html: iconsPage(docs) },
  ];
  const names = docs.nav.filter((g) => !["Começar", "Fundamentos", "Modelos de tela"].includes(g.title))
    .flatMap((g) => g.items.map((i) => i.title)).filter((n) => docs.components[n] && !isScreenModel(n));
  const components = names.map((name) => ({ id: kebab(name), title: docs.components[name].title, html: componentPage(name, docs.components[name], ctx), snippets: snippetsFor(docs.components[name]) }));
  return [...fundamentals, ...components];
}

function buildShowcasePrototype(docs, ctx) {
  const dir = `design/prototypes/${ctx.protoId}`;
  const now = new Date().toISOString();
  const screens = showcaseScreens(docs, ctx);
  const files = screens.map((s) => ({ rel: `${dir}/screens/${s.id}.html`, content: s.html }));
  const proto = {
    schema: 1, id: ctx.protoId, title: "DIS Design System (editável)", version: 1, activeScreen: screens[0].id,
    screens: screens.map((s) => ({ id: s.id, title: s.title, file: `screens/${s.id}.html`, ...(s.snippets && s.snippets.length ? { snippets: s.snippets } : {}) })),
    components: [],
    metadata: { engine: "ds-docs-import", dsComponents: true, sourceArtifact: "dis-design-system", sourceFile: "design/dis-design-system.html", createdAt: now, updatedAt: now },
  };
  files.push({ rel: `${dir}/proto.json`, content: `${JSON.stringify(proto, null, 2)}\n` });
  files.push({ rel: `${dir}/head.html`, content: PATIENT_HEAD });
  files.push({ rel: `${dir}/styles/proto.css`, content: SHOWCASE_CSS });
  files.push({ rel: `${dir}/MAPA.md`, content: `# MAPA: ${ctx.protoId}\n\n## 1. UI / UX\n- Vitrine do DIS Design System: fundamentos (cores, tipografia, espaçamento, ícones) e uma tela por componente, com exemplo ao vivo, propriedades e orientações de uso.\n- Gerada por \`tools/import-ds-docs.js\` a partir de \`design/dis-design-system.html\`.\n\n## Componentes Candidatos\n- Os componentes estão em \`design/ds/components/\`.\n` });
  return files;
}

module.exports = { snippetsFor, buildShowcasePrototype, showcaseScreens, componentPage, SHOWCASE_CSS, esc, inline };
