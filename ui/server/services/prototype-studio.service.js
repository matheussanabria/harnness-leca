// @ts-check
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { getPrototypesBaseDir } = require("./prototype-storage.service");
const { generateScreenCode } = require("./prototype-codegen.factory");

function sha256(str) {
  return crypto.createHash("sha256").update(str || "").digest("hex");
}

/**
 * Monta o workspace virtual do protótipo para o Studio no framework escolhido.
 * @param {string} projectDir
 * @param {string} protoId
 * @param {string} [framework]
 * @param {object} [deps]
 */
function getPrototypeStudioWorkspace(projectDir, protoId, framework = "vanilla", deps = { fs, path }) {
  const baseDir = getPrototypesBaseDir(projectDir, deps);
  const protoDir = deps.path.join(baseDir, protoId);

  if (!deps.fs.existsSync(protoDir)) {
    throw new Error(`Protótipo '${protoId}' não encontrado.`);
  }

  const protoFile = deps.path.join(protoDir, "proto.json");
  if (!deps.fs.existsSync(protoFile)) {
    throw new Error(`Manifesto 'proto.json' não encontrado para '${protoId}'.`);
  }

  const rawJson = deps.fs.readFileSync(protoFile, "utf8");
  const proto = JSON.parse(rawJson);
  const files = [];

  // Manifesto base
  files.push({
    path: "proto.json",
    content: rawJson,
    hash: sha256(rawJson),
    size: Buffer.byteLength(rawJson),
    readOnly: false,
  });

  // Estilos globais
  const protoCssFile = deps.path.join(protoDir, "styles", "proto.css");
  if (deps.fs.existsSync(protoCssFile)) {
    const cssContent = deps.fs.readFileSync(protoCssFile, "utf8");
    files.push({
      path: "styles/proto.css",
      content: cssContent,
      hash: sha256(cssContent),
      size: Buffer.byteLength(cssContent),
      readOnly: false,
    });
  }

  // Datasets de dados mock
  const dataDir = deps.path.join(protoDir, "data");
  if (deps.fs.existsSync(dataDir)) {
    const dataFiles = deps.fs.readdirSync(dataDir);
    for (const df of dataFiles) {
      if (df.endsWith(".json")) {
        const content = deps.fs.readFileSync(deps.path.join(dataDir, df), "utf8");
        files.push({
          path: `data/${df}`,
          content,
          hash: sha256(content),
          size: Buffer.byteLength(content),
          readOnly: false,
        });
      }
    }
  }

  // Gera código para cada tela do protótipo no framework solicitado
  const screens = proto.screens || {};
  for (const [screenId, screen] of Object.entries(screens)) {
    const generated = generateScreenCode(framework, screen, proto);

    if (framework === "angular18" || framework === "angular") {
      const dir = `src/app/screens/${screenId}`;
      files.push({
        path: `${dir}/${screenId}.component.ts`,
        content: generated.ts,
        hash: sha256(generated.ts),
        size: Buffer.byteLength(generated.ts),
        readOnly: false,
      });
      files.push({
        path: `${dir}/${screenId}.component.html`,
        content: generated.html,
        hash: sha256(generated.html),
        size: Buffer.byteLength(generated.html),
        readOnly: false,
      });
      files.push({
        path: `${dir}/${screenId}.component.css`,
        content: generated.css,
        hash: sha256(generated.css),
        size: Buffer.byteLength(generated.css),
        readOnly: false,
      });
    } else if (framework === "react18" || framework === "react") {
      const dir = "src/screens";
      files.push({
        path: `${dir}/${generated.componentName}.tsx`,
        content: generated.tsx,
        hash: sha256(generated.tsx),
        size: Buffer.byteLength(generated.tsx),
        readOnly: false,
      });
      files.push({
        path: `${dir}/${generated.componentName}.css`,
        content: generated.css,
        hash: sha256(generated.css),
        size: Buffer.byteLength(generated.css),
        readOnly: false,
      });
    } else {
      // Vanilla
      files.push({
        path: `screens/${screenId}.html`,
        content: generated.html,
        hash: sha256(generated.html),
        size: Buffer.byteLength(generated.html),
        readOnly: false,
      });
      files.push({
        path: `screens/${screenId}.js`,
        content: generated.js,
        hash: sha256(generated.js),
        size: Buffer.byteLength(generated.js),
        readOnly: false,
      });
    }
  }

  return {
    protoId,
    framework,
    totalFiles: files.length,
    files,
  };
}

module.exports = {
  getPrototypeStudioWorkspace,
};
