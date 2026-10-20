// @ts-check
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  generateReactJsxNode,
  generateReactTsxComponent,
  generateReactScreen,
} from "../ui/server/services/prototype-codegen-react.service.js";

const REPO_ROOT = path.resolve(".");
const SERVICE_PATH = path.join(REPO_ROOT, "ui", "server", "services", "prototype-codegen-react.service.js");

test("EP-12.27: Adaptador React 18+ (Hooks & Componentes Funcionais)", async (t) => {
  await t.test("serviço respeita o limite estrito de linhas e não possui emojis", () => {
    assert.ok(fs.existsSync(SERVICE_PATH));
    const content = fs.readFileSync(SERVICE_PATH, "utf8");
    const lines = content.split("\n").length;
    assert.ok(lines <= 250, `Arquivo com ${lines} linhas (limite 250).`);

    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}]/u;
    assert.equal(emojiRegex.test(content), false, "Não deve conter emojis no código.");
  });

  await t.test("generateReactJsxNode compila nós semânticos para JSX com className e onClick", () => {
    const node = {
      id: "btn-confirmar",
      componentId: "dis.button",
      props: { className: "btn btn-success", label: "Confirmar Dispensação" },
      bindings: { title: "pedido.codigo" },
      events: { click: { type: "navigate", target: "recibo" } },
    };

    const jsx = generateReactJsxNode(node);
    assert.ok(jsx.includes('className="btn btn-success"'));
    assert.ok(jsx.includes("title={state?.pedido.codigo}"));
    assert.ok(jsx.includes("onClick={() => handleNavigate('recibo')}"));
    assert.ok(jsx.includes('{"Confirmar Dispensação"}'));
  });

  await t.test("generateReactTsxComponent produz componente funcional com useState e callbacks", () => {
    const screen = {
      id: "atendimento",
      initialState: {
        paciente: "Maria Silva",
        cpf: "123.456.789-00",
      },
    };

    const tsx = generateReactTsxComponent(screen, "AtendimentoScreen", "<div>Atendimento</div>");
    assert.ok(tsx.includes("import React, { useState, useCallback } from 'react';"));
    assert.ok(tsx.includes("export function AtendimentoScreen("));
    assert.ok(tsx.includes("const [state, setState] = useState<Record<string, any>>("));
    assert.ok(tsx.includes('"paciente": "Maria Silva"'));
    assert.ok(tsx.includes("export default AtendimentoScreen;"));
  });

  await t.test("generateReactScreen compila pacote completo (tsx, css)", () => {
    const screen = {
      id: "dashboard",
      rootNodeId: "root",
      nodes: {
        root: {
          id: "root",
          componentId: "layout.container",
          props: { className: "dash-container" },
          children: ["btn-novo"],
        },
        "btn-novo": {
          id: "btn-novo",
          componentId: "dis.button",
          props: { label: "Novo Registro" },
          children: [],
        },
      },
    };

    const res = generateReactScreen(screen, {});
    assert.equal(res.screenId, "dashboard");
    assert.equal(res.componentName, "DashboardScreen");
    assert.equal(res.framework, "react18");
    assert.ok(res.tsx.includes("export function DashboardScreen"));
    assert.ok(res.tsx.includes('data-node-id="btn-novo"'));
    assert.ok(res.css.includes(".dashboard-container"));
  });
});
