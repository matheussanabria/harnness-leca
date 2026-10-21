// @ts-check
const fs = require("fs");
const path = require("path");
const { getPrototypesBaseDir } = require("./prototype-storage.service");
const { injectDataPidAttributes } = require("./prototype-sanitizer.service");
const { calculateFingerprint, makeUnifiedDiff } = require("./prototype-editor.service");

/**
 * Encontra os limites (início e fim) de um nó com data-node-id ou data-pid no HTML.
 * @param {string} html
 * @param {string} pid
 */
function findNodeRangeByPid(html, pid) {
  const openRegex = new RegExp(`(<([a-zA-Z0-9_-]+)[^>]*?(?:data-node-id|data-pid)=["']${pid}["'][^>]*?)(\\/?>)`, "i");
  const match = openRegex.exec(html);
  if (!match) return null;

  const startIndex = match.index;
  const fullOpenTag = match[0];
  const tagName = match[2].toLowerCase();
  const isSelfClosing = match[3] === "/>" || ["img", "input", "br", "hr", "meta", "link"].includes(tagName);

  if (isSelfClosing) {
    return {
      startIndex,
      endIndex: startIndex + fullOpenTag.length,
      fullMatch: fullOpenTag,
      openTag: fullOpenTag,
      innerContent: "",
      closeTag: "",
      isSelfClosing: true,
      tagName,
    };
  }

  let cursor = startIndex + fullOpenTag.length;
  const innerStart = cursor;
  let depth = 1;
  const tagRegex = new RegExp(`(<\\/?${tagName}\\b[^>]*>)`, "gi");
  tagRegex.lastIndex = cursor;

  let m;
  let closeStart = -1;
  let closeEnd = -1;

  while ((m = tagRegex.exec(html)) !== null) {
    const t = m[0];
    if (t.startsWith("</")) {
      depth--;
      if (depth === 0) {
        closeStart = m.index;
        closeEnd = m.index + t.length;
        break;
      }
    } else if (!t.endsWith("/>")) {
      depth++;
    }
  }

  if (closeStart === -1) {
    const simpleClose = `</${tagName}>`;
    const simpleIdx = html.indexOf(simpleClose, cursor);
    if (simpleIdx !== -1) {
      closeStart = simpleIdx;
      closeEnd = simpleIdx + simpleClose.length;
    } else {
      return null;
    }
  }

  return {
    startIndex,
    endIndex: closeEnd,
    fullMatch: html.slice(startIndex, closeEnd),
    openTag: fullOpenTag,
    innerContent: html.slice(innerStart, closeStart),
    closeTag: html.slice(closeStart, closeEnd),
    isSelfClosing: false,
    tagName,
  };
}

/**
 * Executa mutações estruturais (remove, duplicate, move, insertBlock) sobre um nó por data-pid.
 * @param {string} html
 * @param {string} pid
 * @param {object} op
 * @param {string} [snippetHtml]
 */
function mutateStructuralHtml(html, pid, op, snippetHtml = "") {
  const range = findNodeRangeByPid(html, pid);
  if (!range) {
    throw new Error(`Elemento com data-pid="${pid}" não encontrado.`);
  }

  if (op.type === "remove") {
    return html.slice(0, range.startIndex) + html.slice(range.endIndex);
  }

  if (op.type === "duplicate") {
    // Duplica o bloco e reatribui novos data-pid para evitar colisão
    let duplicated = range.fullMatch.replace(/data-pid="p-\d+"/g, () => `data-pid="p-${Date.now().toString().slice(-4)}${Math.floor(Math.random() * 100)}"`);
    return html.slice(0, range.endIndex) + "\n" + duplicated + html.slice(range.endIndex);
  }

  if (op.type === "insertBlock") {
    const rawBlock = snippetHtml || `<div class="ds-card" data-pid="p-new"><!-- Bloco ${op.componentId || 'DS'} --></div>`;
    const blockWithPids = injectDataPidAttributes(rawBlock);
    const position = op.position || "after"; // "before" | "after" | "inside"

    if (position === "inside" && !range.isSelfClosing) {
      const inserted = range.openTag + range.innerContent + "\n" + blockWithPids + range.closeTag;
      return html.slice(0, range.startIndex) + inserted + html.slice(range.endIndex);
    }
    if (position === "before") {
      return html.slice(0, range.startIndex) + blockWithPids + "\n" + html.slice(range.startIndex);
    }
    return html.slice(0, range.endIndex) + "\n" + blockWithPids + html.slice(range.endIndex);
  }

  if (op.type === "move") {
    const direction = op.direction || "down";
    const nodeText = range.fullMatch;

    if (direction === "up") {
      const before = html.slice(0, range.startIndex);
      const prevPidMatch = [...before.matchAll(/data-pid=["'](p-[^"']+)["']/gi)].pop();
      if (!prevPidMatch) return html;
      const prevPid = prevPidMatch[1];
      const prevRange = findNodeRangeByPid(html, prevPid);
      if (prevRange && prevRange.endIndex <= range.startIndex) {
        const between = html.slice(prevRange.endIndex, range.startIndex);
        if (!between.includes("</") && !between.includes("<")) {
          return (
            html.slice(0, prevRange.startIndex) +
            nodeText +
            between +
            prevRange.fullMatch +
            html.slice(range.endIndex)
          );
        }
      }
    } else {
      const after = html.slice(range.endIndex);
      const nextPidMatch = /data-pid=["'](p-[^"']+)["']/i.exec(after);
      if (!nextPidMatch) return html;
      const nextPid = nextPidMatch[1];
      const nextRange = findNodeRangeByPid(html, nextPid);
      if (nextRange && nextRange.startIndex >= range.endIndex) {
        const between = html.slice(range.endIndex, nextRange.startIndex);
        if (!between.includes("</") && !between.includes("<")) {
          return (
            html.slice(0, range.startIndex) +
            nextRange.fullMatch +
            between +
            nodeText +
            html.slice(nextRange.endIndex)
          );
        }
      }
    }
    return html;
  }

  throw new Error(`Operação estrutural desconhecida: ${op.type}`);
}

/**
 * Registra um componente candidato extraído a partir do protótipo no proto.json e MAPA.md.
 * @param {string} projectDir
 * @param {string} protoId
 * @param {object} candidate
 * @param {object} [deps]
 */
function extractComponentCandidate(projectDir, protoId, candidate, deps = { fs, path }) {
  const baseDir = getPrototypesBaseDir(projectDir, deps);
  const protoDir = deps.path.join(baseDir, protoId);
  if (!deps.fs.existsSync(protoDir)) throw new Error("Protótipo não encontrado.");

  const protoJsonFile = deps.path.join(protoDir, "proto.json");
  let protoJson = { id: protoId, components: [] };
  if (deps.fs.existsSync(protoJsonFile)) {
    try { protoJson = JSON.parse(deps.fs.readFileSync(protoJsonFile, "utf8")); } catch {}
  }

  const compId = (candidate.id || candidate.name || "comp").toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
  const compName = candidate.name || compId.split("-").map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join("") + "Component";

  const newEntry = {
    id: compId,
    name: compName,
    screen: candidate.screen || "home",
    pid: candidate.pid || "",
    stage: "extracted",
    extractedAt: new Date().toISOString(),
  };

  const existingIdx = (protoJson.components || []).findIndex((c) => c.id === compId);
  if (existingIdx !== -1) {
    protoJson.components[existingIdx] = { ...protoJson.components[existingIdx], ...newEntry };
  } else {
    protoJson.components = [...(protoJson.components || []), newEntry];
  }

  deps.fs.writeFileSync(protoJsonFile, JSON.stringify(protoJson, null, 2), "utf8");

  // Atualiza seção no MAPA.md
  const mapaFile = deps.path.join(protoDir, "MAPA.md");
  if (deps.fs.existsSync(mapaFile)) {
    try {
      let mapa = deps.fs.readFileSync(mapaFile, "utf8");
      const candLine = `- **${compName}** (\`${compId}\`) - extraído da tela \`${candidate.screen || 'home'}\` (${candidate.pid || ''})`;
      if (!mapa.includes(compId)) {
        mapa = mapa.replace(/## Componentes Candidatos[\s\S]*$/, (match) => `${match.trim()}\n${candLine}\n`);
        deps.fs.writeFileSync(mapaFile, mapa, "utf8");
      }
    } catch {}
  }

  return { ok: true, component: newEntry };
}

/**
 * Desfaz a extração: remove o componente do proto.json (e do MAPA.md). O elemento volta a ser só HTML + CSS.
 * @param {string} projectDir
 * @param {string} protoId
 * @param {{ id?: string, pid?: string, screen?: string }} target
 * @param {object} [deps]
 */
function removeComponentCandidate(projectDir, protoId, target, deps = { fs, path }) {
  const protoDir = deps.path.join(getPrototypesBaseDir(projectDir, deps), protoId);
  const protoJsonFile = deps.path.join(protoDir, "proto.json");
  if (!deps.fs.existsSync(protoJsonFile)) throw new Error("Protótipo não encontrado.");
  const protoJson = JSON.parse(deps.fs.readFileSync(protoJsonFile, "utf8"));
  const list = Array.isArray(protoJson.components) ? protoJson.components : [];
  const removed = list.filter((c) => (target.id && c.id === target.id) || (target.pid && c.pid === target.pid && (!target.screen || !c.screen || c.screen === target.screen)));
  if (!removed.length) throw new Error("Este elemento não está registrado como componente.");
  protoJson.components = list.filter((c) => !removed.includes(c));
  deps.fs.writeFileSync(protoJsonFile, JSON.stringify(protoJson, null, 2), "utf8");

  const mapaFile = deps.path.join(protoDir, "MAPA.md");
  if (deps.fs.existsSync(mapaFile)) {
    try {
      const ids = removed.map((c) => c.id);
      const mapa = deps.fs.readFileSync(mapaFile, "utf8").split("\n").filter((l) => !ids.some((id) => l.startsWith("- **") && l.includes(`(\`${id}\`)`))).join("\n");
      deps.fs.writeFileSync(mapaFile, mapa, "utf8");
    } catch {}
  }
  return { ok: true, removed: removed.map((c) => c.id) };
}

module.exports = {
  findNodeRangeByPid,
  mutateStructuralHtml,
  extractComponentCandidate,
  removeComponentCandidate,
};
