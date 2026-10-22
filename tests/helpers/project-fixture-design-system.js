// @ts-check
const path = require("node:path");
const { writeText, writeJson, longText } = require("./project-fixture-files");

const TOKENS = `:root {
  --pure-0: #ffffff;
  --pure-100: #000000;
  --blue-1: #f5f8ff;
  --blue-5: #ebf2ff;
  --blue-20: #c7d7fb;
  --blue-60: #4264cd;
  --blue-80: #1d3374;
  --neutral-0: #ffffff;
  --neutral-5: #f7f9fa;
  --neutral-20: #e0e0e0;
  --neutral-60: #6b7280;
  --neutral-90: #212529;
  --font-sans: "Noto Sans", sans-serif;
  --font-display: "Noto Sans Display", sans-serif;
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 32px;
  --radius-1: 3px;
  --radius-2: 4px;
  --radius-3: 8px;
  --shadow-1: 0 1px 3px rgba(0, 0, 0, 0.08);
  --shadow-2: 0 2px 8px rgba(0, 0, 0, 0.12);
}
/* ${longText("token de apoio", 12)} */
`;

const THEME = `:root {
  --primary-interactive: var(--blue-60);
  --primary-headings: var(--blue-80);
  --primary-surface: var(--blue-5);
  --neutral-body: var(--neutral-90);
  --neutral-light: var(--neutral-20);
  --neutral-dark: var(--neutral-60);
  --neutral-background: var(--neutral-5);
  --highlight-focus: var(--blue-60);
  --highlight-danger: #b42318;
  --highlight-success: #067647;
  --highlight-warning: #b54708;
  --text-on-primary: var(--pure-0);
}
/* ${longText("mapeamento semantico", 12)} */
`;

const COMPONENTS_CSS = `.ds-button { display: inline-flex; align-items: center; gap: var(--space-2); }
.ds-accordion { border: 1px solid var(--neutral-light); border-radius: var(--radius-2); }
.dis-notes { display: block; color: var(--neutral-body); margin: var(--space-2) 0; }
.dis-notes__src { display: block; font-size: 12px; color: var(--neutral-dark); margin-top: var(--space-1); }
`;

function componentManifest(id, name, category, dependencies, files, tokensUsed) {
  return {
    id,
    version: "1.0.0",
    name,
    category,
    description: `${name} do Design System de fixture.`,
    props: {},
    slots: {},
    events: {},
    tokensUsed,
    dependencies,
    implementations: {
      vanilla: {
        framework: "vanilla",
        entryFile: files[0],
        files,
        dependencies,
        styles: files.filter((file) => file.endsWith(".css")),
        status: "validated",
      },
      angular: null,
      react: null,
    },
  };
}

function writeComponent(dsDir, folder, files) {
  const base = path.join(dsDir, "components", folder);
  writeJson(path.join(base, "manifest.json"), files.manifest);
  writeText(path.join(base, `${folder}.html`), files.html);
  writeText(path.join(base, `${folder}.css`), files.css);
  if (files.js) writeText(path.join(base, `${folder}.js`), files.js);
}

function writeDesignSystem(projectDir) {
  const dsDir = path.join(projectDir, "design", "ds");
  writeText(path.join(dsDir, "tokens.css"), TOKENS);
  writeText(path.join(dsDir, "theme.css"), THEME);
  writeText(path.join(dsDir, "components.css"), COMPONENTS_CSS);

  const annotationList = componentManifest(
    "dis.annotation-list",
    "Lista de Anotações",
    "data-display",
    ["dis.accordion", "dis.icon"],
    ["annotation-list.html", "annotation-list.css", "annotation-list.js"],
    ["--font-sans", "--neutral-body", "--neutral-dark", "--neutral-light"]
  );
  const accordion = componentManifest(
    "dis.accordion",
    "Acordeão",
    "navigation",
    ["dis.icon"],
    ["accordion.html", "accordion.css", "accordion.js"],
    ["--neutral-light", "--neutral-body", "--font-sans"]
  );
  const button = componentManifest(
    "dis.button",
    "Botão",
    "actions",
    ["dis.icon"],
    ["button.html", "button.css", "button.js"],
    ["--primary-interactive", "--font-sans"]
  );
  const icon = componentManifest(
    "dis.icon",
    "Ícone",
    "media",
    [],
    ["icon.html", "icon.css", "icon.js"],
    ["--neutral-dark"]
  );

  writeComponent(dsDir, "annotation-list", {
    manifest: annotationList,
    html: '<div class="dis-notes" data-component="dis.annotation-list"><div class="dis-accordion"></div></div>',
    css: ".dis-notes { color: var(--neutral-body); }\n.dis-notes__src { color: var(--neutral-dark); }",
    js: "export function renderAnnotationList(root, props) {\n  const items = props.items || [];\n  root.innerHTML = items.map(function (item) { return '<div class=\"dis-notes\">' + item.text + '</div>'; }).join('');\n}",
  });
  writeComponent(dsDir, "accordion", {
    manifest: accordion,
    html: '<div class="dis-accordion" data-component="dis.accordion"></div>',
    css: ".dis-accordion { border: 1px solid var(--neutral-light); color: var(--neutral-body); }",
    js: "export function renderAccordion(root, props) {\n  root.innerHTML = '<div class=\"ds-accordion\"></div>';\n}",
  });
  writeComponent(dsDir, "button", {
    manifest: button,
    html: '<button class="ds-button" type="button" data-component="dis.button"></button>',
    css: ".ds-button { background: var(--primary-interactive); font-family: var(--font-sans); }",
    js: "export function renderButton(root, props) {\n  root.innerHTML = '<button class=\"ds-button\">' + (props.label || '') + '</button>';\n}",
  });
  writeComponent(dsDir, "icon", {
    manifest: icon,
    html: '<i class="fa-solid fa-circle-info" data-component="dis.icon"></i>',
    css: ".ds-icon { color: var(--neutral-dark); }",
    js: "export function renderIcon(root, props) {\n  root.innerHTML = '<i class=\"fa-solid fa-' + (props.name || 'circle-info') + '\"></i>';\n}",
  });

  writeJson(path.join(dsDir, "registry.json"), {
    schema: 1,
    namespace: "dis",
    components: {
      "dis.annotation-list": annotationList,
      "dis.accordion": accordion,
      "dis.button": button,
      "dis.icon": icon,
    },
  });

  writeJson(path.join(dsDir, "components", "header", "manifest.json"), {
    id: "dis.header",
    version: "1.0.0",
    name: "Cabeçalho",
    category: "layout",
    props: {},
    slots: {},
    events: {},
    tokensUsed: ["--neutral-body"],
    dependencies: [],
    implementations: {
      vanilla: {
        framework: "vanilla",
        entryFile: "header.html",
        files: ["header.html"],
        dependencies: [],
        styles: [],
        status: "validated",
      },
      react: {
        framework: "react",
        entryFile: "header.jsx",
        files: ["header.jsx"],
        dependencies: ["react"],
        styles: [],
        status: "validated",
      },
    },
  });
  writeText(path.join(dsDir, "components", "header", "header.html"), '<header class="dis-header" data-component="dis.header"></header>');
  writeText(
    path.join(dsDir, "components", "header", "header.jsx"),
    "export function Header() {\n  return <header className=\"dis-header\" />;\n}"
  );

  writeText(
    path.join(dsDir, "components", "header-menu-dropdown", "header-menu-dropdown.ts"),
    "import { Component } from \"@angular/core\";\n\n@Component({ selector: \"app-header-menu-dropdown\", standalone: true, template: \"\" })\nexport class HeaderMenuDropdownComponent {}\n"
  );
  writeText(
    path.join(dsDir, "components", "header-menu-dropdown", "header-menu-dropdown.html"),
    '<nav class="header-menu-dropdown" aria-label="Menu principal"></nav>'
  );

  writeText(
    path.join(projectDir, "design", "dis-design-system.html"),
    `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>DIS Design System</title>
  <style>
    .dis-notes { display: block; color: var(--neutral-body); }
    .dis-notes__src { display: block; font-weight: 600; color: var(--neutral-dark); }
  </style>
</head>
<body>
  <main class="ds-catalog">
    <h1>DIS Design System</h1>
  </main>
  <script>
  function AnnotationList(props) {
    const items = props.items || [];
    const rows = items.map(function (item) {
      return '<div class="dis-notes"><span class="dis-notes__src">' + item.date + '</span>' + item.text + '</div>';
    }).join("");
    return rows;
  }
  </script>
</body>
</html>`
  );
}

module.exports = { writeDesignSystem };
