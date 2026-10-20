// @ts-check
// Localização cirúrgica de um elemento no template.
const { parseTemplateNodes, cleanRuntimeAttrs } = require("./template-locator-nodes");

/**
 * Localiza um elemento alvo no template para edição direta.
 * @param {string} htmlContent
 * @param {object} target
 * @param {string} target.tag Tag do elemento (ex: 'span', 'button', 'p', 'h2')
 * @param {string} [target.text] Texto textual visível no elemento
 * @param {Record<string, string>} [target.attributes] Atributos estáticos conhecidos
 * @param {string[]} [target.classes] Classes limpas do elemento
 * @param {string} [target.domPath] Caminho do seletor DOM para desempate
 * @param {number} [target.sameTagSiblingIndex] Índice entre irmãos de mesma tag
 */
function locateElementInTemplate(htmlContent, target) {
  if (!htmlContent || typeof htmlContent !== "string") {
    return { ok: false, reason: "invalid-html", message: "Conteúdo de template vazio ou inválido." };
  }
  if (!target || !target.tag) {
    return { ok: false, reason: "invalid-target", message: "Alvo da inspeção não especificado." };
  }

  const tagLower = target.tag.toLowerCase();

  // Se o alvo for um componente filho customizado no template
  if (tagLower.includes("-") && !["ng-container", "ng-template", "ng-content"].includes(tagLower)) {
    // Se a tag é de componente filho, informa motivo child-component
    const allParsed = parseTemplateNodes(htmlContent);
    const hasChildTag = allParsed.some((n) => n.tag === tagLower);
    if (hasChildTag) {
      return {
        ok: false,
        reason: "child-component",
        message: `O elemento <${target.tag}> é o host de um componente filho. Inspecione o componente filho para editar seu template.`,
      };
    }
  }

  const allNodes = parseTemplateNodes(htmlContent);
  const tagNodes = allNodes.filter((n) => n.tag === tagLower);

  if (tagNodes.length === 0) {
    return { ok: false, reason: "not-found", message: `Elemento <${target.tag}> não encontrado no template.` };
  }

  // Filtragem e limpeza de atributos/classes de runtime
  const targetText = target.text ? target.text.trim() : "";
  const targetAttrs = cleanRuntimeAttrs(target.attributes || {});
  const targetClassesList = (Array.isArray(target.classes) ? target.classes : [])
    .filter((c) => c && !c.startsWith("ng-"));
  if (targetClassesList.length > 0 && !targetAttrs.class) {
    targetAttrs.class = targetClassesList.join(" ");
  }

  /** @type {TemplateNode[]} */
  let candidates = [];

  for (const node of tagNodes) {
    let matches = true;
    const nodeAttrs = cleanRuntimeAttrs(node.attributes);

    // Se temos classe no alvo e o nó tem classe, checa interseção
    if (targetAttrs.class && nodeAttrs.class) {
      const targetClasses = targetAttrs.class.trim().split(/\s+/).filter(Boolean);
      const nodeClasses = nodeAttrs.class.trim().split(/\s+/).filter(Boolean);
      const hasIntersection = targetClasses.some((c) => nodeClasses.includes(c));
      if (!hasIntersection) matches = false;
    }

    // Se temos id no alvo, checa se bate
    if (targetAttrs.id && nodeAttrs.id && targetAttrs.id !== nodeAttrs.id) {
      matches = false;
    }

    // Se temos texto e o nó tem texto
    if (targetText && node.text) {
      const normNodeText = node.text.replace(/\s+/g, " ").trim();
      const normTargetText = targetText.replace(/\s+/g, " ").trim();
      if (!normNodeText.includes(normTargetText) && !normTargetText.includes(normNodeText)) {
        matches = false;
      }
    }

    if (matches) {
      candidates.push(node);
    }
  }

  // Se nenhum casou com texto/classe, mas só há 1 nó da tag no arquivo, usa ele
  if (candidates.length === 0 && tagNodes.length === 1) {
    candidates = [tagNodes[0]];
  }

  // Desempate por texto exato caso haja múltiplos candidatos
  if (candidates.length > 1 && targetText) {
    const exactMatches = candidates.filter((c) => c.text.replace(/\s+/g, " ").trim() === targetText);
    if (exactMatches.length === 1) {
      candidates = exactMatches;
    }
  }

  // Desempate por classe exata caso haja múltiplos candidatos
  if (candidates.length > 1 && targetAttrs.class) {
    const exactClassMatches = candidates.filter((c) => {
      const cAttrs = cleanRuntimeAttrs(c.attributes);
      return cAttrs.class === targetAttrs.class;
    });
    if (exactClassMatches.length === 1) {
      candidates = exactClassMatches;
    }
  }

  if (candidates.length === 0) {
    return {
      ok: false,
      reason: "not-found",
      message: `Nenhum nó <${target.tag}> compatível com o elemento selecionado.`,
    };
  }

  if (candidates.length > 1) {
    return {
      ok: false,
      reason: "ambiguous",
      message: `Foram encontrados ${candidates.length} elementos <${target.tag}> candidatos no template.`,
      candidates: candidates.map((c) => ({
        line: c.line,
        snippet: htmlContent.slice(c.openTagStart, Math.min(c.end, c.openTagStart + 120)),
      })),
    };
  }

  const selected = candidates[0];

  // Verifica se o nó possui binding de conteúdo dinâmico
  const bindingKeys = Object.keys(selected.bindings);
  const textBinding = bindingKeys.find((k) =>
    ["[innertext]", "[innerhtml]", "[textcontent]", "[ngmodel]"].includes(k.toLowerCase())
  );
  if (textBinding) {
    return {
      ok: false,
      reason: "binding",
      message: `O elemento possui binding dinâmico ${textBinding}. Use o chat para alterar propriedades vinculadas.`,
      candidate: { line: selected.line },
    };
  }

  // Verifica se está dentro de laço repetitivo (@for / *ngFor)
  if (selected.insideLoop) {
    return {
      ok: false,
      reason: "inside-loop",
      message: "O elemento está dentro de um laço de repetição (@for ou *ngFor). Edições diretas devem ser feitas via chat.",
      candidate: { line: selected.line },
    };
  }

  // Verifica se o texto contém interpolação Angular {{ ... }}
  const innerHtml = htmlContent.slice(selected.contentStart, selected.contentEnd);
  if (/\{\{[\s\S]*?\}\}/.test(innerHtml)) {
    return {
      ok: false,
      reason: "interpolation",
      message: "O elemento contém interpolação dinâmica {{ ... }}. Use o chat para alterar expressões Angular.",
      candidate: { line: selected.line },
    };
  }

  return {
    ok: true,
    node: selected,
    rawOpenTag: htmlContent.slice(selected.openTagStart, selected.openTagEnd),
    rawContent: innerHtml,
  };
}

module.exports = { locateElementInTemplate };
