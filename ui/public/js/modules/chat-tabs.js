// @ts-check
// Presence of the active chat across browser tabs. Tabs never block each other: when two tabs hold the same chat they
// only learn about it (so the UI can warn). Different artifacts or features have different chat keys and stay silent.

const CHANNEL_NAME = "harness:chat-presence";

/**
 * @typedef {{ type: "claim" | "here" | "release", tabId: string, key: string }} PresenceMessage
 * @typedef {{ postMessage(message: PresenceMessage): void, close?(): void, onmessage: ((event: { data: PresenceMessage }) => void) | null }} PresenceChannel
 */

/**
 * @param {{ channel: PresenceChannel | null, tabId: string, onChange?: (conflict: boolean) => void }} options
 */
export function createChatPresence({ channel, tabId, onChange = () => {} }) {
  let myKey = "";
  /** @type {Set<string>} */
  const others = new Set();
  let announced = false;

  const post = (/** @type {PresenceMessage["type"]} */ type, key = myKey) => channel?.postMessage({ type, tabId, key });
  const notify = () => {
    const conflict = others.size > 0;
    if (conflict !== announced) {
      announced = conflict;
      onChange(conflict);
    }
  };

  if (channel) {
    channel.onmessage = ({ data }) => {
      if (!data || data.tabId === tabId) return;
      if (data.type === "release") {
        others.delete(data.tabId);
      } else if (myKey && data.key === myKey) {
        others.add(data.tabId);
        if (data.type === "claim") post("here");
      } else {
        others.delete(data.tabId); // that tab moved to another chat
      }
      notify();
    };
  }

  return {
    /** This tab now holds `key` (a no-op when it already did). @param {string} key */
    claim(key) {
      if (key === myKey) return;
      if (myKey) post("release");
      myKey = key;
      others.clear();
      notify();
      post("claim");
    },
    release() {
      if (myKey) post("release");
      myKey = "";
      others.clear();
      notify();
    },
    hasConflict: () => others.size > 0,
  };
}

/** @returns {PresenceChannel | null} */
function openChannel() {
  try {
    if (typeof BroadcastChannel !== "function") return null;
    const channel = /** @type {any} */ (new BroadcastChannel(CHANNEL_NAME));
    channel.unref?.(); // Node only: an idle presence channel must not keep a process alive
    return channel;
  } catch {
    return null;
  }
}

export const CHAT_CONFLICT_MESSAGE = "Este chat também está aberto em outra aba. Enviar nas duas pode sobrescrever a conversa.";

/** @type {ReturnType<typeof createChatPresence> | null} */
let shared = null;

/** Lazy per-page presence; the toast is injected so this module stays free of DOM imports. @param {(message: string) => void} [warn] */
export function chatPresence(warn) {
  if (!shared) {
    const tabId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    shared = createChatPresence({ channel: openChannel(), tabId, onChange: (conflict) => conflict && warn?.(CHAT_CONFLICT_MESSAGE) });
    if (typeof window !== "undefined") window.addEventListener("pagehide", () => shared?.release());
  }
  return shared;
}
