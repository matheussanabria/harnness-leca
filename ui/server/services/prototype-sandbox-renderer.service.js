// @ts-check
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { getPrototypesBaseDir } = require("./prototype-storage.service");
const { loadSandboxAssets, loadBridgeScript, buildSandboxHeaders } = require("./prototype-sandbox-common.service");
const { renderDcScreen } = require("./prototype-sandbox-dc.service");

/**
 * Renderiza uma tela de protótipo em sandbox iframe isolada e segura.
 * Protótipos com metadata.runtime === "dc" (importados de .dc.html) seguem pelo ramo DC.
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

  if (protoManifest?.metadata?.runtime === "dc") {
    return renderDcScreen(projectDir, protoDir, protoId, protoManifest, screenId, deps);
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

  return {
    ok: true,
    status: 200,
    html: fullHtml,
    nonce,
    manifest: protoManifest,
    headers: buildSandboxHeaders(nonce),
  };
}

module.exports = {
  renderSandboxScreen,
  loadSandboxAssets,
  loadBridgeScript,
};
