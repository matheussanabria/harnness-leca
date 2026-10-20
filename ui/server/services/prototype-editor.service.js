// @ts-check
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { getPrototypesBaseDir } = require("./prototype-storage.service");

const MAX_UNDO_ITEMS = 20;
/** @type {Map<string, Array<{ screenFile: string, content: string, version: number }>>} */
const undoStacks = new Map();

function sanitizeText(text) {
  if (typeof text !== "string") throw new Error("Texto inválido");
  if (text.includes("<script") || text.includes("</script>")) {
    throw new Error("Texto não pode conter scripts");
  }
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function sanitizeClass(cls) {
  if (!cls || typeof cls !== "string") throw new Error("Nome de classe inválido");
  const trimmed = cls.trim();
  if (!/^[a-zA-Z0-9_\-:./\s]+$/.test(trimmed)) {
    throw new Error(`Classe contém caracteres proibidos: ${trimmed}`);
  }
  return trimmed;
}

function sanitizeStyleToken(prop, val) {
  if (!prop || !/^[a-zA-Z0-9_-]+$/.test(prop.trim())) {
    throw new Error("Propriedade CSS inválida");
  }
  if (!val || typeof val !== "string") throw new Error("Valor CSS inválido");
  if (/[;{}]|url\(|@import/i.test(val)) {
    throw new Error("Valor CSS contém caracteres ou comandos proibidos (; { } url @import)");
  }
  return { property: prop.trim(), value: val.trim() };
}

function calculateFingerprint(content) {
  return crypto.createHash("sha256").update(content).digest("hex").slice(0, 16);
}

function makeUnifiedDiff(fileName, oldText, newText) {
  const oldLines = oldText.split(/\r?\n/);
  const newLines = newText.split(/\r?\n/);
  let start = 0;
  while (start < oldLines.length && start < newLines.length && oldLines[start] === newLines[start]) start++;
  let oldEnd = oldLines.length - 1;
  let newEnd = newLines.length - 1;
  while (oldEnd >= start && newEnd >= start && oldLines[oldEnd] === newLines[newEnd]) {
    oldEnd--;
    newEnd--;
  }
  const hunkOld = oldLines.slice(start, oldEnd + 1);
  const hunkNew = newLines.slice(start, newEnd + 1);
  return [
    `--- a/${fileName}`,
    `+++ b/${fileName}`,
    `@@ -${start + 1},${hunkOld.length} +${start + 1},${hunkNew.length} @@`,
    ...hunkOld.map((l) => `-${l}`),
    ...hunkNew.map((l) => `+${l}`),
  ].join("\n");
}

/**
 * Aplica mutação em memória no HTML baseado no data-pid.
 * @param {string} html
 * @param {string} pid
 * @param {object} op
 */
function mutateHtmlByPid(html, pid, op) {
  const { findNodeRangeByPid } = require("./prototype-structural.service");
  const range = findNodeRangeByPid(html, pid);
  if (!range) {
    throw new Error(`Elemento com data-pid="${pid}" não encontrado nesta tela.`);
  }

  const { startIndex, endIndex, openTag, innerContent, closeTag, isSelfClosing } = range;

  if (op.type === "setText") {
    if (isSelfClosing) throw new Error("Não é possível alterar texto interno de elemento auto-fechável.");
    const cleanText = sanitizeText(op.text || "");
    const replaced = `${openTag}${cleanText}${closeTag}`;
    return html.slice(0, startIndex) + replaced + html.slice(endIndex);
  }

  if (op.type === "setClasses") {
    const cleanCls = sanitizeClass(op.classes || "");
    let updatedTag = openTag;
    if (/class=["'][^"']*["']/i.test(openTag)) {
      updatedTag = openTag.replace(/class=["'][^"']*["']/i, `class="${cleanCls}"`);
    } else {
      updatedTag = openTag.replace(/>$/, ` class="${cleanCls}">`).replace(/\/?>$/, ` class="${cleanCls}" />`);
    }
    const replaced = isSelfClosing ? updatedTag : `${updatedTag}${innerContent}${closeTag}`;
    return html.slice(0, startIndex) + replaced + html.slice(endIndex);
  }

  if (op.type === "setAttr") {
    const attrName = (op.name || "").toLowerCase().trim();
    const ALLOWED_ATTRS = new Set(["title", "aria-label", "placeholder", "type", "data-action"]);
    if (!ALLOWED_ATTRS.has(attrName)) throw new Error(`Atributo '${attrName}' não permitido.`);
    const cleanVal = (op.value || "").replace(/"/g, "&quot;");
    let updatedTag = openTag;
    const attrRegex = new RegExp(`${attrName}=["'][^"']*["']`, "i");
    if (attrRegex.test(openTag)) {
      updatedTag = openTag.replace(attrRegex, `${attrName}="${cleanVal}"`);
    } else {
      updatedTag = openTag.replace(/>$/, ` ${attrName}="${cleanVal}">`).replace(/\/?>$/, ` ${attrName}="${cleanVal}" />`);
    }
    const replaced = isSelfClosing ? updatedTag : `${updatedTag}${innerContent}${closeTag}`;
    return html.slice(0, startIndex) + replaced + html.slice(endIndex);
  }

  if (op.type === "setToken") {
    const { property, value } = sanitizeStyleToken(op.property, op.value);
    let updatedTag = openTag;
    const styleRegex = /style=["']([^"']*)["']/i;
    const styleMatch = styleRegex.exec(openTag);
    if (styleMatch) {
      const existingStyles = styleMatch[1].split(";").map((s) => s.trim()).filter(Boolean);
      const filtered = existingStyles.filter((s) => !s.startsWith(`${property}:`));
      filtered.push(`${property}: ${value}`);
      updatedTag = openTag.replace(styleRegex, `style="${filtered.join("; ")}"`);
    } else {
      updatedTag = openTag.replace(/>$/, ` style="${property}: ${value}">`).replace(/\/?>$/, ` style="${property}: ${value}" />`);
    }
    const replaced = isSelfClosing ? updatedTag : `${updatedTag}${innerContent}${closeTag}`;
    return html.slice(0, startIndex) + replaced + html.slice(endIndex);
  }

  throw new Error(`Operação desconhecida: ${op.type}`);
}

/**
 * Gera preview do diff unificado para uma edição mecânica.
 */
function previewPrototypeEdit(projectDir, protoId, screenId, pid, op, deps = { fs, path }) {
  const baseDir = getPrototypesBaseDir(projectDir, deps);
  const screenFile = deps.path.join(baseDir, protoId, "screens", `${screenId || "home"}.html`);
  if (!deps.fs.existsSync(screenFile)) throw new Error("Tela não encontrada.");

  const currentContent = deps.fs.readFileSync(screenFile, "utf8");
  const fingerprint = calculateFingerprint(currentContent);
  const mutatedContent = mutateHtmlByPid(currentContent, pid, op);
  const diff = makeUnifiedDiff(`screens/${screenId || "home"}.html`, currentContent, mutatedContent);

  return { ok: true, fingerprint, diff, mutatedContent };
}

/**
 * Aplica a edição mecânica com validação de fingerprint e histórico de undo.
 */
function applyPrototypeEdit(projectDir, protoId, screenId, pid, op, expectedFingerprint, deps = { fs, path }) {
  const baseDir = getPrototypesBaseDir(projectDir, deps);
  const protoDir = deps.path.join(baseDir, protoId);
  const screenFile = deps.path.join(protoDir, "screens", `${screenId || "home"}.html`);
  if (!deps.fs.existsSync(screenFile)) throw new Error("Tela não encontrada.");

  const currentContent = deps.fs.readFileSync(screenFile, "utf8");
  const currentFingerprint = calculateFingerprint(currentContent);

  if (expectedFingerprint && expectedFingerprint !== currentFingerprint) {
    return { ok: false, conflict: true, error: "Conflito de concorrência: o arquivo foi alterado por outro processo (HTTP 409)." };
  }

  const mutatedContent = mutateHtmlByPid(currentContent, pid, op);

  // Pilha de undo
  const stackKey = `${protoId}:${screenId || "home"}`;
  const stack = undoStacks.get(stackKey) || [];
  stack.push({ screenFile, content: currentContent, version: Date.now() });
  if (stack.length > MAX_UNDO_ITEMS) stack.shift();
  undoStacks.set(stackKey, stack);

  // Gravação atômica
  const tmpFile = `${screenFile}.tmp-${Date.now()}`;
  deps.fs.writeFileSync(tmpFile, mutatedContent, "utf8");
  deps.fs.renameSync(tmpFile, screenFile);

  const newFingerprint = calculateFingerprint(mutatedContent);
  return { ok: true, newFingerprint };
}

/**
 * Desfaz a última edição mecânica aplicada na tela.
 */
function undoPrototypeEdit(projectDir, protoId, screenId, deps = { fs, path }) {
  const stackKey = `${protoId}:${screenId || "home"}`;
  const stack = undoStacks.get(stackKey) || [];
  if (stack.length === 0) return { ok: false, error: "Nenhuma alteração para desfazer nesta tela." };

  const lastState = stack.pop();
  if (lastState && deps.fs.existsSync(lastState.screenFile)) {
    const tmpFile = `${lastState.screenFile}.tmp-${Date.now()}`;
    deps.fs.writeFileSync(tmpFile, lastState.content, "utf8");
    deps.fs.renameSync(tmpFile, lastState.screenFile);
    return { ok: true, newFingerprint: calculateFingerprint(lastState.content) };
  }
  return { ok: false, error: "Falha ao restaurar estado de undo." };
}

module.exports = {
  sanitizeText,
  sanitizeClass,
  sanitizeStyleToken,
  calculateFingerprint,
  makeUnifiedDiff,
  mutateHtmlByPid,
  previewPrototypeEdit,
  applyPrototypeEdit,
  undoPrototypeEdit,
};
