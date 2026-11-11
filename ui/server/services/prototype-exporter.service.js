// @ts-check
const fs = require("fs");
const path = require("path");
const { getPrototypesBaseDir } = require("./prototype-storage.service");
const { generateRuntimeJs } = require("./prototype-exporter-runtime.service");
const { loadSandboxAssets } = require("./prototype-sandbox-common.service");

/** Above this many screens the top bar switches from one tab per screen to a picker with previous/next. */
const MAX_TABS = 8;

/**
 * Compila o protótipo inteiro em um único arquivo HTML autocontido e offline.
 * @param {string} projectDir
 * @param {string} repoRoot
 * @param {string} protoId
 * @param {object} context
 * @param {object} [deps]
 */
function compileSingleHtmlPrototype(projectDir, repoRoot, protoId, context, deps = { fs, path }) {
  const baseDir = getPrototypesBaseDir(projectDir, deps);
  const protoDir = deps.path.join(baseDir, protoId);

  if (!deps.fs.existsSync(protoDir)) {
    throw new Error(`Protótipo '${protoId}' não encontrado.`);
  }

  const protoJsonFile = deps.path.join(protoDir, "proto.json");
  let protoJson = { id: protoId, title: protoId, screens: [{ id: "home", file: "screens/home.html" }] };
  if (deps.fs.existsSync(protoJsonFile)) {
    try { protoJson = JSON.parse(deps.fs.readFileSync(protoJsonFile, "utf8")); } catch {}
  }

  // Mesmos ativos do preview do Ateliê: tokens, tema, CSS dos componentes, estilos do protótipo e head.html (fontes).
  const assets = loadSandboxAssets(projectDir, protoDir, deps);
  const protoCss = assets.protoCss;
  const themeCss = assets.themeCss;
  const dsComponentsCss = protoJson?.metadata?.dsComponents ? assets.componentsCss : "";
  const headHtml = assets.headHtml;

  // Tokens do Design System: os do projeto (design/ds) primeiro; o perfil do repositório é o plano B.
  const tokensRel = context?.profile?.designSystem?.tokensCss || "";
  let tokensCss = assets.tokensCss;
  if (!tokensCss && tokensRel && repoRoot) {
    const fullTokens = deps.path.resolve(repoRoot, tokensRel);
    if (deps.fs.existsSync(fullTokens)) {
      try { tokensCss = deps.fs.readFileSync(fullTokens, "utf8"); } catch {}
    }
  }

  // Compila todas as telas
  const screens = protoJson.screens || [{ id: "home", title: "Início", file: "screens/home.html" }];
  const screenSections = [];
  const tabButtons = [];
  const screenOptions = [];
  const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  for (let i = 0; i < screens.length; i++) {
    const sc = screens[i];
    const screenPath = deps.path.join(protoDir, sc.file || `screens/${sc.id}.html`);
    let content = `<p>Tela ${sc.id} não encontrada.</p>`;
    if (deps.fs.existsSync(screenPath)) {
      try { content = deps.fs.readFileSync(screenPath, "utf8"); } catch {}
    }

    const isFirst = i === 0;
    tabButtons.push(`
      <button type="button" class="tab-btn ${isFirst ? 'active' : ''}" data-screen="${sc.id}" onclick="showScreen('${sc.id}')">${sc.title || sc.id}</button>
    `);
    screenOptions.push(`<option value="${sc.id}"${isFirst ? " selected" : ""}>${escapeHtml(sc.title || sc.id)}</option>`);

    screenSections.push(`
      <section id="screen-${sc.id}" class="proto-screen-panel" style="display:${isFirst ? 'block' : 'none'}">
        ${content}
      </section>
    `);
  }

  const singleHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${protoJson.title || protoId} — Protótipo Autocontido</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" />
  <style id="dsTokensStyle">
${tokensCss}
${themeCss}
  </style>
  ${dsComponentsCss ? `<style id="dsComponentsStyle">${dsComponentsCss}</style>` : ""}
  ${headHtml}
  <style id="protoCustomStyle">
${protoCss}
  </style>
  <style id="singleHtmlRuntimeStyle">
    /* No body colors or font here: the prototype and design-system CSS own them (dark theme included). */
    body { margin: 0; }
    .offline-nav-bar { position: sticky; top: 0; z-index: 9999; display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; background: #0f172a; color: #fff; padding: 8px 16px; border-bottom: 1px solid #334155; }
    .offline-nav-title { font-weight: 700; font-size: 13px; color: #60a5fa; }
    .offline-nav-tabs { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
    .screen-select { min-width: 200px; max-width: 60vw; background: #1e293b; color: #e2e8f0; border: 1px solid #334155; border-radius: 4px; padding: 4px 8px; font-size: 12px; }
    .tab-btn:disabled { opacity: 0.4; cursor: default; }
    @media (max-width: 640px) { .tab-btn, .screen-select { min-height: 44px; } }
    .tab-btn { background: #1e293b; color: #94a3b8; border: 1px solid #334155; padding: 4px 10px; border-radius: 4px; font-size: 11px; cursor: pointer; }
    .tab-btn.active { background: #2563eb; color: #fff; font-weight: 600; border-color: #2563eb; }
    .proto-screen-panel { min-height: 80vh; }
  </style>
</head>
<body>
  <nav class="offline-nav-bar">
    <div class="offline-nav-title">${protoJson.title || protoId} (v${protoJson.version || 1})</div>
    <div class="offline-nav-tabs">
      ${screens.length > MAX_TABS
        ? `<button type="button" id="screenPrev" class="tab-btn" onclick="showRelativeScreen(-1)" aria-label="Tela anterior">&lsaquo;</button>
      <select id="screenSelect" class="screen-select" aria-label="Tela" onchange="showScreen(this.value)">${screenOptions.join("")}</select>
      <button type="button" id="screenNext" class="tab-btn" onclick="showRelativeScreen(1)" aria-label="Próxima tela">&rsaquo;</button>`
        : tabButtons.join("\n")}
    </div>
  </nav>

  <main>
    ${screenSections.join("\n")}
  </main>

  <script>${generateRuntimeJs(screens.map((sc) => sc.id))}</script>
</body>
</html>`;

  return singleHtml;
}

module.exports = {
  compileSingleHtmlPrototype,
};
