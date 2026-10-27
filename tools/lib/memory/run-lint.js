// @ts-check
// Runner do subcomando lint de memória (EP-13.09).
// Apenas leitura sobre memory/; sem modelo; rápido e determinístico.
const fs = require("fs");
const path = require("path");
const { opt, flag, CliError } = require("../cli");
const { lintScope, formatReport } = require("./lint");

/**
 * Executa o lint de memória em um ou todos os projetos.
 * @param {string[]} argv
 * @param {any} [io]
 * @param {string} [baseDir]
 */
function runLint(argv, io = console, baseDir) {
  const rootDir = baseDir || process.env.HARNESS_ROOT || path.resolve(__dirname, "../../..");
  const project = opt("project", argv);
  const allProjects = flag("all", argv);
  const asJson = flag("json", argv);

  /** @type {string[]} */
  const slugs = [];
  if (allProjects) {
    slugs.push("global");
    const pDir = path.join(rootDir, "projects");
    if (fs.existsSync(pDir)) {
      for (const e of fs.readdirSync(pDir, { withFileTypes: true })) {
        if (e.isDirectory()) slugs.push(e.name);
      }
    }
  } else if (project) {
    slugs.push(project);
  } else {
    const activePath = path.join(rootDir, "projects", ".active");
    if (fs.existsSync(activePath)) {
      const line = fs.readFileSync(activePath, "utf8").trim().split(/\r?\n/).pop()?.trim();
      if (line) slugs.push(line);
      else slugs.push("global");
    } else {
      slugs.push("global");
    }
  }

  let globalHasErrors = false;
  /** @type {Record<string, any>} */
  const resultsByProject = {};

  for (const slug of slugs) {
    const memDir = slug === "global"
      ? path.join(rootDir, "global", "memory")
      : path.join(rootDir, "projects", slug, "memory");

    if (!fs.existsSync(memDir) && slug !== "global" && slug !== project) {
      continue;
    }

    const { findings, hasErrors, stats } = lintScope(rootDir, slug);
    if (hasErrors) globalHasErrors = true;
    resultsByProject[slug] = { findings, hasErrors, stats };

    // Grava relatório em Markdown em projects/<slug>/context/faxina-memoria.md (RF2)
    if (slug !== "global") {
      const contextDir = path.join(rootDir, "projects", slug, "context");
      fs.mkdirSync(contextDir, { recursive: true });
      const reportFile = path.join(contextDir, "faxina-memoria.md");
      const reportContent = formatReport(slug, findings, stats);
      fs.writeFileSync(reportFile, reportContent, "utf8");
    }

    if (!asJson) {
      const erros = findings.filter((f) => f.severidade === "erro");
      const avisos = findings.filter((f) => f.severidade === "aviso");
      const statusIcon = hasErrors ? "[FALHA]" : (avisos.length > 0 ? "[AVISO]" : "[OK]");
      io.log(`${statusIcon} [${slug}] ${stats.valid} itens examinados | ${erros.length} erro(s), ${avisos.length} aviso(s)`);
      for (const e of erros) {
        io.error(`  - ERRO [${e.regra}] ${e.relPath}: ${e.mensagem}`);
      }
      for (const a of avisos) {
        io.log(`  - AVISO [${a.regra}] ${a.relPath}: ${a.mensagem}`);
      }
    }
  }

  if (asJson) {
    io.log(JSON.stringify(resultsByProject, null, 2));
  }

  if (globalHasErrors) {
    throw new CliError("Lint de memória encontrou erros críticos de contrato ou guard.", 1);
  }
}

module.exports = {
  runLint,
};
