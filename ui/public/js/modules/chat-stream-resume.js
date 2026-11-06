// @ts-check
// Reads a chat SSE stream and survives the connection dropping (phone locks, app switch, network change).
// The server keeps the run alive and numbers every event (`seq`); on a drop or when the tab becomes visible
// again this reattaches with GET /api/chat/attach?from=<next seq> and skips events it already handled.
// The user's stop button (outer signal) tells the server to abort the engine, because a dropped
// connection no longer does.

const MAX_REATTACH = 40;
const RETRY_BASE_MS = 800;
const RETRY_MAX_MS = 6000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** @param {string} runId */
function sendStop(runId) {
  try {
    void fetch("/api/chat/stop", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ runId }),
      keepalive: true,
    }).catch(() => {});
  } catch {}
}

/** Waits until the page can reach the network again (visible and online). */
async function waitUntilActive(signal) {
  while (!signal.aborted && ((typeof document !== "undefined" && document.hidden) || (typeof navigator !== "undefined" && navigator.onLine === false))) {
    await sleep(500);
  }
}

/**
 * @param {{
 *   response: Response,
 *   signal: AbortSignal,
 *   onEvent: (data: any) => void,
 *   onReattach?: (attempt: number) => void,
 * }} p  `response` is the first POST /api/chat response (already ok).
 */
export async function consumeChatStream({ response, signal, onEvent, onReattach }) {
  let runId = "";
  let nextSeq = 0;
  let terminal = false;
  let current = response;
  /** @type {AbortController | null} */
  let link = null;

  const onUserAbort = () => { if (runId) sendStop(runId); link?.abort(); };
  signal.addEventListener("abort", onUserAbort, { once: true });
  // Coming back to the tab: the old reader may be a zombie that never errors. Drop it and reattach.
  const onVisible = () => { if (!document.hidden && runId && !terminal) link?.abort(); };
  document.addEventListener("visibilitychange", onVisible);

  /** @param {Response} res */
  async function pump(res, cut) {
    const reader = res.body.getReader();
    cut.addEventListener("abort", () => { reader.cancel().catch(() => {}); }, { once: true });
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) return;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = /** @type {string} */ (lines.pop());
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const jsonStr = line.slice(6).trim();
        if (!jsonStr) continue;
        let data;
        try { data = JSON.parse(jsonStr); } catch { continue; }
        if (typeof data.seq === "number") {
          if (data.seq < nextSeq) continue;
          nextSeq = data.seq + 1;
        }
        if (data.type === "run" && data.runId) { runId = data.runId; continue; }
        if (data.type === "done" || data.type === "error") terminal = true;
        onEvent(data);
      }
    }
  }

  try {
    let attempt = 0;
    while (true) {
      link = new AbortController();
      // Aborting `link` cancels the reader (visibility return); the first fetch is also tied to the caller's signal.
      try {
        if (current) await pump(current, link.signal);
      } catch (err) {
        if (signal.aborted) throw err;
        // Anything else (network drop, our own visibility abort) falls through to a reattach.
      }
      if (signal.aborted) throw Object.assign(new Error("aborted"), { name: "AbortError" });
      if (terminal) return;
      if (!runId || attempt >= MAX_REATTACH) {
        throw new Error("A conexão com o servidor caiu antes do fim da resposta.");
      }
      attempt += 1;
      onReattach?.(attempt);
      await waitUntilActive(signal);
      await sleep(Math.min(RETRY_BASE_MS * attempt, RETRY_MAX_MS));
      if (signal.aborted) throw Object.assign(new Error("aborted"), { name: "AbortError" });
      try {
        const res = await fetch(`/api/chat/attach?runId=${encodeURIComponent(runId)}&from=${nextSeq}`, { signal: link.signal });
        if (res.status === 404) throw Object.assign(new Error("A execução expirou no servidor. Envie a mensagem de novo."), { fatal: true });
        if (!res.ok || !res.body) { current = null; continue; }
        current = res;
      } catch (err) {
        current = null;
        if (/** @type {any} */ (err)?.fatal) throw err;
        if (signal.aborted) throw err;
      }
    }
  } finally {
    signal.removeEventListener("abort", onUserAbort);
    document.removeEventListener("visibilitychange", onVisible);
  }
}
