// @ts-check
"use strict";

/**
 * Transforma o HTML de uma tela modelo do DS em tela editável do Ateliê:
 * data-pid estáveis, componentes marcados, navegação `goto:` e imagens embutidas.
 */

const SKIP_TAGS = new Set(["script", "style", "html", "head", "body", "meta", "link", "title"]);

const stripTags = (html) => html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

/** Aplica `fn` só ao HTML fora de comentários, <script> e <style>. */
function mapMarkup(html, fn) {
  const guarded = /<!--[\s\S]*?-->|<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>/gi;
  let out = "";
  let last = 0;
  for (const match of html.matchAll(guarded)) {
    out += fn(html.slice(last, match.index)) + match[0];
    last = match.index + match[0].length;
  }
  return out + fn(html.slice(last));
}

/** Injeta `data-pid="p-N"` em toda tag de abertura que ainda não tenha. */
function injectPids(html, start = 0) {
  let counter = start;
  const text = mapMarkup(html, (chunk) => chunk.replace(/<([a-zA-Z][\w-]*)((?:\s[^<>]*?)?)(\/?)>/g, (all, tag, attrs, selfClose) => {
    if (SKIP_TAGS.has(tag.toLowerCase()) || /\sdata-pid\s*=/.test(` ${attrs}`)) return all;
    counter += 1;
    const body = attrs.trim();
    return `<${tag}${body ? ` ${body}` : ""} data-pid="p-${counter}"${selfClose}>`;
  }));
  return { html: text, count: counter - start };
}

/** Mapa classe-raiz -> id de componente (só classes que identificam um único componente). */
function buildRootClassMap(components) {
  const seen = new Map();
  for (const item of components) {
    const root = /<([a-zA-Z][\w-]*)\s[^>]*?class="([^"]+)"/.exec(item.html || "");
    const cls = root ? root[2].trim().split(/\s+/)[0] : "";
    if (!cls) continue;
    seen.set(cls, seen.has(cls) ? null : item.id);
  }
  return new Map([...seen].filter(([, id]) => id));
}

/** Marca com `data-component` as tags cuja primeira classe é a raiz de um componente. */
function markComponents(html, rootMap) {
  return mapMarkup(html, (chunk) => chunk.replace(/<([a-zA-Z][\w-]*)(\s[^<>]*?class="([^"]+)"[^<>]*?)>/g, (all, tag, attrs, cls) => {
    const id = rootMap.get(cls.trim().split(/\s+/)[0]);
    return id && !/\sdata-component=/.test(attrs) ? `<${tag}${attrs} data-component="${id}">` : all;
  }));
}

/**
 * Liga botões e links à navegação. Cada regra: { cls?, notCls?, text?, goto }.
 * `cls` casa por classe contida; `text` pelo texto exato do elemento.
 */
function wireNavigation(html, rules) {
  return mapMarkup(html, (chunk) => chunk.replace(/<(button|a)(\s[^<>]*)>([\s\S]*?)<\/\1>/g, (all, tag, attrs, inner) => {
    if (/\sdata-action=/.test(attrs)) return all;
    const text = stripTags(inner);
    const cls = (/class="([^"]*)"/.exec(attrs) || [, ""])[1];
    const classes = cls.split(/\s+/);
    const rule = rules.find((r) => (!r.cls || classes.includes(r.cls)) && !(r.notCls && classes.includes(r.notCls)) && (!r.text || r.text === text));
    return rule ? `<${tag}${attrs} data-action="goto:${rule.goto}">${inner}</${tag}>` : all;
  }));
}

/** Troca `src="..."` conhecidos por data URI (o sandbox só aceita img-src 'self' data:). */
function inlineAssets(html, assets) {
  let out = html;
  for (const [needle, dataUri] of Object.entries(assets)) out = out.split(`src="${needle}"`).join(`src="${dataUri}"`);
  return out;
}

/** Remove `<img>` que apontam para recursos externos que o sandbox bloquearia. */
function dropBlockedImages(html) {
  return html.replace(/\s*<img\b[^>]*\ssrc="(?:https?:)?\/\/?[^"]*"[^>]*>/g, (all) => (/src="data:/.test(all) ? all : ""));
}

/** Navegação por URL no JavaScript do DS vira `harnessGoto('<tela>')`. */
function rewriteScript(js, urlMap) {
  let out = js;
  for (const [url, screen] of Object.entries(urlMap)) {
    out = out.replace(new RegExp(`location\\.href\\s*=\\s*'${url.replace(/[/.]/g, "\\$&")}'`, "g"), `harnessGoto('${screen}')`);
  }
  return out;
}

/** Script da tela: isolado em IIFE com try/catch para um erro não derrubar o resto. */
function wrapScript(js) {
  return `<script>\n(function () {\n  try {\n${js.split("\n").map((l) => `    ${l}`).join("\n")}\n  } catch (error) { console.error("[tela]", error); }\n})();\n</script>`;
}

module.exports = {
  stripTags, mapMarkup, injectPids, buildRootClassMap, markComponents, wireNavigation,
  inlineAssets, dropBlockedImages, rewriteScript, wrapScript,
};
