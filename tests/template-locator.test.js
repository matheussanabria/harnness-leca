// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");

const {
  parseTemplateNodes,
  locateElementInTemplate,
} = require("../ui/server/services/template-locator.service");

test("template-locator: parseTemplateNodes extrai tags, atributos e bindings", () => {
  const html = `
    <div class="container" id="main">
      <span class="badge" [class.active]="isActive">Título</span>
      <input type="text" placeholder="Nome" />
    </div>
  `;
  const nodes = parseTemplateNodes(html);
  assert.equal(nodes.length, 3);

  const divNode = nodes[0];
  assert.equal(divNode.tag, "div");
  assert.equal(divNode.attributes.class, "container");
  assert.equal(divNode.attributes.id, "main");

  const spanNode = nodes[1];
  assert.equal(spanNode.tag, "span");
  assert.equal(spanNode.attributes.class, "badge");
  assert.equal(spanNode.bindings["[class.active]"], "isActive");
  assert.equal(spanNode.text, "Título");

  const inputNode = nodes[2];
  assert.equal(inputNode.tag, "input");
  assert.equal(inputNode.isSelfClosing, true);
});

test("template-locator: locateElementInTemplate localiza nó estático exclusivo", () => {
  const html = `
    <header class="header">
      <h1 class="title">Visão Geral</h1>
      <p class="subtitle">Lista de entregas</p>
    </header>
  `;
  const res = locateElementInTemplate(html, {
    tag: "h1",
    text: "Visão Geral",
    attributes: { class: "title" },
  });

  assert.equal(res.ok, true);
  assert.equal(res.node.tag, "h1");
  assert.equal(res.rawContent, "Visão Geral");
  assert.equal(res.rawOpenTag, '<h1 class="title">');
});

test("template-locator: bloqueia nó com interpolação {{ }}", () => {
  const html = `
    <div class="user-info">
      <span class="username">Olá, {{ user.name }}</span>
    </div>
  `;
  const res = locateElementInTemplate(html, {
    tag: "span",
    text: "Olá, João",
    attributes: { class: "username" },
  });

  assert.equal(res.ok, false);
  assert.equal(res.reason, "interpolation");
  assert.match(res.message, /interpolação dinâmica/);
});

test("template-locator: bloqueia nós dentro de laços @for e *ngFor", () => {
  // Caso 1: *ngFor
  const html1 = `
    <ul>
      <li *ngFor="let item of items" class="item">{{ item.title }}</li>
    </ul>
  `;
  const res1 = locateElementInTemplate(html1, {
    tag: "li",
    attributes: { class: "item" },
  });
  assert.equal(res1.ok, false);
  assert.equal(res1.reason, "inside-loop");

  // Caso 2: @for Angular 17+
  const html2 = `
    <div class="card-list">
      @for (item of items; track item.id) {
        <span class="item-badge">Badge</span>
      }
    </div>
  `;
  const res2 = locateElementInTemplate(html2, {
    tag: "span",
    text: "Badge",
    attributes: { class: "item-badge" },
  });
  assert.equal(res2.ok, false);
  assert.equal(res2.reason, "inside-loop");
});

test("template-locator: detecta nós ambíguos e devolve candidatos com linha e snippet", () => {
  const html = `
    <div class="actions">
      <button class="btn btn-primary">Salvar</button>
      <button class="btn btn-primary">Salvar</button>
    </div>
  `;
  const res = locateElementInTemplate(html, {
    tag: "button",
    text: "Salvar",
    attributes: { class: "btn btn-primary" },
  });

  assert.equal(res.ok, false);
  assert.equal(res.reason, "ambiguous");
  assert.equal(res.candidates.length, 2);
  assert.ok(res.candidates[0].line);
  assert.ok(res.candidates[0].snippet);
});

test("template-locator: retorna not-found para elementos ausentes", () => {
  const html = `<p>Apenas um parágrafo</p>`;
  const res = locateElementInTemplate(html, {
    tag: "button",
    text: "Confirmar",
  });
  assert.equal(res.ok, false);
  assert.equal(res.reason, "not-found");
});

test("template-locator: filtra atributos e classes de runtime do Angular (_ngcontent, _nghost, ng-reflect, ng-*)", () => {
  const html = `
    <div class="card-box">
      <h3 class="card-title">Título Estático</h3>
    </div>
  `;
  // Elemento clicado no DOM real com atributos e classes injetadas pelo Angular
  const res = locateElementInTemplate(html, {
    tag: "h3",
    text: "Título Estático",
    attributes: {
      class: "card-title ng-star-inserted ng-untouched",
      "_ngcontent-ng-c123456": "",
      "_nghost-ng-c123456": "",
      "ng-reflect-router-link": "/detalhe",
      "ng-version": "18.2.0",
    },
    classes: ["card-title", "ng-star-inserted", "ng-untouched"],
  });

  assert.equal(res.ok, true);
  assert.equal(res.node.tag, "h3");
  assert.equal(res.rawContent, "Título Estático");
});

test("template-locator: detecta binding dinâmico de texto ([innerText], [innerHTML])", () => {
  const html = `
    <div class="box">
      <span class="label" [innerText]="labelTexto">Placeholder</span>
    </div>
  `;
  const res = locateElementInTemplate(html, {
    tag: "span",
    text: "Placeholder",
    attributes: { class: "label" },
  });

  assert.equal(res.ok, false);
  assert.equal(res.reason, "binding");
  assert.match(res.message, /binding dinâmico/);
});

test("template-locator: detecta componente filho customizado como child-component", () => {
  const html = `
    <div class="page">
      <entrega-liberada-calculo-card [item]="item" />
    </div>
  `;
  const res = locateElementInTemplate(html, {
    tag: "entrega-liberada-calculo-card",
  });

  assert.equal(res.ok, false);
  assert.equal(res.reason, "child-component");
  assert.match(res.message, /componente filho/);
});
