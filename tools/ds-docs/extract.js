// @ts-check
"use strict";

/**
 * Leitura da documentação embutida no HTML do DIS Design System (`window.DOCS`)
 * e nomes derivados (ids kebab-case, telas modelo).
 */

/** Acha o `}` que fecha o objeto JSON que começa em `start`, respeitando strings. */
function findJsonEnd(text, start) {
  let depth = 0;
  let inString = false;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      if (ch === "\\") i += 1;
      else if (ch === '"') inString = false;
    } else if (ch === '"') inString = true;
    else if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  throw new Error("JSON de window.DOCS não termina.");
}

/** @param {string} html conteúdo de dis-design-system.html */
function extractDocs(html) {
  const marker = "window.DOCS=";
  const at = html.indexOf(marker);
  if (at < 0) throw new Error("window.DOCS não encontrado no HTML do Design System.");
  const start = html.indexOf("{", at);
  const docs = JSON.parse(html.slice(start, findJsonEnd(html, start) + 1));
  docs.bundleJs = extractBundle(html);
  return docs;
}

/** Script do bundle React do DS (`/* @ds-bundle ... *\/`), que define `window.DS`. */
function extractBundle(html) {
  const at = html.indexOf("/* @ds-bundle");
  if (at < 0) return "";
  const end = html.indexOf("</script>", at);
  return end < 0 ? "" : html.slice(at, end);
}

const kebab = (name) => name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
const isScreenModel = (name) => /^Tela[A-Z]/.test(name);

/** Telas modelo na ordem do fluxo do paciente, com id estável e título. */
const SCREEN_MODELS = [
  { doc: "TelaVisaoGeral", id: "visao-geral", title: "Visão geral" },
  { doc: "TelaNovaPrescricao", id: "nova-prescricao", title: "Nova prescrição" },
  { doc: "TelaNovaPrescricaoMedicamentos", id: "nova-prescricao-medicamentos", title: "Nova prescrição, medicamentos" },
  { doc: "TelaEntregasLiberadas", id: "entregas-liberadas", title: "Entregas liberadas" },
  { doc: "TelaDispensacaoSucesso", id: "dispensacao-sucesso", title: "Dispensação concluída" },
  { doc: "TelaHistoricoPrescricoes", id: "historico", title: "Histórico de prescrições" },
  { doc: "TelaProgramasSaude", id: "programas", title: "Programas de Saúde" },
  { doc: "TelaAnotacoes", id: "anotacoes", title: "Anotações" },
];

module.exports = { extractDocs, findJsonEnd, kebab, isScreenModel, SCREEN_MODELS };
