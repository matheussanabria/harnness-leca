import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { reconstructPrototypeFromArtifact } from "../ui/server/services/prototype-reconstructor.service.js";
import { validatePrototypeDefinition } from "../ui/server/services/prototype-validator.service.js";
import { createProjectFixture } from "./helpers/project-fixture.js";

const fixture = createProjectFixture();
const sourceProjectDir = fixture.dir;
test.after(() => fixture.cleanup());

test("EP-12.19 & EP-12.20: Reconstrução Completa do Protótipo DIS", async (t) => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "harness-reconstruction-"));
  const projectDir = path.join(tempRoot, "saude-dispensacao");
  const sourceArtifact = path.join(sourceProjectDir, "design", "dis-fluxo-paciente", "Main.dc.html");
  const targetArtifact = path.join(projectDir, "design", "dis-fluxo-paciente", "Main.dc.html");
  const sourceData = path.join(sourceProjectDir, "design", "prototypes", "dis-fluxo-paciente-inspecao", "data");
  const targetData = path.join(projectDir, "design", "prototypes", "dis-fluxo-paciente-inspecao", "data");
  fs.mkdirSync(path.dirname(targetArtifact), { recursive: true });
  fs.mkdirSync(path.dirname(targetData), { recursive: true });
  fs.copyFileSync(sourceArtifact, targetArtifact);
  fs.cpSync(sourceData, targetData, { recursive: true });
  t.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));

  await t.test("reconstrói o protótipo dis-modular a partir do legado DataChef", () => {
    const result = reconstructPrototypeFromArtifact(
      projectDir,
      "design/dis-fluxo-paciente/Main.dc.html",
      "dis-modular",
      "DIS — Fluxo de Dispensação (Modular)"
    );

    assert.equal(result.ok, true);
    assert.equal(result.protoId, "dis-modular");
    assert.ok(result.nodesCount >= 5, "Deve extrair ao menos 5 nós semânticos");
    assert.equal(result.screensCount, 1);
  });

  await t.test("proto.json gerado atende 100% às regras do validador de schema v2", () => {
    const protoPath = path.join(projectDir, "design", "prototypes", "dis-modular", "proto.json");
    const raw = fs.readFileSync(protoPath, "utf8");
    const proto = JSON.parse(raw);

    const validation = validatePrototypeDefinition(proto);
    assert.equal(validation.valid, true, `Erros de validação: ${validation.errors.join("; ")}`);
    assert.equal(proto.metadata.schemaVersion, "2.0.0");
    assert.ok(proto.screens.home);
    assert.ok(proto.screens.home.nodes["root-home"]);
  });

  await t.test("screens/home.html possui marcação anotada com data-node-id e sem scripts legados", () => {
    const screenPath = path.join(projectDir, "design", "prototypes", "dis-modular", "screens", "home.html");
    const html = fs.readFileSync(screenPath, "utf8");

    assert.ok(html.includes("data-node-id="), "Deve conter marcação data-node-id");
    assert.ok(html.includes("data-component="), "Deve conter referência ao componente");
    assert.ok(!html.includes("support.js"), "Não deve conter script support.js");
    assert.ok(!html.includes("<x-import"), "Não deve conter tags proprietárias x-import");
  });

  await t.test("data/ contém datasets de mock clínicos do paciente", () => {
    const dataDir = path.join(projectDir, "design", "prototypes", "dis-modular", "data");
    const patientRaw = fs.readFileSync(path.join(dataDir, "patient.json"), "utf8");
    const patient = JSON.parse(patientRaw);
    assert.equal(patient.name, "Maria Silva Santos");

    const notesRaw = fs.readFileSync(path.join(dataDir, "notes.json"), "utf8");
    const notes = JSON.parse(notesRaw);
    assert.ok(Array.isArray(notes));
  });
});
