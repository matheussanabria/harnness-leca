// @ts-check
const path = require("node:path");
const { writeText, writeJson, longText } = require("./project-fixture-files");

function makeNode(id, componentId, props = {}, children = [], events = {}) {
  return {
    id,
    componentId,
    componentVersion: "1.0.0",
    label: "",
    props,
    bindings: {},
    events,
    slotTargets: {},
    children,
  };
}

function navigationNode(id, label, target) {
  return makeNode(
    id,
    "dis.button",
    { label, className: "btn btn-primary" },
    [],
    { click: { type: "navigate", target } }
  );
}

function screenHtml(title, nodeIds, extra = "") {
  const shells = nodeIds.map((id) => `<div data-node-id="${id}" data-component="fixture"></div>`).join("\n");
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>${title}</title>
</head>
<body>
  ${shells}
  ${extra}
</body>
</html>`;
}

function buildPrototype() {
  const homeNodes = {
    "root-home": makeNode(
      "root-home",
      "layout.container",
      { tag: "main", className: "screen-container" },
      ["node-1", "node-2", "node-3", "node-10", "node-btn-nova-rx"]
    ),
    "node-1": makeNode("node-1", "dis.header", { title: "Dispensação", className: "dis-header" }),
    "node-2": makeNode("node-2", "dis.header", { title: "Paciente", className: "dis-header" }),
    "node-3": makeNode("node-3", "dis.button", { label: "Anotações", className: "btn" }),
    "node-10": makeNode("node-10", "dis.annotation-list", { className: "dis-notes" }),
    "node-btn-nova-rx": navigationNode("node-btn-nova-rx", "Nova prescrição", "prescricao"),
  };

  const prescricaoNodes = {
    "root-prescricao": makeNode(
      "root-prescricao",
      "layout.container",
      { tag: "main", className: "screen-container" },
      ["node-presc-header", "node-btn-avancar-aut"]
    ),
    "node-presc-header": makeNode("node-presc-header", "dis.header", { title: "Prescrição", className: "dis-header" }),
    "node-btn-avancar-aut": navigationNode("node-btn-avancar-aut", "Solicitar autorização", "autorizacao"),
  };

  const autorizacaoNodes = {
    "root-autorizacao": makeNode(
      "root-autorizacao",
      "layout.container",
      { tag: "main", className: "screen-container" },
      ["node-aut-header", "node-btn-concluir-disp"]
    ),
    "node-aut-header": makeNode("node-aut-header", "dis.header", { title: "Autorização", className: "dis-header" }),
    "node-btn-concluir-disp": navigationNode("node-btn-concluir-disp", "Concluir dispensação", "home"),
  };

  return {
    metadata: {
      id: "dis-modular",
      schemaVersion: "2.0.0",
      title: "DIS - Fluxo de Dispensação",
      description: "Protótipo de fixture do fluxo clínico.",
      designSystemId: "dis-design-system",
      defaultScreenId: "home",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    globalState: { system: "DIS", environment: "homologacao" },
    assets: { css: ["styles/proto.css"], js: [], fonts: [] },
    screens: {
      home: {
        id: "home",
        title: "Resumo do Paciente",
        route: "/",
        htmlFile: "screens/home.html",
        rootNodeId: "root-home",
        initialState: { activeTab: "resumo" },
        nodes: homeNodes,
      },
      prescricao: {
        id: "prescricao",
        title: "Prescrição",
        route: "/prescricao",
        htmlFile: "screens/prescricao.html",
        rootNodeId: "root-prescricao",
        initialState: {},
        nodes: prescricaoNodes,
      },
      autorizacao: {
        id: "autorizacao",
        title: "Autorização",
        route: "/autorizacao",
        htmlFile: "screens/autorizacao.html",
        rootNodeId: "root-autorizacao",
        initialState: {},
        nodes: autorizacaoNodes,
      },
    },
  };
}

function prototypeAsset(title, extra = "") {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>${title}</title>
</head>
<body>
  <main data-prototype="${title}"></main>
  ${extra}
  <!-- ${longText("asset de fixture", 40)} -->
</body>
</html>`;
}

function writePrototype(projectDir) {
  const protoDir = path.join(projectDir, "design", "prototypes", "dis-modular");
  const proto = buildPrototype();

  writeJson(path.join(protoDir, "proto.json"), proto);
  writeText(
    path.join(protoDir, "screens", "home.html"),
    screenHtml("Resumo do Paciente", Object.keys(proto.screens.home.nodes), '<p class="fixture-note">Dados do paciente</p>')
  );
  writeText(
    path.join(protoDir, "screens", "prescricao.html"),
    screenHtml("Prescrição", Object.keys(proto.screens.prescricao.nodes), '<i class="fa-solid fa-pills" aria-hidden="true"></i>')
  );
  writeText(
    path.join(protoDir, "screens", "autorizacao.html"),
    screenHtml("Autorização", Object.keys(proto.screens.autorizacao.nodes), '<i class="fa-solid fa-check" aria-hidden="true"></i>')
  );
  writeText(path.join(protoDir, "styles", "proto.css"), "body { font-family: var(--font-sans); }\n.screen-container { display: flex; flex-direction: column; }");

  const data = path.join(protoDir, "data");
  writeJson(path.join(data, "patient.json"), {
    id: "paciente-1",
    name: "Maria Silva Santos",
    age: 68,
    cns: "700123456789012",
  });
  writeJson(path.join(data, "prescriptions.json"), [
    { id: "rx-1", medication: "Losartana", dose: "50 mg", status: "ativa" },
  ]);
  writeJson(path.join(data, "authorizations.json"), [
    { id: "aut-1", prescriptionId: "rx-1", status: "pendente" },
  ]);
  writeJson(path.join(data, "notes.json"), [
    { date: "18/05/2026", text: "Paciente orientado sobre horários da medicação.", source: "Farmacêutico" },
    { date: "10/05/2026", text: "Retorno agendado para reavaliação clínica.", source: "Clínico Geral" },
  ]);

  writeText(
    path.join(projectDir, "design", "prototypes", "dis-design-system", "index.html"),
    prototypeAsset("DIS Design System", '<section data-screen="catalogo">Catálogo de componentes</section>')
  );
  writeText(
    path.join(projectDir, "design", "prototypes", "dis-fluxo-paciente", "index.html"),
    prototypeAsset("DIS Fluxo do Paciente", '<section data-screen="fluxo">Fluxo do paciente</section>')
  );
  writeText(
    path.join(projectDir, "design", "prototypes", "dis-fluxo-paciente", "support.js"),
    `// ${longText("asset de suporte", 80)}\nexport const support = "fixture";\n`
  );

  writeText(
    path.join(projectDir, "design", "dis-fluxo-paciente", "Main.dc.html"),
    `<x-dc>
  <x-import component-from-global-scope="DS.PatientHeader" data-pid="p1" name="{{patient.name}}"></x-import>
  <x-import component-from-global-scope="DS.Header" data-pid="p2" title="Dispensação"></x-import>
  <x-import component-from-global-scope="DS.AnnotationList" data-pid="p3" items="{{notes}}"></x-import>
  <x-import component-from-global-scope="DS.Button" data-pid="p4" label="Nova prescrição"></x-import>
  <x-import component-from-global-scope="DS.Icon" data-pid="p5" name="circle-info"></x-import>
</x-dc>`
  );

  const inspectionData = path.join(projectDir, "design", "prototypes", "dis-fluxo-paciente-inspecao", "data");
  writeJson(path.join(inspectionData, "patient.json"), {
    id: "paciente-1",
    name: "Maria Silva Santos",
    age: 68,
    cns: "700123456789012",
  });
  writeJson(path.join(inspectionData, "notes.json"), [
    { date: "18/05/2026", text: "Paciente orientado sobre horários da medicação.", source: "Farmacêutico" },
    { date: "10/05/2026", text: "Retorno agendado para reavaliação clínica.", source: "Clínico Geral" },
  ]);
}

module.exports = { buildPrototype, writePrototype };
