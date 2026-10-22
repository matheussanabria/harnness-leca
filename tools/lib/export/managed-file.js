// @ts-check
// Escrita não destrutiva de arquivos exportados para fora do repositório.
// - writeManagedBlock: só toca entre os marcadores harness:begin/harness:end.
// - writeGenerated: só reescreve arquivo que o próprio harness gerou (marcador) ou que não existe.

const fs = require("fs");
const path = require("path");

const BEGIN = "<!-- harness:begin -->";
const END = "<!-- harness:end -->";
const GENERATED = "<!-- harness:generated -->";

/**
 * @typedef {{ dryRun?: boolean, log?: (msg: string) => void }} WriteOpts
 * @typedef {{ file: string, status: "created"|"updated"|"unchanged"|"skipped", bytes: number }} WriteResult
 */

/** @param {string} file @returns {string|null} */
function readIfExists(file) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch (err) {
    if (/** @type {NodeJS.ErrnoException} */ (err).code === "ENOENT") return null;
    throw err;
  }
}

/** @param {string} file @param {string} text */
function persist(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text, "utf8");
}

/** Indica se `file` está dentro de `root` (evita escrever fora das pastas permitidas). */
function isInside(root, file) {
  const rel = path.relative(path.resolve(root), path.resolve(file));
  return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
}

/**
 * Escreve `content` entre os marcadores do harness, preservando byte a byte o restante.
 * Arquivo sem marcadores que bata com um cabeçalho em `opts.legacy` foi gerado inteiro por uma versão
 * anterior do export: é substituído pelo bloco (nada do Claude Code se perde, pois ele não escreveu ali).
 * @param {string} file @param {string} content @param {WriteOpts & { legacy?: RegExp[] }} [opts] @returns {WriteResult}
 */
function writeManagedBlock(file, content, opts = {}) {
  const log = opts.log || (() => {});
  const block = `${BEGIN}\n${content.trim()}\n${END}`;
  const current = readIfExists(file);
  const bytes = Buffer.byteLength(block, "utf8");

  let next;
  if (current === null || current === "") {
    next = `${block}\n`;
  } else {
    const b = current.indexOf(BEGIN);
    const e = b >= 0 ? current.indexOf(END, b) : -1;
    if (b < 0 && (opts.legacy || []).some((re) => re.test(current))) {
      if (!opts.dryRun) persist(file, `${block}
`);
      return { file, status: "updated", bytes };
    }
    if (b >= 0 && e < 0) {
      log(`   [aviso] marcador ${BEGIN} sem ${END} em ${file}; arquivo preservado.`);
      return { file, status: "skipped", bytes };
    }
    if (b >= 0) {
      next = current.slice(0, b) + block + current.slice(e + END.length);
    } else {
      const sep = current.endsWith("\n") ? "\n" : "\n\n";
      next = `${current}${sep}${block}\n`;
    }
  }

  if (next === current) return { file, status: "unchanged", bytes };
  if (!opts.dryRun) persist(file, next);
  return { file, status: current === null ? "created" : "updated", bytes };
}

/**
 * Reescreve arquivo gerado. Pula se existir sem o marcador `harness:generated`
 * (a menos que bata com algum cabeçalho legado em `opts.legacy`).
 * @param {string} file @param {string} content
 * @param {WriteOpts & { legacy?: RegExp[] }} [opts] @returns {WriteResult}
 */
function writeGenerated(file, content, opts = {}) {
  const log = opts.log || (() => {});
  const body = content.includes(GENERATED) ? content : withMarker(file, content);
  const bytes = Buffer.byteLength(body, "utf8");
  const current = readIfExists(file);

  if (current !== null) {
    const ours = current.includes(GENERATED) || (opts.legacy || []).some((re) => re.test(current));
    if (!ours) {
      log(`   [aviso] ${file} existe sem ${GENERATED}; não foi reescrito.`);
      return { file, status: "skipped", bytes };
    }
    if (current === body) return { file, status: "unchanged", bytes };
  }
  if (!opts.dryRun) persist(file, body);
  return { file, status: current === null ? "created" : "updated", bytes };
}

/** Insere o marcador (JSON não aceita comentário: usa o campo "generator"). */
function withMarker(file, content) {
  if (file.endsWith(".json")) {
    try {
      const obj = JSON.parse(content);
      return JSON.stringify({ generator: GENERATED, ...obj }, null, 2) + "\n";
    } catch {
      return content;
    }
  }
  const nl = content.indexOf("\n");
  return nl < 0 ? `${content}\n${GENERATED}\n` : `${content.slice(0, nl)}\n${GENERATED}${content.slice(nl)}`;
}

module.exports = { BEGIN, END, GENERATED, writeManagedBlock, writeGenerated, isInside };
