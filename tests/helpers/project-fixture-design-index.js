// @ts-check
const path = require("node:path");
const { writeJson } = require("./project-fixture-files");

function writeDesignIndex(projectDir) {
  writeJson(path.join(projectDir, "design", "design.json"), {
    schema: 1,
    project: "Projeto de Fixture",
    prototypes: [
      {
        id: "dis-modular",
        title: "DIS - Fluxo de Dispensação (Modular)",
        file: "design/prototypes/dis-modular/proto.json",
        externalUrl: null,
      },
      {
        id: "dis-fluxo-paciente",
        title: "DIS - Fluxo do Paciente",
        file: "design/prototypes/dis-fluxo-paciente/index.html",
        externalUrl: null,
      },
      {
        id: "dis-design-system",
        title: "DIS Design System",
        file: "design/prototypes/dis-design-system/index.html",
        externalUrl: null,
      },
    ],
    components: [],
    features: ["visao-geral-paciente"],
  });

  writeJson(path.join(projectDir, "doc", "features", "visao-geral-paciente", "mapa-camadas.json"), {
    feature: "visao-geral-paciente",
    telas: [
      {
        id: "painel-paciente",
        titulo: "Painel do Paciente",
        rota: "/paciente",
        componente: "PatientHeaderComponent",
        campos: [
          {
            id: "nome-paciente",
            rotulo: "Nome do paciente",
            ui: { c: "dis.header", st: "implementado" },
            regra: { descricao: "Exibe o nome completo do paciente.", st: "implementado" },
            api: { endpoint: "/api/patients/:id" },
            dados: { tabela: "patients", coluna: "name" },
          },
          {
            id: "anotacoes",
            rotulo: "Anotações clínicas",
            ui: { c: "dis.annotation-list", st: "implementado" },
            regra: { descricao: "Lista as anotações em ordem decrescente.", st: "implementado" },
          },
        ],
      },
    ],
  });
}

module.exports = { writeDesignIndex };
