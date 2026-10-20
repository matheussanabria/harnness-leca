// @ts-check
const fs = require("fs");
const path = require("path");

const ALLOWED_DOC_EXTS = new Set([".md", ".json", ".ts", ".html", ".css"]);
const MAX_DOC_SIZE = 500 * 1024; // 500 KB

/**
 * Garante que o targetPath está estritamente contido no rootPath.
 * @param {string} rootPath
 * @param {string} targetPath
 */
function isInside(rootPath, targetPath) {
  const rel = path.relative(path.resolve(rootPath), path.resolve(targetPath));
  return !rel.startsWith("..") && !path.isAbsolute(rel);
}

/**
 * Extrai nomes e identificadores de componentes limpos a partir do campo 'c' da UI.
 * Exemplos: "VisaoGeralComponent → entregas-liberadas-section" ou "SearchField" ou "secao-accordion · tabela-visao-geral"
 * @param {string} componentString
 * @returns {string[]}
 */
function parseComponentTokens(componentString) {
  if (!componentString || typeof componentString !== "string") return [];
  return componentString
    .split(/[·→\n,]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.replace(/^[<(\[]+|[>)\]]+$/g, ""));
}

/**
 * Deriva o diretório relativo das features a partir da configuração de docs/camadas.
 * @param {object} [docsConfig]
 * @returns {string}
 */
function resolveFeaturesDirRel(docsConfig) {
  if (!docsConfig) return "doc/features";
  if (typeof docsConfig === "string") return docsConfig;
  const glob = docsConfig.layers?.featuresGlob || docsConfig.featuresGlob || "";
  if (glob) {
    const base = glob.split("*")[0].replace(/[\\/]+$/, "");
    if (base) return base;
  }
  return docsConfig.layers?.featuresDir || docsConfig.featuresDir || "doc/features";
}

/**
 * Varre os arquivos de mapa-camadas.json do repositório para indexar componentes
 * que estão especificamente documentados e componentes com status "so-no-prototipo".
 * @param {string} repoRoot
 * @param {object} [deps]
 * @param {object|string} [docsConfig]
 */
function scanRepositoryLayers(repoRoot, deps = { fs, path }, docsConfig = null) {
  const documentedComponents = new Set();
  const prototypeComponents = new Set();
  const featuresList = [];

  const featuresDirRel = resolveFeaturesDirRel(docsConfig);
  const featuresDir = deps.path.resolve(repoRoot, featuresDirRel);
  if (!deps.fs.existsSync(featuresDir)) {
    return { documentedComponents, prototypeComponents, featuresList };
  }

  try {
    const entries = deps.fs.readdirSync(featuresDir, { withFileTypes: true });
    for (const ent of entries) {
      if (!ent.isDirectory() || ent.name.startsWith(".")) continue;
      featuresList.push(ent.name);

      const mapFile = deps.path.join(featuresDir, ent.name, "mapa-camadas.json");
      if (!deps.fs.existsSync(mapFile)) continue;

      try {
        const raw = deps.fs.readFileSync(mapFile, "utf8").replace(/^\uFEFF/, "");
        const data = JSON.parse(raw);
        const telas = Array.isArray(data.telas) ? data.telas : [];

        for (const tela of telas) {
          if (tela.componente) {
            for (const token of parseComponentTokens(tela.componente)) {
              documentedComponents.add(token.toLowerCase());
            }
          }

          const campos = Array.isArray(tela.campos) ? tela.campos : [];
          for (const campo of campos) {
            const ui = campo.ui || {};
            if (ui.c) {
              const tokens = parseComponentTokens(ui.c);
              for (const token of tokens) {
                const lower = token.toLowerCase();
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

/**
 * Lê e estrutura as 4 camadas de uma funcionalidade específica.
 * @param {string} repoRoot
 * @param {string} featureSlug
 * @param {object} [deps]
 * @param {object|string} [docsConfig]
 */
function getFeatureLayers(repoRoot, featureSlug, deps = { fs, path }, docsConfig = null) {
  if (!featureSlug || typeof featureSlug !== "string" || !/^[a-z0-9_-]{1,80}$/i.test(featureSlug)) {
    throw new Error("Identificador de funcionalidade inválido.");
  }

  const featuresDirRel = resolveFeaturesDirRel(docsConfig);
  const featuresDir = deps.path.resolve(repoRoot, featuresDirRel);
  const featureDir = deps.path.resolve(featuresDir, featureSlug);

  if (!isInside(featuresDir, featureDir) || !deps.fs.existsSync(featureDir)) {
    return { found: false, feature: featureSlug, error: "Funcionalidade não encontrada." };
  }

  const result = {
    found: true,
    feature: featureSlug,
    layers: {
      ui: [],
      regra: [],
      api: [],
      dados: [],
    },
    files: [],
    conferenciaVisual: null,
  };

  // 1. Arquivos adicionais de documentação da feature
  try {
    const entries = deps.fs.readdirSync(featureDir, { withFileTypes: true });
    for (const ent of entries) {
      if (ent.isFile() && ALLOWED_DOC_EXTS.has(deps.path.extname(ent.name))) {
        result.files.push({
          name: ent.name,
          relativePath: `${featuresDirRel}/${featureSlug}/${ent.name}`,
        });
      }
    }
  } catch {}

  // 2. Leitura do mapa-camadas.json
  const mapFile = deps.path.join(featureDir, "mapa-camadas.json");
  if (deps.fs.existsSync(mapFile)) {
    try {
      const raw = deps.fs.readFileSync(mapFile, "utf8").replace(/^\uFEFF/, "");
      const data = JSON.parse(raw);
      result.conferenciaVisual = data.conferencia_visual || null;

      const telas = Array.isArray(data.telas) ? data.telas : [];
      for (const tela of telas) {
        const telaInfo = { id: tela.id, titulo: tela.titulo, rota: tela.rota, componente: tela.componente };
        const campos = Array.isArray(tela.campos) ? tela.campos : [];

        for (const c of campos) {
          const itemBase = { tela: telaInfo, campoId: c.id, rotulo: c.rotulo };
          if (c.ui) result.layers.ui.push({ ...itemBase, ...c.ui, layer: "ui" });
          if (c.regra) result.layers.regra.push({ ...itemBase, ...c.regra, layer: "regra" });
          if (c.api) result.layers.api.push({ ...itemBase, ...c.api, layer: "api" });
          if (c.dados) result.layers.dados.push({ ...itemBase, ...c.dados, layer: "dados" });
        }
      }
    } catch (err) {
      result.layersError = "Erro ao ler ou parsear mapa-camadas.json: " + (err.message || String(err));
    }
  }

  return result;
}

module.exports = {
  isInside,
  parseComponentTokens,
  scanRepositoryLayers,
  getFeatureLayers,
  ALLOWED_DOC_EXTS,
  MAX_DOC_SIZE,
};
