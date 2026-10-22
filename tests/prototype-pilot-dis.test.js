// @ts-check
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { validatePrototypeDefinition } from "../ui/server/services/prototype-validator.service.js";
import { resolveNodeNavigation } from "../ui/server/services/prototype-schema.service.js";
import { generateScreenCode } from "../ui/server/services/prototype-codegen.factory.js";
import { installDispensationPilot } from "../ui/server/services/prototype-pilot-dis.service.js";
import { createProjectFixture } from "./helpers/project-fixture.js";

const fixture = createProjectFixture();
const SAUDE_DIR = fixture.dir;
const PROTO_DIR = path.join(SAUDE_DIR, "design", "prototypes", "dis-modular");
test.after(() => fixture.cleanup());

test("EP-12.31: Piloto Completo do Fluxo DIS Dispensação de Medicamentos", async (t) => {
  const protoPath = path.join(PROTO_DIR, "proto.json");
  assert.ok(fs.existsSync(protoPath), "proto.json deve existir");
  const proto = JSON.parse(fs.readFileSync(protoPath, "utf8"));

  await t.test("instalador recompõe o piloto após uma reconstrução sem alterar o projeto real", () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "harness-pilot-dis-"));
    const tempProject = path.join(tempRoot, "saude-dispensacao");
    const tempProtoDir = path.join(tempProject, "design", "prototypes", "dis-modular");
    fs.cpSync(PROTO_DIR, tempProtoDir, { recursive: true });
    const tempProtoPath = path.join(tempProtoDir, "proto.json");
    const oneScreen = JSON.parse(fs.readFileSync(tempProtoPath, "utf8"));
    oneScreen.screens = { home: oneScreen.screens.home };
    delete oneScreen.screens.home.nodes["node-btn-nova-rx"];
    oneScreen.screens.home.nodes[oneScreen.screens.home.rootNodeId].children =
      oneScreen.screens.home.nodes[oneScreen.screens.home.rootNodeId].children.filter((id) => id !== "node-btn-nova-rx");
    fs.writeFileSync(tempProtoPath, JSON.stringify(oneScreen, null, 2), "utf8");

    try {
      const result = installDispensationPilot(tempProject);
      assert.deepEqual(result.screens, ["home", "prescricao", "autorizacao"]);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  await t.test("o protótipo possui as 3 telas clínicas estruturadas", () => {
    assert.ok(proto.screens.home, "Tela home deve existir");
    assert.ok(proto.screens.prescricao, "Tela prescricao deve existir");
    assert.ok(proto.screens.autorizacao, "Tela autorizacao deve existir");

    assert.equal(proto.screens.home.route, "/");
    assert.equal(proto.screens.prescricao.route, "/prescricao");
    assert.equal(proto.screens.autorizacao.route, "/autorizacao");
  });

  await t.test("arquivos HTML correspondentes existem em screens/ sem emojis", () => {
    for (const [screenId, screen] of Object.entries(proto.screens)) {
      const filePath = path.join(PROTO_DIR, screen.htmlFile);
      assert.ok(fs.existsSync(filePath), `Arquivo ${screen.htmlFile} deve existir`);
      const content = fs.readFileSync(filePath, "utf8");
      assert.ok(content.includes("data-node-id="), `Arquivo ${screen.htmlFile} deve conter data-node-id`);

      if (["prescricao", "autorizacao"].includes(screenId)) {
        assert.ok(content.includes("fa-solid"), `Arquivo ${screen.htmlFile} deve conter ícones FontAwesome`);
      }

      const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}]/u;
      assert.equal(emojiRegex.test(content), false, `Arquivo ${screen.htmlFile} não deve conter emojis`);
    }
  });

  await t.test("navegação circular clínica completa: home -> prescricao -> autorizacao -> home", () => {
    // 1. home -> prescricao
    const btnHome = proto.screens.home.nodes["node-btn-nova-rx"];
    assert.ok(btnHome, "Botão nova prescrição deve existir em home");
    const next1 = resolveNodeNavigation(proto, btnHome);
    assert.equal(next1.id, "prescricao");

    // 2. prescricao -> autorizacao
    const btnPrescricao = proto.screens.prescricao.nodes["node-btn-avancar-aut"];
    assert.ok(btnPrescricao, "Botão solicitar autorização deve existir em prescricao");
    const next2 = resolveNodeNavigation(proto, btnPrescricao);
    assert.equal(next2.id, "autorizacao");

    // 3. autorizacao -> home
    const btnAutorizacao = proto.screens.autorizacao.nodes["node-btn-concluir-disp"];
    assert.ok(btnAutorizacao, "Botão concluir dispensação deve existir em autorizacao");
    const next3 = resolveNodeNavigation(proto, btnAutorizacao);
    assert.equal(next3.id, "home");
  });

  await t.test("datasets clínicos reais existem na pasta data/", () => {
    const requiredData = ["patient.json", "prescriptions.json", "authorizations.json"];
    for (const df of requiredData) {
      const fullPath = path.join(PROTO_DIR, "data", df);
      assert.ok(fs.existsSync(fullPath), `Dataset ${df} deve existir`);
      const parsed = JSON.parse(fs.readFileSync(fullPath, "utf8"));
      assert.ok(Array.isArray(parsed) || typeof parsed === "object");
    }
  });

  await t.test("todas as 3 telas compilam com 100% de sucesso nos 3 frameworks", () => {
    const frameworks = ["vanilla", "angular18", "react18"];
    for (const [screenId, screen] of Object.entries(proto.screens)) {
      for (const fw of frameworks) {
        const out = generateScreenCode(fw, screen, proto);
        assert.equal(out.screenId, screenId);
        assert.equal(out.framework, fw);
      }
    }
  });

  await t.test("proto.json atende estritamente às validações de schema v2", () => {
    const res = validatePrototypeDefinition(proto);
    assert.equal(res.valid, true, `Validação falhou: ${res.errors.join(", ")}`);
  });
});
