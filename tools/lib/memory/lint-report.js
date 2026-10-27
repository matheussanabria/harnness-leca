// @ts-check
// Gerador de relatório e formatador de achados do lint de memória (EP-13.09).
/** @typedef {import("./lint").LintFinding} LintFinding */

/**
 * Gera relatório em Markdown com os achados do lint.
 * @param {string} slug
 * @param {LintFinding[]} findings
 * @param {{ total: number, valid: number, invalid: number }} stats
 * @returns {string}
 */
function formatReport(slug, findings, stats) {
  const lines = [
    `# Relatório de Faxina de Memória: ${slug}`,
    "",
    `Data da verificação: ${new Date().toISOString().slice(0, 10)}`,
    `Total de itens examinados: ${stats.total} (${stats.valid} válidos, ${stats.invalid} inválidos)`,
    "",
  ];

  if (findings.length === 0) {
    lines.push("Nenhum problema encontrado. A memória curada está limpa e consistente.");
    return lines.join("\n") + "\n";
  }

  const erros = findings.filter((f) => f.severidade === "erro");
  const avisos = findings.filter((f) => f.severidade === "aviso");

  lines.push(`Total de achados: ${findings.length} (${erros.length} erros, ${avisos.length} avisos)`);
  lines.push("");

  if (erros.length > 0) {
    lines.push("## Erros Críticos (Contrato / Guard)");
    lines.push("| Arquivo | Regra | Problema | Ação Sugerida |");
    lines.push("|---|---|---|---|");
    for (const e of erros) {
      lines.push(`| \`${e.relPath}\` | ${e.regra} | ${e.mensagem} | ${e.acao} |`);
    }
    lines.push("");
  }

  if (avisos.length > 0) {
    lines.push("## Avisos de Manutenção (Limpeza / Envelhecimento)");
    lines.push("| Arquivo | Regra | Observação | Ação Sugerida |");
    lines.push("|---|---|---|---|");
    for (const a of avisos) {
      lines.push(`| \`${a.relPath}\` | ${a.regra} | ${a.mensagem} | ${a.acao} |`);
    }
    lines.push("");
  }

  return lines.join("\n") + "\n";
}

module.exports = {
  formatReport,
};
