// @ts-check
// Leitura de frontmatter YAML simples dos SKILL.md.
function cleanBOM(str) {
  return str ? str.replace(/^\uFEFF/, "") : "";
}

function parseFrontmatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { attributes: {}, body: text };
  const rawMeta = match[1];
  const body = match[2];
  const attributes = {};
  const lines = rawMeta.split(/\r?\n/);
  let currentKey = null;
  let currentVal = [];

  const flush = () => {
    if (currentKey) {
      let val = currentVal.join(" ").trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      attributes[currentKey] = val;
    }
  };

  for (const line of lines) {
    const colonIdx = line.indexOf(":");
    if (!/^\s+/.test(line) && colonIdx !== -1) {
      flush();
      currentKey = line.slice(0, colonIdx).trim();
      let rest = line.slice(colonIdx + 1).trim();
      if (rest === ">-" || rest === ">" || rest === "|") {
        currentVal = [];
      } else {
        currentVal = [rest];
      }
    } else if (currentKey && /^\s+/.test(line)) {
      currentVal.push(line.trim());
    }
  }
  flush();
  return { attributes, body };
}

module.exports = { cleanBOM, parseFrontmatter };
