// @ts-check
"use strict";
const { SCREEN_MODELS } = require("./extract");
const T = require("./screen-transform");
const S = require("./search-screen");

const NAV_RULES = [
  { cls: "dis-sidenav__item", text: "Visão geral", goto: "visao-geral" },
  { cls: "dis-sidenav__item", text: "Nova prescrição", goto: "nova-prescricao" },
  { cls: "dis-sidenav__item", text: "Histórico de prescrições", goto: "historico" },
  { cls: "dis-sidenav__item", text: "Programas de Saúde", goto: "programas" },
  { cls: "dis-sidenav__item", text: "Anotações", goto: "anotacoes" },
  { cls: "ds-header__link", text: "Pesquisar paciente", goto: S.SEARCH_ID },
];

const SCREEN_RULES = {
  "visao-geral": [{ cls: "ds-medlink", notCls: "ds-medlink--disabled", goto: "historico" }, { text: "Ver todas as anotações", goto: "anotacoes" }],
  "entregas-liberadas": [{ text: "Voltar", goto: "visao-geral" }],
  "nova-prescricao": [{ text: "Voltar", goto: "visao-geral" }],
  "nova-prescricao-medicamentos": [{ text: "Anterior", goto: "nova-prescricao" }],
  "dispensacao-sucesso": [{ text: "Página do paciente", goto: "visao-geral" }, { cls: "ds-medlink", goto: "historico" }],
  programas: [{ cls: "ds-medlink", goto: "historico" }],
};

/** Navegação feita por JavaScript no original (`location.href`) vira goto entre telas. */
const URL_MAPS = {
  "visao-geral": { "/dispensacao/entregas-liberadas": "entregas-liberadas" },
  "entregas-liberadas": { "/dispensacao/sucesso": "dispensacao-sucesso" },
  "nova-prescricao": { "/dispensacao/entregas-liberadas": "nova-prescricao-medicamentos" },
};

const PATIENT_HEAD = `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans:ital,wght@0,400;0,600;0,700;0,800;1,400&family=Noto+Sans+Display:wght@600;700;800&family=Noto+Sans+Mono:wght@400;600&display=swap">
<script>
/* Sandbox sem same-origin: sessionStorage lança erro; troca por um armazenamento em memória. */
(function () {
  try { void window.sessionStorage; } catch (error) {
    var mem = {};
    var fake = {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; },
      setItem: function (k, v) { mem[k] = String(v); },
      removeItem: function (k) { delete mem[k]; },
      clear: function () { mem = {}; },
      key: function (i) { return Object.keys(mem)[i] || null; },
      get length() { return Object.keys(mem).length; },
    };
    try { Object.defineProperty(window, "sessionStorage", { value: fake, configurable: true }); } catch (e) {}
  }
  /* Navegação entre telas do protótipo (a janela-mãe decide o que fazer). */
  window.harnessGoto = function (screen) {
    try { window.parent.postMessage({ type: "HARNESS_PROTO_GOTO", screen: screen }, "*"); } catch (e) {}
  };
  /* "Ver mais" do cabeçalho do paciente: alterna o painel apontado por aria-controls. */
  document.addEventListener("click", function (event) {
    var btn = event.target.closest && event.target.closest(".dis-patient__more");
    var panel = btn && document.getElementById(btn.getAttribute("aria-controls"));
    if (!panel) return;
    var open = btn.getAttribute("aria-expanded") !== "true";
    btn.setAttribute("aria-expanded", String(open));
    panel.hidden = !open;
  });
})();
</script>
`;

const PATIENT_CSS = `/* DIS — Fluxo do paciente (editável). Estilos dos componentes vêm de design/ds/components.css. */
body { margin: 0; background: var(--white); }
.dis-shell { min-height: 100vh; }
button { font: inherit; color: inherit; }
.ds-header__user { background: none; border: 0; padding: 0; cursor: pointer; }
button.ds-header__link { background: none; border: 0; }
`;

/** Constrói o HTML final de uma tela modelo. */
function buildPatientScreen(model, doc, ctx) {
  let html = doc.html;
  html = T.inlineAssets(html, ctx.assets);
  html = T.dropBlockedImages(html);
  html = T.wireNavigation(html, [...(SCREEN_RULES[model.id] || []), ...NAV_RULES]);
  html = T.markComponents(html, ctx.rootMap);
  const { html: withPids } = T.injectPids(html);
  const js = T.rewriteScript(doc.js || "", URL_MAPS[model.id] || {});
  return `${withPids.trim()}\n${js.trim() ? T.wrapScript(js) : ""}\n`;
}

function buildPatientPrototype(docs, ctx) {
  const dir = `design/prototypes/${ctx.protoId}`;
  const now = new Date().toISOString();
  const files = SCREEN_MODELS.map((model) => ({
    rel: `${dir}/screens/${model.id}.html`,
    content: buildPatientScreen(model, docs.components[model.doc], ctx),
  }));
  const overview = files.find((f) => f.rel.endsWith("/screens/visao-geral.html"));
  files.push({ rel: `${dir}/screens/${S.SEARCH_ID}.html`, content: S.buildSearchScreen(overview.content) });
  const proto = {
    schema: 1,
    id: ctx.protoId,
    title: "DIS — Fluxo do paciente (editável)",
    version: 1,
    activeScreen: S.SEARCH_ID,
    screens: [{ id: S.SEARCH_ID, title: "Pesquisar paciente", file: `screens/${S.SEARCH_ID}.html` }, ...SCREEN_MODELS.map((m) => ({ id: m.id, title: m.title, file: `screens/${m.id}.html` }))],
    components: [],
    metadata: {
      engine: "ds-docs-import",
      dsComponents: true,
      sourceArtifact: "dis-design-system",
      sourceFile: "design/dis-design-system.html",
      createdAt: now,
      updatedAt: now,
    },
  };
  files.push({ rel: `${dir}/proto.json`, content: `${JSON.stringify(proto, null, 2)}\n` });
  files.push({ rel: `${dir}/head.html`, content: PATIENT_HEAD + S.SEARCH_HEAD_SCRIPT });
  files.push({ rel: `${dir}/styles/proto.css`, content: PATIENT_CSS + S.SEARCH_CSS });
  files.push({ rel: `${dir}/MAPA.md`, content: patientMapa(ctx.protoId) });
  return files;
}

function patientMapa(protoId) {
  return `# MAPA: ${protoId}

## 1. UI / UX
- 9 telas: Pesquisar paciente (\`tools/ds-docs/search-screen.js\`) e 8 do paciente, geradas a partir dos modelos de tela do Design System (\`tools/import-ds-docs.js\`).
- Navegação: menu lateral, cabeçalho e botões ligados por \`data-action="goto:<tela>"\`; o JavaScript do DS usa \`harnessGoto()\`.
- Cada elemento tem \`data-pid\`; raízes de componentes do DS levam \`data-component="dis.<nome>"\`.

## 2. Regras de Negócio
- Cálculo de dispensação, validações de formulário e estados (selecionar, filtrar, incluir, remover) vêm do JavaScript de cada modelo de tela.

## 3. API / Serviços
- Nenhum. Dados de exemplo ficam no HTML e no script da tela.

## 4. Dados
- Paciente fictício: Carmen Vargas Teixeira. Medicamentos e programas de exemplo do DS.

## Componentes Candidatos
- Veja \`design/ds/components/\` (componentes do DS já extraídos).
`;
}

module.exports = { buildPatientPrototype, buildPatientScreen, NAV_RULES, SCREEN_RULES, URL_MAPS, PATIENT_HEAD, PATIENT_CSS };
