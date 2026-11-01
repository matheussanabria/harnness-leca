// @ts-check
// Testes — Fila de atenção unificada e notificações (EP-09.05).

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const ROOT = path.resolve(".");
const QUEUE_SERVICE = require("../ui/server/services/attention-queue.service");
const NOTIFIER_PATH = path.join(ROOT, "ui", "public", "js", "modules", "attention-notifier.js");

async function loadNotifier() {
  return import(pathToFileURL(NOTIFIER_PATH).href);
}

test("RF2: Ordenação por severidade (high > medium > low), prazo e idade", () => {
  const items = [
    { id: "1", severity: "low", openedAt: "2026-10-21T10:00:00Z" },
    { id: "2", severity: "high", openedAt: "2026-10-21T12:00:00Z" },
    { id: "3", severity: "medium", deadline: "2026-10-21T15:00:00Z", openedAt: "2026-10-21T11:00:00Z" },
    { id: "4", severity: "high", deadline: "2026-10-21T14:00:00Z", openedAt: "2026-10-21T13:00:00Z" },
  ];

  items.sort(QUEUE_SERVICE.compareAttentionItems);

  // '4' e '2' são high; '4' tem deadline então vem primeiro que '2'
  assert.equal(items[0].id, "4");
  assert.equal(items[1].id, "2");
  // '3' é medium
  assert.equal(items[2].id, "3");
  // '1' é low
  assert.equal(items[3].id, "1");
});

test("RF6, RF7: Notificador só avisa item novo, relevante (high/medium) e não reconhecido", async () => {
  const { shouldNotifyItem, getSeverityMeta, renderNotificationToast } = await loadNotifier();

  const highOpen = { id: "item-1", severity: "high", state: "open", title: "Aprovação pendente", origin: "approval" };
  const lowOpen = { id: "item-2", severity: "low", state: "open", title: "Aviso menor", origin: "session" };
  const highAck = { id: "item-3", severity: "high", state: "acknowledged", title: "Já visto", origin: "execution" };

  assert.equal(shouldNotifyItem(highOpen, new Set()), true, "Item high open deve ser notificado");
  assert.equal(shouldNotifyItem(lowOpen, new Set()), false, "Item low não deve gerar notificação intrusiva");
  assert.equal(shouldNotifyItem(highAck, new Set()), false, "Item já reconhecido não deve ser renotificado");

  const already = new Set(["item-1"]);
  assert.equal(shouldNotifyItem(highOpen, already), false, "Item já notificado não se repete");

  // Metadados de severidade: texto + ícone, nunca só cor
  const meta = getSeverityMeta("high");
  assert.equal(meta.icon, "fa-triangle-exclamation");
  assert.ok(meta.label.includes("Alta severidade"));

  // Toast com aria-live
  const html = renderNotificationToast(highOpen);
  assert.ok(html.includes('aria-live="polite"'));
  assert.ok(html.includes("fa-triangle-exclamation"));
  assert.ok(!/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}]/u.test(html), "Zero emojis");
});
