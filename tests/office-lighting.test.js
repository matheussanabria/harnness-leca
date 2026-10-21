// @ts-check
import test from "node:test";
import assert from "node:assert/strict";

import {
  LIGHTING_MODES,
  LIGHTING_PRESETS,
  cssVarsForPreset,
  resolveLightingMode,
  resolveLightingPreset
} from "../ui/public/js/office/lighting-presets.js";
import { OfficeLightingManager } from "../ui/public/js/office/office-lighting.js";
import { createLightingDomTarget } from "../ui/public/js/office/office-lighting-dom.js";
import { bindOfficeLightingDom } from "../ui/public/js/office/office-lighting-bootstrap.js";
import { officeAgentState } from "../ui/public/js/office/office-agent-state.js";
import {
  LIGHT_NAMES,
  OfficeLightingRig,
  setupOfficeLights
} from "../ui/public/js/office3d/scene-lighting.js";

const EMOJI_REGEX = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]/u;

function fakeVector() {
  return {
    x: 0,
    y: 0,
    z: 0,
    set(x, y, z) {
      this.x = x;
      this.y = y;
      this.z = z;
    }
  };
}

class FakeLight {
  constructor(color, intensity, distance) {
    this.color = {
      value: color,
      set(value) {
        this.value = value;
      }
    };
    this.intensity = intensity;
    this.distance = distance;
    this.position = fakeVector();
    this.target = { position: fakeVector() };
    this.castShadow = false;
  }
  dispose() {}
}

const FAKE_THREE = {
  AmbientLight: FakeLight,
  DirectionalLight: FakeLight,
  SpotLight: FakeLight,
  PointLight: FakeLight
};

function fakeScene() {
  return {
    children: [],
    add(...objects) {
      this.children.push(...objects);
    },
    remove(object) {
      const index = this.children.indexOf(object);
      if (index >= 0) this.children.splice(index, 1);
    }
  };
}

function fakeDocument() {
  const attributes = {};
  const properties = {};
  return {
    attributes,
    properties,
    documentElement: {
      style: {
        setProperty(name, value) {
          properties[name] = value;
        },
        removeProperty(name) {
          delete properties[name];
        }
      },
      setAttribute(name, value) {
        attributes[name] = value;
      },
      removeAttribute(name) {
        delete attributes[name];
      }
    }
  };
}

test("EP-03.06: catálogo de modos, presets completos e zero emojis", () => {
  assert.deepEqual([...LIGHTING_MODES], ["idle", "active", "attention", "alert", "offline"]);
  assert.equal(Object.keys(LIGHTING_PRESETS).length, LIGHTING_MODES.length);

  for (const mode of LIGHTING_MODES) {
    const preset = LIGHTING_PRESETS[mode];
    assert.equal(preset.id, mode);
    assert.ok(preset.label, `Modo ${mode} precisa de rótulo`);
    assert.ok(preset.description, `Modo ${mode} precisa de descrição`);
    assert.ok(preset.icon.startsWith("fa-solid"), `Modo ${mode} deve usar FontAwesome`);
    assert.equal(EMOJI_REGEX.test(preset.label + preset.description + preset.icon), false);
    for (const name of LIGHT_NAMES) {
      assert.ok(preset.lights[name], `Preset ${mode} deve definir a luz ${name}`);
      assert.equal(typeof preset.lights[name].intensity, "number");
      assert.equal(typeof preset.lights[name].color, "number");
    }
    const css = cssVarsForPreset(preset);
    assert.ok(css["--office-light-brightness"]);
    assert.ok(css["--office-light-overlay"]);
  }

  assert.equal(resolveLightingPreset("desconhecido").id, "idle");
});

test("EP-03.06: precedência de estados dos agentes", () => {
  assert.equal(resolveLightingMode({}), "idle");
  assert.equal(resolveLightingMode({ a: { status: "idle" }, b: { status: "idle" } }), "idle");
  assert.equal(resolveLightingMode({ a: { status: "offline" } }), "offline");
  assert.equal(resolveLightingMode({ a: { status: "offline" }, b: { status: "idle" } }), "idle");
  assert.equal(resolveLightingMode({ a: { status: "thinking" } }), "active");
  assert.equal(resolveLightingMode({ a: { status: "streaming" }, b: { status: "error" } }), "alert");
  assert.equal(
    resolveLightingMode({ a: { status: "waiting_approval" }, b: { status: "streaming" } }),
    "attention"
  );
  assert.equal(
    resolveLightingMode({ a: { status: "error" }, b: { status: "waiting_approval" } }),
    "alert"
  );
});

test("EP-03.06: gerenciador valida modo, notifica e aceita alvos plugáveis", () => {
  const manager = new OfficeLightingManager();
  const applied = [];
  const received = [];

  assert.equal(manager.getMode(), "idle");
  assert.equal(manager.getPreset().id, "idle");

  const detach = manager.attach({ apply: (preset) => applied.push(preset.id) });
  assert.deepEqual(applied, ["idle"]);

  const unsubscribe = manager.subscribe((snapshot) => received.push(snapshot.mode));
  assert.equal(manager.setMode("active"), true);
  assert.equal(manager.getMode(), "active");
  assert.deepEqual(applied, ["idle", "active"]);
  assert.deepEqual(received, ["active"]);

  assert.equal(manager.setMode("inexistente"), false);
  assert.equal(manager.getMode(), "active");

  detach();
  manager.setMode("alert");
  assert.deepEqual(applied, ["idle", "active"]);
  assert.equal(manager.getSnapshot().css["--office-light-brightness"], "0.92");

  unsubscribe();
  manager.setMode("offline");
  assert.deepEqual(received, ["active", "alert"]);

  manager.reset();
  assert.equal(manager.getMode(), "idle");
});

test("EP-03.06: refreshFromAgents deriva o modo do estado real", () => {
  const manager = new OfficeLightingManager();

  manager.refreshFromAgents({ claude: { status: "streaming" } });
  assert.equal(manager.getMode(), "active");

  manager.refreshFromAgents({ claude: { status: "error" }, gemini: { status: "streaming" } });
  assert.equal(manager.getMode(), "alert");

  manager.refreshFromAgents({ claude: { status: "offline" }, gemini: { status: "offline" } });
  assert.equal(manager.getMode(), "offline");

  manager.refreshFromAgents({});
  assert.equal(manager.getMode(), "idle");
  assert.equal(manager.getSnapshot().reason, "agents");
});

test("EP-03.06: alvo DOM escreve variáveis e atributo e limpa no reset", () => {
  const doc = fakeDocument();
  const target = createLightingDomTarget(doc);

  target.apply(LIGHTING_PRESETS.attention);
  assert.equal(doc.attributes["data-office-lighting"], "attention");
  assert.equal(doc.attributes["data-office-lighting-label"], "Aprovação");
  assert.equal(doc.properties["--office-light-overlay"], "rgba(245, 158, 11, 0.18)");

  target.apply(LIGHTING_PRESETS.alert);
  assert.equal(doc.attributes["data-office-lighting"], "alert");

  target.reset();
  assert.equal(doc.attributes["data-office-lighting"], undefined);
  assert.equal(doc.properties["--office-light-overlay"], undefined);
});

test("EP-03.06: rig 3D cria as sete luzes e aplica preset sem recriar a cena", () => {
  const scene = fakeScene();
  const rig = setupOfficeLights(scene, FAKE_THREE);

  assert.ok(rig instanceof OfficeLightingRig);
  assert.deepEqual(Object.keys(rig.lights).sort(), [...LIGHT_NAMES].sort());
  assert.equal(scene.children.length, 9, "Sete luzes e dois alvos de spot");
  assert.ok(rig.getLight("desk").castShadow);
  const deskTarget = rig.getLight("desk").target.position;
  assert.deepEqual([deskTarget.x, deskTarget.y, deskTarget.z], [0, 0.95, 0.25]);

  assert.equal(rig.apply(LIGHTING_PRESETS.active), "active");
  assert.equal(rig.getLight("screen").color.value, 0x2dd4bf);
  assert.equal(rig.getLight("screen").intensity, 2.4);
  assert.equal(rig.getLight("ambient").intensity, 1.5);

  assert.equal(rig.apply({ id: "desconhecido" }), "idle");
  assert.equal(rig.getLight("desk").intensity, 2.4);

  rig.dispose();
  assert.equal(scene.children.length, 0);
  assert.deepEqual(rig.lights, {});
});

test("EP-03.06: assinatura de officeAgentState atualiza o alvo DOM", () => {
  officeAgentState.reset();
  const doc = fakeDocument();
  const unbind = bindOfficeLightingDom(doc);

  assert.equal(doc.attributes["data-office-lighting"], "idle");

  officeAgentState.setAgentState("gemini", { status: "waiting_approval" });
  assert.equal(doc.attributes["data-office-lighting"], "attention");

  officeAgentState.setAgentState("gemini", { status: "error" });
  assert.equal(doc.attributes["data-office-lighting"], "alert");

  unbind();
  officeAgentState.setAgentState("gemini", { status: "streaming" });
  assert.equal(doc.attributes["data-office-lighting"], "alert");

  officeAgentState.reset();
});
