// @ts-check
"use strict";
const { kebab, isScreenModel } = require("./extract");

const CATEGORY = {
  "Layout e navegação": "layout",
  "Ações e feedback": "actions",
  "Formulários": "forms",
  "Dados": "data-display",
};

/** Variáveis CSS usadas pelo componente (ignora as locais `--c-*` e `--cols`). */
function tokensUsed(css) {
  const found = new Set();
  for (const match of css.matchAll(/var\((--[\w-]+)/g)) {
    if (!/^--c-|^--cols$/.test(match[1])) found.add(match[1]);
  }
  return [...found].sort();
}

/** Linhas da tabela de props do DOCS: [nome, tipo, padrão, descrição]. */
function convertProps(rows) {
  const props = {};
  const events = {};
  for (const [name, type, def, description] of rows) {
    const isEvent = /^on[A-Z]/.test(name) && /=>/.test(type);
    if (isEvent) {
      const key = name.slice(2, 3).toLowerCase() + name.slice(3);
      events[key] = { name: key, description: description.replace(/`/g, ""), payload: type };
    } else {
      const hasDefault = def !== "-" && def !== "";
      props[name] = { name, type, description: description.replace(/`/g, ""), default: hasDefault ? def : "", required: false };
    }
  }
  return { props, events };
}

function reactDependencies(react, known) {
  const deps = new Set(["react"]);
  for (const match of react.matchAll(/from '\.\/([\w-]+)'/g)) {
    const id = `dis.${kebab(match[1])}`;
    if (known.has(id) || match[1] === "icon") deps.add(match[1] === "icon" ? "dis.icon" : id);
  }
  return [...deps];
}

/** Arquivos e manifesto de um componente do DOCS. */
function buildComponent(name, doc, known) {
  const slug = kebab(name);
  const id = `dis.${slug}`;
  const dir = `ds/components/${slug}`;
  const { props, events } = convertProps(doc.props || []);
  const reactDeps = reactDependencies(doc.react || "", known);
  const files = [
    { rel: `${dir}/${slug}.html`, content: doc.html },
    { rel: `${dir}/${slug}.css`, content: doc.css },
    { rel: `${dir}/${slug}.js`, content: doc.js },
    { rel: `${dir}/${slug}.jsx`, content: doc.react },
    { rel: `${dir}/${slug}.component.ts`, content: doc.angular },
  ];
  const manifest = {
    id,
    version: "1.0.0",
    name: doc.title || name,
    category: CATEGORY[doc.group] || "data-display",
    description: doc.summary || "",
    props,
    slots: {},
    events,
    tokensUsed: tokensUsed(doc.css || ""),
    dependencies: reactDeps.filter((d) => d.startsWith("dis.")),
    usage: doc.usage || [],
    implementations: {
      vanilla: { framework: "vanilla", entryFile: `${slug}.html`, files: [`${slug}.html`, `${slug}.css`, `${slug}.js`], dependencies: [], styles: [`${slug}.css`], status: "available" },
      angular: { framework: "angular", entryFile: `${slug}.component.ts`, files: [`${slug}.component.ts`], dependencies: ["@angular/core"], styles: [], status: "available" },
      react: { framework: "react", entryFile: `${slug}.jsx`, files: [`${slug}.jsx`], dependencies: reactDeps, styles: [`${slug}.css`], status: "available" },
    },
  };
  files.push({ rel: `${dir}/manifest.json`, content: `${JSON.stringify(manifest, null, 2)}\n` });
  return { id, slug, manifest, files };
}

/** Componentes de interface (exclui as telas modelo). */
function buildAllComponents(docs) {
  const names = Object.keys(docs.components).filter((n) => !isScreenModel(n));
  const known = new Set(names.map((n) => `dis.${kebab(n)}`));
  return names.map((name) => buildComponent(name, docs.components[name], known));
}

/** Registra no registry; ids já existentes só são trocados com `force`. */
function registerAll(projectDir, built, options = {}) {
  const registry = require("../../ui/server/services/design-registry.service");
  const existing = registry.loadRegistry(projectDir).components;
  const written = [];
  const skipped = [];
  for (const item of built) {
    if (existing[item.id] && !options.force) { skipped.push(item.id); continue; }
    const { implementations, usage, ...entry } = item.manifest;
    registry.registerComponent(projectDir, { ...entry, implementations });
    written.push(item.id);
  }
  return { written, skipped };
}

module.exports = { buildComponent, buildAllComponents, registerAll, tokensUsed, convertProps, CATEGORY };
