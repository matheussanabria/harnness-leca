// @ts-check
const fs = require("fs");
const path = require("path");
const { getPrototypesBaseDir } = require("./prototype-storage.service");

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

  // Estilos do protótipo
  const protoCssFile = deps.path.join(protoDir, "styles", "proto.css");
  let protoCss = "";
  if (deps.fs.existsSync(protoCssFile)) {
    try { protoCss = deps.fs.readFileSync(protoCssFile, "utf8"); } catch {}
  }

  // Tokens do Design System
  const tokensRel = context?.profile?.designSystem?.tokensCss || "";
  let tokensCss = "";
  if (tokensRel && repoRoot) {
    const fullTokens = deps.path.resolve(repoRoot, tokensRel);
    if (deps.fs.existsSync(fullTokens)) {
      try { tokensCss = deps.fs.readFileSync(fullTokens, "utf8"); } catch {}
    }
  }

  // Compila todas as telas
  const screens = protoJson.screens || [{ id: "home", title: "Início", file: "screens/home.html" }];
  const screenSections = [];
  const tabButtons = [];

  for (let i = 0; i < screens.length; i++) {
    const sc = screens[i];
    const screenPath = deps.path.join(protoDir, sc.file || `screens/${sc.id}.html`);
    let content = `<p>Tela ${sc.id} não encontrada.</p>`;
    if (deps.fs.existsSync(screenPath)) {
      try { content = deps.fs.readFileSync(screenPath, "utf8"); } catch {}
    }

    const isFirst = i === 0;
    tabButtons.push(`
      <button type="button" class="tab-btn ${isFirst ? 'active' : ''}" onclick="showScreen('${sc.id}')">${sc.title || sc.id}</button>
    `);

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
  <style id="dsTokensStyle">
${tokensCss}
  </style>
  <style id="protoCustomStyle">
${protoCss}
  </style>
  <style id="singleHtmlRuntimeStyle">
    body { margin: 0; font-family: system-ui, -apple-system, sans-serif; background: #f8fafc; color: #1e293b; }
    .offline-nav-bar { display: flex; align-items: center; justify-content: space-between; background: #0f172a; color: #fff; padding: 8px 16px; border-bottom: 1px solid #334155; }
    .offline-nav-title { font-weight: 700; font-size: 13px; color: #60a5fa; }
    .offline-nav-tabs { display: flex; gap: 6px; }
    .tab-btn { background: #1e293b; color: #94a3b8; border: 1px solid #334155; padding: 4px 10px; border-radius: 4px; font-size: 11px; cursor: pointer; }
    .tab-btn.active { background: #2563eb; color: #fff; font-weight: 600; border-color: #2563eb; }
    .proto-screen-panel { padding: 16px; min-height: 80vh; }
  </style>
</head>
<body>
  <nav class="offline-nav-bar">
    <div class="offline-nav-title">🎨 ${protoJson.title || protoId} (v${protoJson.version || 1})</div>
    <div class="offline-nav-tabs">
      ${tabButtons.join("\n")}
    </div>
  </nav>

  <main>
    ${screenSections.join("\n")}
  </main>

  <script>
    function showScreen(screenId) {
      document.querySelectorAll('.proto-screen-panel').forEach(function(el) {
        el.style.display = 'none';
      });
      document.querySelectorAll('.tab-btn').forEach(function(btn) {
        btn.classList.remove('active');
        if (btn.getAttribute('onclick').includes("'" + screenId + "'")) btn.classList.add('active');
      });
      var active = document.getElementById('screen-' + screenId);
      if (active) active.style.display = 'block';
    }

    document.addEventListener('click', function(e) {
      var actionEl = e.target.closest('[data-action]');
      if (actionEl) {
        var action = actionEl.getAttribute('data-action') || '';
        if (action.startsWith('goto:')) {
          e.preventDefault();
          showScreen(action.replace(/^goto:/, '').trim());
        }
      }
    });
  </script>
</body>
</html>`;

  return singleHtml;
}

module.exports = {
  compileSingleHtmlPrototype,
};
