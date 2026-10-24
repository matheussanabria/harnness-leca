// @ts-check
// Geracao de artefato de teste a partir de uma regra de auditoria (EP-11.02).
const fs = require("fs");
const path = require("path");
const crypto = require("node:crypto");

const TEST_DIR = path.join("doc", "auditoria");
const KINDS = Object.freeze(["bdd", "unit"]);
const MAX_FILE_BYTES = 64 * 1024;

function fail(status, message) {
  const error = new Error(message);
  // @ts-ignore
  error.status = status;
  return error;
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "regra";
}

/**
 * Nome do arquivo de teste gerado para a regra.
 * @param {string} screenId
 * @param {string} ruleTitle
 * @param {string} kind
 * @returns {string}
 */
function testFileName(screenId, ruleTitle, kind) {
  const base = `${slugify(screenId)}-${slugify(ruleTitle)}`.slice(0, 90);
  return kind === "unit" ? `${base}.test.js` : `${base}.feature`;
}

/**
 * Conteudo do teste gerado.
 * @param {{ screenName: string, ruleTitle: string, detail: string, kind: string }} rule
 * @returns {string}
 */
function renderTestContent(rule) {
  const titulo = rule.ruleTitle || "Regra de negocio";
  const detalhe = rule.detail || "Comportamento esperado pela regra de negocio do projeto.";
  if (rule.kind === "unit") {
    return `// Teste gerado pelo Harness Leca (EP-11.02) para a regra: ${titulo}\n`
      + `// ${detalhe}\n`
      + `const test = require("node:test");\n`
      + `const assert = require("node:assert/strict");\n\n`
      + `test("${titulo}", () => {\n`
      + `  assert.fail("Cenario da regra ainda precisa ser preenchido pelo agente.");\n`
      + `});\n`;
  }
  return `# language: pt-BR\n`
    + `Funcionalidade: ${rule.screenName || "Regra de negocio"}\n\n`
    + `  Cenario: ${titulo}\n`
    + `    Dado que o agente preencheu o contexto da regra\n`
    + `    Quando a regra for exercida pelo produto\n`
    + `    Entao o resultado deve atender a seguinte condicao:\n`
    + `      ${detalhe}\n`;
}

/**
 * Cria (ou reaproveita) o arquivo de teste da regra dentro do projeto.
 * @param {{ projectDir: string, screenId: string, screenName?: string, ruleTitle: string, detail?: string, kind?: string }} params
 * @returns {{ file: string, created: boolean, hash: string, bytes: number }}
 */
function generateTestArtifact({ projectDir, screenId, screenName = "", ruleTitle, detail = "", kind = "bdd" }) {
  const type = String(kind || "bdd").trim();
  if (!KINDS.includes(type)) throw fail(400, "Tipo de teste invalido.");
  if (!ruleTitle) throw fail(400, "Informe o titulo da regra.");

  const dir = path.join(projectDir, TEST_DIR);
  const file = path.join(dir, testFileName(screenId, ruleTitle, type));
  const relative = path.relative(projectDir, file).split(path.sep).join("/");

  if (fs.existsSync(file)) {
    const stat = fs.lstatSync(file);
    if (stat.isSymbolicLink() || !stat.isFile()) throw fail(409, "Artefato de teste invalido no projeto.");
    const current = fs.readFileSync(file);
    return {
      file: relative,
      created: false,
      hash: crypto.createHash("sha256").update(current).digest("hex").slice(0, 16),
      bytes: current.length,
    };
  }

  const content = renderTestContent({ screenName, ruleTitle, detail, kind: type });
  if (Buffer.byteLength(content) > MAX_FILE_BYTES) throw fail(400, "Conteudo do teste excede o limite.");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, content, { encoding: "utf8", mode: 0o600 });
  return {
    file: relative,
    created: true,
    hash: crypto.createHash("sha256").update(content).digest("hex").slice(0, 16),
    bytes: Buffer.byteLength(content),
  };
}

module.exports = { TEST_DIR, KINDS, slugify, testFileName, renderTestContent, generateTestArtifact };
