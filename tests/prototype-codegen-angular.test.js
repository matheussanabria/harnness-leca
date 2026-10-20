// @ts-check
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  generateAngularTemplateNode,
  generateAngularClass,
  generateAngularScreen,
} from "../ui/server/services/prototype-codegen-angular.service.js";

const REPO_ROOT = path.resolve(".");
const SERVICE_PATH = path.join(REPO_ROOT, "ui", "server", "services", "prototype-codegen-angular.service.js");

test("EP-12.26: Adaptador Angular 18 (Signals & Standalone Components)", async (t) => {
  await t.test("serviço respeita o limite estrito de linhas e diretrizes anti-monólito", () => {
    assert.ok(fs.existsSync(SERVICE_PATH));
    const lines = fs.readFileSync(SERVICE_PATH, "utf8").split("\n").length;
    assert.ok(lines <= 250, `Arquivo com ${lines} linhas (limite 250).`);
  });

  await t.test("generateAngularTemplateNode compila bindings de signals e eventos de navegação", () => {
    const node = {
      id: "btn-salvar",
      componentId: "dis.button",
      props: { className: "btn btn-primary", label: "Salvar Dados" },
      bindings: { title: "user.nome" },
      events: { click: { type: "navigate", target: "paciente-detalhe" } },
    };

    const tpl = generateAngularTemplateNode(node);
    assert.ok(tpl.includes("[title]=\"state().user.nome\""));
    assert.ok(tpl.includes("(click)=\"onNavigate('paciente-detalhe')\""));
    assert.ok(tpl.includes("Salvar Dados"));
  });

  await t.test("generateAngularClass produz Standalone Component com Signals nativos do Angular 18", () => {
    const screen = {
      id: "fluxo-dispensacao",
      initialState: {
        pacienteId: 1024,
        status: "ativo",
      },
    };

    const ts = generateAngularClass(screen, "FluxoDispensacaoScreen", "app-fluxo-dispensacao");
    assert.ok(ts.includes("standalone: true"));
    assert.ok(ts.includes("imports: [CommonModule]"));
    assert.ok(ts.includes("readonly state = signal<Record<string, any>>("));
    assert.ok(ts.includes('"pacienteId": 1024'));
    assert.ok(ts.includes("ChangeDetectionStrategy.OnPush"));
  });

  await t.test("generateAngularScreen compila pacote completo (ts, html, css)", () => {
    const screen = {
      id: "triagem",
      rootNodeId: "root",
      nodes: {
        root: {
          id: "root",
          componentId: "layout.container",
          props: { className: "triagem-container" },
          children: ["btn-iniciar"],
        },
        "btn-iniciar": {
          id: "btn-iniciar",
          componentId: "dis.button",
          props: { label: "Iniciar Triagem" },
          children: [],
        },
      },
    };

    const res = generateAngularScreen(screen, {});
    assert.equal(res.screenId, "triagem");
    assert.equal(res.componentName, "TriagemScreen");
    assert.equal(res.selector, "app-triagem");
    assert.equal(res.framework, "angular18");
    assert.ok(res.html.includes("data-node-id=\"btn-iniciar\""));
    assert.ok(res.ts.includes("export class TriagemScreenComponent"));
    assert.ok(res.css.includes(":host"));
  });
});
