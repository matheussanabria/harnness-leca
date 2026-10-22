import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import {
  getValueByPath,
  setValueByPath,
  resolveCombinedState,
  interpolateTemplate,
  hydrateNodePropsWithState,
  loadMockDataset,
} from "../ui/server/services/prototype-state.service.js";
import { createProjectFixture } from "./helpers/project-fixture.js";

const fixture = createProjectFixture();
const projectDir = fixture.dir;
test.after(() => fixture.cleanup());

test("EP-12.15: Schema de Estado e Mocks de Dados Dinâmicos", async (t) => {
  await t.test("getValueByPath e setValueByPath manipulam objetos aninhados", () => {
    const obj = { patient: { name: "Maria", tags: ["hiperdia"] } };
    assert.equal(getValueByPath(obj, "patient.name"), "Maria");
    assert.equal(getValueByPath(obj, "patient.unknown"), undefined);

    setValueByPath(obj, "patient.age", 68);
    assert.equal(obj.patient.age, 68);
  });

  await t.test("resolveCombinedState mescla globalState e screenState", () => {
    const proto = {
      globalState: { system: "DIS", env: "homologacao" },
      screens: {
        home: {
          initialState: { counter: 1, env: "local" }
        }
      }
    };

    const combined = resolveCombinedState(proto, "home");
    assert.equal(combined.system, "DIS");
    assert.equal(combined.counter, 1);
    assert.equal(combined.env, "local"); // local sobrescreve global
  });

  await t.test("interpolateTemplate substitui variáveis de estado em texto", () => {
    const state = { patient: { name: "Maria Silva", cns: "700123" } };
    const result = interpolateTemplate("Paciente: {{patient.name}} (CNS: {{patient.cns}})", state);
    assert.equal(result, "Paciente: Maria Silva (CNS: 700123)");

    const unchanged = interpolateTemplate("Sem variáveis aqui", state);
    assert.equal(unchanged, "Sem variáveis aqui");
  });

  await t.test("hydrateNodePropsWithState hidrata bindings e variáveis nas props", () => {
    const state = {
      user: { role: "Farmacêutico" },
      notes: [
        { date: "10/05/2026", text: "Paciente orientado." }
      ]
    };

    const node = {
      id: "annotation-list-1",
      componentId: "dis.annotation-list",
      props: {
        header: "Registrado por {{user.role}}",
      },
      bindings: {
        items: { propName: "items", stateKey: "notes" }
      }
    };

    const hydrated = hydrateNodePropsWithState(node, state);
    assert.equal(hydrated.props.header, "Registrado por Farmacêutico");
    assert.deepEqual(hydrated.props.items, state.notes);
  });

  await t.test("loadMockDataset carrega datasets reais do DIS", () => {
    const patient = loadMockDataset(projectDir, "dis-fluxo-paciente-inspecao", "patient");
    assert.ok(patient);
    assert.equal(patient.name, "Maria Silva Santos");
    assert.equal(patient.age, 68);

    const notes = loadMockDataset(projectDir, "dis-fluxo-paciente-inspecao", "notes");
    assert.ok(Array.isArray(notes));
    assert.ok(notes.length >= 2);
    assert.equal(notes[0].date, "18/05/2026");
  });
});
