// @ts-check
// Varias abas: aviso so quando duas abas seguram o MESMO chat, e a gravacao das sessoes nao apaga a da outra aba.
import test from "node:test";
import assert from "node:assert/strict";

const store = new Map();
globalThis.localStorage = /** @type {any} */ ({
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
});

const { createChatPresence } = await import("../ui/public/js/modules/chat-tabs.js");

/** Barramento em memoria: cada canal entrega aos demais, como o BroadcastChannel. */
function bus() {
  const channels = [];
  return () => {
    const channel = {
      onmessage: null,
      postMessage(message) {
        for (const other of channels) if (other !== channel) other.onmessage?.({ data: message });
      },
    };
    channels.push(channel);
    return channel;
  };
}

function tab(open, id) {
  const events = [];
  const presence = createChatPresence({ channel: open(), tabId: id, onChange: (c) => events.push(c) });
  return { presence, events };
}

test("mesmo chat em duas abas avisa as duas; chats diferentes ficam em silencio", () => {
  const open = bus();
  const a = tab(open, "a");
  const b = tab(open, "b");
  a.presence.claim("p::design:canvas-mindmap:m1");
  b.presence.claim("p::design:canvas-mindmap:m2");
  assert.equal(a.presence.hasConflict(), false);
  assert.equal(b.presence.hasConflict(), false);

  b.presence.claim("p::design:canvas-mindmap:m1"); // b abre o mesmo mapa
  assert.equal(a.presence.hasConflict(), true);
  assert.equal(b.presence.hasConflict(), true);
  assert.deepEqual(a.events, [true]);
});

test("sair do chat ou trocar de artefato desfaz o aviso", () => {
  const open = bus();
  const a = tab(open, "a");
  const b = tab(open, "b");
  a.presence.claim("k");
  b.presence.claim("k");
  b.presence.claim("outro");
  assert.equal(a.presence.hasConflict(), false);
  assert.deepEqual(a.events, [true, false]);
  b.presence.claim("k");
  a.presence.release();
  assert.equal(b.presence.hasConflict(), false);
});

test("sem BroadcastChannel nada quebra", () => {
  const solo = createChatPresence({ channel: null, tabId: "x" });
  solo.claim("k");
  assert.equal(solo.hasConflict(), false);
});

test("duas abas gravando sessoes de chats diferentes nao se apagam", async () => {
  const tabA = await import("../ui/public/js/modules/chat-session-store.js?tab=a");
  const tabB = await import("../ui/public/js/modules/chat-session-store.js?tab=b");
  tabA.getEngineSession("p", null, "claude"); // as duas abas hidratam antes de qualquer gravacao
  tabB.getEngineSession("p", null, "claude");
  tabA.setEngineSession("p", "chat-a.md", "claude", "ses_a");
  tabB.setEngineSession("p", "chat-b.md", "claude", "ses_b");
  const saved = JSON.parse(store.get("harness:engine-sessions:v1"));
  assert.equal(saved["p::chat-a.md"].claude, "ses_a", "a gravacao da aba B manteve a sessao da aba A");
  assert.equal(saved["p::chat-b.md"].claude, "ses_b");
});
