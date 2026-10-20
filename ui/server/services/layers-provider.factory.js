// @ts-check
const fs = require("fs");
const path = require("path");

/**
 * Normaliza e sanitiza tokens de componentes na documentação de camadas.
 * @param {string} raw
 * @returns {string[]}
 */
function parseComponentTokens(raw) {
  if (!raw || typeof raw !== "string") return [];
  return raw
    .split(/[·→\n,]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.replace(/^[<(\[]+|[>)\]]+$/g, ""));
}

/**
 * Adaptador para formato mapa-camadas.json
 */
class MapaCamadasJsonLayersProvider {
  /**
   * @param {object} config
   * @param {string} repoRoot
   * @param {object} [deps]
   */
  constructor(config, repoRoot, deps = { fs, path }) {
    this.config = config || {};
    this.repoRoot = repoRoot || "";
    this.deps = deps;
    // Deriva a pasta base a partir do glob configurado (ex: "doc/sistema/features/*/mapa-camadas.json" -> "doc/sistema/features")
    const glob = this.config.featuresGlob || "doc/sistema/features/*";
    const parts = glob.split("*")[0].replace(/[\\/]+$/, "");
    this.featuresDirRel = parts || "doc/sistema/features";
  }

  scanLayers() {
    const documentedComponents = new Set();
    const prototypeComponents = new Set();
    const featuresList = [];

    if (!this.repoRoot) return { documentedComponents, prototypeComponents, featuresList };
    const fullDir = this.deps.path.resolve(this.repoRoot, this.featuresDirRel);
    if (!this.deps.fs.existsSync(fullDir)) {
      return { documentedComponents, prototypeComponents, featuresList };
    }

    try {
      const entries = this.deps.fs.readdirSync(fullDir, { withFileTypes: true });
      for (const ent of entries) {
        if (!ent.isDirectory() || ent.name.startsWith(".")) continue;
        featuresList.push(ent.name);

        const mapFile = this.deps.path.join(fullDir, ent.name, "mapa-camadas.json");
        if (!this.deps.fs.existsSync(mapFile)) continue;

        try {
          const raw = this.deps.fs.readFileSync(mapFile, "utf8").replace(/^\uFEFF/, "");
          const data = JSON.parse(raw);
          const telas = Array.isArray(data.telas) ? data.telas : [];
          for (const tela of telas) {
            if (tela.componente) {
              for (const tok of parseComponentTokens(tela.componente)) {
                documentedComponents.add(tok.toLowerCase());
              }
            }
            const campos = Array.isArray(tela.campos) ? tela.campos : [];
            for (const campo of campos) {
              const ui = campo.ui || {};
              if (ui.c) {
                for (const tok of parseComponentTokens(ui.c)) {
                  const lower = tok.toLowerCase();
                  documentedComponents.add(lower);
                  if (ui.st === "so-no-prototipo" || campo.regra?.st === "so-no-prototipo") {
                    prototypeComponents.add(lower);
                  }
                }
              }
            }
          }
        } catch {}
      }
    } catch {}

    return { documentedComponents, prototypeComponents, featuresList };
  }

  getFeatureLayers(featureSlug) {
    if (!featureSlug || typeof featureSlug !== "string" || !/^[a-z0-9_-]{1,80}$/i.test(featureSlug)) {
      throw new Error("Identificador de funcionalidade inválido.");
    }
    const fullDir = this.deps.path.resolve(this.repoRoot, this.featuresDirRel, featureSlug);
    if (!this.deps.fs.existsSync(fullDir)) {
      return { found: false, error: `Funcionalidade '${featureSlug}' não encontrada.` };
    }

    const mapFile = this.deps.path.join(fullDir, "mapa-camadas.json");
    let json = null;
    if (this.deps.fs.existsSync(mapFile)) {
      try {
        json = JSON.parse(this.deps.fs.readFileSync(mapFile, "utf8").replace(/^\uFEFF/, ""));
      } catch {}
    }

    return {
      found: true,
      feature: featureSlug,
      hasJsonMap: Boolean(json),
      data: json,
    };
  }

  getAllowedDirs() {
    return [this.featuresDirRel].filter(Boolean);
  }
}

/**
 * Adaptador para formato genérico em pastas markdown (ui.md, regras.md, etc.)
 */
class MarkdownFoldersLayersProvider {
  constructor(config, repoRoot, deps = { fs, path }) {
    this.config = config || {};
    this.repoRoot = repoRoot || "";
    this.deps = deps;
    this.baseDirRel = "doc/features";
  }

  scanLayers() {
    return { documentedComponents: new Set(), prototypeComponents: new Set(), featuresList: [] };
  }

  getFeatureLayers(featureSlug) {
    return { found: false, feature: featureSlug, error: "Formato markdown em pastas vazio." };
  }

  getAllowedDirs() {
    return [this.baseDirRel];
  }
}

/**
 * Cria o provedor de camadas correspondente.
 * @param {object} docsConfig
 * @param {string} repoRoot
 * @param {object} [deps]
 */
function createLayersProvider(docsConfig, repoRoot, deps = { fs, path }) {
  const adapter = docsConfig?.layers?.adapter || "mapa-camadas-json";
  if (adapter === "mapa-camadas-json") {
    return new MapaCamadasJsonLayersProvider(docsConfig?.layers || {}, repoRoot, deps);
  }
  return new MarkdownFoldersLayersProvider(docsConfig?.layers || {}, repoRoot, deps);
}

module.exports = {
  createLayersProvider,
  MapaCamadasJsonLayersProvider,
  MarkdownFoldersLayersProvider,
  parseComponentTokens,
};
