// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const {
  parseComponentTokens,
  scanRepositoryLayers,
  getFeatureLayers,
} = require("../ui/server/services/design-layers.service");

test("design-layers: parseComponentTokens extrai e normaliza nomes de componentes", () => {
  const str = "VisaoGeralComponent → entregas-liberadas-section · anotacoes-resumo-card";
  const tokens = parseComponentTokens(str);
  assert.deepEqual(tokens, [
    "VisaoGeralComponent",
    "entregas-liberadas-section",
    "anotacoes-resumo-card",
  ]);

  const single = parseComponentTokens("<SearchField>");
  assert.deepEqual(single, ["SearchField"]);
});

test("design-layers: scanRepositoryLayers vincula componentes por campo 'c' e detecta 'so-no-prototipo'", () => {
  const mockJson = JSON.stringify({
    feature: "visao-geral",
    telas: [
      {
        id: "s1",
        componente: "VisaoGeralComponent",
        campos: [
          {
            id: "f1",
            rotulo: "Busca",
            ui: { c: "SearchField", st: "so-no-prototipo" },
          },
          {
            id: "f2",
            rotulo: "Tabela",
            ui: { c: "TabelaEntregas", st: "implementado" },
          },
        ],
      },
    ],
  });

  const mockDeps = {
    fs: {
      existsSync: (p) => p.includes("features"),
      readdirSync: (p) => {
        if (p.endsWith("features")) {
          return [{ name: "visao-geral", isDirectory: () => true }];
        }
        return [];
      },
      readFileSync: () => mockJson,
    },
    path,
  };

  const res = scanRepositoryLayers("/repo", mockDeps);
  assert.equal(res.featuresList.includes("visao-geral"), true);
  assert.equal(res.documentedComponents.has("searchfield"), true);
  assert.equal(res.documentedComponents.has("tabelaentregas"), true);
  assert.equal(res.documentedComponents.has("visaogeralcomponent"), true);
  // Não documenta componente aleatório
  assert.equal(res.documentedComponents.has("outro-componente"), false);

  // Protótipo detectado pelo status 'so-no-prototipo'
  assert.equal(res.prototypeComponents.has("searchfield"), true);
  assert.equal(res.prototypeComponents.has("tabelaentregas"), false);
});

test("design-layers: getFeatureLayers normaliza as 4 camadas (ui, regra, api, dados)", () => {
  const mockJson = JSON.stringify({
    telas: [
      {
        id: "s1",
        titulo: "Tela Pacientes",
        campos: [
          {
            id: "c1",
            rotulo: "Nome",
            ui: { t: "Input texto", c: "TextInput" },
            regra: { t: "Obrigatório" },
            api: { t: "POST /pacientes" },
            dados: { t: "Coluna nome varchar" },
          },
        ],
      },
    ],
  });

  const mockDeps = {
    fs: {
      existsSync: () => true,
      readdirSync: () => [
        { name: "04-modelagem.md", isFile: () => true, isDirectory: () => false },
        { name: "mapa-camadas.json", isFile: () => true, isDirectory: () => false },
      ],
      readFileSync: () => mockJson,
    },
    path,
  };

  const res = getFeatureLayers("/repo", "pacientes", mockDeps);
  assert.equal(res.found, true);
  assert.equal(res.layers.ui.length, 1);
  assert.equal(res.layers.regra.length, 1);
  assert.equal(res.layers.api.length, 1);
  assert.equal(res.layers.dados.length, 1);
  assert.equal(res.files.some((f) => f.name === "04-modelagem.md"), true);
});

test("design-layers: getFeatureLayers rejeita slug malicioso", () => {
  assert.throws(
    () => getFeatureLayers("/repo", "../../etc/passwd"),
    /Identificador de funcionalidade inválido/
  );
});
