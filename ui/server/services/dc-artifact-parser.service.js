// @ts-check
// Leitura e validação de um .dc.html: separa template, lógica, helmet e props sem alterar o original.

/** @param {string} html */
function isDcArtifact(html) {
  return /<x-dc[\s>]/i.test(html) && /<script\b[^>]*\btype\s*=\s*["']text\/x-dc["'][^>]*>/i.test(html);
}

/** Decodifica as entidades usadas no atributo data-props. */
function decodeAttr(value) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/** Codifica valor para atributo HTML entre aspas duplas. */
function encodeAttr(value) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Separa o .dc.html em partes. Não altera o conteúdo; só divide.
 * @param {string} html
 */
function splitDcArtifact(html) {
  const warnings = [];
  const xdc = /<x-dc\b[^>]*>([\s\S]*)<\/x-dc\s*>/i.exec(html);
  if (!xdc) throw new Error("Bloco <x-dc> não encontrado no artefato.");
  let inner = xdc[1];

  let helmet = "";
  const helmetMatch = /<helmet\b[^>]*>([\s\S]*?)<\/helmet\s*>/i.exec(inner);
  if (helmetMatch) {
    helmet = helmetMatch[1].trim();
    inner = inner.replace(helmetMatch[0], "");
  }

  // A lógica pode estar dentro ou logo depois de </x-dc> (o runtime a localiza por script[data-dc-script]).
  const logicMatch = /<script\b([^>]*\btype\s*=\s*["']text\/x-dc["'][^>]*)>([\s\S]*?)<\/script\s*>/i.exec(html);
  if (!logicMatch) throw new Error("Bloco de lógica <script type=\"text/x-dc\"> não encontrado.");
  const logicAttrs = logicMatch[1].trim();
  const logic = logicMatch[2];
  inner = inner.replace(logicMatch[0], "");
  const rest = html.replace(xdc[0], "").replace(logicMatch[0], "");

  const propsRaw = /\bdata-props\s*=\s*"([^"]*)"/i.exec(logicAttrs)?.[1] ?? null;
  let props = {};
  if (propsRaw !== null) {
    try {
      props = JSON.parse(decodeAttr(propsRaw));
    } catch {
      warnings.push("data-props não é JSON válido; startScreen não foi lido.");
    }
  }

  const template = inner.trim();

  // Conteúdo fora do <x-dc> que não seja head/script de runtime é ignorado, mas registrado.
  const outside = rest
    .replace(/<head\b[\s\S]*?<\/head\s*>/i, "")
    .replace(/<\/?(html|body|!doctype)[^>]*>/gi, "")
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, "")
    .trim();
  if (outside) warnings.push("Conteúdo fora de <x-dc> foi ignorado.");

  return { helmet, template, logic, logicAttrs, propsRaw, props, warnings };
}

/**
 * Valida as partes antes de gravar. Retorna problemas bloqueantes e avisos.
 * @param {ReturnType<typeof splitDcArtifact>} parts
 */
function validateDcParts(parts) {
  /** @type {string[]} */
  const errors = [];
  /** @type {string[]} */
  const warnings = [...parts.warnings];

  if (/^\s*import\s/m.test(parts.logic) || /\brequire\s*\(/.test(parts.logic)) {
    errors.push("A lógica usa módulos externos (import/require). O runtime do Ateliê não carrega Babel nesta versão.");
  }
  if (/<\/script/i.test(parts.logic)) {
    errors.push("A lógica contém '</script', o que quebraria o bloco embutido.");
  }
  if (/<script\b/i.test(parts.template) || /<script\b/i.test(parts.helmet)) {
    errors.push("O template contém <script>. Scripts só são aceitos no bloco de lógica.");
  }

  const external = [...(parts.template + parts.helmet).matchAll(/(?:src|href)\s*=\s*["'](https?:\/\/[^"']+)["']/gi)]
    .map((m) => m[1])
    .filter((url) => !/^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(url));
  if (external.length) {
    warnings.push(`Recursos externos fora da CSP do sandbox (serão bloqueados): ${[...new Set(external)].join(", ")}`);
  }

  return { ok: errors.length === 0, errors, warnings };
}

/**
 * Lista os assets relativos referenciados (ex.: uploads/logo.png) em template e helmet.
 * @param {string} text
 * @returns {string[]}
 */
function findRelativeAssets(text) {
  const refs = new Set();
  for (const m of text.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']|url\(\s*["']?([^"')]+)["']?\s*\)/gi)) {
    const ref = (m[1] || m[2] || "").trim();
    if (!ref || /^(?:https?:|data:|blob:|\/\/|#|javascript:)/i.test(ref)) continue;
    refs.add(ref.replace(/^\.\//, ""));
  }
  return [...refs];
}

module.exports = {
  isDcArtifact,
  decodeAttr,
  encodeAttr,
  splitDcArtifact,
  validateDcParts,
  findRelativeAssets,
};
