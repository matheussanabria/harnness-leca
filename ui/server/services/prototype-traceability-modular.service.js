// @ts-check
const { findNodeRangeByPid } = require("./prototype-structural.service");
const { readRule, classFor } = require("./prototype-style.service");
const { matchedCssText } = require("./prototype-css-match.service");

/**
 * Resolve a rastreabilidade de um elemento de protótipo modular (telas em arquivos HTML).
 * @param {{ projectDir: string, protoDir: string, protoId: string, proto: any, screenId: string, pid: string, lookup?: (componentId: string) => any }} input
 * @param {{ fs: any, path: any }} deps
 */
function resolveModularTraceability(input, deps) {
  const { protoDir, protoId, proto, pid, lookup } = input;
  const screens = Array.isArray(proto.screens) ? proto.screens : [];
  const screenId = input.screenId || proto.activeScreen || screens[0]?.id || "";
  const screen = screens.find((s) => s.id === screenId);
  if (!screen) throw new Error(`Tela '${screenId}' não encontrada no protótipo '${protoId}'.`);

  const screenFile = screen.file || `screens/${screenId}.html`;
  const abs = deps.path.join(protoDir, screenFile);
  if (!deps.fs.existsSync(abs)) throw new Error(`Arquivo da tela '${screenId}' não encontrado.`);

  const html = deps.fs.readFileSync(abs, "utf8");
  const range = findNodeRangeByPid(html, pid);
  if (!range) throw new Error(`Elemento '${pid}' não encontrado na tela '${screenId}'.`);

  const outer = html.slice(range.startIndex, range.endIndex);
  const attrs = parseAttrs(range.openTag);
  const classes = String(attrs.class || "").split(/\s+/).filter(Boolean);
  const entry = (Array.isArray(proto.components) ? proto.components : []).find((c) => c.pid === pid && (!c.screen || c.screen === screenId)) || null;
  const dsClass = classes.find((c) => /^ds-[a-z0-9]+(-[a-z0-9]+)*$/.test(c));
  const lookupIds = [dsClass && `dis.${dsClass.slice(3)}`, entry && `dis.${entry.id}`, entry?.id, attrs["data-component"]].filter(Boolean);
  let registered = null;
  for (const id of lookupIds) {
    registered = lookup ? lookup(id) : null;
    if (registered) break;
  }
  const componentId = registered?.meta?.id || registered?.manifest?.id || entry?.id || attrs["data-component"] || dsClass || classes.find((c) => !c.startsWith("px-")) || range.tagName;
  const sources = readSources(input.projectDir, registered?.components || [], deps);

  const cssFile = "styles/proto.css";
  const cssPath = deps.path.join(protoDir, cssFile);
  const css = deps.fs.existsSync(cssPath) ? deps.fs.readFileSync(cssPath, "utf8") : "";
  const cls = classFor(pid);
  const decls = Object.entries(readRule(css, cls)).map(([k, v]) => `  ${k}: ${v};`);
  const rule = decls.length ? `.${cls} {\n${decls.join("\n")}\n}` : "";

  const matched = matchedCssText([
    { label: "design/ds/components.css", file: deps.path.join(input.projectDir, "design", "ds", "components.css") },
    { label: "styles/proto.css", file: cssPath },
  ], classes.filter((c) => !c.startsWith("px-")), deps);

  return {
    protoId,
    screenId,
    nodeId: pid,
    node: {
      id: pid,
      componentId,
      label: range.tagName,
      props: attrs,
      bindings: {},
      events: {},
      childrenCount: (range.innerContent.match(/<[a-z]/gi) || []).length,
    },
    component: {
      id: componentId,
      name: entry?.name || registered?.meta?.name || registered?.manifest?.name || componentId,
      // extracted: virou componente no Ateliê; ds: usa componente do design system; none: só HTML + CSS
      source: entry ? "extracted" : registered ? "ds" : "none",
      stage: entry?.stage || "",
      isRegistered: Boolean(registered?.manifest || registered?.meta),
      registryMeta: registered?.meta || null,
      manifest: registered?.manifest || null,
    },
    sources: sources.byPath,
    codeSource: { react18: sources.react?.path || null, angular18: sources.angular?.path || null },
    files: {
      screen: screenFile,
      style: cssFile,
      manifest: registered?.manifestPath || null,
      registry: "design/ds/registry.json",
      components: registered?.components || [],
    },
    css: { className: cls, rule, matched },
    code: {
      vanilla: cleanHtml(outer),
      angular18: sources.angular?.text || cleanHtml(outer),
      react18: sources.react?.text || toJsx(cleanHtml(outer)),
    },
  };
}

const MAX_FILE = 20000;
const MAX_FILES = 16;

/** Lê o conteúdo dos arquivos do componente (limitado) e identifica o arquivo de entrada de React e Angular. */
function readSources(projectDir, files, deps) {
  const byPath = {};
  const entries = {};
  for (const f of files.slice(0, MAX_FILES)) {
    try {
      const text = deps.fs.readFileSync(deps.path.join(projectDir, f.path), "utf8");
      byPath[f.path] = text.length > MAX_FILE ? `${text.slice(0, MAX_FILE)}\n/* ... arquivo cortado ... */` : text;
    } catch { continue; }
    const key = String(f.framework).startsWith("angular") ? "angular" : String(f.framework).startsWith("react") ? "react" : null;
    if (key && f.entry && !entries[key]) entries[key] = { path: f.path, text: byPath[f.path] };
  }
  return { byPath, ...entries };
}

/** @param {string} openTag */
function parseAttrs(openTag) {
  const attrs = {};
  const re = /([a-zA-Z_:][\w:.-]*)(?:=(?:"([^"]*)"|'([^']*)'))?/g;
  const body = openTag.replace(/^<[a-zA-Z0-9_-]+/, "").replace(/\/?>$/, "");
  let m;
  while ((m = re.exec(body)) !== null) attrs[m[1]] = m[2] ?? m[3] ?? "";
  return attrs;
}

/** Remove atributos internos do Ateliê do trecho exibido. */
function cleanHtml(snippet) {
  return snippet.replace(/\sdata-(?:pid|node-id)=("[^"]*"|'[^']*')/gi, "");
}

/** Conversão superficial HTML -> JSX para a aba de código. */
function toJsx(snippet) {
  return snippet
    .replace(/\sclass=/g, " className=")
    .replace(/\sfor=/g, " htmlFor=")
    .replace(/<(img|input|br|hr)\b([^>]*?)\s*\/?>/gi, (_, t, rest) => `<${t}${rest} />`);
}

module.exports = { resolveModularTraceability };
