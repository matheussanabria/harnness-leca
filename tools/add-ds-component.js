#!/usr/bin/env node
// @ts-check
"use strict";
/**
 * Publica um componente do DS: registro (registry.json), página na vitrine (`dis-ds-vitrine`), item no menu de
 * todas as telas, navegação anterior/próximo e, se houver, componente React + demo ao vivo no head da vitrine.
 *
 * A fonte da verdade é a pasta `design/ds/components/<slug>/` com `manifest.json` (ver a skill ds-component).
 *
 * Uso: node tools/add-ds-component.js <slug> --after <slug-do-item-anterior-no-menu>
 *        [--project saude-dispensacao] [--vitrine dis-ds-vitrine] [--root <repo>] [--dry-run]
 */
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const { registerComponent } = require("../ui/server/services/design-registry.service");
const P = require("./ds-docs/component-page");

/** Lê um arquivo de texto da pasta do componente (null se não existir). */
function readIf(dir, file) {
  if (!file) return null;
  const abs = path.join(dir, file);
  return fs.existsSync(abs) ? fs.readFileSync(abs, "utf8") : null;
}

/** Valida o manifest.json do componente antes de publicar. Devolve a lista de problemas. */
function validateManifest(manifest, slug, dir) {
  const problems = [];
  if (manifest.id !== `dis.${slug}`) problems.push(`id deve ser "dis.${slug}" (está "${manifest.id}").`);
  for (const key of ["name", "category", "description"]) if (!manifest[key]) problems.push(`falta "${key}".`);
  if (!Array.isArray(manifest.usage) || !manifest.usage.length) problems.push('falta "usage" (lista de orientações de uso).');
  if (!manifest.props || typeof manifest.props !== "object") problems.push('falta "props".');
  for (const [key, impl] of Object.entries(manifest.implementations || {})) {
    if (!impl) continue;
    for (const file of impl.files || []) if (!fs.existsSync(path.join(dir, file))) problems.push(`implementations.${key}: arquivo "${file}" não existe.`);
  }
  if (!manifest.implementations?.vanilla) problems.push("falta a implementação vanilla (html, css, js).");
  return problems;
}

/** Textos das cinco abas de código, na ordem html, css, js, angular, react. */
function readSources(manifest, dir) {
  const impl = manifest.implementations || {};
  const vanillaJs = (impl.vanilla?.files || []).find((f) => f.endsWith(".js"));
  return {
    html: readIf(dir, impl.vanilla?.entryFile) || "",
    css: readIf(dir, (impl.vanilla?.styles || [])[0]) || "",
    js: readIf(dir, vanillaJs) || "",
    angular: readIf(dir, impl.angular?.entryFile) || "",
    react: readIf(dir, impl.react?.entryFile) || "",
  };
}

/** Insere o componente React e o demo no <head> da vitrine (idempotente). */
function patchHead(head, manifest, docs) {
  const name = manifest.name;
  let out = head;
  if (docs.bundle && !new RegExp(`function ${name}\\(`).test(out)) {
    const marker = "  var api = {";
    if (!out.includes(marker)) throw new Error('Marcador "var api = {" não encontrado no head da vitrine.');
    out = out.replace(marker, `  /* ---------------- ${name} ---------------- */\n${docs.bundle.replace(/\s+$/, "").replace(/^/gm, "  ")}\n\n${marker}`);
    out = out.replace("var api = {", `var api = { ${name}: ${name},`);
    out = out.replace(/\/\* @ds-bundle: (\{.*?\}) \*\//, (all, json) => {
      const meta = JSON.parse(json);
      if (!meta.components.some((c) => c.name === name)) meta.components.push({ name });
      return `/* @ds-bundle: ${JSON.stringify(meta)} */`;
    });
  }
  if (docs.demo) {
    out = out.replace(/(<script type="application\/json" id="ds-demos">)([\s\S]*?)(<\/script>)/, (all, open, json, close) => {
      const data = JSON.parse(json.replace(/\\u003c/g, "<"));
      data.demos[name] = docs.demo.replace(/\s+$/, "");
      return `${open}${JSON.stringify(data).replace(/</g, "\\u003c")}${close}`;
    });
  }
  return out;
}

/**
 * @param {{ root: string, project: string, vitrine: string, slug: string, after: string, dryRun?: boolean }} opts
 */
async function addComponent(opts) {
  const projectDir = path.join(opts.root, "projects", opts.project);
  const dsDir = path.join(projectDir, "design", "ds");
  const dir = path.join(dsDir, "components", opts.slug);
  const vitrineDir = path.join(projectDir, "design", "prototypes", opts.vitrine);
  const manifestFile = path.join(dir, "manifest.json");
  if (!fs.existsSync(manifestFile)) throw new Error(`Falta ${path.relative(opts.root, manifestFile)}.`);
  const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
  const problems = validateManifest(manifest, opts.slug, dir);
  if (problems.length) throw new Error(`manifest.json inválido:\n- ${problems.join("\n- ")}`);

  const protoFile = path.join(vitrineDir, "proto.json");
  const proto = JSON.parse(fs.readFileSync(protoFile, "utf8"));
  const others = proto.screens.filter((s) => s.id !== opts.slug);
  const afterIdx = others.findIndex((s) => s.id === opts.after);
  if (afterIdx < 0) throw new Error(`Tela '${opts.after}' não existe na vitrine (use --after com o item anterior do menu).`);

  // Menu lateral em todas as telas
  const pages = new Map();
  for (const s of others) pages.set(s.id, fs.readFileSync(path.join(vitrineDir, s.file), "utf8"));
  for (const [id, html] of pages) pages.set(id, P.ensureNavItem(html, { slug: opts.slug, name: manifest.name, afterSlug: opts.after }));

  // Anterior e próximo (só entre páginas de componente, que têm dx-pn)
  const afterScreen = others[afterIdx];
  const nextScreen = others[afterIdx + 1];
  const hasPn = (id) => /class="dx-pn"/.test(pages.get(id) || "");
  const prev = hasPn(afterScreen.id) ? { slug: afterScreen.id, title: afterScreen.title } : undefined;
  const next = nextScreen && hasPn(nextScreen.id) ? { slug: nextScreen.id, title: nextScreen.title } : undefined;
  if (prev) pages.set(afterScreen.id, P.fillMissingPids(P.setPn(pages.get(afterScreen.id), { next: { slug: opts.slug, title: manifest.name } })));
  if (next) pages.set(nextScreen.id, P.fillMissingPids(P.setPn(pages.get(nextScreen.id), { prev: { slug: opts.slug, title: manifest.name } })));

  // Página nova: o casco (topo e menu) vem da tela anterior
  const shell = pages.get(afterScreen.id);
  const mainStart = shell.indexOf('<main class="dx-main"');
  const mainEnd = shell.indexOf("</main>");
  if (mainStart < 0 || mainEnd < 0) throw new Error(`A tela '${afterScreen.id}' não tem <main class="dx-main">.`);
  const groupMatch = [...shell.slice(0, mainStart).matchAll(/<h2[^>]*>([^<]+)<\/h2>/g)].filter((m) => m.index < shell.indexOf(`data-action="goto:${opts.slug}"`)).pop();
  const { highlight } = await import(pathToFileURL(path.resolve(__dirname, "..", "ui", "public", "js", "modules", "prototype-code-highlight.js")).href);
  const main = P.buildMain(manifest, readSources(manifest, dir), {
    group: groupMatch ? groupMatch[1] : "Componentes",
    demoName: manifest.name,
    highlight,
    prev: prev && { slug: prev.slug, title: prev.title },
    next: next && { slug: next.slug, title: next.title },
  });
  const page = P.numberPids(P.markCurrent(shell.slice(0, mainStart) + main + shell.slice(mainEnd + "</main>".length), opts.slug));
  pages.set(opts.slug, page);

  // proto.json e head.html
  const screen = { id: opts.slug, title: manifest.name, file: `screens/${opts.slug}.html` };
  const existing = proto.screens.findIndex((s) => s.id === opts.slug);
  if (existing >= 0) proto.screens[existing] = { ...proto.screens[existing], ...screen };
  else proto.screens.splice(proto.screens.findIndex((s) => s.id === opts.after) + 1, 0, screen);
  const docs = {
    bundle: readIf(dir, manifest.docs?.bundle),
    demo: readIf(dir, manifest.docs?.demo),
  };
  const headFile = path.join(vitrineDir, "head.html");
  const head = patchHead(fs.readFileSync(headFile, "utf8"), manifest, docs);

  const writes = [
    [protoFile, `${JSON.stringify(proto, null, 2)}\n`],
    [headFile, head],
    ...[...pages].map(([id, html]) => [path.join(vitrineDir, id === opts.slug ? screen.file : proto.screens.find((s) => s.id === id).file), html]),
  ];
  if (!opts.dryRun) {
    registerComponent(projectDir, manifest);
    for (const [file, content] of writes) fs.writeFileSync(file, content, "utf8");
  }
  return { id: manifest.id, pages: pages.size, prev: prev?.slug, next: next?.slug, written: writes.map(([f]) => path.relative(opts.root, f)), dryRun: Boolean(opts.dryRun) };
}

function main() {
  const argv = process.argv.slice(2);
  const args = { root: process.cwd(), project: "saude-dispensacao", vitrine: "dis-ds-vitrine", slug: "", after: "", dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--dry-run") args.dryRun = true;
    else if (argv[i].startsWith("--")) args[argv[i].slice(2)] = argv[(i += 1)];
    else args.slug = argv[i];
  }
  if (!args.slug || !args.after) {
    console.error("Uso: node tools/add-ds-component.js <slug> --after <slug-do-item-anterior> [--project ...] [--vitrine ...] [--dry-run]");
    process.exit(2);
  }
  addComponent(args).then((r) => console.log(JSON.stringify(r, null, 2)), (e) => { console.error(e.message); process.exit(1); });
}

if (require.main === module) main();
module.exports = { addComponent, validateManifest, readSources, patchHead };
