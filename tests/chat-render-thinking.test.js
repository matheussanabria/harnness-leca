// @ts-check
// Bloco de raciocínio do chat: a rolagem e a escolha do usuário sobrevivem ao redesenho do histórico.
import test from "node:test";
import assert from "node:assert/strict";
import {
  thinkingHtml, captureThinkState, restoreThinkState, installThinkHandlers, resetThinkState,
} from "../ui/public/js/modules/chat-render-thinking.js";

/** Elemento .think-content simulado: rolagem + o <details> pai com a chave. */
function thinkEl(key, { scrollTop = 0, scrollHeight = 1000, clientHeight = 200, live = false } = {}) {
  const parent = { dataset: { thinkKey: key } };
  const el = {
    scrollTop, scrollHeight, clientHeight,
    closest: (/** @type {string} */ sel) => (sel === "[data-think-key]" ? parent : sel === "[data-think-live]" ? (live ? parent : null) : null),
  };
  return el;
}
const boxOf = (/** @type {any[]} */ els) => ({ querySelectorAll: (/** @type {string} */ sel) => (sel === ".think-content" ? els : []) });

test.beforeEach(() => resetThinkState());

test("html: vazio não gera bloco; texto é escapado; mostra o contador de caracteres", () => {
  assert.equal(thinkingHtml("c:0", ""), "");
  const html = thinkingHtml("c:0", "<script>alert(1)</script> pensando");
  assert.ok(!html.includes("<script>"));
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /data-think-key="c:0"/);
  assert.match(html, /\d+ caracteres/);
  assert.match(html, /data-think-act="expand"/);
  assert.match(html, /data-think-act="copy"/);
  assert.ok(!/[\u{1F300}-\u{1FAFF}]/u.test(html), "sem emojis na interface");
});

test("html: aberto enquanto só pensa; fecha quando a resposta começa", () => {
  assert.match(thinkingHtml("c:0", "x", { streaming: true, hasAnswer: false }), /<details[^>]* open>/);
  assert.doesNotMatch(thinkingHtml("c:0", "x", { streaming: true, hasAnswer: true }), /<details[^>]* open>/);
  assert.doesNotMatch(thinkingHtml("c:0", "x", { streaming: false }), /<details[^>]* open>/);
  assert.match(thinkingHtml("c:0", "x", { streaming: true, phase: "thinking" }), /gerando pensamento/);
});

test("rolagem: quem rolou para cima fica exatamente onde estava quando chega texto novo", () => {
  const before = boxOf([thinkEl("c:1", { scrollTop: 120, scrollHeight: 1000, clientHeight: 200 })]);
  const snap = captureThinkState(before);
  // depois do redesenho o elemento é novo, com mais texto e rolagem zerada
  const after = boxOf([thinkEl("c:1", { scrollTop: 0, scrollHeight: 1400, clientHeight: 200, live: true })]);
  restoreThinkState(after, snap);
  assert.equal(after.querySelectorAll(".think-content")[0].scrollTop, 120, "a posição do leitor foi preservada");
});

test("rolagem: quem estava no fim continua acompanhando o texto novo", () => {
  const before = boxOf([thinkEl("c:1", { scrollTop: 800, scrollHeight: 1000, clientHeight: 200 })]); // 0 px do fim
  const snap = captureThinkState(before);
  const after = boxOf([thinkEl("c:1", { scrollTop: 0, scrollHeight: 1600, clientHeight: 200, live: true })]);
  restoreThinkState(after, snap);
  assert.equal(after.querySelectorAll(".think-content")[0].scrollTop, 1600, "foi para o novo fim");
});

test("rolagem: bloco novo em geração começa no fim; bloco concluído começa no topo", () => {
  const snap = captureThinkState(boxOf([]));
  const after = boxOf([thinkEl("novo:2", { scrollHeight: 900, live: true }), thinkEl("novo:0", { scrollHeight: 900, live: false })]);
  restoreThinkState(after, snap);
  const [liveEl, doneEl] = after.querySelectorAll(".think-content");
  assert.equal(liveEl.scrollTop, 900);
  assert.equal(doneEl.scrollTop, 0);
});

test("rolagem: cada bloco tem a sua posição (vários turnos e comparação de motores)", () => {
  const snap = captureThinkState(boxOf([
    thinkEl("c:1", { scrollTop: 50, scrollHeight: 1000 }),
    thinkEl("c:3:gemini", { scrollTop: 300, scrollHeight: 1000 }),
  ]));
  const after = boxOf([thinkEl("c:1", { scrollHeight: 1200 }), thinkEl("c:3:gemini", { scrollHeight: 1200 })]);
  restoreThinkState(after, snap);
  const [a, b] = after.querySelectorAll(".think-content");
  assert.equal(a.scrollTop, 50);
  assert.equal(b.scrollTop, 300);
});

test("escolha do usuário: fechar durante a geração não reabre no próximo trecho", () => {
  /** @type {any} */ let handler = null;
  installThinkHandlers({ addEventListener: (/** @type {string} */ _t, /** @type {any} */ fn) => { handler = fn; } });
  const details = { open: true, dataset: { thinkKey: "c:4" } };
  const summary = { parentElement: details };
  handler({ target: { closest: (/** @type {string} */ s) => (s === ".chat-thinking summary" ? summary : null) } });
  // o usuário clicou no resumo de um bloco aberto: quer fechado
  assert.doesNotMatch(thinkingHtml("c:4", "texto", { streaming: true, hasAnswer: false }), /<details[^>]* open>/);
  // e o oposto: bloco fechado que ele abriu continua aberto mesmo com a resposta já em andamento
  const closed = { open: false, dataset: { thinkKey: "c:5" } };
  handler({ target: { closest: (/** @type {string} */ s) => (s === ".chat-thinking summary" ? { parentElement: closed } : null) } });
  assert.match(thinkingHtml("c:5", "texto", { streaming: true, hasAnswer: true }), /<details[^>]* open>/);
});

test("expandir: alterna a altura total e o html seguinte já nasce expandido", () => {
  /** @type {any} */ let handler = null;
  installThinkHandlers({ addEventListener: (/** @type {string} */ _t, /** @type {any} */ fn) => { handler = fn; } });
  const classes = new Set();
  const content = { classList: { toggle: (/** @type {string} */ c, /** @type {boolean} */ on) => (on ? classes.add(c) : classes.delete(c)) }, textContent: "x" };
  const icon = { setAttribute: () => {} };
  const details = { dataset: { thinkKey: "c:6" }, querySelector: () => content };
  const btn = { dataset: { thinkAct: "expand" }, closest: () => details, querySelector: () => icon, title: "" };
  handler({ target: { closest: (/** @type {string} */ s) => (s === "[data-think-act]" ? btn : null) } });
  assert.ok(classes.has("expanded"));
  assert.match(thinkingHtml("c:6", "texto"), /think-content expanded/);
  handler({ target: { closest: (/** @type {string} */ s) => (s === "[data-think-act]" ? btn : null) } });
  assert.ok(!classes.has("expanded"));
  assert.doesNotMatch(thinkingHtml("c:6", "texto"), /think-content expanded/);
});
