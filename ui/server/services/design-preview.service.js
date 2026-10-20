// @ts-check
const fs = require("fs");
const path = require("path");
const { getComponent } = require("./design-registry.service");

/**
 * Converte kebab-case para PascalCase.
 * @param {string} str
 */
function toPascalCase(str) {
  return str
    .replace(/(^\w|-\w)/g, (clear) => clear.replace("-", "").toUpperCase());
}

/**
 * Converte ID canônico (<namespace>.<kebab>) para pasta e nome de função.
 * @param {string} componentId
 */
function resolveComponentMeta(componentId) {
  const parts = componentId.split(".");
  const kebab = parts[parts.length - 1];
  const pascal = toPascalCase(kebab);
  return {
    kebab,
    pascal,
    functionName: `render${pascal}`,
    folderName: kebab,
  };
}

/**
 * Gera as props padrão ou de fallback para demonstração do componente.
 * @param {any} comp
 * @param {object} [customProps]
 */
function buildDemoProps(comp, customProps = {}) {
  const defaults = {};
  if (comp.props && typeof comp.props === "object") {
    for (const [key, def] of Object.entries(comp.props)) {
      if (def && def.default !== undefined) {
        defaults[key] = def.default;
      }
    }
  }

  // Fallbacks ricos para os componentes base do DIS
  if (comp.id === "dis.annotation-list") {
    defaults.items = [
      { date: "15/05/2026", text: "Paciente orientado sobre horários da medicação.", source: "Farmacêutico" },
      { date: "10/05/2026", text: "Retorno agendado para reavaliação clínica.", source: "Clínico Geral" }
    ];
    defaults.defaultOpenIndex = 0;
  } else if (comp.id === "dis.accordion") {
    defaults.items = [
      { title: "Instruções de Posologia", content: "Tomar 1 comprimido pela manhã em jejum.", defaultOpen: true },
      { title: "Contraindicações", content: "Não ingerir com bebidas alcoólicas.", defaultOpen: false }
    ];
  } else if (comp.id === "dis.button") {
    defaults.label = defaults.label || "Confirmar Ação";
    defaults.emphasis = defaults.emphasis || "primary";
  } else if (comp.id === "dis.icon") {
    defaults.name = defaults.name || "circle-info";
    defaults.size = defaults.size || 24;
  }

  return { ...defaults, ...customProps };
}

/**
 * Coleta todo o CSS de tokens, temas, dependências e do próprio componente.
 * @param {string} projectDir
 * @param {any} comp
 */
function collectComponentStyles(projectDir, comp) {
  const dsDir = path.join(projectDir, "design", "ds");
  const cssParts = [];

  // 1. Tokens e Tema
  const tokensFile = path.join(dsDir, "tokens.css");
  if (fs.existsSync(tokensFile)) cssParts.push(fs.readFileSync(tokensFile, "utf8"));

  const themeFile = path.join(dsDir, "theme.css");
  if (fs.existsSync(themeFile)) cssParts.push(fs.readFileSync(themeFile, "utf8"));

  // 2. CSS de dependências
  const deps = comp.dependencies || [];
  for (const depId of deps) {
    const depMeta = resolveComponentMeta(depId);
    const depCss = path.join(dsDir, "components", depMeta.folderName, `${depMeta.kebab}.css`);
    if (fs.existsSync(depCss)) {
      cssParts.push(fs.readFileSync(depCss, "utf8"));
    }
  }

  // 3. CSS do próprio componente
  const meta = resolveComponentMeta(comp.id);
  const ownCss = path.join(dsDir, "components", meta.folderName, `${meta.kebab}.css`);
  if (fs.existsSync(ownCss)) {
    cssParts.push(fs.readFileSync(ownCss, "utf8"));
  }

  return cssParts.join("\n\n");
}

/**
 * Renderiza uma página HTML sandbox isolada para testar o componente.
 * @param {string} projectDir
 * @param {string} componentId
 * @param {object} [customProps]
 */
function renderComponentPreview(projectDir, componentId, customProps = {}) {
  const comp = getComponent(projectDir, componentId);
  if (!comp) {
    throw new Error(`Componente '${componentId}' não encontrado.`);
  }

  const meta = resolveComponentMeta(comp.id);
  const styles = collectComponentStyles(projectDir, comp);
  const props = buildDemoProps(comp, customProps);
  const dsDir = path.join(projectDir, "design", "ds");

  // Código JS de dependências e componente
  const jsParts = [];
  const deps = comp.dependencies || [];
  for (const depId of deps) {
    const depMeta = resolveComponentMeta(depId);
    const depJs = path.join(dsDir, "components", depMeta.folderName, `${depMeta.kebab}.js`);
    if (fs.existsSync(depJs)) {
      let content = fs.readFileSync(depJs, "utf8");
      content = content.replace(/^import\s+.*?;\s*$/gm, "");
      content = content.replace(/^export\s+/gm, "");
      jsParts.push(content);
    }
  }

  const ownJs = path.join(dsDir, "components", meta.folderName, `${meta.kebab}.js`);
  if (fs.existsSync(ownJs)) {
    let content = fs.readFileSync(ownJs, "utf8");
    content = content.replace(/^import\s+.*?;\s*$/gm, "");
    content = content.replace(/^export\s+/gm, "");
    jsParts.push(content);
  }

  const combinedJs = jsParts.join("\n\n");
  const propsJson = JSON.stringify(props, null, 2);

  return `<!DOCTYPE html>
<html lang="pt-BR" class="sistemas">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preview: ${comp.name} (${comp.id})</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;600;700;800&family=Noto+Sans+Display:wght@600;700;800&display=swap">
  <style>
    body {
      margin: 0;
      padding: 24px;
      background-color: var(--neutral-background, #f7f9fa);
      font-family: var(--font-sans, "Noto Sans", sans-serif);
      color: var(--neutral-body, #212529);
    }
    .preview-card {
      background: #ffffff;
      border: 1px solid var(--neutral-light, #e0e0e0);
      border-radius: 4px;
      padding: 24px;
      max-width: 800px;
      margin: 0 auto;
      box-shadow: 0 2px 8px rgba(0,0,0,0.06);
    }
    .preview-header {
      border-bottom: 1px solid var(--neutral-light, #e0e0e0);
      padding-bottom: 12px;
      margin-bottom: 20px;
    }
    .preview-title {
      margin: 0 0 4px;
      font-size: 1.125rem;
      font-weight: 700;
      color: var(--primary-headings, #1d3374);
    }
    .preview-badge {
      display: inline-block;
      font-size: 11px;
      font-family: monospace;
      color: var(--primary-interactive, #4264cd);
      background: var(--blue-5, #ebf2ff);
      padding: 2px 6px;
      border-radius: 3px;
    }
    ${styles}
  </style>
</head>
<body>
  <div class="preview-card">
    <div class="preview-header">
      <h1 class="preview-title">${comp.name}</h1>
      <span class="preview-badge">${comp.id} • ${comp.category}</span>
    </div>
    <div id="preview-root" class="ds"></div>
  </div>

  <script>
    (function () {
      ${combinedJs}

      const root = document.getElementById("preview-root");
      const props = ${propsJson};
      if (typeof ${meta.functionName} === "function") {
        ${meta.functionName}(root, props);
      } else {
        root.innerHTML = "<p style='color:red;'>Erro: Função '${meta.functionName}' não encontrada.</p>";
      }
    })();
  </script>
</body>
</html>`;
}

module.exports = {
  renderComponentPreview,
  buildDemoProps,
  resolveComponentMeta,
  collectComponentStyles,
};
