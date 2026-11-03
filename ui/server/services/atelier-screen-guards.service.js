"use strict";

const vm = require("vm");

const SCRIPT_RE = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;

/**
 * Validates an HTML screen written by the agent before it reaches disk.
 * Returns null when fine, or a message the agent can act on.
 * Catches the two corruptions seen in production: leaked tool/prose text
 * inside the payload and inline scripts that no longer parse.
 * @param {string} html
 * @returns {string|null}
 */
function validateScreenHtml(html) {
  const text = String(html || "");
  if (/<\/?tool\b/i.test(text)) {
    return "O HTML contém uma tag <tool>: o conteúdo da tela vazou para dentro de outra chamada. Reenvie só o HTML da tela, sem texto fora dele.";
  }
  const roots = text.match(/class\s*=\s*["'][^"']*\blp-app\b/g) || [];
  if (roots.length > 1) {
    return `A tela tem ${roots.length} raízes "lp-app" (conteúdo duplicado). Envie a tela uma única vez.`;
  }
  let m;
  SCRIPT_RE.lastIndex = 0;
  while ((m = SCRIPT_RE.exec(text))) {
    if (/\bsrc\s*=/i.test(m[1]) || /type\s*=\s*["'](?!module|text\/javascript)/i.test(m[1])) continue;
    try {
      new vm.Script(m[2].replace(/\sdata-pid="p-\d+"/g, ""));
    } catch (err) {
      return `Um <script> inline da tela tem erro de sintaxe (${err.message}). Corrija e reenvie; o arquivo não foi gravado.`;
    }
  }
  return null;
}

module.exports = { validateScreenHtml };
