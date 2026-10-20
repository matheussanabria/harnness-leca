// @ts-check
const fs = require("fs");
const path = require("path");
const { validatePrototypeDefinition } = require("./prototype-validator.service");

function node(id, componentId, props = {}, children = [], events = {}) {
  return { id, componentId, componentVersion: "1.0.0", props, bindings: {}, events, slotTargets: {}, children };
}

function navigationButton(id, label, target, className = "btn btn-primary") {
  return node(id, "dis.button", { label, className }, [], { click: { type: "navigate", target } });
}

function prescriptionScreen() {
  return {
    id: "prescricao",
    title: "Nova Prescrição de Medicamentos",
    route: "/prescricao",
    htmlFile: "screens/prescricao.html",
    rootNodeId: "root-prescricao",
    initialState: { medicamento: "", posologia: "", duracao: "" },
    nodes: {
      "root-prescricao": node("root-prescricao", "layout.container", { className: "dis-screen-prescricao" }, ["node-rx-header", "node-rx-body"]),
      "node-rx-header": node("node-rx-header", "layout.header", { className: "dis-screen-header" }, ["node-btn-voltar-home"]),
      "node-btn-voltar-home": navigationButton("node-btn-voltar-home", "Voltar ao Resumo", "home", "btn btn-secondary"),
      "node-rx-body": node("node-rx-body", "layout.container", { className: "dis-screen-body" }, ["node-card-medicamentos"]),
      "node-card-medicamentos": node("node-card-medicamentos", "dis.card", { className: "dis-card" }, ["node-btn-avancar-aut"]),
      "node-btn-avancar-aut": navigationButton("node-btn-avancar-aut", "Solicitar Autorização", "autorizacao"),
    },
  };
}

function authorizationScreen() {
  return {
    id: "autorizacao",
    title: "Autorização Farmacêutica",
    route: "/autorizacao",
    htmlFile: "screens/autorizacao.html",
    rootNodeId: "root-autorizacao",
    initialState: { status: "pendente", justificativa: "" },
    nodes: {
      "root-autorizacao": node("root-autorizacao", "layout.container", { className: "dis-screen-autorizacao" }, ["node-aut-header", "node-aut-body"]),
      "node-aut-header": node("node-aut-header", "layout.header", { className: "dis-screen-header" }, ["node-btn-voltar-rx"]),
      "node-btn-voltar-rx": navigationButton("node-btn-voltar-rx", "Voltar à Prescrição", "prescricao", "btn btn-secondary"),
      "node-aut-body": node("node-aut-body", "layout.container", { className: "dis-screen-body" }, ["node-card-parecer"]),
      "node-card-parecer": node("node-card-parecer", "dis.card", { className: "dis-card" }, ["node-btn-concluir-disp"]),
      "node-btn-concluir-disp": navigationButton("node-btn-concluir-disp", "Concluir Dispensação", "home", "btn btn-success"),
    },
  };
}

function assertPilotAssets(protoDir) {
  const required = [
    "screens/prescricao.html",
    "screens/autorizacao.html",
    "data/patient.json",
    "data/prescriptions.json",
    "data/authorizations.json",
  ];
  for (const relativePath of required) {
    if (!fs.existsSync(path.join(protoDir, relativePath))) {
      throw new Error(`Artefato obrigatório do piloto DIS ausente: ${relativePath}`);
    }
  }
}

function installDispensationPilot(projectDir, protoId = "dis-modular") {
  const protoDir = path.join(projectDir, "design", "prototypes", protoId);
  const protoPath = path.join(protoDir, "proto.json");
  if (!fs.existsSync(protoPath)) throw new Error(`Protótipo '${protoId}' não encontrado.`);
  assertPilotAssets(protoDir);

  const proto = JSON.parse(fs.readFileSync(protoPath, "utf8"));
  const home = proto.screens?.home;
  if (!home?.nodes?.[home.rootNodeId]) throw new Error("Tela home do piloto DIS é inválida.");

  home.nodes["node-btn-nova-rx"] = navigationButton("node-btn-nova-rx", "Nova Prescrição", "prescricao");
  const rootChildren = home.nodes[home.rootNodeId].children || [];
  if (!rootChildren.includes("node-btn-nova-rx")) rootChildren.push("node-btn-nova-rx");
  home.nodes[home.rootNodeId].children = rootChildren;
  proto.screens.prescricao = prescriptionScreen();
  proto.screens.autorizacao = authorizationScreen();
  proto.metadata.updatedAt = new Date().toISOString();

  const validation = validatePrototypeDefinition(proto);
  if (!validation.valid) throw new Error(`Piloto DIS inválido: ${validation.errors.join("; ")}`);

  const temporaryPath = `${protoPath}.tmp`;
  fs.writeFileSync(temporaryPath, JSON.stringify(proto, null, 2), "utf8");
  fs.renameSync(temporaryPath, protoPath);
  return { ok: true, protoId, screens: Object.keys(proto.screens) };
}

module.exports = { installDispensationPilot };
