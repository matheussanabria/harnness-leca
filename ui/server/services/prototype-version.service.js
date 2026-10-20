// @ts-check
const fs = require("fs");
const path = require("path");

const MAX_VERSIONS = 20;

/**
 * Cria um snapshot de versão imutável do protótipo atual.
 * @param {string} protoDir
 * @param {number} versionNum
 * @param {object} metadata
 * @param {object} [deps]
 */
function createVersionSnapshot(protoDir, versionNum, metadata = {}, deps = { fs, path }) {
  const versionsDir = deps.path.join(protoDir, ".versions");
  if (!deps.fs.existsSync(versionsDir)) {
    deps.fs.mkdirSync(versionsDir, { recursive: true });
  }

  const snapshotDir = deps.path.join(versionsDir, `v${versionNum}`);
  if (!deps.fs.existsSync(snapshotDir)) {
    deps.fs.mkdirSync(snapshotDir, { recursive: true });
  }

  // Copia arquivos relevantes (screens, styles, scripts, MAPA.md, proto.json)
  const filesCopied = [];
  const entriesToCopy = ["MAPA.md", "proto.json", "screens", "styles", "scripts", "data"];

  for (const item of entriesToCopy) {
    const src = deps.path.join(protoDir, item);
    if (!deps.fs.existsSync(src)) continue;
    const dest = deps.path.join(snapshotDir, item);

    try {
      const st = deps.fs.statSync(src);
      if (st.isDirectory()) {
        copyRecursive(src, dest, deps);
        filesCopied.push(`${item}/`);
      } else {
        deps.fs.copyFileSync(src, dest);
        filesCopied.push(item);
      }
    } catch {}
  }

  // Manifesto da versão
  const manifest = {
    version: versionNum,
    createdAt: new Date().toISOString(),
    author: metadata.author || "user",
    engine: metadata.engine || "manual",
    message: metadata.message || `Versão ${versionNum}`,
    files: filesCopied,
  };

  deps.fs.writeFileSync(
    deps.path.join(snapshotDir, "manifest.json"),
    JSON.stringify(manifest, null, 2),
    "utf8"
  );

  pruneOldVersions(versionsDir, MAX_VERSIONS, deps);
  return manifest;
}

/**
 * Copia recursivamente um diretório para outro.
 * @param {string} src
 * @param {string} dest
 * @param {object} deps
 */
function copyRecursive(src, dest, deps) {
  if (!deps.fs.existsSync(dest)) {
    deps.fs.mkdirSync(dest, { recursive: true });
  }
  const entries = deps.fs.readdirSync(src, { withFileTypes: true });
  for (const ent of entries) {
    const srcPath = deps.path.join(src, ent.name);
    const destPath = deps.path.join(dest, ent.name);
    if (ent.isDirectory()) {
      copyRecursive(srcPath, destPath, deps);
    } else {
      deps.fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Remove versões antigas excedentes mantendo as mais recentes.
 * @param {string} versionsDir
 * @param {number} max
 * @param {object} deps
 */
function pruneOldVersions(versionsDir, max, deps) {
  try {
    const entries = deps.fs.readdirSync(versionsDir, { withFileTypes: true });
    const versionDirs = entries
      .filter((e) => e.isDirectory() && /^v\d+$/.test(e.name))
      .map((e) => ({ name: e.name, num: parseInt(e.name.slice(1), 10) }))
      .sort((a, b) => a.num - b.num);

    while (versionDirs.length > max) {
      const oldest = versionDirs.shift();
      if (oldest) {
        deps.fs.rmSync(deps.path.join(versionsDir, oldest.name), { recursive: true, force: true });
      }
    }
  } catch {}
}

/**
 * Lista as versões existentes de um protótipo com seus manifestos.
 * @param {string} protoDir
 * @param {object} [deps]
 */
function listPrototypeVersions(protoDir, deps = { fs, path }) {
  const versionsDir = deps.path.join(protoDir, ".versions");
  if (!deps.fs.existsSync(versionsDir)) return [];

  const list = [];
  try {
    const entries = deps.fs.readdirSync(versionsDir, { withFileTypes: true });
    for (const ent of entries) {
      if (!ent.isDirectory() || !/^v\d+$/.test(ent.name)) continue;
      const manifestPath = deps.path.join(versionsDir, ent.name, "manifest.json");
      if (deps.fs.existsSync(manifestPath)) {
        try {
          const raw = deps.fs.readFileSync(manifestPath, "utf8");
          list.push(JSON.parse(raw));
        } catch {}
      } else {
        list.push({ version: parseInt(ent.name.slice(1), 10), createdAt: null, message: ent.name });
      }
    }
  } catch {}

  return list.sort((a, b) => b.version - a.version);
}

/**
 * Restaura uma versão específica para o diretório atual do protótipo.
 * @param {string} protoDir
 * @param {number} targetVersion
 * @param {object} [deps]
 */
function restorePrototypeVersion(protoDir, targetVersion, deps = { fs, path }) {
  const versionsDir = deps.path.join(protoDir, ".versions");
  const snapshotDir = deps.path.join(versionsDir, `v${targetVersion}`);

  if (!deps.fs.existsSync(snapshotDir)) {
    return { ok: false, error: `Versão v${targetVersion} não encontrada.` };
  }

  // Copia os arquivos da versão para a raiz do protótipo
  const entriesToRestore = ["MAPA.md", "proto.json", "screens", "styles", "scripts", "data"];
  for (const item of entriesToRestore) {
    const src = deps.path.join(snapshotDir, item);
    if (!deps.fs.existsSync(src)) continue;
    const dest = deps.path.join(protoDir, item);

    try {
      const st = deps.fs.statSync(src);
      if (st.isDirectory()) {
        copyRecursive(src, dest, deps);
      } else {
        deps.fs.copyFileSync(src, dest);
      }
    } catch {}
  }

  return { ok: true, version: targetVersion };
}

module.exports = {
  createVersionSnapshot,
  listPrototypeVersions,
  restorePrototypeVersion,
  MAX_VERSIONS,
};
