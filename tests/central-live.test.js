// @ts-check
// Testes — Assinatura SSE da Central de Sessões e indicador de status (EP-09.04, RF7 e RF8).

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const ROOT = path.resolve(".");
const LIVE_PATH = path.join(ROOT, "ui", "public", "js", "modules", "central-live.js");

class FakeEventSource {
  constructor(url) {
    this.url = url;
    this.readyState = 0;
    this.listeners = new Map();
    FakeEventSource.lastInstance = this;
    setTimeout(() => {
      this.readyState = 1;
      if (this.onopen) this.onopen();
    }, 10);
  }

  addEventListener(type, cb) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(cb);
  }

  emit(type, data, lastEventId) {
    const event = { data: JSON.stringify(data), lastEventId };
    if (type === "message" && this.onmessage) this.onmessage(event);
    const list = this.listeners.get(type) || [];
    for (const cb of list) cb(event);
  }

  emitError() {
    if (this.onerror) this.onerror(new Error("Network broken"));
  }

  close() {
    this.readyState = 2;
    this.closed = true;
  }
}

async function loadLiveModule() {
  return import(pathToFileURL(LIVE_PATH).href);
}

test("RF7: Assinatura SSE conecta e repassa eventos atualizando o cursor", async () => {
  const { createCentralLiveSubscription } = await loadLiveModule();

  const receivedEvents = [];
  let currentStatus = null;

  const sub = createCentralLiveSubscription({
    slug: "saude-dispensacao",
    eventSourceImpl: FakeEventSource,
    onEvent: (evt) => receivedEvents.push(evt),
    onStatusChange: (status) => {
      currentStatus = status;
    },
  });

  sub.connect();
  assert.equal(sub.getStatus().state, "connecting");

  // Aguarda onopen
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(sub.getStatus().state, "connected");

  // Simula evento chegando pelo stream
  FakeEventSource.lastInstance.emit("session.updated", { cursor: "105", id: "evt-1", type: "session.updated" }, "105");

  assert.equal(receivedEvents.length, 1);
  assert.equal(receivedEvents[0].id, "evt-1");
  assert.equal(sub.getCursor(), "105");
  assert.ok(sub.getStatus().lastUpdatedAt, "lastUpdatedAt deve ser preenchido");

  sub.disconnect();
  assert.equal(sub.getStatus().state, "disconnected");
});

test("RF8: Indicador de status exibe conectado, conectando e desconectado com timestamp", async () => {
  const { renderLiveStatusBadge } = await loadLiveModule();

  const connectedHtml = renderLiveStatusBadge({
    state: "connected",
    cursor: "42",
    lastUpdatedAt: "2026-10-26T14:00:00.000Z",
    retryCount: 0,
  });
  assert.ok(connectedHtml.includes("central-live-badge--connected"));
  assert.ok(connectedHtml.includes("Ao vivo"));
  assert.ok(!/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}]/u.test(connectedHtml), "Sem emojis");

  const disconnectedHtml = renderLiveStatusBadge({
    state: "disconnected",
    cursor: "42",
    lastUpdatedAt: "2026-10-26T14:15:30.000Z",
    retryCount: 2,
  });
  assert.ok(disconnectedHtml.includes("central-live-badge--disconnected"));
  assert.ok(disconnectedHtml.includes("Desconectado"));
  assert.ok(disconnectedHtml.includes("fa-circle-exclamation"));
  assert.ok(!/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}]/u.test(disconnectedHtml), "Sem emojis");
});
