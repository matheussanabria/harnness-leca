// @ts-check
const fs = require("fs");
const path = require("path");
const { decomposeIntoScreens } = require("./prototype-screen-decomposer.service");
const { createPrototypeDefinition } = require("./prototype-schema.service");
const { validatePrototypeDefinition } = require("./prototype-validator.service");

/**
 * Reconstrói um protótipo monolítico para o formato modular canônico v2.0.0.
 * @param {string} projectDir Caminho absoluto do projeto
 * @param {string} artifactRelPath Caminho relativo do arquivo fonte (ex: "design/dis-fluxo-paciente/Main.dc.html")
 * @param {string} [targetProtoId="dis-modular"] ID do protótipo de destino
 * @param {string} [title="DIS — Fluxo de Dispensação (Modular)"]
 */
function reconstructPrototypeFromArtifact(
  projectDir,
  artifactRelPath,
  targetProtoId = "dis-modular",
  title = "DIS — Fluxo de Dispensação (Modular)"
) {
  const sourcePath = path.resolve(projectDir, artifactRelPath);
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Arquivo fonte '${sourcePath}' não encontrado.`);
  }

  const rawHtml = fs.readFileSync(sourcePath, "utf8");
  const { screens, allNodes } = decomposeIntoScreens(rawHtml, targetProtoId);

  // 1. Monta o manifesto PrototypeDefinition v2
  const proto = createPrototypeDefinition({
    id: targetProtoId,
    title,
    designSystemId: "procempa-dis",
    defaultScreenId: "home",
    description: "Protótipo desacoplado do fluxo de dispensação reconstruído a partir do legado DataChef.",
  });

  proto.assets = {
    css: ["styles/proto.css", "../../../design/ds/theme.css"],
    js: [],
    fonts: ["https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;600;700;800&display=swap"],
  };

  proto.globalState = {
    system: "DIS — Dispensação de Medicamentos",
    environment: "homologacao",
  };

  // Vincula as telas decompostas
  for (const [screenId, screenData] of Object.entries(screens)) {
    proto.screens[screenId] = {
      id: screenData.id,
      title: screenData.title,
      route: screenData.route,
      htmlFile: screenData.htmlFile,
      rootNodeId: screenData.rootNodeId,
      initialState: screenData.initialState || {},
      nodes: screenData.nodes,
    };
  }

  // 2. Validação Estrita do Schema
  const validation = validatePrototypeDefinition(proto);
  if (!validation.valid) {
    throw new Error(`Falha na validação do protótipo reconstruído: ${validation.errors.join("; ")}`);
  }

  // 3. Persistência Física dos Arquivos
  const targetDir = path.join(projectDir, "design", "prototypes", targetProtoId);
  const screensDir = path.join(targetDir, "screens");
  const dataDir = path.join(targetDir, "data");
  const stylesDir = path.join(targetDir, "styles");

  fs.mkdirSync(screensDir, { recursive: true });
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(stylesDir, { recursive: true });

  // Grava proto.json
  fs.writeFileSync(path.join(targetDir, "proto.json"), JSON.stringify(proto, null, 2), "utf8");

  // Grava telas HTML
  for (const [screenId, screenData] of Object.entries(screens)) {
    fs.writeFileSync(path.join(targetDir, screenData.htmlFile), screenData.htmlContent, "utf8");
  }

  // Grava estilo do protótipo
  const protoCssContent = `/**
 * Estilos do Protótipo Modular DIS
 */
@import url("../../ds/theme.css");

body {
  margin: 0;
  padding: 0;
  font-family: var(--font-sans);
  background-color: var(--neutral-background);
  color: var(--neutral-body);
}

.dis-flow-container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.ds-mount {
  margin-bottom: var(--spacing-scale-2x, 16px);
}
`;
  fs.writeFileSync(path.join(stylesDir, "proto.css"), protoCssContent, "utf8");

  // Copia datasets de mock existentes de data/ se disponíveis
  const srcDataDir = path.join(projectDir, "design", "prototypes", "dis-fluxo-paciente-inspecao", "data");
  if (fs.existsSync(srcDataDir)) {
    const files = fs.readdirSync(srcDataDir);
    for (const f of files) {
      if (f.endsWith(".json")) {
        fs.copyFileSync(path.join(srcDataDir, f), path.join(dataDir, f));
      }
    }
  }

  return {
    ok: true,
    protoId: targetProtoId,
    protoDir: targetDir,
    screensCount: Object.keys(proto.screens).length,
    nodesCount: Object.keys(allNodes).length,
    manifest: proto,
  };
}

module.exports = {
  reconstructPrototypeFromArtifact,
};
