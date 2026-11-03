"use strict";

const vm = require("vm");

const SCRIPT_RE = /<script\b([^>]*)>([\s\S]*?)<\/script[^>]*>/gi;

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
  const storage = storageGuard(text);
  if (storage) return storage;
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

const STORAGE_HINT =
  "Use um wrapper seguro: window.LPS=window.LPS||(function(){var o={};try{o=JSON.parse(window.name||'{}')||{}}catch(e){}var ls=null;try{ls=window.localStorage;ls.getItem('x')}catch(e){ls=null}" +
  "return{getItem:function(k){if(ls){try{return ls.getItem(k)}catch(e){}}return o[k]==null?null:o[k]},setItem:function(k,v){v=String(v);if(ls){try{ls.setItem(k,v);return}catch(e){}}o[k]=v;try{window.name=JSON.stringify(o)}catch(e){}}," +
  "removeItem:function(k){if(ls){try{ls.removeItem(k)}catch(e){}}delete o[k];try{window.name=JSON.stringify(o)}catch(e){}}}})(); e troque localStorage. por LPS.";
const LPS_DEF = /window\.LPS\s*=\s*window\.LPS\s*\|\|\s*\(function\(\)\{[\s\S]*?\}\)\(\);/;

/**
 * The preview iframe is sandboxed without allow-same-origin, so direct
 * localStorage/sessionStorage access throws and the screen renders empty.
 * Scripts may touch them only inside the LPS wrapper, which probes safely.
 */
function storageGuard(text) {
  const re = new RegExp(SCRIPT_RE.source, "gi");
  const bodies = [];
  let m;
  while ((m = re.exec(text))) bodies.push(m[2]);
  const code = bodies.join("\n").replace(LPS_DEF, "");
  if (!/\b(?:localStorage|sessionStorage)\b/.test(code)) return null;
  return "O preview roda em iframe sandbox e bloqueia localStorage/sessionStorage (a tela fica vazia). " + STORAGE_HINT;
}

module.exports = { validateScreenHtml };
