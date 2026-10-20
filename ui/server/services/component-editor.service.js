// @ts-check
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { isInside, resolveComponent } = require("./component-resolver.service");
const { locateElementInTemplate } = require("./template-locator.service");

const MAX_UNDO_ITEMS = 20;

function sanitizeText(text) {
  if (typeof text !== "string") throw new Error("Texto inválido");
  if (text.includes("{{") || text.includes("}}")) {
    throw new Error("Texto não pode conter interpolação Angular ({{ ou }})");
  }
  if (text.includes("<script") || text.includes("</script>")) {
    throw new Error("Texto contém tags perigosas (<script>)");
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

function generateFingerprint(content, mtimeMs) {
  const hash = crypto.createHash("sha256").update(content).digest("hex").slice(0, 16);
  return `${hash}:${Math.floor(mtimeMs)}`;
}

function makeUnifiedDiff(fileName, oldText, newText) {
  const oldLines = oldText.split(/\r?\n/);
  const newLines = newText.split(/\r?\n/);

  let start = 0;
  while (start < oldLines.length && start < newLines.length && oldLines[start] === newLines[start]) {
    start++;
  }
  let oldEnd = oldLines.length - 1;
  let newEnd = newLines.length - 1;
  while (oldEnd >= start && newEnd >= start && oldLines[oldEnd] === newLines[newEnd]) {
    oldEnd--;
    newEnd--;
  }

  const removed = oldLines.slice(start, oldEnd + 1);
  const added = newLines.slice(start, newEnd + 1);
  const header = `--- a/${fileName}\n+++ b/${fileName}\n@@ -${start + 1},${removed.length} +${start + 1},${added.length} @@\n`;
  const diffBody = [...removed.map((l) => `-${l}`), ...added.map((l) => `+${l}`)].join("\n");
  return header + diffBody;
}

function applyChangeToHtml(content, target, change) {
  const loc = locateElementInTemplate(content, target);
  if (!loc.ok) return loc;

  const node = loc.node;
  let newContent = content;

  if (change.type === "text") {
    const safe = sanitizeText(change.value);
    newContent = content.slice(0, node.contentStart) + safe + content.slice(node.contentEnd);
  } else if (change.type === "class") {
    const rawTag = content.slice(node.openTagStart, node.openTagEnd);
    const safeCls = sanitizeClass(change.value);
    let newTag = rawTag;
    const classMatch = rawTag.match(/class\s*=\s*(['"])(.*?)\1/);

    if (change.action === "add-class") {
      if (classMatch) {
        const quote = classMatch[1];
        const existing = classMatch[2].trim().split(/\s+/).filter(Boolean);
        for (const c of safeCls.split(/\s+/).filter(Boolean)) {
          if (!existing.includes(c)) existing.push(c);
        }
        newTag = rawTag.replace(/class\s*=\s*(['"]).*?\1/, `class=${quote}${existing.join(" ")}${quote}`);
      } else {
        newTag = rawTag.replace(new RegExp(`^<${node.tag}\\b`), `<${node.tag} class="${safeCls}"`);
      }
    } else if (change.action === "remove-class" && classMatch) {
      const quote = classMatch[1];
      const existing = classMatch[2].trim().split(/\s+/).filter(Boolean);
      const toRemove = safeCls.split(/\s+/).filter(Boolean);
      const filtered = existing.filter((c) => !toRemove.includes(c));
      newTag = rawTag.replace(/class\s*=\s*(['"]).*?\1/, `class=${quote}${filtered.join(" ")}${quote}`);
    }
    newContent = content.slice(0, node.openTagStart) + newTag + content.slice(node.openTagEnd);
  } else {
    return { ok: false, reason: "unsupported-change", message: `Tipo de alteração '${change.type}' não suportado.` };
  }
  return { ok: true, newContent };
}

function validateEditableFile(repoRoot, relFile, componentName, options = {}) {
  const deps = options.deps || { fs, path };
  const resolvedRoot = deps.path.resolve(repoRoot);
  const targetAbs = deps.path.resolve(resolvedRoot, relFile);

  if (!isInside(resolvedRoot, targetAbs)) {
    throw new Error("Acesso negado: arquivo fora do repositório");
  }
  const ext = deps.path.extname(targetAbs).toLowerCase();
  if (![".html", ".scss", ".css"].includes(ext)) {
    throw new Error(`Edição permitida apenas para arquivos .html, .scss e .css (recebido: ${ext})`);
  }

  if (componentName) {
    const resolved = resolveComponent(repoRoot, componentName, { appCwd: options.appCwd, deps });
    if (resolved && resolved.found && resolved.files) {
      const allowed = [];
      if (resolved.files.html?.path) allowed.push(resolved.files.html.path.replace(/\\/g, "/"));
      for (const st of resolved.files.styles || []) {
        if (st.path) allowed.push(st.path.replace(/\\/g, "/"));
      }
      const normRel = relFile.replace(/\\/g, "/");
      const isAllowed = allowed.some((a) => normRel.endsWith(a) || a.endsWith(normRel));
      if (!isAllowed) {
        throw new Error(`Arquivo '${relFile}' não pertence aos templates/estilos do componente '${componentName}'`);
      }
    }
  }
  return targetAbs;
}

function previewEdit(repoRoot, params) {
  const { file, componentName, target, change, appCwd, deps = { fs, path } } = params;
  const absPath = validateEditableFile(repoRoot, file, componentName, { appCwd, deps });

  const raw = deps.fs.readFileSync(absPath, "utf8");
  const stat = deps.fs.statSync(absPath);
  const fingerprint = generateFingerprint(raw, stat.mtimeMs);

  const applied = applyChangeToHtml(raw, target, change);
  if (!applied.ok) return applied;

  const diff = makeUnifiedDiff(deps.path.basename(file), raw, applied.newContent);
  return { ok: true, diff, fingerprint, newContent: applied.newContent, warnings: [] };
}

function applyEdit(repoRoot, projectDir, params) {
  const { file, componentName, target, change, fingerprint, appCwd, deps = { fs, path } } = params;
  const absPath = validateEditableFile(repoRoot, file, componentName, { appCwd, deps });

  const currentRaw = deps.fs.readFileSync(absPath, "utf8");
  const currentStat = deps.fs.statSync(absPath);
  const currentFp = generateFingerprint(currentRaw, currentStat.mtimeMs);

  if (fingerprint && currentFp !== fingerprint) {
    const err = new Error("Arquivo foi modificado desde o preview. Gere um novo preview.");
    // @ts-ignore
    err.code = "CONFLICT_409";
    throw err;
  }

  const applied = applyChangeToHtml(currentRaw, target, change);
  if (!applied.ok) return applied;

  // Escrita atômica: cria .tmp e renomeia
  const tmpFile = `${absPath}.tmp.${Date.now()}`;
  deps.fs.writeFileSync(tmpFile, applied.newContent, "utf8");
  deps.fs.renameSync(tmpFile, absPath);

  // Backup para Undo
  const undoDir = deps.path.join(projectDir, ".inspector-undo");
  if (!deps.fs.existsSync(undoDir)) deps.fs.mkdirSync(undoDir, { recursive: true });

  const undoToken = `undo_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  const undoData = {
    token: undoToken,
    file,
    absPath,
    previousContent: currentRaw,
    appliedContent: applied.newContent,
    timestamp: Date.now(),
  };
  deps.fs.writeFileSync(deps.path.join(undoDir, `${undoToken}.json`), JSON.stringify(undoData), "utf8");

  try {
    const files = deps.fs.readdirSync(undoDir).filter((f) => f.startsWith("undo_") && f.endsWith(".json"));
    if (files.length > MAX_UNDO_ITEMS) {
      files.sort().slice(0, files.length - MAX_UNDO_ITEMS).forEach((f) => {
        try { deps.fs.unlinkSync(deps.path.join(undoDir, f)); } catch {}
      });
    }
  } catch {}

  return { ok: true, undoToken };
}

function undoEdit(projectDir, undoToken, options = {}) {
  const deps = options.deps || { fs, path };
  if (!undoToken || !/^undo_[a-zA-Z0-9_]+$/.test(undoToken)) {
    throw new Error("Token de desfazer inválido");
  }

  const undoFile = deps.path.join(projectDir, ".inspector-undo", `${undoToken}.json`);
  if (!deps.fs.existsSync(undoFile)) {
    throw new Error("Ponto de restauração não encontrado ou expirado");
  }

  const data = JSON.parse(deps.fs.readFileSync(undoFile, "utf8"));
  if (!deps.fs.existsSync(data.absPath)) {
    throw new Error("Arquivo alvo do restauração não encontrado");
  }

  const currentContent = deps.fs.readFileSync(data.absPath, "utf8");
  if (currentContent !== data.appliedContent) {
    throw new Error("Arquivo foi modificado após a aplicação; restauração automática cancelada para evitar conflitos");
  }

  const tmpFile = `${data.absPath}.undo.tmp.${Date.now()}`;
  deps.fs.writeFileSync(tmpFile, data.previousContent, "utf8");
  deps.fs.renameSync(tmpFile, data.absPath);

  try { deps.fs.unlinkSync(undoFile); } catch {}
  return { ok: true, restoredFile: data.file };
}

module.exports = {
  sanitizeText,
  sanitizeClass,
  sanitizeStyleToken,
  generateFingerprint,
  makeUnifiedDiff,
  validateEditableFile,
  previewEdit,
  applyEdit,
  undoEdit,
};
