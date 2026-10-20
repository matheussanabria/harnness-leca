// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  isInside,
  parseComponentMetadata,
} = require("../ui/server/services/component-resolver.service");

test("isInside: valida confinamento estrito de diretório", () => {
  const root = path.resolve("/app/repo");
  assert.equal(isInside(root, path.resolve("/app/repo/src/app/comp.ts")), true);
  assert.equal(isInside(root, path.resolve("/app/repo")), true);
  assert.equal(isInside(root, path.resolve("/app/repo/../etc/passwd")), false);
  assert.equal(isInside(root, path.resolve("/other/repo/comp.ts")), false);
});

test("parseComponentMetadata: extrai metadados de casos reais do Angular", () => {
  // 1. templateUrl e styleUrl (Angular 17+)
  const ts1 = `
@Component({
  selector: 'app-item-card',
  standalone: true,
  templateUrl: './item-card.component.html',
  styleUrl: './item-card.component.scss'
})
export class ItemCardComponent {}
`;
  const m1 = parseComponentMetadata(ts1, "ItemCardComponent");
  assert.ok(m1);
  assert.equal(m1.className, "ItemCardComponent");
  assert.equal(m1.selector, "app-item-card");
  assert.equal(m1.templateUrl, "./item-card.component.html");
  assert.equal(m1.inlineTemplate, null);
  assert.deepEqual(m1.styleUrls, ["./item-card.component.scss"]);
  assert.equal(m1.standalone, true);

  // 2. template inline com crase multiline e styleUrls array
  const ts2 = `
@Component({
  selector: 'app-multi-style',
  standalone: false,
  template: \`
    <div class="box">
      <h2>Título</h2>
    </div>
  \`,
  styleUrls: ['./first.css', '../shared.css']
})
export class MultiStyleComponent {}
`;
  const m2 = parseComponentMetadata(ts2, "MultiStyleComponent");
  assert.ok(m2);
  assert.equal(m2.standalone, false);
  assert.ok(m2.inlineTemplate.includes("<h2>Título</h2>"));
  assert.deepEqual(m2.styleUrls, ["./first.css", "../shared.css"]);

  // 3. template inline com aspas simples e styles array inline
  const ts3 = `
@Component({
  selector: 'app-inline-styles',
  template: '<span class="label">Texto</span>',
  styles: ['h1 { color: red; }', \`.label { font-weight: bold; }\`]
})
export class InlineStylesComponent {}
`;
  const m3 = parseComponentMetadata(ts3, "InlineStylesComponent");
  assert.ok(m3);
  assert.equal(m3.inlineTemplate, '<span class="label">Texto</span>');
  assert.deepEqual(m3.inlineStyles, ["h1 { color: red; }", ".label { font-weight: bold; }"]);

  // 4. template inline com aspas duplas
  const ts4 = `
@Component({
  selector: 'app-double-quote',
  template: "<p>Paragrafo</p>"
})
export class DoubleQuoteComponent {}
`;
  const m4 = parseComponentMetadata(ts4, "DoubleQuoteComponent");
  assert.ok(m4);
  assert.equal(m4.inlineTemplate, "<p>Paragrafo</p>");
});

test("parseComponentMetadata: dois componentes no mesmo arquivo são isolados corretamente", () => {
  const multiComponentFile = `
import { Component } from '@angular/core';

@Component({
  selector: 'comp-primeiro',
  templateUrl: './primeiro.html',
  styleUrl: './primeiro.css'
})
export class PrimeiroComponent {}

@Component({
  selector: 'comp-segundo',
  templateUrl: './segundo.html',
  styleUrl: './segundo.css'
})
export class SegundoComponent {}
`;

  // Busca por classe
  const mPrimeiro = parseComponentMetadata(multiComponentFile, "PrimeiroComponent");
  assert.ok(mPrimeiro);
  assert.equal(mPrimeiro.className, "PrimeiroComponent");
  assert.equal(mPrimeiro.templateUrl, "./primeiro.html");

  const mSegundo = parseComponentMetadata(multiComponentFile, "SegundoComponent");
  assert.ok(mSegundo);
  assert.equal(mSegundo.className, "SegundoComponent");
  assert.equal(mSegundo.templateUrl, "./segundo.html");

  // Busca por seletor
  const sPrimeiro = parseComponentMetadata(multiComponentFile, "comp-primeiro");
  assert.ok(sPrimeiro);
  assert.equal(sPrimeiro.className, "PrimeiroComponent");

  const sSegundo = parseComponentMetadata(multiComponentFile, "comp-segundo");
  assert.ok(sSegundo);
  assert.equal(sSegundo.className, "SegundoComponent");
});

