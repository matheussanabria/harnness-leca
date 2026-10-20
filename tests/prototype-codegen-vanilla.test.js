// @ts-check
import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveHtmlTag,
  generateVanillaNode,
  generateVanillaScript,
  generateVanillaScreen,
} from "../ui/server/services/prototype-codegen-vanilla.service.js";

test("EP-12.25: Adaptador de Geração Vanilla HTML/CSS/JS", async (t) => {
  await t.test("resolveHtmlTag mapeia corretamente componentes para tags padrão", () => {
    assert.equal(resolveHtmlTag("dis.button"), "button");
    assert.equal(resolveHtmlTag("dis.icon"), "i");
    assert.equal(resolveHtmlTag("layout.header"), "header");
    assert.equal(resolveHtmlTag("layout.container"), "main");
    assert.equal(resolveHtmlTag("custom.box"), "div");
    assert.equal(resolveHtmlTag("custom.box", "section"), "section");
  });

  await t.test("generateVanillaNode compila nó simples com atributos e labels", () => {
    const node = {
      id: "node-btn-1",
      componentId: "dis.button",
      props: {
        className: "btn btn-primary",
        label: "Confirmar Pedido",
        type: "button",
      },
      events: {
        click: { type: "navigate", target: "resumo" },
      },
    };

    const html = generateVanillaNode(node);
    assert.ok(html.includes("<button"));
    assert.ok(html.includes('class="btn btn-primary"'));
    assert.ok(html.includes('data-node-id="node-btn-1"'));
    assert.ok(html.includes('data-action="goto:resumo"'));
    assert.ok(html.includes(">Confirmar Pedido</button>"));
  });

  await t.test("generateVanillaNode processa nós aninhados e slots nomeados", () => {
    const node = {
      id: "node-card-1",
      componentId: "dis.card",
      props: { className: "card" },
      children: [
        {
          id: "node-header-1",
          componentId: "layout.header",
          props: { text: "Título do Card" },
        },
      ],
      slotTargets: {
        actions: [
          {
            id: "node-btn-action",
            componentId: "dis.button",
            props: { label: "Ação Rápida" },
          },
        ],
      },
    };

    const html = generateVanillaNode(node);
    assert.ok(html.includes("Título do Card"));
    assert.ok(html.includes('data-slot="actions"'));
    assert.ok(html.includes("Ação Rápida"));
  });

  await t.test("generateVanillaScreen compila tela completa em pacote estruturado (html, css, js)", () => {
    const screen = {
      id: "home",
      rootNodeId: "root",
      nodes: {
        root: {
          id: "root",
          componentId: "layout.container",
          props: { className: "container" },
          children: ["btn-1"],
        },
        "btn-1": {
          id: "btn-1",
          componentId: "dis.button",
          props: { label: "Salvar" },
          children: [],
        },
      },
    };

    const res = generateVanillaScreen(screen, {});
    assert.equal(res.screenId, "home");
    assert.equal(res.framework, "vanilla");
    assert.ok(res.html.includes('data-node-id="root"'));
    assert.ok(res.html.includes('data-node-id="btn-1"'));
    assert.ok(res.css.includes(".screen-container"));
    assert.ok(res.js.includes("export function setupScreen"));
  });
});
