// @ts-check
// Motor de verificação e auditoria de qualidade da memória declarativa (EP-13.09).
// Apenas leitura sobre memory/; sem IA/modelos; rápido e determinístico.
const fs = require("fs");
const path = require("path");
const { resolveMemoryDir, listItems } = require("./store");
const { hashOf, slugify } = require("./item");
const { similarity } = require("./dedupe");
const { inspectSecrets } = require("./guard");
const { render } = require("./index");
const { formatReport } = require("./lint-report");

/**
 * @typedef {{
 *   regra: string,
 *   severidade: "erro" | "aviso",
 *   relPath: string,
 *   mensagem: string,
 *   acao: string
 * }} LintFinding
 */

/**
 * Regra 1: Validação de Contrato
 * @param {Array<{ file: string, relPath: string, errors: import("./item").ErroContrato[] }>} invalidItems
 * @returns {LintFinding[]}
 */
function checkContractErrors(invalidItems) {
  /** @type {LintFinding[]} */
  const findings = [];
  for (const inv of invalidItems) {
    for (const err of inv.errors) {
      findings.push({
        regra: "contrato",
        severidade: "erro",
        relPath: inv.relPath,
        mensagem: `Erro de contrato: [${err.campo}] ${err.mensagem}`,
        acao: "Corrigir frontmatter ou formato do arquivo para cumprir o contrato do item de memória.",
      });
    }
  }
  return findings;
}

/**
 * Regra 2: Guard de Segredos e PII
 * @param {Array<{ file: string, relPath: string, item: import("./item").Item }>} validItems
 * @returns {LintFinding[]}
 */
function checkGuardViolations(validItems) {
  /** @type {LintFinding[]} */
  const findings = [];
  for (const v of validItems) {
    const violations = inspectSecrets(v.item.meta.description, v.item.body);
    if (violations.length > 0) {
      findings.push({
        regra: "guard",
        severidade: "erro",
        relPath: v.relPath,
        mensagem: `Potencial vazamento de segredo ou PII detectado: ${violations.join(", ")}`,
        acao: "Remover imediatamente o segredo, token, senha ou dado pessoal do corpo do item.",
      });
    }
  }
  return findings;
}

/**
 * Regra 3: Duplicatas Exatas e Similares (> 0.8)
 * @param {Array<{ file: string, relPath: string, item: import("./item").Item }>} validItems
 * @returns {LintFinding[]}
 */
function checkDuplicates(validItems) {
  /** @type {LintFinding[]} */
  const findings = [];
  /** @type {Map<string, string>} */
  const seenHashes = new Map();

  for (let i = 0; i < validItems.length; i++) {
    const a = validItems[i];
    const textA = `${a.item.meta.description}\n${a.item.body}`;
    const h = hashOf(textA);

    if (seenHashes.has(h)) {
      findings.push({
        regra: "duplicata-exata",
        severidade: "aviso",
        relPath: a.relPath,
        mensagem: `Conteúdo idêntico (hash coincidente) com ${seenHashes.get(h)}`,
        acao: "Remover o arquivo duplicado ou mesclar os fatos em um único item.",
      });
    } else {
      seenHashes.set(h, a.relPath);
    }

    for (let j = 0; j < i; j++) {
      const b = validItems[j];
      const descSim = similarity(a.item.meta.description, b.item.meta.description);
      if (descSim >= 0.8 && descSim < 1.0) {
        findings.push({
          regra: "duplicata-provavel",
          severidade: "aviso",
          relPath: a.relPath,
          mensagem: `Descrição muito similar (${Math.round(descSim * 100)}%) à de ${b.relPath}`,
          acao: "Avaliar fusão das memórias se tratarem do mesmo conceito.",
        });
      }
    }
  }
  return findings;
}

/**
 * Regra 4: Caminhos citados inexistentes no repo
 * @param {Array<{ file: string, relPath: string, item: import("./item").Item }>} validItems
 * @param {string} rootDir
 * @returns {LintFinding[]}
 */
function checkDeadPaths(validItems, rootDir) {
  /** @type {LintFinding[]} */
  const findings = [];
  const pathRegex = /\b(?:tools|ui|docs|projects|global)\/[A-Za-z0-9_\-\.\/]+/g;

  for (const v of validItems) {
    const text = `${v.item.meta.description}\n${v.item.body}`;
    const matches = text.match(pathRegex) || [];
    for (const rawPath of matches) {
      const cleanPath = rawPath.replace(/[,\.\:\;\)\>\"]+$/, "");
      if (cleanPath.includes("*") || cleanPath.includes("<") || cleanPath.endsWith("/")) continue;
      const full = path.join(rootDir, cleanPath);
      if (!fs.existsSync(full)) {
        findings.push({
          regra: "caminho-morto",
          severidade: "aviso",
          relPath: v.relPath,
          mensagem: `Caminho citado não existe no repositório: ${cleanPath}`,
          acao: "Atualizar o caminho para a nova localização do arquivo ou remover a menção obsoleta.",
        });
      }
    }
  }
  return findings;
}

/**
 * Regra 5: Wikilinks sem item correspondente
 * @param {Array<{ file: string, relPath: string, item: import("./item").Item }>} validItems
 * @returns {LintFinding[]}
 */
function checkBrokenWikilinks(validItems) {
  /** @type {LintFinding[]} */
  const findings = [];
  const knownNames = new Set(validItems.map((v) => slugify(v.item.meta.name)));

  for (const v of validItems) {
    const text = `${v.item.meta.description}\n${v.item.body}`;
    const wikilinks = text.match(/\[\[([^\]]+)\]\]/g) || [];
    for (const w of wikilinks) {
      const target = w.slice(2, -2).trim().split("|")[0].trim();
      const targetSlug = slugify(target);
      if (!knownNames.has(targetSlug)) {
        findings.push({
          regra: "wikilink-orfao",
          severidade: "aviso",
          relPath: v.relPath,
          mensagem: `Wikilink para item inexistente: [[${target}]]`,
          acao: "Criar o item referenciado quando o fato for conhecido ou corrigir a grafia do link.",
        });
      }
    }
  }
  return findings;
}

/**
 * Regra 6: Itens com updated há mais de 60 dias (para escopo project)
 * @param {Array<{ file: string, relPath: string, item: import("./item").Item }>} validItems
 * @param {string} [todayStr]
 * @returns {LintFinding[]}
 */
function checkStaleItems(validItems, todayStr) {
  /** @type {LintFinding[]} */
  const findings = [];
  const now = todayStr ? new Date(`${todayStr}T00:00:00Z`).getTime() : Date.now();
  const SIXTY_DAYS_MS = 60 * 24 * 60 * 60 * 1000;

  for (const v of validItems) {
    if (v.item.meta.type === "project") {
      const updatedTime = new Date(`${v.item.meta.updated}T00:00:00Z`).getTime();
      if (!isNaN(updatedTime) && (now - updatedTime) > SIXTY_DAYS_MS) {
        const days = Math.round((now - updatedTime) / (24 * 60 * 60 * 1000));
        findings.push({
          regra: "item-antigo",
          severidade: "aviso",
          relPath: v.relPath,
          mensagem: `Item de projeto não atualizado há mais de 60 dias (${days} dias desde ${v.item.meta.updated})`,
          acao: "Revisar se o fato do projeto ainda é válido ou se deve ser arquivado/atualizado.",
        });
      }
    }
  }
  return findings;
}

/**
 * Regra 7: Índice acima de 80% do teto (teto = 150 linhas)
 * @param {Array<{ relPath: string, item: import("./item").Item }>} validItems
 * @returns {LintFinding[]}
 */
function checkIndexCapacity(validItems) {
  /** @type {LintFinding[]} */
  const findings = [];
  const { linesCount } = render(validItems);
  const threshold = Math.round(150 * 0.8);
  if (linesCount >= threshold) {
    findings.push({
      regra: "teto-indice",
      severidade: "aviso",
      relPath: "memory.md",
      mensagem: `Índice de memória atingiu ${linesCount} linhas (capacidade >= 80% do teto de 150 linhas)`,
      acao: "Arquivar itens antigos ou consolidar referências para manter o índice conciso.",
    });
  }
  return findings;
}

/**
 * Executa todas as regras de lint sobre um projeto ou escopo global.
 * @param {string} rootDir
 * @param {string} slug
 * @param {{ today?: string }} [opts]
 * @returns {{ findings: LintFinding[], hasErrors: boolean, stats: { total: number, valid: number, invalid: number } }}
 */
function lintScope(rootDir, slug, opts = {}) {
  const memDir = resolveMemoryDir(rootDir, slug);
  const { valid, invalid } = listItems(memDir);

  const findings = [
    ...checkContractErrors(invalid),
    ...checkGuardViolations(valid),
    ...checkDuplicates(valid),
    ...checkDeadPaths(valid, rootDir),
    ...checkBrokenWikilinks(valid),
    ...checkStaleItems(valid, opts.today),
    ...checkIndexCapacity(valid),
  ];

  const hasErrors = findings.some((f) => f.severidade === "erro");
  return {
    findings,
    hasErrors,
    stats: {
      total: valid.length + invalid.length,
      valid: valid.length,
      invalid: invalid.length,
    },
  };
}

module.exports = {
  checkContractErrors,
  checkGuardViolations,
  checkDuplicates,
  checkDeadPaths,
  checkBrokenWikilinks,
  checkStaleItems,
  checkIndexCapacity,
  lintScope,
  formatReport,
};
