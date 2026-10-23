// @ts-check
// Grava as partes de um .dc.html em <protoDir>/dc/ e o manifesto. Idempotente pelo hash do original.
const fs = require("fs");
const path = require("path");
const { ADAPTER_ID, INSPECTION_FORMAT, SUPPORT_SHA256, sha256 } = require("./dc-runtime-config.service");
const { validateDcParts, findRelativeAssets } = require("./dc-artifact-parser.service");

const ASSET_MIME = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

/** @param {string} protoDir */
function readManifest(protoDir) {
  try {
    return JSON.parse(fs.readFileSync(path.join(protoDir, "dc", "manifest.json"), "utf8"));
  } catch {
    return null;
  }
}

/**
 * Lista de telas e tela padrão a partir das props do componente.
 * @param {Record<string, any>} props
 */
function screensFromProps(props) {
  const spec = props?.startScreen || {};
  const screens = Array.isArray(spec.options) ? spec.options.map(String) : [];
  const defaultScreen = spec.default ?? spec.value ?? screens[0] ?? null;
  return { screens, defaultScreen };
}

/**
 * Resolve e copia assets relativos para dc/assets/, sem sair da pasta de origem.
 * @param {string[]} refs
 * @param {string | undefined} sourceDir
 * @param {string} dcDir
 */
function copyAssets(refs, sourceDir, dcDir) {
  /** @type {{ref: string, file: string, mime: string, size: number}[]} */
  const assets = [];
  /** @type {string[]} */
  const missing = [];
  const base = path.resolve(sourceDir || ".");
  for (const ref of refs) {
    const source = path.resolve(base, ref);
    const rel = path.relative(base, source);
    const inside = !rel.startsWith("..") && !path.isAbsolute(rel);
    const mime = ASSET_MIME[path.extname(ref).toLowerCase()];
    if (!sourceDir || !inside || !mime || !fs.existsSync(source) || !fs.statSync(source).isFile()) {
      missing.push(ref);
      continue;
    }
    const target = path.join(dcDir, "assets", ref);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
    assets.push({ ref, file: ref, mime, size: fs.statSync(source).size });
  }
  return { assets, missing };
}

/**
 * Grava as partes e o manifesto. Lança erro 422 se a validação bloquear.
 * @param {string} protoDir
 * @param {ReturnType<import("./dc-artifact-parser.service").splitDcArtifact>} parts
 * @param {{sourceSha256: string, sourceArtifact: string, sourceFile: string, sourceDir?: string}} meta
 */
function writeDcInspection(protoDir, parts, meta) {
  const existing = readManifest(protoDir);
  if (existing && existing.sourceSha256 === meta.sourceSha256 && existing.runtime?.support_sha256 === SUPPORT_SHA256) {
    return { changed: false, manifest: existing };
  }
  const validation = validateDcParts(parts);
  if (!validation.ok) {
    const error = new Error(validation.errors.join(" "));
    // @ts-ignore
    error.status = 422;
    throw error;
  }

  const dcDir = path.join(protoDir, "dc");
  fs.mkdirSync(dcDir, { recursive: true });
  fs.rmSync(path.join(dcDir, "assets"), { recursive: true, force: true });

  const refs = findRelativeAssets(parts.template + "\n" + parts.helmet);
  const { assets, missing } = copyAssets(refs, meta.sourceDir, dcDir);

  fs.writeFileSync(path.join(dcDir, "template.html"), parts.template, "utf8");
  fs.writeFileSync(path.join(dcDir, "logic.js"), parts.logic, "utf8");
  fs.writeFileSync(path.join(dcDir, "helmet.html"), parts.helmet, "utf8");

  const { screens, defaultScreen } = screensFromProps(parts.props);
  const warnings = [...validation.warnings];
  if (missing.length) warnings.push(`Assets ausentes na origem (imagens ficarão vazias): ${missing.join(", ")}`);

  const manifest = {
    schema: "dc-inspection/1",
    adapter: ADAPTER_ID,
    inspectionFormat: INSPECTION_FORMAT,
    sourceArtifact: meta.sourceArtifact,
    sourceFile: meta.sourceFile,
    sourceSha256: meta.sourceSha256,
    runtime: {
      support_sha256: SUPPORT_SHA256,
      react: "18.3.1",
      reactDom: "18.3.1",
      vendorUrl: "/js/vendor/dc-runtime",
    },
    parts: {
      template: { file: "dc/template.html", sha256: sha256(parts.template) },
      logic: { file: "dc/logic.js", sha256: sha256(parts.logic) },
      helmet: { file: "dc/helmet.html", sha256: sha256(parts.helmet) },
    },
    logicAttrs: parts.logicAttrs,
    props: parts.props,
    screens,
    defaultScreen,
    assets,
    missingAssets: missing,
    warnings,
    generatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(dcDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
  return { changed: true, manifest };
}

module.exports = { readManifest, screensFromProps, copyAssets, writeDcInspection };
