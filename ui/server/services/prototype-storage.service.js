// @ts-check
const fs = require("fs");
const path = require("path");
const { validatePrototypePath, sanitizeHtmlFragment, injectDataPidAttributes } = require("./prototype-sanitizer.service");
const { createVersionSnapshot } = require("./prototype-version.service");

/**
 * Retorna o diretório base de protótipos de um projeto.
 * @param {string} projectDir
 * @param {object} [deps]
 */
function getPrototypesBaseDir(projectDir, deps = { path }) {
  return deps.path.join(projectDir, "design", "prototypes");
}

/**
 * Cria um novo protótipo com estrutura modular inicial.
 * @param {string} projectDir
 * @param {string} protoId
 * @param {string} title
 * @param {object} [options]
 * @param {object} [deps]
 */
function initPrototype(projectDir, protoId, title, options = {}, deps = { fs, path }) {
  const baseDir = getPrototypesBaseDir(projectDir, deps);
  const protoDir = deps.path.join(baseDir, protoId);

  if (deps.fs.existsSync(protoDir)) {
    throw new Error(`Protótipo '${protoId}' já existe.`);
  }

  deps.fs.mkdirSync(deps.path.join(protoDir, "screens"), { recursive: true });
  deps.fs.mkdirSync(deps.path.join(protoDir, "styles"), { recursive: true });
  deps.fs.mkdirSync(deps.path.join(protoDir, "scripts"), { recursive: true });
  deps.fs.mkdirSync(deps.path.join(protoDir, "data"), { recursive: true });

  const protoJson = {
    schema: 1,
    id: protoId,
    title: title || protoId,
    version: 1,
    activeScreen: "home",
    screens: [
      { id: "home", title: "Início", file: "screens/home.html" }
    ],
    components: [],
    metadata: {
      engine: options.engine || "manual",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  };

  const initialHtml = `<div class="proto-container" data-pid="p-1">
  <header class="proto-header" data-pid="p-2">
    <h1 data-pid="p-3">${title || protoId}</h1>
  </header>
  <main class="proto-main" data-pid="p-4">
    <p data-pid="p-5">Descreva sua tela no chat para gerar o protótipo.</p>
  </main>
</div>`;

  const initialMapa = `# MAPA: ${title || protoId}

## 1. UI / UX
- Tela inicial gerada pelo Ateliê de Protótipos.

## 2. Regras de Negócio
- [A preencher na evolução do protótipo]

## 3. API / Serviços
- [A preencher na evolução do protótipo]

## 4. Dados
- [A preencher na evolução do protótipo]

## Componentes Candidatos
- (Nenhum componente extraído ainda)
`;

  deps.fs.writeFileSync(deps.path.join(protoDir, "proto.json"), JSON.stringify(protoJson, null, 2), "utf8");
  deps.fs.writeFileSync(deps.path.join(protoDir, "MAPA.md"), initialMapa, "utf8");
  deps.fs.writeFileSync(deps.path.join(protoDir, "screens", "home.html"), initialHtml, "utf8");
  deps.fs.writeFileSync(deps.path.join(protoDir, "styles", "proto.css"), "/* Estilos específicos do protótipo */\n", "utf8");

  createVersionSnapshot(protoDir, 1, { author: options.author || "user", message: "Inicialização do protótipo" }, deps);
  return protoJson;
}

/**
 * Grava uma lista de arquivos delimitados validados e sanitizados no protótipo.
 * @param {string} projectDir
 * @param {string} protoId
 * @param {Array<{ path: string, content: string }>} files
 * @param {object} [metadata]
 * @param {object} [deps]
 */
function savePrototypeFiles(projectDir, protoId, files, metadata = {}, deps = { fs, path }) {
  const baseDir = getPrototypesBaseDir(projectDir, deps);
  const protoDir = deps.path.join(baseDir, protoId);

  if (!deps.fs.existsSync(protoDir)) {
    throw new Error(`Protótipo '${protoId}' não encontrado.`);
  }

  const protoJsonFile = deps.path.join(protoDir, "proto.json");
  let protoJson = { schema: 1, id: protoId, version: 1, screens: [] };
  if (deps.fs.existsSync(protoJsonFile)) {
    try {
      protoJson = JSON.parse(deps.fs.readFileSync(protoJsonFile, "utf8"));
    } catch {}
  }

  // Snapshot antes da gravação da nova versão
  const nextVer = (protoJson.version || 1) + 1;
  createVersionSnapshot(protoDir, nextVer, metadata, deps);

  const screensMap = new Map((protoJson.screens || []).map((s) => [s.id, s]));

  for (const f of files) {
    const val = validatePrototypePath(protoDir, f.path);
    if (!val.ok) {
      continue; // Ignora caminho inválido ou evasão
    }

    const normPath = val.normalizedPath;
    let finalContent = f.content;

    // Se for arquivo de tela HTML, sanitiza e injeta data-pid
    if (normPath.startsWith("screens/") && (normPath.endsWith(".html") || normPath.endsWith(".htm"))) {
      finalContent = sanitizeHtmlFragment(finalContent);
      finalContent = injectDataPidAttributes(finalContent);

      const screenId = deps.path.basename(normPath, deps.path.extname(normPath));
      if (!screensMap.has(screenId)) {
        screensMap.set(screenId, {
          id: screenId,
          title: screenId.charAt(0).toUpperCase() + screenId.slice(1),
          file: normPath,
        });
      }
    }

    const destFile = deps.path.join(protoDir, normPath);
    const destFolder = deps.path.dirname(destFile);
    if (!deps.fs.existsSync(destFolder)) {
      deps.fs.mkdirSync(destFolder, { recursive: true });
    }

    // Escrita atômica via arquivo temporário
    const tmpFile = `${destFile}.tmp-${Date.now()}`;
    deps.fs.writeFileSync(tmpFile, finalContent, "utf8");
    deps.fs.renameSync(tmpFile, destFile);
  }

  protoJson.version = nextVer;
  protoJson.screens = Array.from(screensMap.values());
  protoJson.metadata = {
    ...(protoJson.metadata || {}),
    updatedAt: new Date().toISOString(),
    lastEngine: metadata.engine || "manual",
  };

  deps.fs.writeFileSync(protoJsonFile, JSON.stringify(protoJson, null, 2), "utf8");
  return { ok: true, version: nextVer, screens: protoJson.screens };
}

/**
 * Normaliza manifestos para garantir interoperabilidade entre Schema v1 e v2.
 * @param {object} data
 * @param {string} folderName
 */
function normalizePrototypeManifest(data, folderName) {
  if (!data || typeof data !== "object") {
    return { id: folderName, title: folderName, version: 1, screens: [] };
  }
  const id = data.id || data.metadata?.id || folderName;
  const title = data.title || data.metadata?.title || data.metadata?.name || id;
  const version = data.version || data.metadata?.schemaVersion || data.metadata?.version || 1;
  const rawScreens = data.screens;
  let screens = [];
  if (Array.isArray(rawScreens)) {
    screens = rawScreens;
  } else if (rawScreens && typeof rawScreens === "object") {
    screens = Object.values(rawScreens).map((s) => ({
      id: s.id,
      title: s.title || s.id,
      file: s.htmlFile || s.file || `screens/${s.id}.html`,
    }));
  }
  return {
    ...data,
    id,
    title,
    version,
    screens,
  };
}

/**
 * Lista todos os protótipos de um projeto.
 * @param {string} projectDir
 * @param {object} [deps]
 */
function listProjectPrototypes(projectDir, deps = { fs, path }) {
  const baseDir = getPrototypesBaseDir(projectDir, deps);
  if (!deps.fs.existsSync(baseDir)) return [];

  const list = [];
  try {
    const entries = deps.fs.readdirSync(baseDir, { withFileTypes: true });
    for (const ent of entries) {
      if (!ent.isDirectory() || ent.name.startsWith(".")) continue;
      const jsonFile = deps.path.join(baseDir, ent.name, "proto.json");
      if (deps.fs.existsSync(jsonFile)) {
        try {
          const raw = deps.fs.readFileSync(jsonFile, "utf8");
          const parsed = JSON.parse(raw);
          list.push(normalizePrototypeManifest(parsed, ent.name));
        } catch {}
      } else {
        list.push({ id: ent.name, title: ent.name, version: 1, screens: [] });
      }
    }
  } catch {}

  return list;
}

module.exports = {
  getPrototypesBaseDir,
  initPrototype,
  savePrototypeFiles,
  listProjectPrototypes,
  normalizePrototypeManifest,
};
