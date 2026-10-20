// @ts-check
// Extração de metadados de componentes Angular.
const { escapeRegExp, normalizeComponentName } = require("./component-resolver-utils");

/**
 * Analisa o conteúdo de um arquivo TypeScript para extrair metadados do @Component.
 * Aceita tanto o nome da classe (ex: DispensaMedicamentoComponent) quanto o seletor (ex: app-dispensa-medicamento),
 * tolerando prefixos como _ ou ɵ emitidos pelo compilador esbuild.
 * @param {string} content
 * @param {string} identifier
 */
function parseComponentMetadata(content, identifier) {
  if (!identifier || typeof identifier !== "string") return null;

  let targetClass = identifier;
  const safeId = escapeRegExp(identifier);
  const normalizedId = normalizeComponentName(identifier);
  const safeNormalized = escapeRegExp(normalizedId);

  // Procura seletor correspondente no arquivo
  const selRegex = new RegExp(`selector\\s*:\\s*['"\`](${safeId}|${safeNormalized})['"\`]`);
  const selMatch = content.match(selRegex);
  if (selMatch && selMatch.index !== undefined) {
    const afterSel = content.slice(selMatch.index);
    const clsMatch = afterSel.match(/export\s+class\s+([A-Za-z0-9_]+)\b/);
    if (clsMatch) {
      targetClass = clsMatch[1];
    }
  }

  // Regex para achar a declaração da classe (tenta nome fornecido, depois normalizado)
  let classRegex = new RegExp(`export\\s+class\\s+${escapeRegExp(targetClass)}\\b`);
  let classMatch = content.match(classRegex);
  if (!classMatch && normalizedId && normalizedId !== targetClass) {
    targetClass = normalizedId;
    classRegex = new RegExp(`export\\s+class\\s+${escapeRegExp(targetClass)}\\b`);
    classMatch = content.match(classRegex);
  }

  if (!classMatch || classMatch.index === undefined) return null;

  // Pega o trecho que antecede a classe onde vive o @Component
  const beforeClass = content.slice(0, classMatch.index);
  const compIdx = beforeClass.lastIndexOf("@Component");
  if (compIdx === -1) return null;

  const decoratorBlock = beforeClass.slice(compIdx);

  // Extrai selector
  const compSelMatch = decoratorBlock.match(/selector\s*:\s*['"`]([^'"`]+)['"`]/);
  const selector = compSelMatch ? compSelMatch[1] : null;

  // Extrai templateUrl ou template inline (crase multiline, aspas simples ou aspas duplas)
  const tmplUrlMatch = decoratorBlock.match(/templateUrl\s*:\s*['"`]([^'"`]+)['"`]/);
  const tmplInlineMatch = decoratorBlock.match(/template\s*:\s*(?:`([\s\S]*?)`|'([^']*)'|"([^"]*)")/);
  const templateUrl = tmplUrlMatch ? tmplUrlMatch[1] : null;
  const inlineTemplate = tmplInlineMatch ? (tmplInlineMatch[1] ?? tmplInlineMatch[2] ?? tmplInlineMatch[3] ?? "") : null;

  // Extrai styleUrl (Angular 17+), styleUrls (Array) ou styles (Array inline)
  const styleUrls = [];
  const inlineStyles = [];

  const singleStyleMatch = decoratorBlock.match(/styleUrl\s*:\s*['"`]([^'"`]+)['"`]/);
  if (singleStyleMatch) {
    styleUrls.push(singleStyleMatch[1]);
  } else {
    const multiStyleMatch = decoratorBlock.match(/styleUrls\s*:\s*\[([\s\S]*?)\]/);
    if (multiStyleMatch) {
      const entries = multiStyleMatch[1].matchAll(/['"`]([^'"`]+)['"`]/g);
      for (const m of entries) {
        styleUrls.push(m[1]);
      }
    }
  }

  const inlineStylesMatch = decoratorBlock.match(/styles\s*:\s*\[([\s\S]*?)\]/);
  if (inlineStylesMatch) {
    const entries = inlineStylesMatch[1].matchAll(/(?:`([\s\S]*?)`|'([^']*)'|"([^"]*)")/g);
    for (const m of entries) {
      inlineStyles.push(m[1] ?? m[2] ?? m[3] ?? "");
    }
  }

  // Verifica standalone
  const standaloneMatch = decoratorBlock.match(/standalone\s*:\s*(true|false)/);
  const standalone = standaloneMatch ? standaloneMatch[1] === "true" : true;

  return {
    className: targetClass,
    selector,
    templateUrl,
    inlineTemplate,
    styleUrls,
    inlineStyles,
    standalone,
  };
}

module.exports = { parseComponentMetadata };
