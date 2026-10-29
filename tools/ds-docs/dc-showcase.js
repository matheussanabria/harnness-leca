// @ts-check
"use strict";

const path = require("path");
const { requiredTokens } = require("./extract-dc");

const esc = (value) => String(value ?? "").replace(/[&<>\"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char]));
const slug = (value) => String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const SHOWCASE_CSS = `
body{margin:0;background:var(--neutral-background);color:var(--neutral-body);font-family:var(--font-sans)}
.dc-doc{max-width:1120px;margin:0 auto;padding:32px}.dc-doc__eyebrow{font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--neutral-base)}
.dc-doc h1{margin:6px 0 8px;color:var(--primary-headings);font-family:var(--font-display);font-size:32px}.dc-doc__summary{max-width:72ch;margin:0 0 28px;line-height:1.5}
.dc-doc__demo{padding:24px;overflow:auto;border:1px solid var(--neutral-light);border-radius:12px;background:#fff}.dc-doc__meta{display:flex;flex-wrap:wrap;gap:8px;margin-top:20px}
.dc-doc__tag{padding:5px 9px;border-radius:999px;background:var(--primary-background);color:var(--primary-headings);font-size:12px;font-weight:700}
`;

function sourceSetFor(component) {
  const className = String(component.name || component.id).replace(/[^a-zA-Z0-9]+/g, " ").split(" ").filter(Boolean).map((part) => part[0].toUpperCase() + part.slice(1)).join("") || "DesignSystemComponent";
  const selector = `ds-${slug(component.id)}`;
  const htmlLiteral = JSON.stringify(String(component.html || ""));
  const angular = component.ng || `@Component({ selector: '${selector}', standalone: true, template: ${htmlLiteral} })\nexport class ${className}Component {}`;
  const react = component.react || `export function ${className}() {\n  const markup = ${htmlLiteral};\n  return <div dangerouslySetInnerHTML={{ __html: markup }} />;\n}`;
  return { html: component.html, css: component.css, js: component.js || "// Presentational component: no JavaScript behavior required.", angular, react };
}

function snippetsFor(component) {
  const source = sourceSetFor(component);
  const candidates = [
    ["HTML", "html", source.html], ["CSS", "css", source.css], ["JavaScript", "js", source.js],
    ["React", "js", source.react], ["Angular", "ts", source.angular],
  ];
  return candidates.map(([label, lang, code]) => ({
    name: `${component.name} - ${label}`, lang, code: String(code).trim(),
  }));
}

function apiRows(component) {
  const rows = [];
  const push = (name, type, required, def, description) => rows.push({ name, type, required: required ? "Yes" : "No", default: def || "-", description });
  const states = String(component.states || "").split(/\s*[·|]\s*/).filter(Boolean);
  if (states.length) push("state / variant", "string", false, states[0], `Supported values: ${states.join(", ")}.`);
  for (const match of String(component.ng || "").matchAll(/@(Input|Output)(?:\([^)]*\))?\s*(?:[!?:]|readonly\s+)?\s*([A-Za-z_$][\w$]*)/g)) {
    push(match[2], match[1] === "Output" ? "Angular EventEmitter" : "Angular @Input", false, "-", match[1] === "Output" ? "Event emitted by the component." : "Public Angular component input.");
  }
  const react = String(component.react || "").match(/(?:function\s+\w+|(?:const|let)\s+\w+\s*=)\s*\(\s*\{([^}]+)\}/);
  if (react) for (const raw of react[1].split(",")) {
    const part = raw.trim(); if (!part || part.startsWith("...")) continue;
    const [name, def] = part.split("=").map((item) => item.trim());
    if (/^[A-Za-z_$][\w$]*$/.test(name)) push(name, "React prop", false, def || "-", "Public React component property.");
  }
  for (const token of requiredTokens(component)) push(token, "CSS custom property", true, "theme", "Semantic Design System token consumed by this component.");
  return rows.length ? rows : [{ name: "content", type: "HTML content", required: "No", default: "-", description: "Semantic content rendered inside the component." }];
}

const DOC_SCREENS = [
  ["inicio", "Início"], ["indice", "Índice"], ["instalacao", "Instalação"], ["arquitetura", "Arquitetura"],
  ["cores", "Cores"], ["tipografia", "Tipografia"], ["espacamento", "Espaçamento e grid"],
  ["raio", "Raio e sombras"], ["acessibilidade", "Acessibilidade"], ["assets", "Assets"],
];

function dcScreens(components) {
  return [...DOC_SCREENS.map(([id, title]) => ({ id, title, file: "dc/template.html", dcScreen: id })), ...components.map((component) => ({
    id: `c-${slug(component.id)}`, title: component.name, file: "dc/template.html", dcScreen: `c-${slug(component.id)}`, snippets: snippetsFor(component),
  }))];
}

function enhanceDcTemplate(template) {
  let out = template.replace('<article id="{{ d.anchor }}"', '<article id="{{ d.anchor }}" data-component="{{ d.registryId }}" data-pid="{{ d.pid }}"');
  const codeHeading = '<h2 style="font:700 1.5rem';
  const index = out.indexOf(codeHeading, out.indexOf("{{ d.is.piechart }}"));
  if (index < 0 || out.includes("Detailed API")) return out;
  const api = `<h2 style="font:700 1.5rem 'Noto Sans Display',sans-serif;margin:36px 0 14px">API</h2>
    <div aria-label="Detailed API" style="border:1px solid {{ t.line }};border-radius:10px;overflow:auto"><table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr style="background:{{ t.panel2 }};text-align:left"><th style="padding:10px">Property</th><th>Type</th><th>Required</th><th>Default</th><th>Description</th></tr></thead><tbody><sc-for list="{{ d.api }}" as="a" hint-placeholder-count="3"><tr style="border-top:1px solid {{ t.line }}"><td style="padding:10px"><code>{{ a.name }}</code></td><td><code>{{ a.type }}</code></td><td>{{ a.required }}</td><td><code>{{ a.default }}</code></td><td style="padding:10px">{{ a.description }}</td></tr></sc-for></tbody></table></div>
    `;
  return `${out.slice(0, index)}${api}${out.slice(index)}`;
}

function enhanceDcLogic(logic, components, namespace = "m57") {
  const api = Object.fromEntries(components.map((component) => [slug(component.id), apiRows(component)]));
  let out = logic;
  if (!out.includes("API_DOCS =")) out = out.replace(/\n\s*renderVals\(\)\s*\{/, `\n  API_DOCS = ${JSON.stringify(api)};\n\n  renderVals() {`);
  return out.replace("return { ...d, cat:", `return { ...d, registryId: '${namespace}.' + d.id, pid: 'component-' + d.id, api: this.API_DOCS[d.id] || [], cat:`);
}

function componentPage(component, componentId) {
  const states = String(component.states || "").split(/[·|]/).map((item) => item.trim()).filter(Boolean);
  return `<article class="dc-doc">
  <header><span class="dc-doc__eyebrow">Design System component</span><h1>${esc(component.name)}</h1><p class="dc-doc__summary">${esc(component.desc || "Live, editable preview generated from the source artifact.")}</p></header>
  <section class="dc-doc__demo" data-component="${esc(componentId)}" data-pid="component-${esc(slug(component.id))}">${component.html}</section>
  ${states.length ? `<div class="dc-doc__meta">${states.map((state) => `<span class="dc-doc__tag">${esc(state)}</span>`).join("")}</div>` : ""}
</article>\n`;
}

function buildRegistry(components, namespace = "m57", prototypeId = "") {
  const entries = components.map((component) => {
    const id = `${namespace}.${slug(component.id)}`;
    const file = slug(component.id);
    return [id, {
      id, version: "1.0.0", name: component.name, category: "Design System",
      description: component.desc || "", props: {}, slots: {}, events: {}, dependencies: [],
      ...(prototypeId ? { documentation: { prototypeId, screenId: `c-${file}` } } : {}),
      implementations: {
        vanilla: { framework: "vanilla", entryFile: `${file}.html`, files: [`${file}.html`, `${file}.css`, `${file}.js`], styles: [`${file}.css`], dependencies: [], status: "available" },
        angular: { framework: "angular", entryFile: `${file}.angular.ts`, files: [`${file}.angular.ts`], styles: [`${file}.css`], dependencies: [], status: "available" },
        react: { framework: "react", entryFile: `${file}.react.jsx`, files: [`${file}.react.jsx`], styles: [`${file}.css`], dependencies: [], status: "available" },
      },
    }];
  });
  return { schema: 1, namespace, components: Object.fromEntries(entries) };
}

function buildDcShowcase(components, options) {
  const namespace = options.namespace || "m57";
  const screens = dcScreens(components);
  const now = new Date().toISOString();
  const proto = {
    schema: 1, id: options.protoId, title: options.title, version: 2,
    activeScreen: "inicio", screens,
    components: components.map((component) => ({ id: `${namespace}.${slug(component.id)}`, name: component.name, screen: `c-${slug(component.id)}`, pid: `component-${slug(component.id)}`, relationship: "source" })),
    metadata: { engine: "dc-design-system-import", runtime: "dc", dsComponents: true, sourceArtifact: options.sourceArtifact, sourceFile: options.sourceFile, inspectionCopy: true, inspectionFormat: 5, createdAt: now, updatedAt: now },
  };
  const base = `prototypes/${options.protoId}`;
  return [
    { rel: `${base}/proto.json`, content: `${JSON.stringify(proto, null, 2)}\n` },
    { rel: `${base}/MAPA.md`, content: `# ${options.title}\n\nGenerated from \`${path.basename(options.sourceFile)}\`. Each Design System component is an editable screen with live preview and source snippets.\n` },
  ];
}

function referencedComponents(sourceText, components, namespace = "m57") {
  const compact = String(sourceText).toLowerCase().replace(/[^a-z0-9]+/g, "");
  return components.filter((component) => [component.id, component.name].some((value) => {
    const needle = String(value).toLowerCase().replace(/[^a-z0-9]+/g, "");
    return needle.length > 3 && compact.includes(needle);
  })).map((component) => ({ id: `${namespace}.${slug(component.id)}`, name: component.name, relationship: "reference" }));
}

module.exports = { apiRows, buildDcShowcase, buildRegistry, componentPage, dcScreens, enhanceDcLogic, enhanceDcTemplate, referencedComponents, snippetsFor, sourceSetFor, SHOWCASE_CSS };
