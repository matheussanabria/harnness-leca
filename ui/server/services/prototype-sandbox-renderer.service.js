// @ts-check
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { getPrototypesBaseDir } = require("./prototype-storage.service");

/**
 * Carrega estilos auxiliares e de tokens para o sandbox.
 * @param {string} projectDir
 * @param {string} protoDir
 * @param {object} deps
 * @returns {{ tokensCss: string, themeCss: string, componentsCss: string, protoCss: string, headHtml: string }}
 */
function loadSandboxAssets(projectDir, protoDir, deps) {
  let tokensCss = "";
  let themeCss = "";
  let componentsCss = "";
  let protoCss = "";
  let headHtml = "";

  const dsDir = deps.path.join(projectDir, "design", "ds");
  const tokensFile = deps.path.join(dsDir, "tokens.css");
  const themeFile = deps.path.join(dsDir, "theme.css");

  if (deps.fs.existsSync(tokensFile)) {
    try { tokensCss = deps.fs.readFileSync(tokensFile, "utf8"); } catch {}
  }
  if (deps.fs.existsSync(themeFile)) {
    try { themeCss = deps.fs.readFileSync(themeFile, "utf8"); } catch {}
  }

  const componentsFile = deps.path.join(dsDir, "components.css");
  if (deps.fs.existsSync(componentsFile)) {
    try { componentsCss = deps.fs.readFileSync(componentsFile, "utf8"); } catch {}
  }

  const protoCssFile = deps.path.join(protoDir, "styles", "proto.css");
  if (deps.fs.existsSync(protoCssFile)) {
    try { protoCss = deps.fs.readFileSync(protoCssFile, "utf8"); } catch {}
  }

  const headFile = deps.path.join(protoDir, "head.html");
  if (deps.fs.existsSync(headFile)) {
    try { headHtml = deps.fs.readFileSync(headFile, "utf8"); } catch {}
  }

  return { tokensCss, themeCss, componentsCss, protoCss, headHtml };
}

/** Scripts da ponte, na ordem de execução: medidas/prévia, ponte principal e arrastar para reordenar. */
const BRIDGE_FILES = ["prototype-bridge-props.js", "prototype-bridge.js", "prototype-bridge-drag.js"];

/**
 * Lê os scripts da ponte de comunicação do harness e os junta em um único bloco.
 * @param {object} deps
 * @returns {string}
 */
function loadBridgeScript(deps) {
  const dir = deps.path.resolve(__dirname, "..", "..", "public", "js", "modules");
  return BRIDGE_FILES.map((name) => {
    const file = deps.path.join(dir, name);
    if (!deps.fs.existsSync(file)) return "";
    try { return deps.fs.readFileSync(file, "utf8"); } catch { return ""; }
  }).filter(Boolean).join("\n;\n");
}

/**
 * Renderiza uma tela de protótipo em sandbox iframe isolada e segura.
 * @param {string} projectDir
 * @param {string} repoRoot
 * @param {string} protoId
 * @param {string} screenId
 * @param {object} [options]
 * @param {object} [deps]
 */
function renderSandboxScreen(projectDir, repoRoot, protoId, screenId, options = {}, deps = { fs, path }) {
  const baseDir = getPrototypesBaseDir(projectDir, deps);
  const protoDir = deps.path.join(baseDir, protoId);

  if (!deps.fs.existsSync(protoDir)) {
    return { ok: false, status: 404, error: `Protótipo '${protoId}' não encontrado.` };
  }

  let protoManifest = null;
  const protoJsonFile = deps.path.join(protoDir, "proto.json");
  if (deps.fs.existsSync(protoJsonFile)) {
    try {
      protoManifest = JSON.parse(deps.fs.readFileSync(protoJsonFile, "utf8"));
    } catch {}
  }

  const targetScreen = screenId || protoManifest?.screens?.[0]?.id || "home";
  const screenFile = deps.path.join(protoDir, "screens", `${targetScreen}.html`);
  if (!deps.fs.existsSync(screenFile)) {
    return { ok: false, status: 404, error: `Tela '${targetScreen}' não encontrada no protótipo '${protoId}'.` };
  }

  const screenHtml = deps.fs.readFileSync(screenFile, "utf8");
  const { tokensCss, themeCss, componentsCss, protoCss, headHtml } = loadSandboxAssets(projectDir, protoDir, deps);
  // CSS dos componentes do DS só entra em protótipos que pedem (metadata.dsComponents), para não afetar os antigos.
  const dsComponentsStyle = protoManifest?.metadata?.dsComponents && componentsCss ? `<style id="dsComponentsStyle">${componentsCss}</style>\n  ` : "";
  const bridgeScript = loadBridgeScript(deps);

  const nonce = crypto.randomBytes(16).toString("hex");

  // Garante que tags <script> tenham o nonce correto
  const applyNonce = (html) => html.replace(/<script\b(?![^>]*\bnonce\s*=)([^>]*)>/gi, `<script nonce="${nonce}"$1>`);

  const safeHeadHtml = applyNonce(headHtml);
  const safeScreenHtml = applyNonce(screenHtml);

  const fullHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${protoManifest?.name || protoId} - ${targetScreen}</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" />
  <style id="dsTokensStyle">${tokensCss}\n${themeCss}</style>
  ${dsComponentsStyle}<style id="protoCustomStyle">${protoCss}</style>
  <style id="harnessBridgeStyle">
    [data-node-id], [data-pid] { transition: outline 0.15s ease-in-out; cursor: pointer; }
    [data-node-id]:hover, [data-pid]:hover { outline: 1px dashed rgba(59, 130, 246, 0.7); outline-offset: 1px; }
    .harness-highlight { outline: 2px solid #2563eb !important; outline-offset: 2px !important; }
  </style>
  ${safeHeadHtml}
</head>
<body data-proto="${protoId}" data-screen="${targetScreen}" data-version="${protoManifest?.version || "1.0.0"}">
${safeScreenHtml}
  <script nonce="${nonce}">${bridgeScript}</script>
</body>
</html>`;

  const cspHeader = [
    "default-src 'none'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com",
    "font-src 'self' data: https://fonts.gstatic.com https://cdnjs.cloudflare.com",
    "img-src 'self' data: blob:",
    `script-src 'self' https://cdnjs.cloudflare.com 'nonce-${nonce}' 'unsafe-eval'`,
    "connect-src 'none'",
    "frame-src 'none'",
  ].join("; ");

  return {
    ok: true,
    status: 200,
    html: fullHtml,
    nonce,
    manifest: protoManifest,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": cspHeader,
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "SAMEORIGIN",
    },
  };
}

module.exports = {
  renderSandboxScreen,
  loadSandboxAssets,
  loadBridgeScript,
};
