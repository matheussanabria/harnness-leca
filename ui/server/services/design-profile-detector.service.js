// @ts-check
const fs = require("fs");
const path = require("path");

/**
 * Detecta características do projeto (framework, design system, pastas de documentação)
 * a partir da estrutura do repositório para sugerir um profile.json.
 *
 * @param {string} repoRoot
 * @param {object} [deps]
 */
function detectProjectProfile(repoRoot, deps = { fs, path }) {
  const proposal = {
    schema: 1,
    framework: { adapter: "none" },
    designSystem: { provider: "none", prefix: "ds-" },
    docs: { layers: { adapter: "markdown-folders", featuresGlob: "doc/features/*" } },
    stages: {
      enabled: [
        "prototype",
        "extracted",
        "design_system",
        "boilerplate",
        "implemented",
        "documented",
      ],
    },
    agents: {
      source: "dai",
      map: {
        prototype: "ux-ui-designer",
        boilerplate: "frontend-engineer",
      },
    },
    prototypes: {
      viewports: [
        { id: "desktop", label: "Desktop", width: 1280 },
        { id: "tablet", label: "Tablet", width: 768 },
        { id: "mobile", label: "Celular", width: 390 },
      ],
    },
  };

  if (!repoRoot || !deps.fs.existsSync(repoRoot)) {
    return proposal;
  }

  // 1. Detecta Framework via package.json
  const pkgPath = deps.path.join(repoRoot, "package.json");
  if (deps.fs.existsSync(pkgPath)) {
    try {
      const raw = deps.fs.readFileSync(pkgPath, "utf8");
      const pkg = JSON.parse(raw);
      const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
      if (allDeps["@angular/core"] || allDeps["@angular/common"]) {
        proposal.framework.adapter = "angular";
      } else if (allDeps["react"] || allDeps["next"]) {
        proposal.framework.adapter = "react";
      } else {
        proposal.framework.adapter = "static-html";
      }
    } catch {}
  }

  // 2. Detecta Design System (Procempa DIS ou local)
  const procempaDsDir = deps.path.join(repoRoot, "doc", "design-system");
  if (deps.fs.existsSync(procempaDsDir)) {
    proposal.designSystem = {
      ref: "procempa-dis",
      overrides: {
        componentsDir: "doc/design-system",
        tokensCss: "doc/design-system/ds.css",
      },
    };
  }

  // 3. Detecta Documentação em Camadas
  const procempaLayersDir = deps.path.join(repoRoot, "doc", "sistema", "features");
  if (deps.fs.existsSync(procempaLayersDir)) {
    proposal.docs.layers = {
      adapter: "mapa-camadas-json",
      featuresGlob: "doc/sistema/features/*/mapa-camadas.json",
    };
  }

  return proposal;
}

module.exports = {
  detectProjectProfile,
};
