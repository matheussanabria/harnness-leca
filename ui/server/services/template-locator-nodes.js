// @ts-check
// Tokenização dos nós do template Angular.

/**
 * Tokenizador e localizador cirúrgico de elementos em templates Angular (.html).
 * Sem dependências externas, tolerante à sintaxe de template do Angular (@if, @for, [prop], etc.).
 */

/**
 * @typedef {Object} TemplateNode
 * @property {string} tag
 * @property {number} start
 * @property {number} end
 * @property {number} openTagStart
 * @property {number} openTagEnd
 * @property {number} contentStart
 * @property {number} contentEnd
 * @property {string} text
 * @property {Record<string, string>} attributes
 * @property {Record<string, string>} bindings
 * @property {boolean} isSelfClosing
 * @property {boolean} insideLoop
 * @property {boolean} isConditional
 * @property {number} line
 */

/**
 * Tokeniza tags HTML e controle de fluxo do template Angular.
 * @param {string} html
 * @returns {TemplateNode[]}
 */
function parseTemplateNodes(html) {
  const nodes = [];
  const tagRegex = /<([a-zA-Z0-9_-]+)([\s\S]*?)(\/?)>|<!--[\s\S]*?-->/g;
  let match;

  while ((match = tagRegex.exec(html)) !== null) {
    if (match[0].startsWith("<!--")) continue;

    const tagName = match[1].toLowerCase();
    const rawAttrs = match[2] || "";
    const isSelfClosing = match[3] === "/" || ["input", "img", "br", "hr", "meta"].includes(tagName);

    const openTagStart = match.index;
    const openTagEnd = openTagStart + match[0].length;

    // Calcula linha
    const preContent = html.slice(0, openTagStart);
    const line = preContent.split("\n").length;

    // Detecta contexto de @for ou @if prévio
    const textBefore = preContent.slice(Math.max(0, openTagStart - 500));
    const openForMatches = (textBefore.match(/@for\s*\([^)]+\)\s*\{/g) || []).length;
    const closeBraceMatches = (textBefore.match(/\}/g) || []).length;
    const isInsideAngularFor = openForMatches > closeBraceMatches;

    // Extrai atributos e bindings
    const attributes = /** @type {Record<string, string>} */ ({});
    const bindings = /** @type {Record<string, string>} */ ({});
    const attrRegex = /([*\[\(]?[a-zA-Z0-9_.:-]+[\]\)]?)(?:\s*=\s*(?:'([^']*)'|"([^"]*)"|`([^`]*)`|([^\s>]+)))?/g;
    let attrMatch;

    let hasNgFor = false;
    let hasNgIf = false;

    while ((attrMatch = attrRegex.exec(rawAttrs)) !== null) {
      const rawName = attrMatch[1];
      const val = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? attrMatch[5] ?? "";

      if (rawName.startsWith("*ngFor") || rawName === "*ngFor") {
        hasNgFor = true;
      }
      if (rawName.startsWith("*ngIf") || rawName === "*ngIf") {
        hasNgIf = true;
      }

      if (rawName.startsWith("[") || rawName.startsWith("(") || rawName.startsWith("*")) {
        bindings[rawName] = val;
      } else {
        attributes[rawName] = val;
      }
    }

    let contentStart = openTagEnd;
    let contentEnd = openTagEnd;
    let nodeEnd = openTagEnd;
    let text = "";

    if (!isSelfClosing) {
      // Procura a tag de fechamento correspondente
      const closeTagStr = `</${tagName}>`;
      const closeIdx = html.indexOf(closeTagStr, openTagEnd);
      if (closeIdx !== -1) {
        contentEnd = closeIdx;
        nodeEnd = closeIdx + closeTagStr.length;
        const inner = html.slice(contentStart, contentEnd);
        // Pega texto estático imediato (sem tags aninhadas)
        text = inner.replace(/<[^>]*>/g, "").trim();
      }
    }

    nodes.push({
      tag: tagName,
      start: openTagStart,
      end: nodeEnd,
      openTagStart,
      openTagEnd,
      contentStart,
      contentEnd,
      text,
      attributes,
      bindings,
      isSelfClosing,
      insideLoop: isInsideAngularFor || hasNgFor,
      isConditional: hasNgIf,
      line,
    });
  }

  return nodes;
}

/**
 * Remove atributos e classes adicionadas pelo runtime do Angular (_ngcontent, _nghost, ng-reflect, classes ng-*).
 * @param {Record<string, string>} [attrs]
 * @returns {Record<string, string>}
 */
function cleanRuntimeAttrs(attrs = {}) {
  const clean = {};
  for (const [key, val] of Object.entries(attrs)) {
    const k = key.toLowerCase();
    if (k.startsWith("_ngcontent") || k.startsWith("_nghost") || k.startsWith("ng-reflect") || k === "ng-version") {
      continue;
    }
    if (k === "class" && typeof val === "string") {
      const filtered = val.split(/\s+/).filter((c) => c && !c.startsWith("ng-")).join(" ");
      if (filtered) clean["class"] = filtered;
    } else {
      clean[key] = val;
    }
  }
  return clean;
}

module.exports = { parseTemplateNodes, cleanRuntimeAttrs };
