// Debounced autosave scheduler. Pure: timers and the save call are injected, so it is tested without a DOM.
// States: idle (nothing pending) -> dirty (waiting for the debounce) -> saving -> saved | error | conflict.
// A change that arrives while saving triggers one more save afterwards. Conflict stops all saving until `resume`.

export type SaveState = "idle" | "dirty" | "saving" | "saved" | "error" | "conflict";

export interface AutosaveDeps {
  delayMs: number;
  /** Saves the latest snapshot. Throw to signal failure; set `conflict` on the error for a 409. */
  save: () => Promise<void>;
  isConflict: (error: unknown) => boolean;
  onState: (state: SaveState, error?: unknown) => void;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

export interface Autosave {
  /** Call on every content change. */
  touch(): void;
  /** Saves now (skips the debounce) and resolves when the queue is empty. */
  flush(): Promise<void>;
  /** Leaves the conflict state after the caller reloaded or chose to retry. */
  resume(): void;
  dispose(): void;
  state(): SaveState;
}

export function createAutosave(deps: AutosaveDeps): Autosave {
  const setTimer = deps.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = deps.clearTimer ?? ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>));
  let current: SaveState = "idle";
  let timer: unknown = null;
  let dirty = false;
  let running: Promise<void> | null = null;
  let disposed = false;

  function emit(next: SaveState, error?: unknown) {
    current = next;
    if (!disposed) deps.onState(next, error);
  }

  function cancelTimer() {
    if (timer !== null) clearTimer(timer);
    timer = null;
  }

  async function run(): Promise<void> {
    while (dirty && current !== "conflict" && !disposed) {
      dirty = false;
      emit("saving");
      try {
        await deps.save();
      } catch (error) {
        dirty = true;
        emit(deps.isConflict(error) ? "conflict" : "error", error);
        return;
      }
      if (!dirty) emit("saved");
    }
  }

  function start(): Promise<void> {
    if (!running) {
      running = run().finally(() => {
        running = null;
      });
    }
    return running;
  }

  return {
    touch() {
      if (disposed || current === "conflict") return;
      dirty = true;
      cancelTimer();
      if (current !== "saving") emit("dirty");
      timer = setTimer(() => {
        timer = null;
        void start();
      }, deps.delayMs);
    },
    async flush() {
      cancelTimer();
      if (running) await running;
      if (dirty && current !== "conflict") await start();
    },
    resume() {
      if (current !== "conflict") return;
      dirty = false;
      emit("idle");
    },
    dispose() {
      disposed = true;
      cancelTimer();
    },
    state: () => current,
  };
}
