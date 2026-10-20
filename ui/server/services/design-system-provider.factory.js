// @ts-check
const fs = require("fs");
const path = require("path");

/**
 * Provedor de Design System via Sistema de Arquivos (FS)
 */
class FsDesignSystemProvider {
  /**
   * @param {object} config
   * @param {string} repoRoot
   * @param {object} [deps]
   */
  constructor(config, repoRoot, deps = { fs, path }) {
    this.config = config || {};
    this.repoRoot = repoRoot || "";
    this.deps = deps;
    this.componentsDir = this.config.componentsDir || "";
    this.prefix = this.config.prefix || "ds-";
  }

  async getTokens() {
    const tokensRel = this.config.tokensCss || "";
    if (!tokensRel || !this.repoRoot) return [];
    const fullPath = this.deps.path.resolve(this.repoRoot, tokensRel);
    if (!this.deps.fs.existsSync(fullPath)) return [];

    try {
      const content = this.deps.fs.readFileSync(fullPath, "utf8");
      const varMatches = content.match(/--[a-zA-Z0-9_-]+:\s*[^;]+/g) || [];
      return varMatches.map((m) => {
        const [name, val] = m.split(":");
        return { name: name.trim(), value: (val || "").trim() };
      });
    } catch {
      return [];
    }
  }

  async getComponents() {
    if (!this.componentsDir || !this.repoRoot) return [];
    const fullDir = this.deps.path.resolve(this.repoRoot, this.componentsDir);
    if (!this.deps.fs.existsSync(fullDir)) return [];

    const discovered = [];
    try {
      const entries = this.deps.fs.readdirSync(fullDir, { withFileTypes: true });
      for (const ent of entries) {
        if (!ent.isDirectory() || ent.name.startsWith(".")) continue;
        const cleanName = ent.name.replace(/^\d+[-_]?/, "");
        const id = cleanName.toLowerCase();
        discovered.push({
          id,
          name: cleanName.split("-").map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join("") + "Component",
          folder: `${this.componentsDir}/${ent.name}`,
          prefix: this.prefix,
        });
      }
    } catch {}
    return discovered;
  }

  async getSnippet(componentId) {
    // Procura por snippet HTML estático no diretório ou manifest
    return `<div class="${this.prefix}${componentId}"><!-- Snippet ${componentId} --></div>`;
  }

  getAllowedDirs() {
    return Array.isArray(this.config.allowedRepoDirs) ? this.config.allowedRepoDirs : [this.componentsDir].filter(Boolean);
  }
}

/**
 * Provedor nulo de Design System (projeto genérico)
 */
class NullDesignSystemProvider {
  constructor(config = {}) {
    this.config = config;
    this.prefix = config.prefix || "ds-";
  }
  async getTokens() { return []; }
  async getComponents() { return []; }
  async getSnippet(id) { return `<div>${id}</div>`; }
  getAllowedDirs() { return []; }
}

/**
 * Cria o provedor apropriado com base na configuração.
 * @param {object} dsConfig
 * @param {string} repoRoot
 * @param {object} [deps]
 */
function createDesignSystemProvider(dsConfig, repoRoot, deps = { fs, path }) {
  const providerType = dsConfig?.provider || (dsConfig?.componentsDir ? "fs" : "none");
  if (providerType === "fs") {
    return new FsDesignSystemProvider(dsConfig, repoRoot, deps);
  }
  return new NullDesignSystemProvider(dsConfig);
}

module.exports = {
  createDesignSystemProvider,
  FsDesignSystemProvider,
  NullDesignSystemProvider,
};
