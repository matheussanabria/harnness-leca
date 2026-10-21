// @ts-check
/** Formatadores leves (HTML e CSS) para a aba de código: indentação de 2 espaços, uma declaração por linha. */

const IND = "  ";
const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
const RAW = new Set(["pre", "textarea", "script", "style"]);
const MAX_TAG = 64;
const MAX_JOIN = 120;

/** Abre a tag em várias linhas (um atributo por linha) quando ela fica longa. */
function layoutTag(tag, pad) {
  if (tag.length + pad.length <= MAX_TAG) return pad + tag;
  const m = /^<([\w:-]+)([\s\S]*?)(\/?>)$/.exec(tag);
  if (!m) return pad + tag;
  const attrs = m[2].match(/[^\s=]+(?:=(?:"[^"]*"|'[^']*'|[^\s"'>]+))?/g) || [];
  if (attrs.length < 2) return pad + tag;
  return `${pad}<${m[1]}\n${attrs.map((a) => `${pad}${IND}${a}`).join("\n")}${m[3]}`;
}

/** @param {string} src */
export function formatHtml(src) {
  const tokens = String(src ?? "").match(/<!--[\s\S]*?-->|<[^>]+>|[^<]+/g) || [];
  const out = [];
  let depth = 0;
  let raw = 0;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const pad = IND.repeat(Math.max(0, depth));
    if (raw) {
      out.push(t);
      if (/^<\//.test(t)) { raw--; if (!raw) { depth--; out[out.length - 1] = pad.slice(IND.length) + t.trim(); } }
      continue;
    }
    if (!t.startsWith("<")) {
      const text = t.replace(/\s+/g, " ").trim();
      if (text) out.push(pad + text);
      continue;
    }
    if (t.startsWith("<!")) { out.push(pad + t); continue; }
    if (t.startsWith("</")) { depth--; out.push(IND.repeat(Math.max(0, depth)) + t); continue; }
    const name = (/^<([\w:-]+)/.exec(t)?.[1] || "").toLowerCase();
    if (t.endsWith("/>") || VOID.has(name)) { out.push(layoutTag(t, pad)); continue; }
    const next = tokens[i + 1];
    const after = tokens[i + 2];
    const close = `</${name}`;
    if (next && next.toLowerCase().startsWith(close) && (pad + t).length <= MAX_TAG) {
      out.push(pad + t + next);
      i += 1;
      continue;
    }
    if (next && !next.startsWith("<") && after && after.toLowerCase().startsWith(close) && !RAW.has(name) && (pad + t).length <= MAX_TAG) {
      const line = pad + t + next.replace(/\s+/g, " ").trim() + after;
      if (line.length <= MAX_JOIN) { out.push(line); i += 2; continue; }
    }
    out.push(layoutTag(t, pad));
    if (RAW.has(name)) raw = 1;
    depth++;
  }
  return out.join("\n");
}

/** @param {string} src */
export function formatCss(src) {
  const css = String(src ?? "");
  const out = [];
  let depth = 0;
  let buf = "";
  let paren = 0;
  let quote = "";
  const pad = () => IND.repeat(Math.max(0, depth));
  const flush = (suffix = "") => {
    const text = buf.replace(/\s+/g, " ").trim();
    if (text) out.push(`${pad()}${text}${suffix}`);
    buf = "";
  };
  for (let i = 0; i < css.length; i++) {
    const ch = css[i];
    if (quote) { buf += ch; if (ch === quote && css[i - 1] !== "\\") quote = ""; continue; }
    if (ch === '"' || ch === "'") { quote = ch; buf += ch; continue; }
    if (ch === "/" && css[i + 1] === "*") {
      flush();
      const end = css.indexOf("*/", i + 2);
      const stop = end === -1 ? css.length : end + 2;
      out.push(pad() + css.slice(i, stop).trim());
      i = stop - 1;
      continue;
    }
    if (ch === "(") paren++;
    if (ch === ")") paren = Math.max(0, paren - 1);
    if (paren === 0 && ch === "{") { flush(" {"); depth++; continue; }
    if (paren === 0 && ch === "}") {
      flush(buf.trim() && !buf.trim().endsWith(";") ? ";" : "");
      depth = Math.max(0, depth - 1);
      if (out.length && out[out.length - 1].endsWith(" {")) out[out.length - 1] += "}";
      else out.push(`${pad()}}`);
      if (depth === 0) out.push("");
      continue;
    }
    if (paren === 0 && ch === ";") { flush(";"); continue; }
    buf += ch;
  }
  flush();
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
