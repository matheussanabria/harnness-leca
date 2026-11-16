// @ts-check
// Empacota o codigo real do mapa em camadas do Harness (modulos e CSS) com os dados embutidos, num HTML unico.
// Usa o Vite que ja esta no repositorio; o iframe do prototipo troca o src por srcdoc so neste bundle.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { ROOT } = require("./config");

const PUB = path.join(ROOT, "ui", "public").split(path.sep).join("/");
const IFRAME_FROM = 'src="${esc(url)}" sandbox="allow-scripts" loading="lazy"';
const IFRAME_TO = "srcdoc=\"${esc(window.__PROTOS__[sc.prototype.screen] || '')}\" sandbox=\"allow-scripts\"";

const srcdocPlugin = {
  name: "proto-srcdoc",
  transform(code, id) {
    if (!id.includes("layers-screen-replica-proto.js")) return null;
    if (!code.includes(IFRAME_FROM)) {
      throw new Error("pacote-revisao: o trecho do iframe mudou em layers-screen-replica-proto.js; ajuste map-bundle.js");
    }
    return code.replace(IFRAME_FROM, () => IFRAME_TO);
  },
};

/**
 * Mermaid for the diagrams of the embedded documentation. The package opens from file:// with no server, so the
 * library (the exact version pinned in package.json) goes inline; only when some embedded document has a diagram.
 * @param {any} docs embedded documentation (docs-data.js) or null
 * @returns {string} a <script> tag, or ""
 */
function mermaidScript(docs) {
  const files = (docs && docs.files) || {};
  if (!Object.values(files).some((text) => /^\s*```\s*mermaid\b/im.test(String(text)))) return "";
  const lib = require.resolve("mermaid/dist/mermaid.min.js", { paths: [ROOT] });
  return `<script>${fs.readFileSync(lib, "utf8").replace(/<\/script/gi, "<\\/script")}</script>`;
}

const BAR_CSS = [
  "html,body{height:auto;overflow:auto}body{margin:0;background:var(--bg,#0f1420)}#designViewContainer{padding:12px 16px 40px}",
  ".retrato-bar{position:sticky;top:0;z-index:50;display:flex;gap:12px;align-items:center;flex-wrap:wrap;background:#171e2e;border-bottom:1px solid #2c3853;padding:8px 16px;font:13px system-ui,sans-serif;color:#9aa7c2}",
  ".retrato-bar .voltar{display:inline-flex;align-items:center;gap:8px;background:#1f56c4;color:#fff;text-decoration:none;font-weight:600;border-radius:8px;padding:7px 14px}",
  ".retrato-bar .voltar:hover{background:#2a66dd}.retrato-bar .voltar:focus-visible{outline:2px solid #7db0ff;outline-offset:2px}",
].join("\n");

/**
 * @param {{ geradoEm: string, screensData: any, protos: Record<string,string> }} map
 * @param {{ slug: string, boardFile: string }} opts
 * @returns {Promise<string>} HTML completo
 */
async function renderMapHtml(map, { slug, boardFile }) {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "pacote-mapa-"));
  try {
    const docs = map.docs ? map.docs.data : null;
    fs.writeFileSync(path.join(work, "static-data.json"), JSON.stringify({ slug, geradoEm: map.geradoEm, screensData: map.screensData, protos: map.protos, docs }));
    const entry = fs.readFileSync(path.join(__dirname, "map-entry.template.js"), "utf8").replace(/__PUB__/g, () => PUB);
    fs.writeFileSync(path.join(work, "entry.js"), entry);
    const { build } = await import("vite");
    await build({
      configFile: false, root: work, logLevel: "warn", plugins: [srcdocPlugin], server: { fs: { strict: false } },
      build: {
        outDir: path.join(work, "dist"), emptyOutDir: true, cssCodeSplit: false, minify: true,
        lib: { entry: path.join(work, "entry.js"), formats: ["iife"], name: "MapaEstatico", fileName: () => "mapa.js", cssFileName: "mapa" },
      },
    });
    const css = fs.readFileSync(path.join(work, "dist", "mapa.css"), "utf8").replace(/<\/style/gi, "<\\/style");
    const js = fs.readFileSync(path.join(work, "dist", "mapa.js"), "utf8").replace(/<\/script/gi, "<\\/script");
    const dia = new Date(map.geradoEm).toLocaleDateString("pt-BR");
    return [
      '<!doctype html>',
      '<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">',
      "<title>Mapa em camadas (retrato)</title>",
      '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">',
      `<style>${css}</style><style>${BAR_CSS}</style></head>`,
      "<body>",
      `<nav class="retrato-bar" aria-label="Navegação do pacote"><a class="voltar" href="${boardFile}"><i class="fa-solid fa-arrow-left" aria-hidden="true"></i> Voltar ao quadro de histórias</a><span><i class="fa-solid fa-camera" aria-hidden="true"></i> Retrato de ${dia}, sem o Harness</span></nav>`,
      '<div id="designViewContainer"></div>',
      mermaidScript(docs),
      `<script>${js}</script>`,
      "</body></html>",
    ].join("\n");
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

module.exports = { renderMapHtml, mermaidScript };
