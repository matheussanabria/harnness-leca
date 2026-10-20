// @ts-check
const fs = require("fs");
const path = require("path");
const { registerComponent, registerImplementation } = require("./design-registry.service");

/**
 * Converte PascalCase para kebab-case.
 * @param {string} str
 */
function toKebab(str) {
  return str
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .toLowerCase();
}

/**
 * Extrai regras CSS do HTML do Design System que correspondam aos seletores ou classes do componente.
 * @param {string} htmlContent
 * @param {string[]} classNames
 */
function extractCssRulesForClasses(htmlContent, classNames) {
  const stylesMatches = htmlContent.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) || [];
  const allCss = stylesMatches.map((m) => m.replace(/<\/?style[^>]*>/gi, "")).join("\n");

  const rules = [];
  for (const cls of classNames) {
    const escapedCls = cls.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(^|\\n|\\})([^\\{]*\\.${escapedCls}[^\\{]*)\\{([^\\}]*)\\}`, "g");
    let match;
    while ((match = regex.exec(allCss)) !== null) {
      const selector = match[2].trim();
      const body = match[3].trim();
      rules.push(`${selector} {\n  ${body}\n}`);
    }
  }

  // Deduplica regras
  return Array.from(new Set(rules)).join("\n\n");
}

/**
 * Extrai o código fonte da função de um componente no bundle do Design System.
 * @param {string} htmlContent
 * @param {string} componentName
 */
function extractComponentFunction(htmlContent, componentName) {
  const regex = new RegExp(`function\\s+${componentName}\\s*\\(([^)]*)\\)\\s*\\{([\\s\\S]*?)\\n\\s{2}\\}`, "m");
  const match = htmlContent.match(regex);
  if (!match) return null;
  return {
    params: match[1].trim(),
    body: match[2].trim(),
    full: match[0],
  };
}

/**
 * Extrai e modulariza o componente AnnotationList como piloto oficial da F1.
 * @param {string} projectDir
 * @param {object} [deps]
 */
function extractAnnotationListPilot(projectDir, deps = { fs, path }) {
  const dsFile = deps.path.join(projectDir, "design", "dis-design-system.html");
  if (!deps.fs.existsSync(dsFile)) {
    throw new Error(`Arquivo do Design System não encontrado: ${dsFile}`);
  }
  const htmlContent = deps.fs.readFileSync(dsFile, "utf8");

  const compFn = extractComponentFunction(htmlContent, "AnnotationList");
  const css = extractCssRulesForClasses(htmlContent, ["dis-notes", "dis-notes__src"]);

  const compDir = deps.path.join(projectDir, "design", "ds", "components", "annotation-list");
  if (!deps.fs.existsSync(compDir)) {
    deps.fs.mkdirSync(compDir, { recursive: true });
  }

  const manifest = {
    id: "dis.annotation-list",
    version: "1.0.0",
    name: "Lista de Anotações",
    category: "data-display",
    description: "Exibe uma lista expansível de anotações clínicas com data, texto e fonte.",
    props: {
      items: {
        name: "items",
        type: "array",
        description: "Lista de anotações com date, text e source opcional.",
        default: [],
        required: true,
      },
      defaultOpenIndex: {
        name: "defaultOpenIndex",
        type: "number",
        description: "Índice do item aberto por padrão.",
        default: 0,
        required: false,
      },
    },
    slots: {},
    events: {},
    tokensUsed: ["--font-sans", "--neutral-body", "--neutral-dark", "--neutral-light"],
    dependencies: ["dis.accordion", "dis.icon"],
    implementations: {
      vanilla: {
        framework: "vanilla",
        entryFile: "annotation-list.html",
        files: ["annotation-list.html", "annotation-list.css", "annotation-list.js"],
        dependencies: ["dis.accordion"],
        styles: ["annotation-list.css"],
        status: "available",
      },
      react: {
        framework: "react",
        entryFile: "annotation-list.jsx",
        files: ["annotation-list.jsx"],
        dependencies: ["react", "dis.accordion"],
        status: "available",
      },
      angular: null,
    },
  };

  const htmlContentComp = `
<div class="dis-notes" data-component="dis.annotation-list">
  <div class="dis-accordion dis-accordion--sm" id="annotationAccordion">
    <!-- Itens renderizados dinamicamente pelo script -->
  </div>
</div>
`.trim();

  const jsContent = `
/**
 * Componente Vanilla AnnotationList
 * @param {HTMLElement} container
 * @param {{ items: Array<{ date: string, text: string, source?: string }>, defaultOpenIndex?: number }} props
 */
export function renderAnnotationList(container, props) {
  const items = props.items || [];
  const defaultOpen = props.defaultOpenIndex ?? 0;

  const html = items.map((item, idx) => {
    const isOpen = idx === defaultOpen;
    return \`
      <div class="dis-accordion__item \${isOpen ? 'is-open' : ''}" data-index="\${idx}">
        <button type="button" class="dis-accordion__header">
          <span class="dis-accordion__title">\${item.date}</span>
          <i class="fa-solid fa-chevron-down dis-accordion__icon"></i>
        </button>
        <div class="dis-accordion__content" \${isOpen ? '' : 'hidden'}>
          <div class="dis-accordion__body">
            \${item.text}
            \${item.source ? \`<span class="dis-notes__src">\${item.source}</span>\` : ''}
          </div>
        </div>
      </div>
    \`;
  }).join('');

  container.innerHTML = \`<div class="dis-notes">\${html}</div>\`;

  container.querySelectorAll('.dis-accordion__header').forEach((btn) => {
    btn.addEventListener('click', () => {
      const itemEl = btn.closest('.dis-accordion__item');
      if (!itemEl) return;
      const content = itemEl.querySelector('.dis-accordion__content');
      const isNowOpen = itemEl.classList.toggle('is-open');
      if (content) content.hidden = !isNowOpen;
    });
  });
}
`.trim();

  deps.fs.writeFileSync(deps.path.join(compDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
  deps.fs.writeFileSync(deps.path.join(compDir, "annotation-list.html"), htmlContentComp, "utf8");
  deps.fs.writeFileSync(deps.path.join(compDir, "annotation-list.css"), css || "/* Estilos isolados do AnnotationList */\n.dis-notes { margin: 8px 0; }\n.dis-notes__src { display: block; font-size: 12px; color: var(--neutral-dark, #666); margin-top: 4px; }", "utf8");
  deps.fs.writeFileSync(deps.path.join(compDir, "annotation-list.js"), jsContent, "utf8");

  // Registra no Registry oficial
  registerComponent(projectDir, manifest, deps);
  return manifest;
}

module.exports = {
  toKebab,
  extractComponentFunction,
  extractCssRulesForClasses,
  extractAnnotationListPilot,
};
